"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {apiIrSend,validateBoundIdentity,assertPrivateOtpEnvironment,
 requestOwnerRecoveryOtp,verifyOwnerRecoveryOtp}=require("../ops/national-root-recovery-real-smsotp.cjs");
const {kinds,signingBytes,verifyOwnerRecoveryEvidence}=require("../ops/national-root-signed-recovery-evidence.cjs");
const ROOT="a1111111-1111-4111-8111-111111111111",
 REVIEWER="a2222222-2222-4222-8222-222222222222",NONCE="a3333333-3333-4333-8333-333333333333";
const issuer=crypto.generateKeyPairSync("ed25519"),reviewer=crypto.generateKeyPairSync("ed25519");
const trust={
 otpVerifierPublicKeyPem:issuer.publicKey.export({format:"pem",type:"spki"}),
 reviewerPublicKeyPem:reviewer.publicKey.export({format:"pem",type:"spki"})
};
const calcId=x=>{
 const rem=[...x].reduce((s,d,i)=>s+Number(d)*(10-i),0)%11;
 return x+(rem<2?rem:11-rem);
};
const ID=calcId("001234567"),MOBILE="09120000001",NOW=Date.now();
const env={TTO_RECOVERY_OTP_CHALLENGE_SECRET:"c".repeat(40),TTO_RECOVERY_IDENTITY_HMAC_SECRET:"i".repeat(40),
 APIIR_TOKEN:"TEST-ONLY-TOKEN-NOT-REAL",TTO_RECOVERY_OTP_ISSUER_PRIVATE_KEY_PEM:issuer.privateKey.export({format:"pem",type:"pkcs8"})};
