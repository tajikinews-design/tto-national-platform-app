"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const os=require("node:os");
const fs=require("node:fs/promises");
const path=require("node:path");
const {KIND,PROJECT,authorityApprovalBytes,verifyTrustCertificate}=require("../ops/national-root-recovery-trust-ceremony.cjs");
const {pinsFromEnv,loadValidatedTrustCertificate,privateWrite}=require("../ops/national-root-recovery-trust-register.cjs");
const {reviewerKeyMatchesCert,createIndependentApproval}=require("../ops/national-root-recovery-independent-review.cjs");
const {validateIssuerPrivateKeyMatchesCert,requirePrivateTerminal,getExistingRoot,runPrivateIntake}
 =require("../ops/national-root-recovery-private-intake.cjs");
const {readApprovedPrivateReceipts}=require("../ops/national-root-recovery-private-complete.cjs");
const {kinds,signingBytes,verifyOwnerRecoveryEvidence}=require("../ops/national-root-signed-recovery-evidence.cjs");
const NOW=Date.now(),p=()=>crypto.generateKeyPairSync("ed25519");
const [issuer,reviewer,g1,g2]=[p(),p(),p(),p()];
const pem=k=>k.publicKey.export({type:"spki",format:"pem"});
const priv=k=>k.privateKey.export({type:"pkcs8",format:"pem"});
const root="a1111111-1111-4111-8111-111111111111",
 reviewerId="a2222222-2222-4222-8222-222222222222",
 auth1="a3333333-3333-4333-8333-333333333333",
 auth2="a4444444-4444-4444-8444-444444444444";
const national="0012345679",mobile="09120000001";
const anchors={TTO_RECOVERY_AUTHORITY_ONE_PUBLIC_KEY_PEM:pem(g1),
 TTO_RECOVERY_AUTHORITY_TWO_PUBLIC_KEY_PEM:pem(g2)};
