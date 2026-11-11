"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {generateKeyPairSync,sign}=require("node:crypto");
const {fingerprintRegisterCandidateSnapshot,signingBytesForCustodianProof,
  reviewCandidateCustodianProof}=require("../../services/api/dist/child07-custodian-proof-review.js");
const T="91111111-1111-4111-8111-111111111111";
const T2="92222222-2222-4222-8222-222222222222";
const A="a1111111-1111-4111-8111-111111111111",B="a2222222-2222-4222-8222-222222222222";
const NONCE="a1111111-1111-4111-8111-111111111111";
const keys=generateKeyPairSync("ed25519");
const other=generateKeyPairSync("ed25519");
const NOW=Date.now();
const date=n=>new Date(n).toISOString();
const positions=()=>[
 {tenantId:T,accountId:A,quantity:60n,sourceEntryRef:"CI-SOURCE-ENTRY-0001"},
 {tenantId:T,accountId:B,quantity:30n,sourceEntryRef:"CI-SOURCE-ENTRY-0002"}
];
const official=()=>({tenantId:T,registerId:"CI-REGISTER-SYNTHETIC-ONLY",
 custodianSourceRef:"CI-CUSTODIAN-SYNTHETIC-ONLY",sourceVersion:4,asOf:date(NOW-60000),
 issuedShares:100n,treasuryShares:10n,positions:positions()});
const projection=()=>({tenantId:T,registerSourceVersion:4,issuedShares:100n,
 treasuryShares:10n,positions:positions()});
const pinned=()=>({boundary:"SYNTHETIC_CI_ONLY",tenantId:T,registerId:"CI-REGISTER-SYNTHETIC-ONLY",
 custodianSourceRef:"CI-CUSTODIAN-SYNTHETIC-ONLY",mandateReference:"CI-UNSIGNED-MANDATE-ONLY",
 keyId:"CI-SIGNING-KEY-V1",trustEpoch:2,validFrom:date(NOW-300000),
 validUntil:date(NOW+600000),revokedAt:null,publicKeyPem:keys.publicKey.export({format:"pem",type:"spki"})});
function signedReceipt(snapshot=official(),mutation={}){
 const fields={tenantId:snapshot.tenantId,registerId:snapshot.registerId,
   custodianSourceRef:snapshot.custodianSourceRef,sourceVersion:snapshot.sourceVersion,
   trustEpoch:2,snapshotSha256:fingerprintRegisterCandidateSnapshot(snapshot),
   challengeNonce:NONCE,keyId:"CI-SIGNING-KEY-V1",issuedAt:date(NOW-5000),
   expiresAt:date(NOW+100000),...mutation};
 return {...fields,signatureBase64:sign(null,signingBytesForCustodianProof(fields),keys.privateKey).toString("base64")};
}
function review(args={}){
 const value=(k,fallback)=>Object.prototype.hasOwnProperty.call(args,k)?args[k]:fallback();
 return reviewCandidateCustodianProof(
  value("official",official),value("projection",projection),
  value("receipt",signedReceipt),value("pinned",pinned),value("nonce",()=>NONCE),NOW);
}
function hold(r){assert.equal(r.formalCustodianAcceptance,false);assert.equal(r.officialSourceAccepted,false);
 assert.equal(r.legallyAdmittedSource,false);assert.equal(r.officialOwnershipTransferAuthorized,false);
 assert.equal(r.officialRegisterCanBeWritten,false);}