const bound={rootUserId:ROOT,expectedVersion:"4",nonce:NONCE,nationalId:ID,mobile:MOBILE};
function fakeDb(){
 const state={issued:null,delivered:false,consumed:false,rows:[],otp:null};
 return {state,async query(sql,args){
  state.rows.push({shape:sql.split("(")[0].slice(0,65),argCount:args?.length});
  if(sql.includes("begin_national_root_recovery_smsotp")){
   state.issued={root:args[0],version:String(args[1]),challenge:args[2],nonce:args[3],mobileHash:args[4],nationalHash:args[5],otpHash:args[6]};
   return {rowCount:1,rows:[{created:true}]};
  }
  if(sql.includes("complete_smsotp_delivery")){
   state.delivered=args[1]===true;return {rowCount:1,rows:[{recorded:true}]};
  }
  if(sql.includes("consume_national_root_recovery_smsotp")){
   const s=state.issued;
   if(!s||!state.delivered||state.consumed||args[0]!==s.challenge||
      !crypto.timingSafeEqual(args[1],s.otpHash)||
      !crypto.timingSafeEqual(args[2],s.mobileHash)||
      !crypto.timingSafeEqual(args[3],s.nationalHash))return {rowCount:0,rows:[]};
   state.consumed=true;
   return {rowCount:1,rows:[{root_user_id:s.root,root_credentials_version:s.version,recovery_nonce:s.nonce,verified_at:new Date(NOW).toISOString()}]};
  }
  throw Error("unexpected SQL");
 }};
}
test("API.ir payload uses existing authorized SMSOTP transport, not fake success",async()=>{
 const r=await apiIrSend(MOBILE,"654321","provider-token-test",async(url,opts)=>{
  assert.equal(url,"https://s.api.ir/api/sw1/SmsOTP");
  assert.equal(opts.method,"POST");
  assert.equal(opts.headers.Authorization,"Bearer provider-token-test");
  assert.deepEqual(JSON.parse(opts.body),{code:"654321",mobile:MOBILE,template:1});
  return {ok:true,json:async()=>({success:true,data:true})};
 });
 assert.equal(r,true);
 assert.equal(await apiIrSend(MOBILE,"654321","token",async()=>({ok:true,json:async()=>({success:true,data:false})})),false);
 assert.equal(await apiIrSend(MOBILE,"654321","token",async()=>{throw Error("network");}),false);
});
test("owner request is a real OTP challenge with no root session or credential mutation",async()=>{
 const db=fakeDb();let code;
 const created=await requestOwnerRecoveryOtp(db,bound,env,async(m,c)=>{
  assert.equal(m,MOBILE);code=c;return true;
 },NOW);
 assert.match(code,/^[0-9]{6}$/);
 assert.equal(db.state.delivered,true);
 assert.equal(created.nonce,NONCE);
 assert.equal(db.state.rows.some(x=>x.shape.includes("UPDATE tto.national_root_accounts")),false);
 assert.equal(db.state.rows.some(x=>x.shape.includes("user_sessions")),false);
});
test("verified SMS code yields Ed25519 OTP receipt bound to root and independently signed approval",async()=>{
 const db=fakeDb();let code;
 const created=await requestOwnerRecoveryOtp(db,bound,env,async(_,otp)=>{code=otp;return true;},NOW);
 const receipt=await verifyOwnerRecoveryOtp(db,{...bound,challengeId:created.challengeId,otp:code},env,NOW);
 assert.equal(receipt.mobile,MOBILE);
 assert.equal(receipt.rootUserId,ROOT);
 assert.equal(receipt.kind,kinds.otp);
 assert.equal(receipt.challengeId,created.challengeId);
 const review={
  kind:kinds.approval,rootUserId:ROOT,expectedVersion:"4",nationalId:ID,mobile:MOBILE,
  challengeId:created.challengeId,nonce:NONCE,reviewerUserId:REVIEWER,
  mandateRef:"TEST-MANDATE-ISOLATED-ONLY",reviewedAt:new Date(NOW-3000).toISOString(),
  issuedAt:new Date(NOW-10000).toISOString(),expiresAt:new Date(NOW+60000).toISOString()
 };
 const signed={...review,signature:crypto.sign(null,signingBytes("approval",review),reviewer.privateKey).toString("base64")};
 assert.deepEqual(verifyOwnerRecoveryEvidence({expectedRootUserId:ROOT,expectedRootVersion:"4",otp:receipt,approval:signed},trust,NOW),
  {status:"SIGNED_EVIDENCE_CHECKED_PREVIEW_ONLY",blockers:[]});
});
test("replayed verification or changed mobile cannot yield a second signed receipt",async()=>{
 const db=fakeDb();let code;
 const c=await requestOwnerRecoveryOtp(db,bound,env,async(_,otp)=>{code=otp;return true;},NOW);
 const v={...bound,challengeId:c.challengeId,otp:code};
 await verifyOwnerRecoveryOtp(db,v,env,NOW);
 await assert.rejects(verifyOwnerRecoveryOtp(db,v,env,NOW),/INVALID_EXPIRED_OR_CONSUMED/);
});
test("wrong OTP, national ID and mobile are rejected by server hash binding",async()=>{
 const db=fakeDb();let code;
 const c=await requestOwnerRecoveryOtp(db,bound,env,async(_,otp)=>{code=otp;return true;},NOW);
 await assert.rejects(verifyOwnerRecoveryOtp(db,{...bound,challengeId:c.challengeId,otp:code==="000000"?"000001":"000000"},env,NOW));
 await assert.rejects(verifyOwnerRecoveryOtp(db,{...bound,challengeId:c.challengeId,otp:code,nationalId:calcId("001234568")},env,NOW));
 await assert.rejects(verifyOwnerRecoveryOtp(db,{...bound,challengeId:c.challengeId,otp:code,mobile:"09120000002"},env,NOW));
});
test("failed SMS transport never provides a verified receipt",async()=>{
 const db=fakeDb();
 await assert.rejects(requestOwnerRecoveryOtp(db,bound,env,async()=>false,NOW),/SMSOTP_DELIVERY_FAILED/);
 assert.equal(db.state.delivered,false);
});
test("operator-only Preview environment blocks CI, Vercel, production and wrong project",()=>{
 const src={...env,TTO_ISOLATED_DEMO_DB:"true",TTO_ENVIRONMENT:"preview",TTO_PREVIEW_NATIONAL_ROOT_RECOVERY_SMSOTP:"operator-approved",
  TTO_ENABLE_REAL_SMSOTP_DELIVERY:"true",TTO_PREVIEW_DB_PROJECT_REF:"zkfwsgrgslxxlusxrwce",
  TTO_PREVIEW_APPROVED_DB_HOST:"db.zkfwsgrgslxxlusxrwce.supabase.co",
  TTO_PREVIEW_DB_SSL:"required",TTO_PREVIEW_DATABASE_URL:"postgresql://operator@db.zkfwsgrgslxxlusxrwce.supabase.co:5432/postgres"};
 assert.equal(assertPrivateOtpEnvironment(src,["node","cli","--request"]).connectionString.startsWith("postgresql://"),true);
 assert.equal(assertPrivateOtpEnvironment(src,["node","cli","--verify"]).connectionString.startsWith("postgresql://"),true);
 for(const patch of [{CI:"true"},{VERCEL:"1"},{TTO_ENVIRONMENT:"production"},{TTO_PREVIEW_DB_SSL:"disable"},
  {TTO_PREVIEW_DB_PROJECT_REF:"aaaaaaaaaaaaaaaaaaaa"},{TTO_ENABLE_REAL_SMSOTP_DELIVERY:"false"}]){
  assert.throws(()=>assertPrivateOtpEnvironment({...src,...patch},["node","cli","--request"]));
 }
});
test("wrong ID format or wrong root UUID is always rejected before sending",()=>{
 for(const patch of [{nationalId:"1234567890"},{mobile:"989120000001"},{rootUserId:REVIEWER.slice(1)}])
  assert.throws(()=>validateBoundIdentity({...bound,...patch}));
});
