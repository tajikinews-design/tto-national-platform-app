"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const path=require("node:path");
const {KIND,PROJECT,publicTrustPayload,authorityApprovalBytes,verifyTrustCertificate,fingerprint,sameKey}
 =require("../ops/national-root-recovery-trust-ceremony.cjs");
const {safePrivatePath}=require("../ops/national-root-recovery-trust-register.cjs");
const ROOT="a1111111-1111-4111-8111-111111111111";
const REVIEWER="a2222222-2222-4222-8222-222222222222";
const GOV1="a3333333-3333-4333-8333-333333333333";
const GOV2="a4444444-4444-4444-8444-444444444444";
const p=()=>crypto.generateKeyPairSync("ed25519");
const issuer=p(),reviewer=p(),g1=p(),g2=p();
const pem=k=>k.publicKey.export({type:"spki",format:"pem"});
const anchors={authorityOnePublicKeyPem:pem(g1),authorityTwoPublicKeyPem:pem(g2)};
const NOW=Date.parse("2026-11-12T10:00:00Z");
function goodCert(){
 const c={kind:KIND,projectRef:PROJECT,environment:"preview",
  rootUserId:ROOT,reviewerUserId:REVIEWER,mandateRef:"CI-APPROVAL-LEGAL-000001",
  otpIssuerPublicKeyPem:pem(issuer),reviewerPublicKeyPem:pem(reviewer),
  validFrom:new Date(NOW-60000).toISOString(),
  expiresAt:new Date(NOW+600000).toISOString(),
  ceremonyRef:"CI-CEREMONY-SYNTHETIC-20261112"};
 c.approvals=[
  {role:"AUTHORITY_ONE",authorityUserId:GOV1,signature:crypto.sign(null,authorityApprovalBytes(c,"AUTHORITY_ONE",GOV1),g1.privateKey).toString("base64")},
  {role:"AUTHORITY_TWO",authorityUserId:GOV2,signature:crypto.sign(null,authorityApprovalBytes(c,"AUTHORITY_TWO",GOV2),g2.privateKey).toString("base64")}
 ];
 return c;
}
function verdict(c=goodCert(),keys=anchors){return verifyTrustCertificate(c,keys,NOW);}
test("two independent externally anchored approvals activate Preview public keys only",()=>{
 const v=verdict();
 assert.equal(v.state,"VALIDATED_TRUST_CEREMONY_PREVIEW_ONLY");
 assert.match(v.otpKeyFingerprint,/^[0-9a-f]{64}$/);
 assert.notEqual(v.otpKeyFingerprint,v.reviewerKeyFingerprint);
});
test("trust remains HOLD until BOTH genuine independent authority signatures",()=>{
 const c=goodCert();c.approvals.pop();
 assert.equal(verdict(c).state,"HOLD");
 const d=goodCert();d.approvals=[];
 assert.equal(verdict(d).state,"HOLD");
});
test("even a signed certificate cannot be reused for another root, reviewer, key or mandate",()=>{
 for(const mutation of [
  c=>{c.rootUserId=GOV1},
  c=>{c.reviewerUserId=GOV2},
  c=>{c.mandateRef="OTHER-MANDATE-CANNOT-REUSE"},
  c=>{c.otpIssuerPublicKeyPem=pem(p())},
  c=>{c.expiresAt=new Date(NOW+6000000).toISOString()}
 ]){
  const c=goodCert();mutation(c);
  assert.equal(verdict(c).state,"HOLD");
 }
});
test("two distinct people and four separate Ed25519 public keys required",()=>{
 const c=goodCert();c.approvals[1].authorityUserId=GOV1;
 assert.equal(verdict(c).state,"HOLD");
 const d=goodCert();d.reviewerPublicKeyPem=d.otpIssuerPublicKeyPem;
 assert.equal(verdict(d).state,"HOLD");
 const e=goodCert();
 assert.equal(verdict(e,{authorityOnePublicKeyPem:anchors.authorityOnePublicKeyPem,
  authorityTwoPublicKeyPem:anchors.authorityOnePublicKeyPem}).state,"HOLD");
});
test("wrong project, future or expired approval cannot enable trust",()=>{
 for(const mutation of [
  c=>{c.projectRef="different"},
  c=>{c.environment="production"},
  c=>{c.validFrom=new Date(NOW+10000).toISOString()},
  c=>{c.expiresAt=new Date(NOW-1).toISOString()}
 ]){
  const c=goodCert();mutation(c);
  assert.equal(verdict(c).state,"HOLD");
 }
});
test("no key identity may be treated as approved by mere fingerprint",()=>{
 assert.equal(sameKey(pem(issuer),pem(issuer)),true);
 assert.equal(sameKey(pem(issuer),pem(reviewer)),false);
 assert.match(fingerprint(pem(issuer)),/^[a-f0-9]{64}$/);
 assert.equal(verdict(goodCert(),{}).state,"HOLD");
});
test("private trust registry path must be outside repository",()=>{
 const cwd=process.cwd();
 assert.throws(()=>safePrivatePath(path.join(cwd,"approved.json"),cwd));
 assert.throws(()=>safePrivatePath("approved.json",cwd));
 assert.equal(safePrivatePath(path.join(path.dirname(cwd),"secure-external.json"),cwd),
  path.join(path.dirname(cwd),"secure-external.json"));
});

test("an independent authority's signed reviewer ID and role cannot be rewritten",()=>{
 const c=goodCert();
 c.approvals[0].authorityUserId="a5555555-5555-4555-8555-555555555555";
 assert.equal(verdict(c).state,"HOLD");
 const d=goodCert();
 d.approvals[0].role="AUTHORITY_TWO";
 assert.equal(verdict(d).state,"HOLD");
});
