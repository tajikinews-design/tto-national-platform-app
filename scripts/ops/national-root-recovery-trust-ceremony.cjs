"use strict";
/**
 * PH12 two-authority public-key enrollment ceremony, Preview only.
 *
 * A local operator cannot mark arbitrary self-generated keys trusted.
 * Certificate activation requires TWO separate pre-pinned authority signatures.
 * The two authority private keys and reviewer private key are never held by
 * this module. No PII, mobile, national ID or OTP is stored in certificates.
 */
const {createPublicKey,verify,createHash,timingSafeEqual}=require("node:crypto");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const REF=/^[A-Za-z0-9._:-]{12,128}$/;
const PROJECT="zkfwsgrgslxxlusxrwce";
const KIND="TTO_PH12_PREVIEW_RECOVERY_TRUST_CERT_V1";
function keyFromPem(pem){
 if(typeof pem!=="string"||pem.length>4096)throw Error("TRUST_KEY_INVALID");
 const key=createPublicKey(pem);
 if(key.asymmetricKeyType!=="ed25519")throw Error("TRUST_KEY_MUST_BE_ED25519");
 return key;
}
function keyDer(key){return key.export({type:"spki",format:"der"});}
function fingerprint(pem){return createHash("sha256").update(keyDer(keyFromPem(pem))).digest("hex");}
function sameKey(a,b){
 const x=keyDer(keyFromPem(a)),y=keyDer(keyFromPem(b));
 return x.length===y.length&&timingSafeEqual(x,y);
}
function publicTrustPayload(cert){
 if(!cert||typeof cert!=="object"||Array.isArray(cert))throw Error("TRUST_CERT_INVALID");
 const {
  kind,projectRef,environment,rootUserId,reviewerUserId,mandateRef,
  otpIssuerPublicKeyPem,reviewerPublicKeyPem,validFrom,expiresAt,ceremonyRef
 }=cert;
 return Buffer.from(JSON.stringify(["TTO_PH12_TRUST_CEREMONY_V1",kind,projectRef,environment,
  rootUserId,reviewerUserId,mandateRef,fingerprint(otpIssuerPublicKeyPem),
  fingerprint(reviewerPublicKeyPem),validFrom,expiresAt,ceremonyRef]),"utf8");
}
function authorityApprovalBytes(cert,role,authorityUserId){
 if(!["AUTHORITY_ONE","AUTHORITY_TWO"].includes(role)||!UUID.test(authorityUserId))
  throw Error("TRUST_APPROVER_IDENTITY_INVALID");
 return Buffer.from(JSON.stringify(["TTO_PH12_AUTHORITY_SIGNED_APPROVAL_V1",
  publicTrustPayload(cert).toString("base64"),role,authorityUserId]),"utf8");
}
function verifyTrustCertificate(cert,anchors,now=Date.now()){
 const fail=(reason)=>({state:"HOLD",reason});
 try{
  if(!cert||cert.kind!==KIND||cert.projectRef!==PROJECT||cert.environment!=="preview"||
     !UUID.test(cert.rootUserId)||!UUID.test(cert.reviewerUserId)||
     cert.rootUserId===cert.reviewerUserId||!REF.test(cert.mandateRef)||
     !REF.test(cert.ceremonyRef))
   return fail("TRUST_SCOPE_OR_AUTHORITY_SUBJECT_INVALID");
  const from=Date.parse(cert.validFrom),until=Date.parse(cert.expiresAt);
  if(!Number.isFinite(from)||!Number.isFinite(until)||from>now||
     until<=now||until-from>7*24*60*60*1000)
   return fail("TRUST_CERT_EXPIRED_OR_INVALID");
  if(!anchors||!anchors.authorityOnePublicKeyPem||!anchors.authorityTwoPublicKeyPem||
     !Array.isArray(cert.approvals)||cert.approvals.length!==2)
   return fail("TWO_PREAPPROVED_AUTHORITIES_REQUIRED");
  const keys=[cert.otpIssuerPublicKeyPem,cert.reviewerPublicKeyPem,
    anchors.authorityOnePublicKeyPem,anchors.authorityTwoPublicKeyPem];
  if(keys.some((k,i)=>keys.some((other,j)=>i!==j&&sameKey(k,other))))
   return fail("FOUR_DISTINCT_KEYS_REQUIRED");
  const labels=["AUTHORITY_ONE","AUTHORITY_TWO"];
  for(let i=0;i<2;i++){
   const approval=cert.approvals.find(p=>p&&p.role===labels[i]);
   const key=keyFromPem(i===0?anchors.authorityOnePublicKeyPem:anchors.authorityTwoPublicKeyPem);
   if(!approval||!UUID.test(approval.authorityUserId)||
      approval.authorityUserId===cert.rootUserId||
      approval.authorityUserId===cert.reviewerUserId||
      typeof approval.signature!=="string"||
      !/^[A-Za-z0-9+/]{86}==$/.test(approval.signature))
    return fail("TRUST_AUTHORITY_SIGNATURE_OR_ID_MISSING");
   const signature=Buffer.from(approval.signature,"base64");
   if(signature.length!==64||!verify(null,authorityApprovalBytes(cert,labels[i],approval.authorityUserId),key,signature))
    return fail("TRUST_AUTHORITY_SIGNATURE_INVALID");
  }
  if(cert.approvals[0].authorityUserId===cert.approvals[1].authorityUserId)
   return fail("TWO_DISTINCT_AUTHORITY_PEOPLE_REQUIRED");
  return {
   state:"VALIDATED_TRUST_CEREMONY_PREVIEW_ONLY",
   otpKeyFingerprint:fingerprint(cert.otpIssuerPublicKeyPem),
   reviewerKeyFingerprint:fingerprint(cert.reviewerPublicKeyPem)
  };
 }catch{return fail("TRUST_CERT_INVALID_OR_UNVERIFIABLE");}
}
module.exports={KIND,PROJECT,publicTrustPayload,authorityApprovalBytes,verifyTrustCertificate,fingerprint,sameKey};
