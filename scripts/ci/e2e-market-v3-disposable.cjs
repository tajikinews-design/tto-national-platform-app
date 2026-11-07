"use strict";
/** Real loopback HTTP + isolated PG17 lab after all current migrations.
 * No hosted DB/financial settlement/official register or real ledger writes. */
const assert=require("node:assert/strict");
const {randomBytes}=require("node:crypto");
const {createDisposableMarketApi}=require("../../services/api/dist/market-v3-disposable-api.js");
const T="91111111-1111-4111-8111-111111111111";
const T2="92222222-2222-4222-8222-222222222222";
const SELLER="a1111111-1111-4111-8111-111111111111";
const SELLER_UNPAID="a6666666-6666-4666-8666-666666666666";
const BUYER1="a2222222-2222-4222-8222-222222222222";
const BUYER2="a3333333-3333-4333-8333-333333333333";
const NONMEMBER="a7777777-7777-4777-8777-777777777777";
const MANAGER="a4444444-4444-4444-8444-444444444444";
const REVIEWER="a5555555-5555-4555-8555-555555555555";
const BOARD_SECRETARY="a9999999-9999-4999-8999-999999999999";
const OUTSIDER="a8888888-8888-4888-8888-888888888888";
const token=process.env.TTO_MARKET_LAB_SECRET;
assert.match(token||"",/^[a-f0-9]{64}$/);
const {server,pool}=createDisposableMarketApi();
let checks=0;
(async()=>{
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
 const base="http://127.0.0.1:"+server.address().port;
 async function api(method,path,actor,body,key=undefined,secret=token){
   const r=await fetch(base+path,{
    method,
    headers:{"x-lab-actor":actor,...(secret?{"x-lab-secret":secret}:{}),
      ...(method==="POST"?{"idempotency-key":key||randomBytes(24).toString("hex"),"Content-Type":"application/json"}:{})},
    ...(method==="POST"?{body:JSON.stringify(body||{})}:{})
   });
   const j=await r.json();
   checks++;return {httpStatus:r.status,...j};
 }
 function status(result,expected,code=undefined){
   assert.equal(result.httpStatus,expected,JSON.stringify(result));
   if(code)assert.equal(result.code,code);
 }
 // Reject requests without correct test-secret, with no fallback to a browser claim.
 status(await api("GET",`/lab/tenants/${T}/market-offers`,BUYER1,undefined,undefined,null),401);
 status(await api("GET",`/lab/tenants/${T2}/market-offers`,BUYER1),403,"ROLE_OR_TENANT_DENIED");
 status(await api("POST",`/lab/tenants/${T}/sell-orders`,BUYER1,{quantity:10,saleMode:"FULL_OFFER"}),403);
 status(await api("POST",`/lab/tenants/${T}/sell-orders`,SELLER_UNPAID,{quantity:10,saleMode:"FULL_OFFER"}),409,"UNPAID_COMMITMENT_REVIEW_REQUIRED");
 status(await api("POST",`/lab/tenants/${T}/sell-orders`,SELLER,{quantity:101,saleMode:"FULL_OFFER"}),409,"INSUFFICIENT_AVAILABLE_SHARES");
 status(await api("POST",`/lab/tenants/${T}/sell-orders`,SELLER,{quantity:10,saleMode:"PARTIAL_MATCH"}),422,"MVP_FULL_OFFER_ONLY");
 const sellPath=`/lab/tenants/${T}/sell-orders`;
 const key1="sell-case-0000000001";
 const first=await api("POST",sellPath,SELLER,{quantity:10,saleMode:"FULL_OFFER"},key1);
 status(first,201);assert.equal(first.status,"QUEUED");assert.equal(first.idempotent,false);
 const repeat=await api("POST",sellPath,SELLER,{quantity:10,saleMode:"FULL_OFFER"},key1);
 status(repeat,201);assert.equal(repeat.offerId,first.offerId);assert.equal(repeat.idempotent,true);
 const second=await api("POST",sellPath,SELLER,{quantity:20,saleMode:"FULL_OFFER"},"sell-case-0000000002");
 status(second,201);assert.equal(second.status,"QUEUED");
 // Only market manager may publish, and only the oldest queued offer.
 const publish=offer=>`/lab/tenants/${T}/offers/${offer}/publish`;
 // Each seller sees only their own FIFO queue and an approximate, source-driven ETA.
 const queue=await api("GET",`/lab/tenants/${T}/my-queue`,SELLER);
 status(queue,200);assert.equal(queue.offers.length,2);
 assert.deepEqual(queue.offers.map(x=>x.queuePosition),[1,2]);
 assert.ok(queue.offers.every(x=>x.estimatedNotGuaranteed===true&&
   /^\d{4}-\d{2}-\d{2}$/.test(x.estimatedDate)));
 status(await api("GET",`/lab/tenants/${T}/my-queue`,BUYER1),403,"ROLE_OR_TENANT_DENIED");
 const schedule=offer=>`/lab/tenants/${T}/offers/${offer}/schedule`;
 status(await api("POST",schedule(second.offerId),MANAGER,{}),409,"FIFO_QUEUE_ORDER_REQUIRED");
 status(await api("POST",schedule(first.offerId),BUYER1,{}),403,"ROLE_OR_TENANT_DENIED");
 const firstSchedule=await api("POST",schedule(first.offerId),MANAGER,{});
 status(firstSchedule,200);
 assert.equal(firstSchedule.status,"SCHEDULED");
 assert.equal(firstSchedule.estimatedNotGuaranteed,true);
 status(await api("POST",schedule(first.offerId),MANAGER,{}),200);
 status(await api("POST",schedule(second.offerId),MANAGER,{}),200);
 status(await api("POST",publish(second.offerId),SELLER,{}),403,"ROLE_OR_TENANT_DENIED");
 status(await api("POST",publish(first.offerId),BUYER1,{}),403,"ROLE_OR_TENANT_DENIED");
 status(await api("POST",publish(first.offerId),MANAGER,{}),200);
 const available=await api("GET",`/lab/tenants/${T}/market-offers`,BUYER1);
 status(available,200);assert.equal(available.offers.length,1);
 assert.equal(available.offers[0].offer_id,first.offerId);
 assert.equal(JSON.stringify(available).includes("bank_account"),false);
 status(await api("POST",publish(second.offerId),MANAGER,{}),200);
 // Both buyers compete for one FULL_OFFER: row lock and UNIQUE(offer_id).
 const buyPath=`/lab/tenants/${T}/offers/${first.offerId}/buy`;
 const races=await Promise.all([
   api("POST",buyPath,BUYER1,{quantity:10},"buy-race-00000000001"),
   api("POST",buyPath,BUYER2,{quantity:10},"buy-race-00000000002")
 ]);
 assert.deepEqual(races.map(x=>x.httpStatus).sort(),[201,409]);
 assert.equal(races.filter(x=>x.httpStatus===201).length,1);
 const winnerIndex=races[0].httpStatus===201?0:1;
 const winner=winnerIndex===0?BUYER1:BUYER2;
 const winKey=winnerIndex===0?"buy-race-00000000001":"buy-race-00000000002";
 const win=races[winnerIndex];
 assert.equal(win.state,"COOP_REVIEW");assert.equal(win.boardApprovalGranted,false);
 const winAgain=await api("POST",buyPath,winner,{quantity:10},winKey);
 status(winAgain,201);assert.equal(winAgain.idempotent,true);
 status(await api("POST",`/lab/tenants/${T}/offers/${second.offerId}/buy`,
   NONMEMBER,{quantity:20}),409,"BUYER_LEGAL_ELIGIBILITY_NOT_CONFIRMED");
 status(await api("POST",`/lab/tenants/${T}/offers/${second.offerId}/buy`,
   OUTSIDER,{quantity:20}),403,"ROLE_OR_TENANT_DENIED");
 status(await api("POST",`/lab/tenants/${T}/offers/${second.offerId}/buy`,
   BUYER1,{quantity:20}),409,"BUYER_ACTIVE_CAP_EXCEEDED");
 const reviewPath=`/lab/tenants/${T}/buy-requests/${win.buyRequestId}/review`;
 status(await api("POST",reviewPath,SELLER,{verdict:"REFER_TO_BOARD"}),403,"ROLE_OR_TENANT_DENIED");
 status(await api("POST",reviewPath,REVIEWER,{verdict:"APPROVE_SHARE_TRANSFER"}),422,
   "COOPERATIVE_REVIEW_IS_NOT_BOARD_APPROVAL");
 const reviewKey="coop-case-0000000001";
 const reviewed=await api("POST",reviewPath,REVIEWER,{verdict:"REFER_TO_BOARD"},reviewKey);
 status(reviewed,200);assert.equal(reviewed.state,"BOARD_APPROVAL_PENDING");
 assert.equal(reviewed.boardApprovalGranted,false);
 const reviewAgain=await api("POST",reviewPath,REVIEWER,{verdict:"REFER_TO_BOARD"},reviewKey);
 status(reviewAgain,200);assert.equal(reviewAgain.reviewId,reviewed.reviewId);
 // BOARD_SECRETARIAT may only record evidence as a staged UNVERIFIED_DRAFT.
 // It cannot approve any legally binding board decision or enable payment.
 const boardPath=`/lab/tenants/${T}/buy-requests/${win.buyRequestId}/board-decision-draft`;
 const decision={decision:"APPROVE",meetingReference:"TEST-MEETING-2026-01",
   resolutionReference:"TEST-RESOLUTION-2026-01",
   attachmentReference:"TEST-EVIDENCE-DOC-2026-01",
   legalBasisReference:"TEST-ARTICLE-08",decisionDate:"2026-11-07"};
 status(await api("POST",boardPath,REVIEWER,decision),403,"ROLE_OR_TENANT_DENIED");
 status(await api("POST",boardPath,BOARD_SECRETARY,{...decision,attachmentReference:"bad"}),422,
   "BOARD_EVIDENCE_REFERENCE_REQUIRED");
 status(await api("POST",boardPath,BOARD_SECRETARY,{...decision,decision:"PAID"}),422,
   "INVALID_BOARD_DECISION");
 const boardKey="board-draft-000000001";
 const draft=await api("POST",boardPath,BOARD_SECRETARY,decision,boardKey);
 status(draft,201);
 assert.equal(draft.evidenceStatus,"UNVERIFIED_DRAFT");
 assert.equal(draft.legalBoardApprovalGranted,false);
 assert.equal(draft.sellerContinuationEnabled,false);
 const draftAgain=await api("POST",boardPath,BOARD_SECRETARY,decision,boardKey);
 status(draftAgain,201);assert.equal(draft.decisionId,draftAgain.decisionId);
 const dbDraft=await pool.query("SELECT evidence_status,verified_by,decision FROM market_v3_disposable.board_decision_drafts WHERE decision_id=$1",[draft.decisionId]);
 assert.equal(dbDraft.rows[0].evidence_status,"UNVERIFIED_DRAFT");
 assert.equal(dbDraft.rows[0].verified_by,null);
 assert.equal(dbDraft.rows[0].decision,"APPROVE");
 // Verification state and pricing must be source-derived; fake or expired source must fail.
 await pool.query("UPDATE market_v3_disposable.price_source_versions SET evidence_state='UNVERIFIED' WHERE source_id='TEST-PRICE-RULE'");
 status(await api("POST",sellPath,SELLER,{quantity:1,saleMode:"FULL_OFFER"},
   "sell-unverified-price-01"),409,"VERSIONED_PRICING_SOURCE_REQUIRED");
 await pool.query("UPDATE market_v3_disposable.price_source_versions SET evidence_state='LAB_TEST_ATTESTED' WHERE source_id='TEST-PRICE-RULE'");
 await pool.query("UPDATE market_v3_disposable.buyer_entitlement_sources SET evidence_state='UNVERIFIED' WHERE buyer_id=$1",[BUYER1]);
 status(await api("POST",`/lab/tenants/${T}/offers/${second.offerId}/buy`,
   BUYER1,{quantity:20}),409,"BUYER_LEGAL_ELIGIBILITY_NOT_CONFIRMED");
 // No purchase price, fee, bank transfer, official register or ownership-finalization API.
 for(const forbidden of ["/payments","/fees","/register","/finalize","/ownership-transfers"]){
  status(await api("POST",`/lab/tenants/${T}${forbidden}`,REVIEWER,{}),404,"LAB_ROUTE_NOT_FOUND");
 }
 // Verify original holdings stayed unchanged, while staged queue/review was persisted.
 const h=await pool.query("SELECT actor_id,registered_quantity FROM market_v3_disposable.holdings WHERE tenant_id=$1",[T]);
 assert.equal(h.rowCount,4);
 const seen=new Map(h.rows.map(x=>[x.actor_id,Number(x.registered_quantity)]));
 assert.equal(seen.get(SELLER),100);assert.equal(seen.get(BUYER1),10);assert.equal(seen.get(BUYER2),10);
 const trades=await pool.query("SELECT count(*)::integer AS n FROM market_v3_disposable.buy_requests");
 assert.equal(trades.rows[0].n,1);
 const reviews=await pool.query("SELECT state FROM market_v3_disposable.buy_requests WHERE buy_request_id=$1",[win.buyRequestId]);
 assert.equal(reviews.rows[0].state,"BOARD_APPROVAL_PENDING");
 console.log("PH12_MARKET_V3_ISOLATED_HTTP_QUEUE_BUY_COOP_PASS="+checks);
 console.log("PH12_MARKET_V3_CONCURRENT_FULL_OFFER_SINGLE_WINNER_PASS");
 console.log("PH12_MARKET_V3_TENANT_ROLE_IDEMPOTENCY_DIRECT_PAYMENT_GUARDS_PASS");
 console.log("PH12_MARKET_V3_OFFICIAL_SHARE_LEDGER_UNCHANGED_NO_FUNDS_NO_FINALIZATION_PASS");
 console.log("PH12_MARKET_V3_FIFO_ETA_POLICY_AND_VERSIONED_PRICING_PASS");
 console.log("PH12_MARKET_V3_SOURCED_BUYER_CAP_AND_BOARD_UNVERIFIED_EVIDENCE_PASS");
})().catch(e=>{console.error("PH12_MARKET_V3_LAB_FAILED",e);process.exitCode=1;})
.finally(async()=>{await new Promise(resolve=>server.close(resolve));await pool.end()});
