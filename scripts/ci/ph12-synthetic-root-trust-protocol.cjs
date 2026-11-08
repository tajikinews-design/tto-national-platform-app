"use strict";
/*
 * PH12 synthetic root-signed trust governance protocol.
 * CI-only and domain-separated. No production authority or tariff transitions.
 * Root key is supplied out of band, NEVER by an issuer envelope or the database.
 */
const {sign,verify,createHash}=require("node:crypto");
const {canonical}=require("./ph12-mock-official-issuer.cjs");
const PREFIX="TTO-PH12-SYNTHETIC-ROOT-ROTATION-V1\n";
const ANCHOR_PREFIX="TTO-PH12-SYNTHETIC-RESTORE-WITNESS-V1\n";
const HASH=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const KID=/^PH12_TEST_ED25519_KEY_0[12]$/;
const URL=/^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/;
const sha256=x=>createHash("sha256").update(x).digest("hex");
function exact(x,expected){
 return x&&typeof x==="object"&&!Array.isArray(x)&&
 Object.keys(x).sort().join("|")===expected.slice().sort().join("|");
}
function signedRecord(record,rootKey,kind="rotation"){
 const prefix=kind==="rotation"?PREFIX:ANCHOR_PREFIX;
 return {record,signature:sign(null,Buffer.from(prefix+canonical(record)),rootKey).toString("base64url")};
}
function validSignature(envelope,rootPublicKey,kind){
 try{
  if(!exact(envelope,["record","signature"])||
    typeof envelope.signature!=="string"||
    !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature))return false;
  return verify(null,Buffer.from((kind==="rotation"?PREFIX:ANCHOR_PREFIX)+canonical(envelope.record)),
     rootPublicKey,Buffer.from(envelope.signature,"base64url"));
 }catch{return false;}
}
function validateRotation(envelope,pinnedRoot,prior,now=Date.now()){
 if(!validSignature(envelope,pinnedRoot,"rotation"))return "HOLD_BAD_ROOT_SIGNATURE";
 const r=envelope.record;
 if(!exact(r,["kind","tenantId","issuerId","keyId","trustEpoch","issuerUrl",
   "publicKeyPem","previousKeyFingerprint","notBefore","expiresAt","requestId"])||
    r.kind!=="PH12_SYNTHETIC_ROTATION"||!UUID.test(r.tenantId)||
    r.issuerId!=="PH12_SYNTHETIC_ISSUER_NOT_OFFICIAL"||
    !KID.test(r.keyId)||!URL.test(r.issuerUrl)||!UUID.test(r.requestId)||
    typeof r.publicKeyPem!=="string"||
    !r.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----")||
    !HASH.test(r.previousKeyFingerprint)||!Number.isSafeInteger(r.trustEpoch))
  return "HOLD_INVALID_ROOT_MANDATE";
 const starts=Date.parse(r.notBefore),until=Date.parse(r.expiresAt);
 if(!Number.isFinite(starts)||!Number.isFinite(until)||starts>now||until<=now||
    until-starts>300000)return "HOLD_ROOT_MANDATE_EXPIRED";
 if(r.tenantId!==prior.tenantId||r.issuerId!==prior.issuerId)
  return "HOLD_ROOT_MANDATE_SUBJECT";
 if(r.trustEpoch!==prior.trustEpoch+1||
    r.keyId===prior.keyId||r.publicKeyPem===prior.publicKeyPem||
    prior.usedKeyIds.includes(r.keyId)||prior.usedRequestIds.includes(r.requestId)||
    sha256(prior.publicKeyPem)!==r.previousKeyFingerprint)
  return "HOLD_ROOT_MANDATE_REPLAY_OR_ROLLBACK";
 return "MOCK_ROOT_MANDATE_VALID_FOR_LAB_ONLY";
}
function validateRecoveryWitness(envelope,pinnedRoot,actual,now=Date.now()){
 if(!validSignature(envelope,pinnedRoot,"anchor"))return "HOLD_WITNESS_SIGNATURE";
 const r=envelope.record;
 if(!exact(r,["kind","tenantId","entityId","trustEpoch","keyFingerprint",
   "sourceVersion","recordHash","revoked","issuedAt","expiresAt"])||
    r.kind!=="PH12_SYNTHETIC_WITNESS"||!UUID.test(r.tenantId)||
    !/^SYNTHETIC_[A-Za-z0-9_]+$/.test(r.entityId)||
    !Number.isSafeInteger(r.trustEpoch)||!Number.isSafeInteger(r.sourceVersion)||
    !HASH.test(r.keyFingerprint)||!HASH.test(r.recordHash)||
    typeof r.revoked!=="boolean")
  return "HOLD_INVALID_WITNESS";
 const from=Date.parse(r.issuedAt),until=Date.parse(r.expiresAt);
 if(!Number.isFinite(from)||!Number.isFinite(until)||from>now||
    until<=now||until-from>300000)return "HOLD_WITNESS_EXPIRED";
 if(r.tenantId!==actual.tenantId||r.entityId!==actual.entityId)
   return "HOLD_WITNESS_SUBJECT";
 if(actual.trustEpoch<r.trustEpoch||actual.sourceVersion<r.sourceVersion||
    (r.revoked&&!actual.revoked))
  return "HOLD_RESTORE_BEHIND_SIGNED_WITNESS";
 if(actual.trustEpoch===r.trustEpoch&&actual.keyFingerprint!==r.keyFingerprint)
  return "HOLD_RESTORED_TRUST_KEY_CONFLICT";
 if(actual.sourceVersion===r.sourceVersion&&actual.recordHash!==r.recordHash)
  return "HOLD_RESTORED_SOURCE_EQUIVOCATION";
 if(actual.revoked)return "MOCK_HOLD_REVOKED";
 return "MOCK_WITNESS_MATCH_LAB_ONLY";
}
module.exports={signedRecord,validateRotation,validateRecoveryWitness,sha256};