function certificate(){
 const cert={kind:KIND,projectRef:PROJECT,environment:"preview",rootUserId:root,
  reviewerUserId:reviewerId,mandateRef:"CI-MANDATE-ONLY-20261112",
  otpIssuerPublicKeyPem:pem(issuer),reviewerPublicKeyPem:pem(reviewer),
  validFrom:new Date(NOW-60000).toISOString(),expiresAt:new Date(NOW+600000).toISOString(),
  ceremonyRef:"CI-TRUST-CEREMONY-20261112"};
 cert.approvals=[
  {role:"AUTHORITY_ONE",authorityUserId:auth1,
   signature:crypto.sign(null,authorityApprovalBytes(cert,"AUTHORITY_ONE",auth1),g1.privateKey).toString("base64")},
  {role:"AUTHORITY_TWO",authorityUserId:auth2,
   signature:crypto.sign(null,authorityApprovalBytes(cert,"AUTHORITY_TWO",auth2),g2.privateKey).toString("base64")}
 ];
 return cert;
}
const certificateEnv=(folder)=>({
 ...anchors,TTO_ENVIRONMENT:"preview",TTO_ISOLATED_DEMO_DB:"true",
 TTO_PREVIEW_NATIONAL_ROOT_RECOVERY:"operator-approved",
 TTO_RECOVERY_IDENTITY_HMAC_SECRET:"test-private-identity-binding-shared-secret-20261112",
 TTO_RECOVERY_PRIVATE_TRUST_PATH:path.join(folder,"trust.json"),
 TTO_RECOVERY_PRIVATE_OTP_RECEIPT_PATH:path.join(folder,"owner-otp.json"),
 TTO_RECOVERY_PRIVATE_APPROVAL_PATH:path.join(folder,"reviewer-approval.json"),
 TTO_PREVIEW_DATABASE_URL:"postgresql://operator@db.zkfwsgrgslxxlusxrwce.supabase.co:5432/postgres",
 TTO_PREVIEW_APPROVED_DB_HOST:"db.zkfwsgrgslxxlusxrwce.supabase.co",
 TTO_PREVIEW_DB_PROJECT_REF:"zkfwsgrgslxxlusxrwce",
 TTO_PREVIEW_DB_SSL:"required"
});
const signedOtp=(now=NOW)=>{
 const data={kind:kinds.otp,rootUserId:root,expectedVersion:"4",
  nationalId:national,mobile,challengeId:"a5555555-5555-4555-8555-555555555555",
  nonce:"a6666666-6666-4666-8666-666666666666",
  verifiedAt:new Date(now-7000).toISOString(),
  issuedAt:new Date(now-3000).toISOString(),
  expiresAt:new Date(now+100000).toISOString()};
 return {...data,signature:crypto.sign(null,signingBytes("otp",data),issuer.privateKey).toString("base64")};
};
test("reviewer's private key cannot masquerade as issuer or another reviewer",()=>{
 const cert=certificate();
 assert.doesNotThrow(()=>reviewerKeyMatchesCert(priv(reviewer),cert));
 assert.throws(()=>reviewerKeyMatchesCert(priv(g1),cert));
 assert.doesNotThrow(()=>validateIssuerPrivateKeyMatchesCert({TTO_RECOVERY_OTP_ISSUER_PRIVATE_KEY_PEM:priv(issuer)},cert));
 assert.throws(()=>validateIssuerPrivateKeyMatchesCert({TTO_RECOVERY_OTP_ISSUER_PRIVATE_KEY_PEM:priv(reviewer)},cert));
});
test("reviewer cannot sign without explicit independent mandate review acknowledgement",()=>{
 const otp=signedOtp();
 assert.throws(()=>createIndependentApproval(otp,certificate(),reviewer.privateKey,NOW,false));
 const a=createIndependentApproval(otp,certificate(),reviewer.privateKey,NOW,true);
 assert.equal(a.reviewerUserId,reviewerId);
 assert.equal(a.mandateRef,certificate().mandateRef);
 assert.deepEqual(verifyOwnerRecoveryEvidence({expectedRootUserId:root,expectedRootVersion:"4",otp,approval:a},
  {otpVerifierPublicKeyPem:pem(issuer),reviewerPublicKeyPem:pem(reviewer)},NOW),
  {status:"SIGNED_EVIDENCE_CHECKED_PREVIEW_ONLY",blockers:[]});
});
test("expired or forged OTP receipt cannot be reviewed",()=>{
 const cert=certificate(),otp=signedOtp();
 assert.throws(()=>createIndependentApproval({...otp,mobile:"09120000002"},cert,reviewer.privateKey,NOW,true));
 assert.throws(()=>createIndependentApproval(otp,cert,reviewer.privateKey,NOW+200000,true));
});
test("private root selection must use current existing root (not create a second)",async()=>{
 const db={query:async()=>({rowCount:1,rows:[{user_id:root,version:"4"}]})};
 assert.deepEqual(await getExistingRoot(db),{rootUserId:root,expectedVersion:"4"});
 await assert.rejects(getExistingRoot({query:async()=>({rowCount:0,rows:[]})}));
 assert.throws(()=>requirePrivateTerminal({isTTY:false},{isTTY:true}));
});
test("approved trust registry private files are validated; missing approval blocks completion",async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),"tto-trust-ci-"));
 try{
  const env=certificateEnv(folder),cert=certificate();
  await privateWrite(env.TTO_RECOVERY_PRIVATE_TRUST_PATH,cert);
  assert.equal((await loadValidatedTrustCertificate(env.TTO_RECOVERY_PRIVATE_TRUST_PATH,env,NOW)).result.state,
   "VALIDATED_TRUST_CEREMONY_PREVIEW_ONLY");
  const otp=signedOtp();
  await privateWrite(env.TTO_RECOVERY_PRIVATE_OTP_RECEIPT_PATH,otp);
  await assert.rejects(readApprovedPrivateReceipts(env,NOW));
  const a=createIndependentApproval(otp,cert,reviewer.privateKey,NOW,true);
  await privateWrite(env.TTO_RECOVERY_PRIVATE_APPROVAL_PATH,a);
  const approved=await readApprovedPrivateReceipts(env,NOW);
  assert.equal(approved.input.expectedRootUserId,root);
  assert.equal(approved.input.approval.reviewerUserId,reviewerId);
  assert.equal(approved.options.identityHmacSecret,env.TTO_RECOVERY_IDENTITY_HMAC_SECRET);
  const mode=(await fs.stat(env.TTO_RECOVERY_PRIVATE_TRUST_PATH)).mode&0o777;
  if(process.platform!=="win32")assert.equal(mode,0o600);
 }finally{await fs.rm(folder,{recursive:true,force:true})}
});
test("unapproved trust anchors, wrong root or reviewer mandate cannot be used in final step",async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),"tto-hold-ci-"));
 try{
  const env=certificateEnv(folder),cert=certificate();
  await privateWrite(env.TTO_RECOVERY_PRIVATE_TRUST_PATH,cert);
  const otp=signedOtp(),a=createIndependentApproval(otp,cert,reviewer.privateKey,NOW,true);
  await privateWrite(env.TTO_RECOVERY_PRIVATE_OTP_RECEIPT_PATH,otp);
  await privateWrite(env.TTO_RECOVERY_PRIVATE_APPROVAL_PATH,a);
  await assert.rejects(readApprovedPrivateReceipts({...env,
    TTO_RECOVERY_AUTHORITY_TWO_PUBLIC_KEY_PEM:pem(p())},NOW));
  const c={...cert,reviewerUserId:auth1};
  assert.equal(verifyTrustCertificate(c,{
   authorityOnePublicKeyPem:pem(g1),authorityTwoPublicKeyPem:pem(g2)},NOW).state,"HOLD");
 }finally{await fs.rm(folder,{recursive:true,force:true})}
});

