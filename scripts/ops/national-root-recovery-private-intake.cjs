"use strict";
/**
 * Local TTY-only PH12 identity intake and genuine SMS OTP.
 * PII never appears in command arguments, env, logs, GitHub or browser URLs.
 * The operator's approved trust cert is checked before taking any PII.
 */
const {randomUUID,createPrivateKey,createPublicKey}=require("node:crypto");
const readline=require("node:readline");
const {createRequire}=require("node:module");
const {resolve}=require("node:path");
const fs=require("node:fs/promises");
const {isNationalId,isMobile}=require("./national-root-owner-credentials.cjs");
const {assertPrivateOtpEnvironment,requestOwnerRecoveryOtp,verifyOwnerRecoveryOtp}
 =require("./national-root-recovery-real-smsotp.cjs");
const {loadValidatedTrustCertificate,privateWrite,safePrivatePath}
 =require("./national-root-recovery-trust-register.cjs");
const {sameKey}=require("./national-root-recovery-trust-ceremony.cjs");

function requirePrivateTerminal(input=process.stdin,output=process.stdout){
 if(!input?.isTTY||!output?.isTTY||typeof input.setRawMode!=="function")
  throw Error("PRIVATE_INTERACTIVE_TTY_REQUIRED");
}
async function promptHiddenNumeric(label,length,input=process.stdin,output=process.stdout,deadlineMs=0){
 requirePrivateTerminal(input,output);
 if(!Number.isInteger(length)||length<1||length>64)throw Error("PRIVATE_PROMPT_LIMIT_INVALID");
 output.write(label+" [ورودی مخفی]: ");
 const wasRaw=!!input.isRaw;
 readline.emitKeypressEvents(input);
 input.setRawMode(true);input.resume();
 return await new Promise((resolve,reject)=>{
  let value="",ended=false,timer;
  const stop=(err)=>{
   if(ended)return;
   ended=true;
   if(timer)clearTimeout(timer);
   input.removeListener("keypress",onKey);
   input.setRawMode(wasRaw);
   output.write("\n");
   if(err)reject(err);else resolve(value);
  };
  const onKey=(str,key)=>{
   if(key?.ctrl&&key?.name==="c"){stop(Error("PRIVATE_OPERATOR_CANCELLED"));return}
   if(key?.name==="return"||key?.name==="enter"){
    if(value.length!==length){stop(Error("PRIVATE_INPUT_LENGTH_INVALID"));return}
    stop();return;
   }
   if(key?.name==="backspace"){value=value.slice(0,-1);return}
   if(typeof str==="string"&&/^[0-9]$/.test(str)&&value.length<length)value+=str;
  };
  input.on("keypress",onKey);
  if(deadlineMs>0)timer=setTimeout(()=>stop(Error("PRIVATE_SMSOTP_EXPIRED")),deadlineMs);
 });
}
function validateIssuerPrivateKeyMatchesCert(env,cert){
 const key=createPrivateKey(env.TTO_RECOVERY_OTP_ISSUER_PRIVATE_KEY_PEM||"");
 if(key.asymmetricKeyType!=="ed25519")throw Error("OTP_ISSUER_SIGNING_KEY_INVALID");
 const pk=createPublicKey(key).export({type:"spki",format:"pem"});
 if(!sameKey(pk,cert.otpIssuerPublicKeyPem))throw Error("OTP_ISSUER_NOT_REGISTERED_IN_TRUST");
}
async function getExistingRoot(db){
 const result=await db.query(
  "SELECT r.user_id::text AS user_id,r.credentials_version::text AS version " +
  "FROM tto.national_root_accounts r " +
  "JOIN tto.user_accounts u ON u.user_id=r.user_id " +
  "WHERE r.singleton=true AND r.revoked_at IS NULL AND u.status='ACTIVE'");
 if(result.rowCount!==1)throw Error("EXACTLY_ONE_ACTIVE_ROOT_REQUIRED");
 return {rootUserId:result.rows[0].user_id,expectedVersion:result.rows[0].version};
}
async function runPrivateIntake(db,env,identityPrompt=promptHiddenNumeric,now=()=>Date.now()){
 const certResult=await loadValidatedTrustCertificate(env.TTO_RECOVERY_PRIVATE_TRUST_PATH,env,now());
 const cert=certResult.cert;
 validateIssuerPrivateKeyMatchesCert(env,cert);
 const root=await getExistingRoot(db);
 if(root.rootUserId!==cert.rootUserId)
  throw Error("CERTIFICATE_IS_FOR_DIFFERENT_EXISTING_ROOT");
 const nationalId=await identityPrompt("کد ملی مدیر ملی",10);
 const mobile=await identityPrompt("شماره موبایل",11);
 if(!isNationalId(nationalId)||!isMobile(mobile))throw Error("IDENTITY_FORMAT_REJECTED");
 const bound={...root,nationalId,mobile,nonce:randomUUID()};
 const result=await requestOwnerRecoveryOtp(db,bound,env,undefined,now());
 process.stdout.write("کد تأیید به سرویس پیامک ارسال شد؛ فقط کد دریافتی را وارد کنید.\n");
 const remaining=Math.max(0,Date.parse(result.expiresAt)-now());
 if(remaining<1000)throw Error("SMSOTP_ALREADY_EXPIRED");
 const otp=await identityPrompt("کد پیامکی",6,process.stdin,process.stdout,remaining);
 const receipt=await verifyOwnerRecoveryOtp(db,{...bound,challengeId:result.challengeId,otp},env,now());
 await privateWrite(env.TTO_RECOVERY_PRIVATE_OTP_RECEIPT_PATH,receipt);
 return {status:"PH12_OWNER_REAL_SMSOTP_SIGNED_RECEIPT_PRIVATE_ONLY"};
}
async function main(){
 let db;
 try{
  if(process.argv.length!==3||process.argv[2]!=="--run")throw Error("PRIVATE_WIZARD_RUN_ONLY");
  assertPrivateOtpEnvironment(process.env,["node","wizard","--request"]);
  assertPrivateOtpEnvironment(process.env,["node","wizard","--verify"]);
  requirePrivateTerminal();
  const output=safePrivatePath(process.env.TTO_RECOVERY_PRIVATE_OTP_RECEIPT_PATH);
  try{await fs.access(output);throw Error("PRIVATE_RECEIPT_ALREADY_EXISTS");}
  catch(e){if(e.code!=="ENOENT")throw e;}
  const {Client}=createRequire(resolve(__dirname,"../../services/api/package.json"))("pg");
  db=new Client({connectionString:process.env.TTO_PREVIEW_DATABASE_URL,ssl:{rejectUnauthorized:true}});
  await db.connect();
  const result=await runPrivateIntake(db,process.env);
  process.stdout.write(result.status+"\n");
 }catch{
  process.stderr.write("PH12_PRIVATE_IDENTITY_INTAKE_HOLD_OR_FAILED\n");
  process.exitCode=1;
 }finally{if(db)await db.end().catch(()=>{});}
}
if(require.main===module)main();
module.exports={requirePrivateTerminal,validateIssuerPrivateKeyMatchesCert,getExistingRoot,runPrivateIntake,promptHiddenNumeric};
