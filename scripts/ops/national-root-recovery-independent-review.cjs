"use strict";
/**
 * Separate-person signed approval. Run on REVIEWER'S computer, never on the
 * OTP issuer/owner operator workstation. This is a digital attestation tool:
 * it does not independently determine legal entitlement or create a user.
 */
const fs=require("node:fs/promises");
const {createPrivateKey,createPublicKey,verify,sign}=require("node:crypto");
const readline=require("node:readline/promises");
const {loadValidatedTrustCertificate,privateWrite,safePrivatePath}
 =require("./national-root-recovery-trust-register.cjs");
const {sameKey}=require("./national-root-recovery-trust-ceremony.cjs");
const {kinds,signingBytes}=require("./national-root-signed-recovery-evidence.cjs");
function reviewerKeyMatchesCert(privateKeyPem,cert){
 const key=createPrivateKey(privateKeyPem||"");
 if(key.asymmetricKeyType!=="ed25519")throw Error("REVIEWER_KEY_NOT_ED25519");
 const p=createPublicKey(key).export({format:"pem",type:"spki"});
 if(!sameKey(p,cert.reviewerPublicKeyPem))throw Error("REVIEWER_KEY_NOT_IN_APPROVED_TRUST");
 return key;
}
function validateIncomingOtpReceipt(receipt,cert,now=Date.now()){
 if(!receipt||receipt.kind!==kinds.otp||receipt.rootUserId!==cert.rootUserId||
    typeof receipt.signature!=="string"||!receipt.signature.endsWith("=="))
  throw Error("OTP_RECEIPT_NOT_FOR_APPROVED_ROOT");
 const issued=Date.parse(receipt.issuedAt),expires=Date.parse(receipt.expiresAt),
  verified=Date.parse(receipt.verifiedAt);
 if(!Number.isFinite(issued)||!Number.isFinite(expires)||!Number.isFinite(verified)||
    issued>now+30000||now>=expires||issued<now-180000||
    verified>now||verified<now-120000||expires-issued>300000)
  throw Error("OTP_RECEIPT_NOT_CURRENT");
 const pub=createPublicKey(cert.otpIssuerPublicKeyPem);
 const sig=Buffer.from(receipt.signature,"base64");
 if(sig.length!==64||!verify(null,signingBytes("otp",receipt),pub,sig))
  throw Error("OTP_RECEIPT_NOT_SIGNED_BY_APPROVED_ISSUER");
 return true;
}
function createIndependentApproval(receipt,cert,reviewerKey,now=Date.now(),reviewConfirmed=false){
 if(!reviewConfirmed)throw Error("REVIEWER_MANDATE_AND_OWNER_NOT_ATTESTED");
 validateIncomingOtpReceipt(receipt,cert,now);
 const common={kind:kinds.approval,rootUserId:receipt.rootUserId,
  expectedVersion:receipt.expectedVersion,nationalId:receipt.nationalId,
  mobile:receipt.mobile,challengeId:receipt.challengeId,nonce:receipt.nonce,
  reviewerUserId:cert.reviewerUserId,mandateRef:cert.mandateRef,
  reviewedAt:new Date(now).toISOString(),issuedAt:new Date(now).toISOString(),
  expiresAt:new Date(now+120000).toISOString()};
 return {...common,signature:sign(null,signingBytes("approval",common),reviewerKey).toString("base64")};
}
async function main(){
 try{
  if(process.argv.length!==3||process.argv[2]!=="--approve"||process.env.CI||
     process.env.VERCEL||process.env.NODE_ENV==="production"||
     process.env.TTO_ENVIRONMENT!=="preview"||
     process.env.TTO_ISOLATED_DEMO_DB!=="true"||
     !process.stdin.isTTY||!process.stdout.isTTY)
   throw Error("REVIEWER_PRIVATE_TTY_PREVIEW_ONLY");
  const {cert}=await loadValidatedTrustCertificate(process.env.TTO_RECOVERY_PRIVATE_TRUST_PATH,process.env);
  const reviewerKey=reviewerKeyMatchesCert(process.env.TTO_RECOVERY_REVIEWER_PRIVATE_KEY_PEM,cert);
  const inputPath=safePrivatePath(process.env.TTO_RECOVERY_PRIVATE_OTP_RECEIPT_PATH);
  const outputPath=safePrivatePath(process.env.TTO_RECOVERY_PRIVATE_APPROVAL_PATH);
  const data=await fs.readFile(inputPath,"utf8");
  if(Buffer.byteLength(data)>4500)throw Error("OTP_PRIVATE_RECEIPT_TOO_LARGE");
  const receipt=JSON.parse(data);
  validateIncomingOtpReceipt(receipt,cert);
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  let answer;
  try{
   answer=await rl.question("پس از کنترل مستقل هویت و اختیار قانونی مدیر ملی، برای امضا عبارت APPROVE-PH12 را تایپ کنید: ");
  }finally{rl.close();}
  if(answer!=="APPROVE-PH12")throw Error("REVIEWER_APPROVAL_NOT_GIVEN");
  const approval=createIndependentApproval(receipt,cert,reviewerKey,Date.now(),true);
  await privateWrite(outputPath,approval);
  process.stdout.write("INDEPENDENT_REVIEWER_SIGNED_APPROVAL_PRIVATE_ONLY\n");
 }catch{
  process.stderr.write("INDEPENDENT_REVIEWER_SIGNATURE_HOLD_OR_FAILED\n");
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={reviewerKeyMatchesCert,validateIncomingOtpReceipt,createIndependentApproval};
