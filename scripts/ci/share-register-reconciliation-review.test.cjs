"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {reviewOfficialRegisterReconciliation}=require("../../services/api/dist/share-register-reconciliation-review.js");
const T="91111111-1111-4111-8111-111111111111";
const T2="92222222-2222-4222-8222-222222222222";
const A="a1111111-1111-4111-8111-111111111111";
const B="a2222222-2222-4222-8222-222222222222";
const positions=()=>[
 {tenantId:T,accountId:A,quantity:60n,sourceEntryRef:"TEST-REGISTER-OPENING-1"},
 {tenantId:T,accountId:B,quantity:30n,sourceEntryRef:"TEST-REGISTER-OPENING-2"}
];
const official=()=>({
 tenantId:T,registerId:"TEST-OFFICIAL-REGISTER-NOT-AUTHENTIC",
 custodianSourceRef:"TEST-UNSIGNED-CUSTODIAN-SOURCE",
 sourceVersion:5,asOf:"2026-11-11T00:00:00Z",issuedShares:100n,
 treasuryShares:10n,positions:positions()
});
const projection=()=>({
 tenantId:T,registerSourceVersion:5,issuedShares:100n,treasuryShares:10n,
 positions:positions()
});
function noLegalPromotion(r){
 assert.equal(r.officialSourceAccepted,false);
 assert.equal(r.legalOwnershipTransferAuthorized,false);
 assert.equal(r.candidateCanBePromoted,false);
 assert.equal(r.sourceAuthority,"EXTERNAL_COOPERATIVE_OFFICIAL_REGISTER");
}
test("synthetic parity remains candidate-only, never signed authority",()=>{
 const r=reviewOfficialRegisterReconciliation(official(),projection());
 assert.equal(r.status,"MATCHED_CANDIDATE_ONLY");
 assert.equal(r.checkedAccounts,2);assert.deepEqual(r.blockers,[]);
 noLegalPromotion(r);
});
test("missing register or projection fails closed",()=>{
 for(const pair of [[null,projection()],[official(),null],[undefined,undefined]]){
  const r=reviewOfficialRegisterReconciliation(...pair);
  assert.equal(r.status,"BLOCKED");
  assert.ok(r.blockers.includes("REGISTER_OR_PROJECTION_MISSING"));
  noLegalPromotion(r);
 }
});
test("cross-tenant register and projection mismatch always blocks",()=>{
 const r=reviewOfficialRegisterReconciliation({...official(),tenantId:T2},projection());
 assert.ok(r.blockers.includes("TENANT_SOURCE_MISMATCH"));noLegalPromotion(r);
});
test("cross-tenant account inside official data is not counted as valid",()=>{
 const o=official();o.positions[0]={...o.positions[0],tenantId:T2};
 const r=reviewOfficialRegisterReconciliation(o,projection());
 assert.ok(r.blockers.includes("REGISTER_TENANT_OR_ACCOUNT_INVALID"));noLegalPromotion(r);
});
test("version gaps, stale version, missing as-of and provenance all fail closed",()=>{
 const variations=[
 [ {...official(),sourceVersion:4},projection(),"REGISTER_SOURCE_VERSION_MISMATCH" ],
 [ {...official(),sourceVersion:null},projection(),"REGISTER_SOURCE_VERSION_MISSING" ],
 [ {...official(),asOf:"2026-02-30T00:00:00Z"},projection(),"REGISTER_AS_OF_INVALID" ],
 [ {...official(),custodianSourceRef:null},projection(),"OFFICIAL_CUSTODIAN_SOURCE_UNVERIFIED" ],
 [ official(),{...projection(),registerSourceVersion:6},"REGISTER_SOURCE_VERSION_MISMATCH" ]
 ];
 for(const [o,p,code] of variations){
  const r=reviewOfficialRegisterReconciliation(o,p);
  assert.equal(r.status,"BLOCKED",code);assert.ok(r.blockers.includes(code),code);noLegalPromotion(r);
 }
});
test("unknown register balance cannot become zero",()=>{
 const o=official();o.positions[0]={...o.positions[0],quantity:null};
 const r=reviewOfficialRegisterReconciliation(o,projection());
 assert.ok(r.blockers.includes("REGISTER_UNKNOWN_QUANTITY"));noLegalPromotion(r);
});
test("duplicate account and missing account are both blocked",()=>{
 for(const override of [[positions()[0],positions()[0]],[positions()[0]]]){
  const r=reviewOfficialRegisterReconciliation({...official(),positions:override},projection());
  assert.equal(r.status,"BLOCKED");noLegalPromotion(r);
 }
});
test("per-account quantity mismatch blocked even when total is unchanged",()=>{
 const p=projection();p.positions[0]={...p.positions[0],quantity:50n};
 p.positions[1]={...p.positions[1],quantity:40n};
 const r=reviewOfficialRegisterReconciliation(official(),p);
 assert.ok(r.blockers.includes("ACCOUNT_SHARE_QUANTITY_MISMATCH"));noLegalPromotion(r);
});
test("issued shares and treasury conservation must reconcile independently",()=>{
 const pairs=[
 [official(),{...projection(),issuedShares:101n},"ISSUED_SHARE_TOTAL_MISMATCH"],
 [{...official(),issuedShares:101n},projection(),"REGISTER_CONSERVATION_MISMATCH"],
 [official(),{...projection(),treasuryShares:5n},"TREASURY_SHARE_TOTAL_MISMATCH"],
 [{...official(),positions:[{...positions()[0],sourceEntryRef:null},positions()[1]]},projection(),"REGISTER_SOURCE_REFERENCE_MISSING"]
 ];
 for(const [o,p,code] of pairs){const r=reviewOfficialRegisterReconciliation(o,p);
  assert.ok(r.blockers.includes(code),code);noLegalPromotion(r);}
});
test("missing or malformed source entries do not certify missing records",()=>{
 const r=reviewOfficialRegisterReconciliation({...official(),positions:[]},projection());
 assert.ok(r.blockers.includes("ACCOUNT_MISSING_FROM_SOURCE_OR_PROJECTION"));noLegalPromotion(r);
});
