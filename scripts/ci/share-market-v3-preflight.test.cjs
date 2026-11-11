"use strict";
/** TTO v3 candidate pure preflight tests; deliberately NO live trade/API/DB writes. */
const test=require("node:test");
const assert=require("node:assert/strict");
const {reviewSellerPreflight,reviewBuyerPreflight,reviewOfficialRegisterFinalization,reviewRelistGuard}
  =require("../../services/api/dist/share-market-v3-preflight.js");

const seller=()=>({
 saleMode:"FULL_OFFER",sellerStatus:"ACTIVE",requestedQuantity:10n,availableShares:25n,
 ownershipSourceVerified:true,noConflictingLock:true,noLegalHold:true,
 noActiveConflictingTrade:true,shareSaleEligibility:"VALID",
 unpaidCapitalCommitment:false,pricingRuleVerified:true
});
const buyer=()=>({
 buyerType:"MEMBER",identityVerified:true,classificationSourceVerified:true,
 buyerEligibilityRule:"VALID",buyerCapRuleVerified:true,
 currentShares:10n,pendingAcquisitions:2n,requestedShares:3n,maximumAllowedShares:15n,
 noLegalHold:true,noActiveDispute:true,offerStillValid:true
});
const register=()=>({
 boardApprovalValid:true,buyerEligibilityValid:true,sellerPaymentConfirmed:true,
 mandatoryFeesResolved:true,officialRegisterEntryVerified:true,
 officialRegisterReference:"TEST-OFFICIAL-REGISTER-REF",registeredAt:"2026-11-07T00:00:00Z",
 noOpenDispute:true,lockedShares:10n,tradeQuantity:10n
});
function onlyReview(report){
 assert.equal(report.liveOrderAuthorized,false);
 assert.equal(report.liveOwnershipTransferAuthorized,false);
 assert.equal(report.sourceAuthority,"OFFICIAL_COOPERATIVE_SHARE_REGISTER_ONLY");
}
test("eligible seller is still review-only, not a live market order",()=>{
 const r=reviewSellerPreflight(seller());
 assert.equal(r.prerequisitesSatisfied,true);onlyReview(r);
});
test("seller rejects missing source, lock, hold, stale pricing and partial matching",()=>{
 const r=reviewSellerPreflight({...seller(),saleMode:"PARTIAL_MATCH",
 ownershipSourceVerified:false,noConflictingLock:false,noLegalHold:false,
 availableShares:4n,pricingRuleVerified:false});
 for(const k of ["MVP_FULL_OFFER_ONLY","OFFICIAL_HOLDINGS_SOURCE_UNVERIFIED",
 "CONFLICTING_SHARE_LOCK","LEGAL_HOLD_OR_UNKNOWN","ACTIVE_PRICING_RULE_NOT_VERIFIED",
 "INSUFFICIENT_OR_UNVERIFIED_FREE_SHARES"])assert.ok(r.blockers.includes(k),k);
 assert.equal(r.prerequisitesSatisfied,false);onlyReview(r);
});
test("unpaid capital requires independent legal review, no implicit forfeiture",()=>{
 const r=reviewSellerPreflight({...seller(),unpaidCapitalCommitment:true});
 assert.ok(r.blockers.includes("UNPAID_COMMITMENT_LEGAL_REVIEW"));onlyReview(r);
});
test("unknown sale rule is never treated as permission",()=>{
 const r=reviewSellerPreflight({...seller(),shareSaleEligibility:"UNKNOWN"});
 assert.ok(r.blockers.includes("SALE_ELIGIBILITY_RULE_NOT_VALID"));onlyReview(r);
});
test("external versioned cap rule at equality passes review, not trading",()=>{
 const r=reviewBuyerPreflight(buyer());assert.equal(r.prerequisitesSatisfied,true);onlyReview(r);
});
test("maximum holding formula counts pending acquisitions",()=>{
 const r=reviewBuyerPreflight({...buyer(),pendingAcquisitions:3n});
 assert.ok(r.blockers.includes("BUYER_ACTIVE_LEGAL_CAP_EXCEEDED"));onlyReview(r);
});
test("non-member and applicant cannot obtain permission without approved source rule",()=>{
 const r=reviewBuyerPreflight({...buyer(),buyerType:"NON_MEMBER_SHAREHOLDER",
 buyerEligibilityRule:"UNKNOWN",classificationSourceVerified:false});
 assert.ok(r.blockers.includes("BUYER_ELIGIBILITY_RULE_NOT_VALID"));
 assert.ok(r.blockers.includes("BUYER_CLASSIFICATION_NOT_APPROVED"));onlyReview(r);
});
test("report and unresolved or disputed fees cannot be converted into seller receipt",()=>{
 const r=reviewOfficialRegisterFinalization({...register(),sellerPaymentConfirmed:false,
 mandatoryFeesResolved:false,noOpenDispute:false});
 assert.ok(r.blockers.includes("SELLER_PAYMENT_NOT_CONFIRMED"));
 assert.ok(r.blockers.includes("COOPERATIVE_FEES_NOT_RESOLVED"));
 assert.ok(r.blockers.includes("OPEN_DISPUTE_OR_UNKNOWN"));onlyReview(r);
});
test("no official ledger reference and dated record => never even prerequisite ready",()=>{
 const r=reviewOfficialRegisterFinalization({...register(),officialRegisterReference:null});
 assert.ok(r.blockers.includes("OFFICIAL_COOPERATIVE_REGISTER_NOT_VERIFIED"));onlyReview(r);
});
test("all nominal references still NEVER give finalization authorization",()=>{
 const r=reviewOfficialRegisterFinalization(register());
 assert.equal(r.prerequisitesSatisfied,true);onlyReview(r);
});
test("invalid or insufficient locked quantities block any transfer",()=>{
 const r=reviewOfficialRegisterFinalization({...register(),lockedShares:9n});
 assert.ok(r.blockers.includes("INSUFFICIENT_LOCKED_SHARES"));onlyReview(r);
});

