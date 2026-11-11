"use strict";
/**
 * PH12 owner recovery: proof verification only. NEVER issues a login, changes
 * a national root, sends an SMS or approves the owner by itself.
 *
 * Trust anchors must be independently vetted, held outside Git/CI and owned
 * by different principals. Synthetic signatures are not lawful evidence.
 */
const {createPublicKey,verify,timingSafeEqual}=require("node:crypto");
const {isNationalId,isMobile}=require("./national-root-owner-credentials.cjs");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const VERSION=/^(0|[1-9][0-9]{0,15})$/;
const REF=/^[A-Za-z0-9._:-]{12,128}$/;
const B64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const kinds={otp:"TTO_NATIONAL_ROOT_RECOVERY_OTP_V1",approval:"TTO_NATIONAL_ROOT_RECOVERY_APPROVAL_V1"};
const signedKeys={
 otp:["kind","rootUserId","expectedVersion","nationalId","mobile","challengeId","nonce","verifiedAt","issuedAt","expiresAt"],
 approval:["kind","rootUserId","expectedVersion","nationalId","mobile","challengeId","nonce","reviewerUserId","mandateRef","reviewedAt","issuedAt","expiresAt"]
};
const nowDate=ms=>new Date(ms).toISOString();
function signingBytes(kind,receipt){
 const keys=signedKeys[kind];
 if(!keys||!receipt||typeof receipt!=="object")throw Error("INVALID_RECOVERY_RECEIPT");
 return Buffer.from(JSON.stringify(["TTO_PH12_SIGNED_RECOVERY_V1",kind,...keys.map(k=>receipt[k])]),"utf8");
}
function verifySignature(kind,receipt,publicKeyPem){
 try{
  if(!receipt||typeof receipt.signature!=="string"||receipt.signature.length!==88||!B64.test(receipt.signature))
   return false;
  const publicKey=createPublicKey(publicKeyPem);
  if(publicKey.asymmetricKeyType!=="ed25519")return false;
  const signature=Buffer.from(receipt.signature,"base64");
  return signature.length===64&&verify(null,signingBytes(kind,receipt),publicKey,signature);
 }catch{return false}
}
function checkReceiptTime(receipt,now){
 const issued=Date.parse(receipt.issuedAt),expiry=Date.parse(receipt.expiresAt);
 if(!Number.isFinite(issued)||!Number.isFinite(expiry)||!Number.isFinite(now))return false;
 return issued<=now+30_000&&issued>=now-300_000&&expiry>now&&
  expiry-issued<=300_000&&expiry>issued;
}
function verifyOwnerRecoveryEvidence(input,trust,now=Date.now()){
 const blockers=[],fail=x=>{if(!blockers.includes(x))blockers.push(x)};
 if(!input||typeof input!=="object"||!trust||typeof trust!=="object"){
  return {status:"BLOCKED",blockers:["RECOVERY_INPUT_OR_TRUST_MISSING"]};
 }
 const o=input.otp,a=input.approval;
 if(!o||!a||o.kind!==kinds.otp||a.kind!==kinds.approval){
  return {status:"BLOCKED",blockers:["TWO_DIFFERENT_RECEIPTS_REQUIRED"]};
 }
 if(!isNationalId(o.nationalId)||!isMobile(o.mobile)||
    !UUID.test(o.rootUserId)||!VERSION.test(String(o.expectedVersion))||
    !UUID.test(o.challengeId)||!UUID.test(o.nonce))
   fail("OWNER_IDENTITY_OR_OTP_BINDING_INVALID");
 if(!UUID.test(a.reviewerUserId)||a.reviewerUserId===o.rootUserId||
    !REF.test(a.mandateRef))fail("INDEPENDENT_REVIEWER_MANDATE_INVALID");
 for(const key of ["rootUserId","expectedVersion","nationalId","mobile","challengeId","nonce"]){
  if(a[key]!==o[key])fail("TWO_RECEIPTS_NOT_BOUND_TO_SAME_RECOVERY");
 }
 if(!UUID.test(input.expectedRootUserId)||input.expectedRootUserId!==o.rootUserId||
    String(input.expectedRootVersion)!==String(o.expectedVersion))
   fail("LIVE_ROOT_ID_OR_VERSION_NOT_ATTESTED");
 if(!checkReceiptTime(o,now)||!checkReceiptTime(a,now))
   fail("RECOVERY_RECEIPT_EXPIRED_OR_CLOCK_INVALID");
 const verified=Date.parse(o.verifiedAt),reviewed=Date.parse(a.reviewedAt);
 if(!Number.isFinite(verified)||verified>now||verified<now-120_000||
    verified<Date.parse(o.issuedAt)-30_000)
   fail("RECENT_OTP_SUCCESS_NOT_ATTESTED");
 if(!Number.isFinite(reviewed)||reviewed>now||reviewed<now-300_000)
   fail("INDEPENDENT_APPROVAL_EXPIRED");
 let keyOne,keyTwo;
 try{
  keyOne=createPublicKey(trust.otpVerifierPublicKeyPem);
  keyTwo=createPublicKey(trust.reviewerPublicKeyPem);
  if(keyOne.asymmetricKeyType!=="ed25519"||keyTwo.asymmetricKeyType!=="ed25519"||
      timingSafeEqual(keyOne.export({type:"spki",format:"der"}),keyTwo.export({type:"spki",format:"der"})))
   fail("TWO_INDEPENDENT_PINNED_KEYS_REQUIRED");
 }catch{fail("TWO_INDEPENDENT_PINNED_KEYS_REQUIRED")}
 if(!verifySignature("otp",o,trust.otpVerifierPublicKeyPem))fail("VERIFIED_MOBILE_RECEIPT_SIGNATURE_INVALID");
 if(!verifySignature("approval",a,trust.reviewerPublicKeyPem))fail("REVIEWER_APPROVAL_SIGNATURE_INVALID");
 return {status:blockers.length?"BLOCKED":"SIGNED_EVIDENCE_CHECKED_PREVIEW_ONLY",blockers};
}
module.exports={kinds,signingBytes,verifyOwnerRecoveryEvidence,nowDate};
