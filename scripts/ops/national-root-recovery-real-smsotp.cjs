"use strict";
/**
 * PH12 - operator-only genuine API.ir SMSOTP for the EXISTING national root.
 * This code NEVER creates a privileged identity, signs a reviewer decision,
 * changes the root password, or issues a user session.
 *
 * The approved OTP issuer's Ed25519 key is separate from the independent
 * legal reviewer key. Input + signed receipt must stay on private operator host.
 */
const crypto=require("node:crypto");
const fs=require("node:fs/promises");
const path=require("node:path");
const {createRequire}=require("node:module");
const {resolve}=require("node:path");
const {isNationalId,isMobile}=require("./national-root-owner-credentials.cjs");
const {kinds,signingBytes}=require("./national-root-signed-recovery-evidence.cjs");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION=/^(0|[1-9][0-9]{0,15})$/;
const LIMIT=2100;
const hash=(secret,label,value)=>crypto.createHmac("sha256",secret).update(label+":"+value).digest();
function validateBoundIdentity(input){
 if(!input||!UUID.test(input.rootUserId)||!UUID.test(input.nonce)||
    !VERSION.test(String(input.expectedVersion))||
    !isNationalId(input.nationalId)||!isMobile(input.mobile))
  throw Error("ROOT_RECOVERY_IDENTITY_FORMAT_INVALID");
}
function requireSecret(v){return typeof v==="string"&&Buffer.byteLength(v)>=32}
function assertPrivateOtpEnvironment(env,argv){
 if(argv.length!==3||!["--request","--verify"].includes(argv[2])||
    env.CI||env.VERCEL||env.NODE_ENV==="production"||
    env.TTO_ENVIRONMENT!=="preview"||
    env.TTO_ISOLATED_DEMO_DB!=="true"||
    env.TTO_PREVIEW_NATIONAL_ROOT_RECOVERY_SMSOTP!=="operator-approved"||
    env.TTO_ENABLE_REAL_SMSOTP_DELIVERY!=="true"||
    !requireSecret(env.TTO_RECOVERY_OTP_CHALLENGE_SECRET)||
    !requireSecret(env.TTO_RECOVERY_IDENTITY_HMAC_SECRET))
  throw Error("PRIVATE_SMSOTP_OPERATOR_GATE_CLOSED");
 const ref=env.TTO_PREVIEW_DB_PROJECT_REF,host=env.TTO_PREVIEW_APPROVED_DB_HOST;
 if(!/^[a-z0-9]{20}$/.test(ref||"")||
    host!=="db."+ref+".supabase.co"||
    env.TTO_PREVIEW_DB_SSL!=="required")
  throw Error("PRIVATE_SMSOTP_PREVIEW_DATABASE_REQUIRED");
 let u;
 try{u=new URL(env.TTO_PREVIEW_DATABASE_URL)}catch{throw Error("PRIVATE_SMSOTP_DB_URL_MISSING")}
 if(u.protocol!=="postgresql:"||u.hostname!==host)
  throw Error("PRIVATE_SMSOTP_PREVIEW_DATABASE_REQUIRED");
 if(argv[2]==="--request" &&
    (typeof env.APIIR_TOKEN!=="string"||env.APIIR_TOKEN.length<12))
  throw Error("APPROVED_APIIR_PROVIDER_TOKEN_MISSING");
 if(argv[2]==="--verify"){
  if(typeof env.TTO_RECOVERY_OTP_ISSUER_PRIVATE_KEY_PEM!=="string")
   throw Error("INDEPENDENT_OTP_ISSUER_KEY_MISSING");
  let key;
  try{key=crypto.createPrivateKey(env.TTO_RECOVERY_OTP_ISSUER_PRIVATE_KEY_PEM)}
  catch{throw Error("INDEPENDENT_OTP_ISSUER_KEY_INVALID")}
  if(key.asymmetricKeyType!=="ed25519")throw Error("INDEPENDENT_OTP_ISSUER_KEY_INVALID");
 }
 return {connectionString:u.toString()};
}
async function apiIrSend(mobile,code,token,request=fetch){
 try{
  const response=await request("https://s.api.ir/api/sw1/SmsOTP",{
   method:"POST",redirect:"error",signal:AbortSignal.timeout(8000),
   headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+token},
   body:JSON.stringify({code,mobile,template:1})
  });
  if(!response.ok)return false;
  const data=await response.json();
  return data?.success===true&&data?.data===true;
 }catch{return false}
}
async function requestOwnerRecoveryOtp(db,input,env,send=apiIrSend,now=Date.now()){
 validateBoundIdentity(input);
 const challengeId=crypto.randomUUID();
 const code=String(crypto.randomInt(100000,1000000));
 const secret=env.TTO_RECOVERY_OTP_CHALLENGE_SECRET,identity=env.TTO_RECOVERY_IDENTITY_HMAC_SECRET;
 const expires=new Date(now+60000).toISOString();
 const requested=await db.query(
  "SELECT tto.begin_national_root_recovery_smsotp($1::uuid,$2::bigint,$3::uuid,$4::uuid,$5,$6,$7,$8::timestamptz) AS created",
  [input.rootUserId,input.expectedVersion,challengeId,input.nonce,
   hash(identity,"mobile",input.mobile),hash(identity,"national",input.nationalId),
   hash(secret,"otp",challengeId+":"+code),expires]);
 if(requested.rowCount!==1||requested.rows[0]?.created!==true)
  throw Error("OWNER_RECOVERY_SMSOTP_CHALLENGE_DENIED");
 const accepted=await send(input.mobile,code,env.APIIR_TOKEN);
 const complete=await db.query("SELECT tto.complete_smsotp_delivery($1::uuid,$2::boolean) AS recorded",[challengeId,accepted]);
 if(!accepted||complete.rows[0]?.recorded!==true)
  throw Error("OWNER_RECOVERY_SMSOTP_DELIVERY_FAILED");
 return {challengeId,expiresAt:expires,nonce:input.nonce};
}
async function verifyOwnerRecoveryOtp(db,input,env,now=Date.now()){
 validateBoundIdentity(input);
 if(!UUID.test(input.challengeId)||typeof input.otp!=="string"||!/^[0-9]{6}$/.test(input.otp))
  throw Error("ROOT_RECOVERY_OTP_INPUT_INVALID");
 const secret=env.TTO_RECOVERY_OTP_CHALLENGE_SECRET,identity=env.TTO_RECOVERY_IDENTITY_HMAC_SECRET;
 const verification=await db.query(
  "SELECT root_user_id,root_credentials_version,recovery_nonce,verified_at FROM tto.consume_national_root_recovery_smsotp($1::uuid,$2,$3,$4)",
  [input.challengeId,hash(secret,"otp",input.challengeId+":"+input.otp),
   hash(identity,"mobile",input.mobile),hash(identity,"national",input.nationalId)]);
 if(verification.rowCount!==1)throw Error("OWNER_RECOVERY_OTP_INVALID_EXPIRED_OR_CONSUMED");
 const proof=verification.rows[0];
 if(proof.root_user_id!==input.rootUserId||String(proof.root_credentials_version)!==String(input.expectedVersion)||
    proof.recovery_nonce!==input.nonce)
  throw Error("ROOT_RECOVERY_OTP_DATABASE_BINDING_CONFLICT");
 const verifiedAt=new Date(proof.verified_at).toISOString();
 if(!Number.isFinite(Date.parse(verifiedAt))||Math.abs(now-Date.parse(verifiedAt))>30000)
  throw Error("ROOT_RECOVERY_OTP_VERIFICATION_STALE");
 const issuerKey=crypto.createPrivateKey(env.TTO_RECOVERY_OTP_ISSUER_PRIVATE_KEY_PEM);
 if(issuerKey.asymmetricKeyType!=="ed25519")throw Error("OTP_SIGNER_NOT_ED25519");
 const receipt={kind:kinds.otp,rootUserId:input.rootUserId,expectedVersion:String(input.expectedVersion),
   nationalId:input.nationalId,mobile:input.mobile,challengeId:input.challengeId,nonce:input.nonce,
   verifiedAt,issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+120000).toISOString()};
 return {...receipt,signature:crypto.sign(null,signingBytes("otp",receipt),issuerKey).toString("base64")};
}
async function writePrivateJson(filename,data){
 if(!path.isAbsolute(filename)||filename.startsWith(process.cwd()+path.sep)||
    filename===process.cwd())throw Error("PRIVATE_OUTPUT_OUTSIDE_REPOSITORY_REQUIRED");
 const file=await fs.open(filename,"wx",0o600);
 try{await file.writeFile(JSON.stringify(data)+"\n",{encoding:"utf8"});}
 finally{await file.close();}
}
async function readPrivateInput(){
 let source="";
 for await(const chunk of process.stdin){source+=String(chunk);if(source.length>LIMIT)throw Error("PRIVATE_INPUT_TOO_LARGE");}
 if(!source)throw Error("PRIVATE_INPUT_REQUIRED");
 return JSON.parse(source);
}
async function main(){
 let db;
 try{
  const cfg=assertPrivateOtpEnvironment(process.env,process.argv);
  const input=await readPrivateInput();
  const {Client}=createRequire(resolve(__dirname,"../../services/api/package.json"))("pg");
  db=new Client({connectionString:cfg.connectionString,ssl:{rejectUnauthorized:true}});
  await db.connect();
  const output=process.env.TTO_RECOVERY_PRIVATE_RESULT_PATH;
  if(!output)throw Error("PRIVATE_RECEIPT_OUTPUT_REQUIRED");
  const result=process.argv[2]==="--request"?
   await requestOwnerRecoveryOtp(db,input,process.env):
   await verifyOwnerRecoveryOtp(db,input,process.env);
  await writePrivateJson(output,result);
  process.stdout.write(process.argv[2]==="--request"?
   "TTO_RECOVERY_SMSOTP_REQUEST_ACCEPTED_PRIVATE_FILE_WRITTEN\n":
   "TTO_RECOVERY_SIGNED_OTP_RECEIPT_PRIVATE_FILE_WRITTEN\n");
 }catch{
  // Deliberately no mobile, national ID, OTP, provider response or stack trace.
  process.stderr.write("TTO_RECOVERY_PRIVATE_SMSOTP_HOLD_OR_FAILED\n");
  process.exitCode=1;
 }finally{if(db)await db.end().catch(()=>{});}
}
if(require.main===module)main();
module.exports={validateBoundIdentity,assertPrivateOtpEnvironment,requestOwnerRecoveryOtp,
 verifyOwnerRecoveryOtp,apiIrSend,writePrivateJson};
