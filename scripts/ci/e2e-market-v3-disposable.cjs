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
const BOARD_META_REVIEWER="aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
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
 status(await api("POST",sellPath,SELLER,{quantity:11,saleMode:"FULL_OFFER"},key1),
   409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
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
 status(await api("POST",buyPath,winner,{quantity:9},winKey),
   409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
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
 status(await api("POST",`/lab/tenants/${T}/buy-requests/${"00000000-0000-4000-8000-000000000001"}/review`,
   REVIEWER,{verdict:"REFER_TO_BOARD"},reviewKey),409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
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
 status(await api("POST",boardPath,BOARD_SECRETARY,{...decision,resolutionReference:"TEST-NEW-RESOLUTION-2026"},boardKey),
   409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
 const dbDraft=await pool.query("SELECT evidence_status,verified_by,decision FROM market_v3_disposable.board_decision_drafts WHERE decision_id=$1",[draft.decisionId]);
 assert.equal(dbDraft.rows[0].evidence_status,"UNVERIFIED_DRAFT");
 assert.equal(dbDraft.rows[0].verified_by,null);
 assert.equal(dbDraft.rows[0].decision,"APPROVE");
 // Independent board metadata cross-check is NOT validation of signatures or legal mandate.
 const metadataPath=`/lab/tenants/${T}/board-drafts/${draft.decisionId}/metadata-check`;
 const metadataRefs={meetingReference:decision.meetingReference,
   resolutionReference:decision.resolutionReference,
   attachmentReference:decision.attachmentReference,
   legalBasisReference:decision.legalBasisReference};
 status(await api("POST",metadataPath,BOARD_SECRETARY,metadataRefs),403,"ROLE_OR_TENANT_DENIED");
 status(await api("POST",metadataPath,REVIEWER,metadataRefs),403,"ROLE_OR_TENANT_DENIED");
 status(await api("POST",metadataPath,BOARD_META_REVIEWER,
   {...metadataRefs,attachmentReference:"TEST-WRONG-EVIDENCE-2026"}),409,
   "BOARD_METADATA_SOURCE_MISMATCH");
 const metadataKey="board-independent-meta-01";
 const checked=await api("POST",metadataPath,BOARD_META_REVIEWER,metadataRefs,metadataKey);
 status(checked,201);
 assert.equal(checked.evidenceCheck,"LAB_METADATA_MATCHED_NOT_SIGNED");
 assert.equal(checked.legalBoardApprovalGranted,false);
 assert.equal(checked.sellerContinuationEnabled,false);
 const checkedAgain=await api("POST",metadataPath,BOARD_META_REVIEWER,metadataRefs,metadataKey);
 status(checkedAgain,201);assert.equal(checkedAgain.checkId,checked.checkId);
 const proof=await pool.query(
  "SELECT checked_by,entered_by,outcome FROM market_v3_disposable.board_evidence_metadata_reviews WHERE check_id=$1",
  [checked.checkId]);
 assert.equal(proof.rowCount,1);
 assert.notEqual(proof.rows[0].checked_by,proof.rows[0].entered_by);
 assert.equal(proof.rows[0].outcome,"LAB_METADATA_MATCHED_NOT_SIGNED");
 const unchanged=await pool.query(
  "SELECT evidence_status,verified_by FROM market_v3_disposable.board_decision_drafts WHERE decision_id=$1",
  [draft.decisionId]);
 assert.equal(unchanged.rows[0].evidence_status,"UNVERIFIED_DRAFT");
 assert.equal(unchanged.rows[0].verified_by,null);
 // Append-only test: updates to evidence-check rows must fail at SQL boundary.
 await assert.rejects(async()=>pool.query(
  "UPDATE market_v3_disposable.board_evidence_metadata_reviews SET outcome=outcome WHERE check_id=$1",
  [checked.checkId]),/LAB_REVIEW_APPEND_ONLY/);
 console.log("PH12_MARKET_V3_BOARD_INDEPENDENT_METADATA_ONLY_NO_LEGAL_SIGNOFF_PASS");

 // Sign a wholly synthetic board fixture with an ephemeral Ed25519 key.
 // The test key is created in this runner, NEVER stored in source or legal docs.
 const {generateKeyPairSync,sign}=require("node:crypto");
 const {syntheticBoardSigningMessage}=
   require("../../services/api/dist/market-v3-disposable-postboard.js");
 const pair=generateKeyPairSync("ed25519");
 const labSourceId="TEST-BOARD-AUTHORITY";
 const labSourceVersion=1;
 await pool.query(`INSERT INTO market_v3_disposable.lab_source_keys
    (tenant_id,source_id,source_version,public_key_pem,valid_from,valid_until,source_status)
    VALUES($1,$2,$3,$4,'2026-01-01','2028-01-01','LAB_TEST_ONLY')`,
    [T,labSourceId,labSourceVersion,
     pair.publicKey.export({type:"spki",format:"pem"}).toString()]);
 const signedMessage=syntheticBoardSigningMessage({
   tenantId:T,requestId:win.buyRequestId,decisionId:draft.decisionId,
   sourceId:labSourceId,sourceVersion:labSourceVersion,
   meetingReference:decision.meetingReference,
   resolutionReference:decision.resolutionReference,
   attachmentReference:decision.attachmentReference,
   legalBasisReference:decision.legalBasisReference,
   decisionDate:decision.decisionDate,decision:decision.decision
 });
 const signature=sign(null,signedMessage,pair.privateKey).toString("base64");
 const signedPayload={sourceId:labSourceId,sourceVersion:labSourceVersion,signature};
 const attestPath=`/lab/tenants/${T}/buy-requests/${win.buyRequestId}/test-board-source-attestation`;
 const continuePath=`/lab/tenants/${T}/buy-requests/${win.buyRequestId}/test-seller-continuation`;
 status(await api("POST",continuePath,SELLER,{accept:true}),409,
   "VALID_LAB_BOARD_SOURCE_REQUIRED");
 status(await api("POST",attestPath,BOARD_SECRETARY,signedPayload),403,"ROLE_OR_TENANT_DENIED");
 const wrongSignature=sign(null,Buffer.from("tampered"),pair.privateKey).toString("base64");
 status(await api("POST",attestPath,BOARD_META_REVIEWER,
   {...signedPayload,signature:wrongSignature}),409,"SYNTHETIC_SIGNATURE_NOT_VERIFIED");
 status(await api("POST",attestPath,BOARD_META_REVIEWER,
   {...signedPayload,sourceVersion:2}),409,"TRUSTED_LAB_SOURCE_UNAVAILABLE");
 const attestKey="synthetic-board-attest-001";
 const attest=await api("POST",attestPath,BOARD_META_REVIEWER,signedPayload,attestKey);
 status(attest,201);assert.equal(attest.attestationType,"LAB_SIGNED_SOURCE_TEST_ONLY");
 assert.equal(attest.legalBoardApprovalGranted,false);
 const attRepeat=await api("POST",attestPath,BOARD_META_REVIEWER,signedPayload,attestKey);
 status(attRepeat,201);assert.equal(attRepeat.attestationId,attest.attestationId);
 status(await api("POST",attestPath,BOARD_META_REVIEWER,
   {...signedPayload,signature:wrongSignature},attestKey),409,
   "SYNTHETIC_SIGNATURE_NOT_VERIFIED");
 const payInstructions=`/lab/tenants/${T}/buy-requests/${win.buyRequestId}/test-payment-instructions`;
 status(await api("GET",payInstructions,winner),403,"BUYER_NOT_AUTHORIZED_FOR_TRADE");
 status(await api("POST",continuePath,SELLER_UNPAID,{accept:true}),403,"SELLER_NOT_OWNER");
 status(await api("POST",continuePath,SELLER,{accept:false}),422,
   "EXPLICIT_SELLER_CONTINUATION_REQUIRED");
 const continuationKey="seller-test-continue-0001";
 const cont=await api("POST",continuePath,SELLER,{accept:true},continuationKey);
 status(cont,201);assert.equal(cont.state,"PAYMENT_PENDING");
 assert.equal(cont.customerCanOnlyPaySellerExternally,true);
 assert.equal(cont.legalBoardApprovalGranted,false);
 const contRepeat=await api("POST",continuePath,SELLER,{accept:true},continuationKey);
 status(contRepeat,201);assert.equal(contRepeat.idempotent,true);
 status(await api("GET",payInstructions,SELLER),403,"ROLE_OR_TENANT_DENIED");
 status(await api("GET",payInstructions,winnerIndex===0?BUYER2:BUYER1),403,
   "BUYER_NOT_AUTHORIZED_FOR_TRADE");
 const instructions=await api("GET",payInstructions,winner);
 status(instructions,200);
 assert.equal(instructions.bankReference,"TEST-BANK-SELLER-001");
 assert.equal(instructions.expectedGross,"10000");
 assert.equal(instructions.directBuyerToSellerOnly,true);
 // Buyer reports EXTERNAL money movement as unverified evidence; the service does not pay.
 const paymentPath=`/lab/tenants/${T}/buy-requests/${win.buyRequestId}/test-payment-report`;
 const evidence={amount:10000,bankLabel:"TEST-EXTERNAL-BANK",
   trackingReference:"TEST-TRACK-2026-0001",
   receiptReference:"TEST-RECEIPT-2026-0001",paymentDate:"2026-11-07"};
 status(await api("POST",paymentPath,SELLER,evidence),403,"ROLE_OR_TENANT_DENIED");
 status(await api("POST",paymentPath,winner,{...evidence,amount:9999}),409,
   "REPORTED_AMOUNT_NOT_TRADE_GROSS");
 const receiptPath=`/lab/tenants/${T}/buy-requests/${win.buyRequestId}/test-seller-receipt`;
 status(await api("POST",receiptPath,SELLER,{response:"RECEIVED_FULL"}),409,
   "SELLER_CONFIRMATION_NOT_READY");
 const paymentKey="payment-evidence-000001";
 const rep=await api("POST",paymentPath,winner,evidence,paymentKey);
 status(rep,201);assert.equal(rep.state,"PAYMENT_REPORTED");
 assert.equal(rep.receiptNotYetConfirmed,true);
 const repRepeat=await api("POST",paymentPath,winner,evidence,paymentKey);
 status(repRepeat,201);assert.equal(repRepeat.reportId,rep.reportId);
 status(await api("POST",paymentPath,winner,
   {...evidence,receiptReference:"TEST-DIFFERENT-RECEIPT-0001"},paymentKey),
   409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
 status(await api("POST",receiptPath,winner,{response:"RECEIVED_FULL"}),403,
   "ROLE_OR_TENANT_DENIED");
 const receiptKey="seller-receipt-test-00001";
 const received=await api("POST",receiptPath,SELLER,{response:"RECEIVED_FULL"},receiptKey);
 status(received,201);assert.equal(received.state,"PAYMENT_CONFIRMED");
 assert.equal(received.mandatoryFeesResolved,false);
 assert.equal(received.readyForOfficialRegister,false);
 assert.equal(received.realPaymentProcessed,false);
 const receivedAgain=await api("POST",receiptPath,SELLER,{response:"RECEIVED_FULL"},receiptKey);
 status(receivedAgain,201);assert.equal(receivedAgain.receiptId,received.receiptId);
 status(await api("POST",receiptPath,SELLER,{response:"NOT_RECEIVED"},receiptKey),
   409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
 const trueState=await pool.query(`SELECT state,bank_reference,expected_gross
   FROM market_v3_disposable.lab_trade_progress
   WHERE tenant_id=$1 AND buy_request_id=$2`,[T,win.buyRequestId]);
 assert.equal(trueState.rows[0].state,"PAYMENT_CONFIRMED");
 assert.equal(trueState.rows[0].expected_gross,"10000");
 const neverLegal=await pool.query(`SELECT evidence_status,verified_by
   FROM market_v3_disposable.board_decision_drafts WHERE decision_id=$1`,[draft.decisionId]);
 assert.equal(neverLegal.rows[0].evidence_status,"UNVERIFIED_DRAFT");
 assert.equal(neverLegal.rows[0].verified_by,null);
 const labAuthority=await pool.query(`SELECT attestation_type FROM
   market_v3_disposable.lab_board_attestations WHERE buy_request_id=$1`,[win.buyRequestId]);
 assert.equal(labAuthority.rows[0].attestation_type,"SYNTHETIC_SIGNATURE_TEST_NOT_LEGAL");
 console.log("PH12_MARKET_V3_TEST_ONLY_ED25519_SOURCE_AND_DIRECT_PAYMENT_EVIDENCE_PASS");

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