test("complete private OTP intake passes only approved trust, existing root, hidden values and genuine-code verification",async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),"tto-operator-private-"));
 try{
  const cert=certificate(),env={...certificateEnv(folder),
   TTO_RECOVERY_OTP_ISSUER_PRIVATE_KEY_PEM:priv(issuer),
   TTO_RECOVERY_OTP_CHALLENGE_SECRET:"ci-only-otp-challenge-secret-for-test-20261112",
   TTO_RECOVERY_IDENTITY_HMAC_SECRET:"ci-only-private-identity-HMAC-for-test-20261112"};
  await privateWrite(env.TTO_RECOVERY_PRIVATE_TRUST_PATH,cert);
  let secretCode,requestRecord,deliveryAccepted=false,consumed=false;
  const hash=(key,tag,val)=>crypto.createHmac("sha256",key).update(tag+":"+val).digest();
  const queries=[];
  const db={async query(sql,args=[]){
   queries.push(sql);
   if(sql.includes("FROM tto.national_root_accounts r")&&sql.includes("JOIN tto.user_accounts u"))
    return {rowCount:1,rows:[{user_id:root,version:"4"}]};
   if(sql.includes("begin_national_root_recovery_smsotp")){
    requestRecord={challengeId:args[2],nonce:args[3],mobileHash:args[4],nationalHash:args[5],otpHash:args[6]};
    return {rowCount:1,rows:[{created:true}]};
   }
   if(sql.includes("complete_smsotp_delivery")){
    deliveryAccepted=args[1]===true;return {rowCount:1,rows:[{recorded:true}]};
   }
   if(sql.includes("consume_national_root_recovery_smsotp")){
    const match=requestRecord&&deliveryAccepted&&!consumed&&
     args[0]===requestRecord.challengeId&&
     args[1].equals(requestRecord.otpHash)&&
     args[2].equals(requestRecord.mobileHash)&&
     args[3].equals(requestRecord.nationalHash);
    if(!match)return {rowCount:0,rows:[]};
    consumed=true;
    return {rowCount:1,rows:[{
     root_user_id:root,root_credentials_version:"4",
     recovery_nonce:requestRecord.nonce,verified_at:new Date(NOW).toISOString()
    }]};
   }
   throw Error("Unexpected SQL shape");
  }};
  let step=0;
  const prompts=async()=>{
   step++;
   return step===1?national:step===2?mobile:secretCode;
  };
  const result=await runPrivateIntake(db,env,prompts,()=>NOW,async(m,code)=>{
   assert.equal(m,mobile);
   secretCode=code;
   assert.match(code,/^[0-9]{6}$/);
   return true;
  });
  assert.equal(result.status,"PH12_OWNER_REAL_SMSOTP_SIGNED_RECEIPT_PRIVATE_ONLY");
  assert.equal(step,3);
  assert.equal(consumed,true);
  const receipt=JSON.parse(await fs.readFile(env.TTO_RECOVERY_PRIVATE_OTP_RECEIPT_PATH,"utf8"));
  assert.equal(receipt.rootUserId,root);
  assert.equal(receipt.nationalId,national);
  assert.equal(receipt.mobile,mobile);
  assert.equal(receipt.kind,kinds.otp);
  assert.equal(crypto.verify(null,signingBytes("otp",receipt),issuer.publicKey,
   Buffer.from(receipt.signature,"base64")),true);
  assert.equal(queries.some(q=>/INSERT INTO tto.national_root_accounts|UPDATE tto.national_root_accounts|user_sessions/i.test(q)),false);
  assert.equal(requestRecord.mobileHash.equals(hash(env.TTO_RECOVERY_IDENTITY_HMAC_SECRET,"mobile",mobile)),true);
  assert.equal(requestRecord.nationalHash.equals(hash(env.TTO_RECOVERY_IDENTITY_HMAC_SECRET,"national",national)),true);
 }finally{await fs.rm(folder,{recursive:true,force:true})}
});
