"use strict";
/**
 * Final Preview recovery approval boundary. Does NOT execute unless:
 * - trust cert approved by two pinned independent governance authorities;
 * - genuine signed OTP receipt from its registered issuer;
 * - independent reviewer-signed decision with approved mandate;
 * - PostgreSQL has a matching consumed, delivered OTP challenge.
 *
 * A trusted operator supplies a private DB URL. No PII is logged.
 */
const fs=require("node:fs/promises");
const readline=require("node:readline/promises");
const {createRequire}=require("node:module");
const {resolve}=require("node:path");
const {loadValidatedTrustCertificate,safePrivatePath}
 =require("./national-root-recovery-trust-register.cjs");
const {verifyOwnerRecoveryEvidence}=require("./national-root-signed-recovery-evidence.cjs");
const {assertEnvironment,executeAtomicRecovery}=require("./recover-national-root-preview.cjs");
async function readApprovedPrivateReceipts(env,now=Date.now()){
 const {cert}=await loadValidatedTrustCertificate(env.TTO_RECOVERY_PRIVATE_TRUST_PATH,env,now);
 const read=async filename=>{
  const path=safePrivatePath(filename);
  const body=await fs.readFile(path,"utf8");
  if(Buffer.byteLength(body)>5000)throw Error("PRIVATE_RECEIPT_TOO_LARGE");
  return JSON.parse(body);
 };
 const [otp,approval]=await Promise.all([
  read(env.TTO_RECOVERY_PRIVATE_OTP_RECEIPT_PATH),
  read(env.TTO_RECOVERY_PRIVATE_APPROVAL_PATH)
 ]);
 if(otp.rootUserId!==cert.rootUserId||approval.reviewerUserId!==cert.reviewerUserId||
    approval.mandateRef!==cert.mandateRef)
  throw Error("TRUST_CERTIFICATE_NOT_BOUND_TO_APPROVAL");
 const input={expectedRootUserId:otp.rootUserId,expectedRootVersion:otp.expectedVersion,otp,approval};
 const trust={otpVerifierPublicKeyPem:cert.otpIssuerPublicKeyPem,
  reviewerPublicKeyPem:cert.reviewerPublicKeyPem};
 const result=verifyOwnerRecoveryEvidence(input,trust,now);
 if(result.status!=="SIGNED_EVIDENCE_CHECKED_PREVIEW_ONLY")
  throw Error("TWO_INDEPENDENT_RECOVERY_RECEIPTS_INVALID");
 const options=assertEnvironment({
  ...env,TTO_RECOVERY_OTP_VERIFIER_PUBLIC_KEY_PEM:trust.otpVerifierPublicKeyPem,
  TTO_RECOVERY_REVIEWER_PUBLIC_KEY_PEM:trust.reviewerPublicKeyPem
 },["node","recovery","--apply"]);
 return {input,trust,options};
}
async function main(){
 let db;
 try{
  if(process.argv.length!==3||process.argv[2]!=="--apply"||process.env.CI||
    process.env.VERCEL||process.env.NODE_ENV==="production"||
    !process.stdin.isTTY||!process.stdout.isTTY||
    process.env.TTO_RECOVERY_REVIEWER_PRIVATE_KEY_PEM)
   throw Error("PRIVATE_OPERATOR_DEVICE_REQUIRED");
  const approved=await readApprovedPrivateReceipts(process.env);
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  let answer;
  try{answer=await rl.question("پس از بررسی نهایی دو سند امضاشده و نسخه حساب در Preview، برای بازیابی عبارت APPLY-PH12 را تایپ کنید: ")}
  finally{rl.close()}
  if(answer!=="APPLY-PH12")throw Error("FINAL_OPERATOR_CONFIRMATION_MISSING");
  const {Client}=createRequire(resolve(__dirname,"../../services/api/package.json"))("pg");
  db=new Client({connectionString:approved.options.connectionString,ssl:{rejectUnauthorized:true}});
  await db.connect();
  const result=await executeAtomicRecovery(db,approved.input,approved.trust,Date.now(),
    approved.options.identityHmacSecret);
  if(result.status!=="ROOT_RECOVERED_PREVIEW_ONLY")throw Error("RECOVERY_NOT_COMMITTED");
  process.stdout.write("ROOT_RECOVERED_PREVIEW_ONLY_SESSIONS_REVOKED\n");
 }catch{
  process.stderr.write("ROOT_RECOVERY_NOT_APPLIED_OR_FAILED\n");
  process.exitCode=1;
 }finally{if(db)await db.end().catch(()=>{});}
}
if(require.main===module)main();
module.exports={readApprovedPrivateReceipts};