const relist=()=>({
 noUnresolvedPaymentClaim:true,noOpenDispute:true,noLegalHold:true,
 reservationReleasedSafely:true,offerStillValid:true,pricingRuleValid:true,
 sellerContinuationOrRelistPermissionValid:true,marketPolicyAllows:true
});
test("relist preflight with all eight verified guards is still not live authorization",()=>{
 const result=reviewRelistGuard(relist());
 assert.equal(result.prerequisitesSatisfied,true);
 assert.deepEqual(result.blockers,[]);
 onlyReview(result);
});
test("each of eight relist guards separately fails closed",()=>{
 const guardToBlocker={
  noUnresolvedPaymentClaim:"UNRESOLVED_PAYMENT_CLAIM",
  noOpenDispute:"OPEN_DISPUTE_OR_UNKNOWN",
  noLegalHold:"LEGAL_HOLD_OR_UNKNOWN",
  reservationReleasedSafely:"RESERVATION_NOT_SAFELY_RELEASED",
  offerStillValid:"OFFER_INVALID_OR_EXPIRED",
  pricingRuleValid:"ACTIVE_PRICING_RULE_NOT_VALID",
  sellerContinuationOrRelistPermissionValid:"SELLER_RELIST_PERMISSION_NOT_VALID",
  marketPolicyAllows:"MARKET_RELIST_POLICY_NOT_VALID"
 };
 for(const [guard,blocker] of Object.entries(guardToBlocker)){
  for(const missingValue of [false,undefined,null]){
   const facts={...relist(),[guard]:missingValue};
   const result=reviewRelistGuard(facts);
   assert.equal(result.prerequisitesSatisfied,false,guard);
   assert.ok(result.blockers.includes(blocker),guard);
   onlyReview(result);
  }
 }
});
test("payment dispute plus unresolved claim never releases for relist",()=>{
 const result=reviewRelistGuard({...relist(),noUnresolvedPaymentClaim:false,
  noOpenDispute:false,reservationReleasedSafely:false});
 assert.deepEqual(result.blockers,[
  "UNRESOLVED_PAYMENT_CLAIM","OPEN_DISPUTE_OR_UNKNOWN","RESERVATION_NOT_SAFELY_RELEASED"
 ]);
 onlyReview(result);
});
test("omitted relist guard object is denied rather than assuming permission",()=>{
 const result=reviewRelistGuard(undefined);
 assert.equal(result.prerequisitesSatisfied,false);
 assert.equal(result.blockers.length,8);
 onlyReview(result);
});
