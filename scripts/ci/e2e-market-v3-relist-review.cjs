"use strict";
/** PR189: Real loopback HTTP + disposable PostgreSQL17 relist-review state-machine proof.
 * Synthetic only. Cannot publish, unlock, pay, finalize or change official holdings.
 */
const assert=require("node:assert/strict");
const {randomBytes,randomUUID}=require("node:crypto");
const {createDisposableMarketApi}=require("../../services/api/dist/market-v3-disposable-api.js");
const T="91111111-1111-4111-8111-111111111111";
const T2="92222222-2222-4222-8222-222222222222";
const SELLER="a1111111-1111-4111-8111-111111111111";
const MANAGER="a4444444-4444-4444-8444-444444444444";
const BUYER="a2222222-2222-4222-8222-222222222222";
const OUTSIDER="a8888888-8888-4888-8888-888888888888";
assert.equal(process.env.CI,"true");
assert.equal(process.env.TTO_MARKET_DISPOSABLE_LAB,"1");
assert.match(process.env.TTO_MARKET_LAB_SECRET||"",/^[a-f0-9]{64}$/);
const {server,pool}=createDisposableMarketApi();
(async()=>{
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
 const base="http://127.0.0.1:"+server.address().port;
 const offer=randomUUID();
 const path=`/lab/tenants/${T}/offers/${offer}/relist-review`;
 async function call(actor,uri=path,body={},key=randomBytes(16).toString("hex")){
   const response=await fetch(base+uri,{method:"POST",headers:{
    "x-lab-secret":process.env.TTO_MARKET_LAB_SECRET,"x-lab-actor":actor,
    "idempotency-key":key,"Content-Type":"application/json"},body:JSON.stringify(body)});
   return {status:response.status,...await response.json()};
 }
 try{
  await pool.query(`INSERT INTO market_v3_disposable.offers
   (offer_id,tenant_id,seller_id,requested_quantity,unit_price,pricing_rule_version,idempotency_key,status)
   VALUES($1,$2,$3,10,1000,'TEST-PRICE-RULE-v1','lab-relist-case-001','RESERVED')`,
   [offer,T,SELLER]);
  const fields=[
   "no_unresolved_payment_claim","no_open_dispute","no_legal_hold",
   "reservation_released_safely","offer_still_valid","pricing_rule_valid",
   "seller_relist_permission_valid","market_policy_allows"
  ];
  await pool.query(`INSERT INTO market_v3_disposable.lab_relist_review
   (tenant_id,offer_id,source_version,source_kind,valid_until,
    no_unresolved_payment_claim,no_open_dispute,no_legal_hold,reservation_released_safely,
    offer_still_valid,pricing_rule_valid,seller_relist_permission_valid,market_policy_allows)
   VALUES($1,$2,1,'SYNTHETIC_PG17_REVIEW_ONLY',clock_timestamp()+interval '1 day',
    true,true,true,true,true,true,true,true)`,[T,offer]);
  const observedBefore=await pool.query("SELECT registered_quantity FROM market_v3_disposable.holdings WHERE tenant_id=$1 AND actor_id=$2",[T,SELLER]);
  assert.equal(Number(observedBefore.rows[0].registered_quantity),100);
  assert.equal((await call(BUYER)).status,403);
  assert.equal((await call(OUTSIDER)).status,403);
  assert.equal((await call(MANAGER,`/lab/tenants/${T}/offers/${randomUUID()}/relist-review`)).status,404);
  for(const field of fields){
   for(const value of [false,null]){
    await pool.query(`UPDATE market_v3_disposable.lab_relist_review SET ${field}=$3 WHERE tenant_id=$1 AND offer_id=$2`,[T,offer,value]);
    const blocked=await call(MANAGER);
    assert.equal(blocked.status,409,field);
    assert.equal(blocked.code,"RELIST_GUARD_BLOCKED",field);
    assert.equal(blocked.listingAuthorized,false);
    assert.equal(blocked.sharesUnlocked,false);
    const db=await pool.query("SELECT review_state FROM market_v3_disposable.lab_relist_review WHERE tenant_id=$1 AND offer_id=$2",[T,offer]);
    assert.equal(db.rows[0].review_state,"PENDING_REVIEW",field);
    await pool.query(`UPDATE market_v3_disposable.lab_relist_review SET ${field}=true WHERE tenant_id=$1 AND offer_id=$2`,[T,offer]);
   }
  }
  await pool.query("UPDATE market_v3_disposable.lab_relist_review SET valid_until=clock_timestamp()-interval '1 second' WHERE tenant_id=$1 AND offer_id=$2",[T,offer]);
  assert.equal((await call(MANAGER)).code,"RELIST_VERIFIED_SOURCE_MISSING_OR_EXPIRED");
  await pool.query("UPDATE market_v3_disposable.lab_relist_review SET valid_until=clock_timestamp()+interval '1 day' WHERE tenant_id=$1 AND offer_id=$2",[T,offer]);
  const good=await call(MANAGER);
  assert.equal(good.status,200);assert.equal(good.reviewState,"READY_FOR_INDEPENDENT_REVIEW");
  assert.equal(good.offerStatus,"RESERVED");assert.equal(good.listingAuthorized,false);
  assert.equal(good.legalOwnershipChanged,false);assert.equal(good.financialTransaction,false);
  const again=await call(MANAGER);
  assert.equal(again.status,200);assert.equal(again.idempotent,true);
  const persisted=await pool.query(`SELECT review_state,reviewed_by FROM market_v3_disposable.lab_relist_review
   WHERE tenant_id=$1 AND offer_id=$2`,[T,offer]);
  assert.equal(persisted.rows[0].review_state,"READY_FOR_INDEPENDENT_REVIEW");
  assert.equal(persisted.rows[0].reviewed_by,MANAGER);
  // Source revocation and expiry must roll a prior green review back to PENDING.
  await pool.query("UPDATE market_v3_disposable.lab_relist_review SET no_open_dispute=false WHERE tenant_id=$1 AND offer_id=$2",[T,offer]);
  const invalidated=await call(MANAGER);
  assert.equal(invalidated.status,409);assert.equal(invalidated.code,"RELIST_GUARD_BLOCKED");
  let afterInvalidation=await pool.query("SELECT review_state,reviewed_by,reviewed_at FROM market_v3_disposable.lab_relist_review WHERE tenant_id=$1 AND offer_id=$2",[T,offer]);
  assert.equal(afterInvalidation.rows[0].review_state,"PENDING_REVIEW");
  assert.equal(afterInvalidation.rows[0].reviewed_by,null);
  assert.equal(afterInvalidation.rows[0].reviewed_at,null);
  await pool.query("UPDATE market_v3_disposable.lab_relist_review SET no_open_dispute=true WHERE tenant_id=$1 AND offer_id=$2",[T,offer]);
  assert.equal((await call(MANAGER)).status,200);
  await pool.query("UPDATE market_v3_disposable.lab_relist_review SET valid_until=clock_timestamp()-interval '1 second' WHERE tenant_id=$1 AND offer_id=$2",[T,offer]);
  const expiredReview=await call(MANAGER);
  assert.equal(expiredReview.status,409);assert.equal(expiredReview.code,"RELIST_VERIFIED_SOURCE_MISSING_OR_EXPIRED");
  afterInvalidation=await pool.query("SELECT review_state FROM market_v3_disposable.lab_relist_review WHERE tenant_id=$1 AND offer_id=$2",[T,offer]);
  assert.equal(afterInvalidation.rows[0].review_state,"PENDING_REVIEW");
  const stillReserved=await pool.query("SELECT status FROM market_v3_disposable.offers WHERE offer_id=$1",[offer]);
  assert.equal(stillReserved.rows[0].status,"RESERVED");
  const holdings=await pool.query("SELECT registered_quantity FROM market_v3_disposable.holdings WHERE tenant_id=$1 AND actor_id=$2",[T,SELLER]);
  assert.equal(Number(holdings.rows[0].registered_quantity),100);
  console.log("TTO_MARKET_RELIST_PG17_8_GUARDS_ROLE_TENANT_NO_SHARE_CHANGE_PASS");
 }finally{
  await pool.end();await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error("TTO_MARKET_RELIST_PG17_FAIL",e);process.exitCode=1;});