test("valid synthetic Ed25519 signature plus parity is never official authority",()=>{
 const r=review();assert.equal(r.status,"INTEGRITY_CHECKED_CANDIDATE_ONLY");
 assert.equal(r.signatureVerified,true);assert.equal(r.shareQuantityParityCandidate,true);hold(r);
});
test("unknown or absent custodian trust never inherits authority",()=>{
 for(const val of [null,undefined]){
  const r=review({pinned:val});assert.equal(r.status,"BLOCKED");hold(r);
 }
});
test("tampered holdings after signing block source attachment",()=>{
 const snap=official(),rec=signedReceipt(snap);snap.positions[0].quantity=59n;
 const r=review({official:snap,receipt:rec});
 assert.equal(r.status,"BLOCKED");hold(r);
 assert.ok(r.blockers.includes("CUSTODIAN_SIGNED_SNAPSHOT_MISMATCH"));
});
test("mismatched source-entry reference blocks even with equal quantities",()=>{
 const p=projection();p.positions[0].sourceEntryRef="CI-WRONG-SOURCE-ENTRY";
 const r=review({projection:p});assert.equal(r.status,"BLOCKED");
 assert.ok(r.blockers.includes("CHILD07_REGISTER_PARITY_NOT_VERIFIED"));hold(r);
});
test("cross-tenant and wrong register reject pinned signature",()=>{
 for(const x of [{tenantId:T2},{registerId:"CI-WRONG-REGISTER"}]){
  const r=review({pinned:{...pinned(),...x}});
  assert.equal(r.status,"BLOCKED");assert.ok(r.blockers.includes("CUSTODIAN_TENANT_REGISTER_OR_SOURCE_MISMATCH"));hold(r);
 }
});
test("revoked key, changed trust epoch and missing mandate block",()=>{
 const cases=[
  [{revokedAt:date(NOW-10000)},"CUSTODIAN_KEY_REVOKED_OR_UNKNOWN"],
  [{trustEpoch:3},"CUSTODIAN_TRUST_EPOCH_MISMATCH"],
  [{mandateReference:""},"INDEPENDENT_CUSTODIAN_MANDATE_NOT_ATTESTED"]
 ];
 for(const [change,code] of cases){const r=review({pinned:{...pinned(),...change}});
   assert.ok(r.blockers.includes(code),code);hold(r);}
});
test("short-lived receipt expiration and missing nonce block",()=>{
 const expired=signedReceipt(official(),{issuedAt:date(NOW-400000),expiresAt:date(NOW-200000)});
 let r=review({receipt:expired});assert.equal(r.status,"BLOCKED");
 assert.ok(r.blockers.includes("CUSTODIAN_RECEIPT_OR_MANDATE_STALE"));hold(r);
 r=review({nonce:"b1111111-1111-4111-8111-111111111111"});
 assert.ok(r.blockers.includes("CUSTODIAN_CHALLENGE_NONCE_UNBOUND"));hold(r);
});
test("source version and signing key ID must match pinned trust",()=>{
 for(const mutation of [{sourceVersion:5},{keyId:"CI-WRONG-SIGNING-KEY"}]){
  const r=review({receipt:signedReceipt(official(),mutation)});assert.equal(r.status,"BLOCKED");hold(r);
 }
});
test("wrong private key cannot forge a valid receipt",()=>{
 const r=signedReceipt(),{signatureBase64,...signed}=r;
 const wrong={...r,signatureBase64:sign(null,signingBytesForCustodianProof(signed),other.privateKey).toString("base64")};
 const check=review({receipt:wrong});assert.ok(check.blockers.includes("CUSTODIAN_SIGNATURE_VERIFICATION_FAILED"));hold(check);
});
test("malformed candidate register source fails closed without throwing",()=>{
 const malformed={...official(),positions:null};
 const r=review({official:malformed});
 assert.equal(r.status,"BLOCKED");
 assert.ok(r.blockers.includes("CHILD07_REGISTER_PARITY_NOT_VERIFIED"));
 assert.ok(r.blockers.includes("CUSTODIAN_SNAPSHOT_MALFORMED"));
 hold(r);
});
test("no CI-only flag means receipt is unusable in runtime",()=>{
 const before=process.env.TTO_CHILD07_CUSTODIAN_LAB;
 delete process.env.TTO_CHILD07_CUSTODIAN_LAB;
 try{const r=review();assert.ok(r.blockers.includes("CUSTODIAN_VERIFIER_CI_ONLY"));hold(r);}
 finally{if(before===undefined)delete process.env.TTO_CHILD07_CUSTODIAN_LAB;
       else process.env.TTO_CHILD07_CUSTODIAN_LAB=before;}
});
