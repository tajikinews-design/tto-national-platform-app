/**
 * v3 §§21–25 disposable fee components and independent documentary assessment.
 * NOT a real payment provider, not a statutory fee decision, not an official PAID.
 */
import {randomUUID} from "node:crypto";
import type {IncomingMessage} from "node:http";
import type {Pool,PoolClient} from "pg";
import {PostBoardLabError} from "./market-v3-disposable-postboard";
const LAB="market_v3_disposable";
type LabInput={req:IncomingMessage;parts:string[];tenant:string;actorId:string;
  key:string|null;pool:Pool;parseBody:()=>Promise<Record<string,unknown>>};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function deny(code:string,status=409):never{throw new PostBoardLabError(status,code)}
function label(v:unknown):string{
 if(typeof v!=="string"||!/^[A-Z0-9_.:-]{8,160}$/.test(v))deny("INVALID_FEE_EVIDENCE",422);
 return v;
}
async function tx<T>(p:Pool,work:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await p.connect();
 try{await c.query("BEGIN");const r=await work(c);await c.query("COMMIT");return r}
 catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
}
async function sourceActor(c:PoolClient,tenant:string,id:string){
 const r=await c.query(`SELECT * FROM ${LAB}.actors
  WHERE tenant_id=$1 AND actor_id=$2`,[tenant,id]);
 if(!r.rows[0]||r.rows[0].status!=="ACTIVE"||r.rows[0].source_verified!==true)
   deny("ROLE_OR_TENANT_DENIED",403);
 return r.rows[0];
}
async function participants(c:PoolClient,tenant:string,reqId:string){
 const r=await c.query(`SELECT b.buyer_id,o.seller_id FROM ${LAB}.buy_requests b
  JOIN ${LAB}.offers o ON b.offer_id=o.offer_id AND b.tenant_id=o.tenant_id
  WHERE b.tenant_id=$1 AND b.buy_request_id=$2`,[tenant,reqId]);
 if(!r.rows[0])deny("TRADE_NOT_FOUND",404);
 return r.rows[0];
}
export async function handleMultiFeeLab(input:LabInput):
 Promise<{status:number;value:Record<string,unknown>}|null>{
 const {req,parts,tenant,actorId,pool,key,parseBody}=input;
 if(parts.length!==6||parts[3]!=="buy-requests"||!uuid.test(parts[4]??""))return null;
 const reqId=parts[4],action=parts[5];
 if(req.method==="GET"&&action==="test-fee-components"){
  const rows=await tx(pool,async c=>{
   await sourceActor(c,tenant,actorId);
   const p=await participants(c,tenant,reqId);
   if(![p.buyer_id,p.seller_id].includes(actorId))deny("TRADE_PARTICIPANT_DENIED",403);
   const r=await c.query(`SELECT fee_id,category,source_version,calculation_mode,
     percentage_rate_bps,payer_mode,fee_amount,buyer_amount,seller_amount,
     status FROM ${LAB}.lab_fee_policy_snapshots
     WHERE tenant_id=$1 AND buy_request_id=$2 ORDER BY fee_id`,[tenant,reqId]);
   return r.rows;
  });
  return {status:200,value:{components:rows,externalDirectToCooperativeOnly:true,
    legalFeePaid:false,platformHoldsFunds:false}};
 }
 if(req.method==="POST"&&action==="test-fee-component-report"){
  const raw=await parseBody();
  const feeId=label(raw.feeId),side=raw.payerSide,reference=label(raw.evidenceReference);
  if(!["BUYER","SELLER"].includes(String(side)))deny("INVALID_FEE_PAYER_SIDE",422);
  if(raw.beneficiaryReference!=="TEST-COOP-ACCOUNT-001")deny("INVALID_COOPERATIVE_DESTINATION",422);
  if(typeof raw.amount!=="number"||!Number.isSafeInteger(raw.amount)||raw.amount<1)
     deny("INVALID_FEE_AMOUNT",422);
  const value=BigInt(raw.amount);
  const result=await tx(pool,async c=>{
   const a=await sourceActor(c,tenant,actorId);
   if(a.role!==side)deny("FEE_SIDE_ROLE_DENIED",403);
   const p=await participants(c,tenant,reqId);
   if((side==="BUYER"&&p.buyer_id!==actorId)||
      (side==="SELLER"&&p.seller_id!==actorId))deny("FEE_PAYER_NOT_AUTHORIZED",403);
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      [`lab-fee-part:${tenant}:${reqId}:${feeId}:${side}`]);
   const snap=await c.query(`SELECT * FROM ${LAB}.lab_fee_policy_snapshots
     WHERE tenant_id=$1 AND buy_request_id=$2 AND fee_id=$3 FOR UPDATE`,
     [tenant,reqId,feeId]);
   const fee=snap.rows[0];if(!fee)deny("FEE_SNAPSHOT_NOT_FOUND",404);
   const due=BigInt(side==="BUYER"?fee.buyer_amount:fee.seller_amount);
   if(due===0n)deny("FEE_SIDE_HAS_NO_LIABILITY");
   if(value!==due)deny("FEE_COMPONENT_AMOUNT_MISMATCH");
   const existing=await c.query(`SELECT * FROM ${LAB}.lab_fee_component_reports
      WHERE tenant_id=$1 AND payer_id=$2 AND idempotency_key=$3`,
      [tenant,actorId,key]);
   if(existing.rows[0]){
     const e=existing.rows[0];
     if(e.buy_request_id!==reqId||e.fee_id!==feeId||e.payer_side!==side||
       BigInt(e.amount)!==value||e.evidence_reference!==reference||
       e.beneficiary_reference!==raw.beneficiaryReference)
       deny("IDEMPOTENCY_PAYLOAD_MISMATCH");
     return {reportId:e.report_id,idempotent:true};
   }
   const previous=await c.query(`SELECT report_id FROM ${LAB}.lab_fee_component_reports
      WHERE tenant_id=$1 AND buy_request_id=$2 AND fee_id=$3 AND payer_side=$4`,
      [tenant,reqId,feeId,side]);
   if(previous.rows[0])deny("FEE_SIDE_ALREADY_REPORTED");
   const trade=await c.query(`SELECT state FROM ${LAB}.lab_trade_progress
      WHERE tenant_id=$1 AND buy_request_id=$2`,[tenant,reqId]);
   if(trade.rows[0]?.state!=="PAYMENT_CONFIRMED")
       deny("SELLER_RECEIPT_OR_DISPUTE_UNRESOLVED");
   const ins=await c.query(`INSERT INTO ${LAB}.lab_fee_component_reports
     (report_id,tenant_id,buy_request_id,fee_id,payer_id,payer_side,amount,
      beneficiary_reference,evidence_reference,idempotency_key)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING report_id`,
     [randomUUID(),tenant,reqId,feeId,actorId,side,value.toString(),
       raw.beneficiaryReference,reference,key]);
   return {reportId:ins.rows[0].report_id,idempotent:false};
  });
  return {status:201,value:{...result,evidenceStatus:"UNVERIFIED_EXTERNAL_REPORT",
    legalFeePaid:false,realPaymentProcessed:false,legalOwnershipChanged:false}};
 }
 if(req.method==="POST"&&action==="test-fee-document-review"){
  const raw=await parseBody();
  const reportId=String(raw.reportId??""),decision=raw.decision,
   reason=label(raw.reviewReason),sourceRef=label(raw.sourceDocumentReference);
  if(!uuid.test(reportId)||!["CHECK_METADATA","REJECT_DOCUMENT"].includes(String(decision)))
    deny("INVALID_FEE_REVIEW",422);
  const result=await tx(pool,async c=>{
   const a=await sourceActor(c,tenant,actorId);
   if(a.role!=="COOP_FINANCE_OPERATOR")deny("FINANCE_REVIEW_ROLE_REQUIRED",403);
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      [`lab-fee-review:${tenant}:${reportId}`]);
   const e=await c.query(`SELECT * FROM ${LAB}.lab_fee_component_reports
      WHERE tenant_id=$1 AND report_id=$2`,[tenant,reportId]);
   const report=e.rows[0];
   if(!report||report.buy_request_id!==reqId)deny("FEE_REPORT_NOT_FOUND",404);
   if(report.payer_id===actorId)deny("FOUR_EYES_REVIEW_REQUIRED",403);
   const old=await c.query(`SELECT * FROM ${LAB}.lab_fee_documentary_reviews
      WHERE tenant_id=$1 AND reviewer_id=$2 AND idempotency_key=$3`,
      [tenant,actorId,key]);
   const outcome=decision==="CHECK_METADATA"?"LAB_DOCUMENT_CHECKED_NOT_PAID":"LAB_DOCUMENT_REJECTED";
   if(old.rows[0]){
     const x=old.rows[0];
     if(x.report_id!==reportId||x.decision!==outcome||
        x.review_reason!==reason||x.source_document_reference!==sourceRef)
       deny("IDEMPOTENCY_PAYLOAD_MISMATCH");
     return {reviewId:x.review_id,decision:x.decision,idempotent:true};
   }
   const previous=await c.query(`SELECT review_id FROM ${LAB}.lab_fee_documentary_reviews
      WHERE tenant_id=$1 AND report_id=$2`,[tenant,reportId]);
   if(previous.rows[0])deny("FEE_DOCUMENT_ALREADY_REVIEWED");
   const ins=await c.query(`INSERT INTO ${LAB}.lab_fee_documentary_reviews
      (review_id,tenant_id,report_id,reviewer_id,decision,review_reason,
       source_document_reference,idempotency_key)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING review_id`,
      [randomUUID(),tenant,reportId,actorId,outcome,reason,sourceRef,key]);
   return {reviewId:ins.rows[0].review_id,decision:outcome,idempotent:false};
  });
  return {status:201,value:{...result,technicalDocumentaryReviewOnly:true,
   legalFeePaid:false,statutoryVerification:false,appointmentEnabled:false,
   officialRegisterUpdated:false,legalOwnershipChanged:false}};
 }
 return null;
}
