/**
 * TTO Share Market v3 §§21-26. TEST ONLY.
 * Read a frozen cooperative fee policy snapshot, record a buyer's report of
 * payment made OUTSIDE the platform to the cooperative, and inspect why
 * appointment scheduling must remain blocked. Never operates a payment
 * gateway or promotes fee evidence to PAID/WAIVED/REFUNDED.
 */
import {randomUUID} from "node:crypto";
import type {IncomingMessage} from "node:http";
import type {Pool,PoolClient} from "pg";
import {PostBoardLabError} from "./market-v3-disposable-postboard";
type Input={req:IncomingMessage;parts:string[];tenant:string;actorId:string;key:string|null;
 pool:Pool;parseBody:()=>Promise<Record<string,unknown>>};
type Answer={status:number;value:Record<string,unknown>};
const LAB="market_v3_disposable";
const isUuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function fail(status:number,code:string):never{throw new PostBoardLabError(status,code)}
async function tx<T>(p:Pool,run:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await p.connect();
 try{await c.query("BEGIN");const v=await run(c);await c.query("COMMIT");return v}
 catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
}
async function allowParticipant(c:PoolClient,tenant:string,reqId:string,actorId:string):
 Promise<{buyer_id:string;seller_id:string}>{
 const who=await c.query(`SELECT role,status FROM ${LAB}.actors
  WHERE tenant_id=$1 AND actor_id=$2`,[tenant,actorId]);
 if(who.rows[0]?.status!=="ACTIVE"||
    !["BUYER","SELLER"].includes(who.rows[0]?.role))fail(403,"ROLE_OR_TENANT_DENIED");
 const r=await c.query(`SELECT b.buyer_id,o.seller_id
  FROM ${LAB}.buy_requests b JOIN ${LAB}.offers o
  ON o.offer_id=b.offer_id AND o.tenant_id=b.tenant_id
  WHERE b.tenant_id=$1 AND b.buy_request_id=$2`,[tenant,reqId]);
 const trade=r.rows[0];
 if(!trade||![trade.seller_id,trade.buyer_id].includes(actorId))
   fail(403,"TRADE_PARTICIPANT_DENIED");
 return trade;
}
export async function handleFeeEvidenceLab(input:Input):Promise<Answer|null>{
 const {parts,tenant,actorId,key,pool,parseBody,req}=input;
 if(parts.length!==6||parts[3]!=="buy-requests"||!isUuid.test(parts[4]??""))
   return null;
 const reqId=parts[4],action=parts[5];
 if(req.method==="GET"&&action==="test-fee-snapshot"){
   const details=await tx(pool,async c=>{
     await allowParticipant(c,tenant,reqId,actorId);
     const fees=await c.query(`SELECT fee_id,source_version,category,payer_mode,fee_amount,
       status,approval_reference,legal_basis_reference,snapshot_at
       FROM ${LAB}.lab_fee_policy_snapshots
       WHERE tenant_id=$1 AND buy_request_id=$2 ORDER BY fee_id`,[tenant,reqId]);
     if(!fees.rows.length)fail(409,"FEE_SNAPSHOT_MISSING");
     return fees.rows;
   });
   return {status:200,value:{feeSnapshots:details,sourceVersionFrozenAtBuyRequest:true,
     beneficiary:"TEST-COOP-ACCOUNT-001",platformHoldsFunds:false,
     externallyReportedIsNotPaid:true,officialFeeResolutionGranted:false}};
 }
 if(req.method==="POST"&&action==="test-fee-report"){
   const raw=await parseBody();
   const feeId=raw.feeId,beneficiary=raw.beneficiaryReference,reference=raw.externalReference;
   const value=raw.amount;
   if(typeof feeId!=="string"||!/^[A-Z0-9_.:-]{8,100}$/.test(feeId)||
      beneficiary!=="TEST-COOP-ACCOUNT-001"||
      typeof reference!=="string"||!/^[A-Z0-9_.:-]{8,140}$/.test(reference)||
      typeof value!=="number"||!Number.isSafeInteger(value)||value<=0)
     fail(422,"INVALID_COOPERATIVE_FEE_REPORT");
   const result=await tx(pool,async c=>{
     const participant=await allowParticipant(c,tenant,reqId,actorId);
     if(participant.buyer_id!==actorId)fail(403,"FEE_PAYER_NOT_AUTHORIZED");
     await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
       [`fee-report:${tenant}:${reqId}:${feeId}`]);
     const snapshot=await c.query(`SELECT * FROM ${LAB}.lab_fee_policy_snapshots
       WHERE tenant_id=$1 AND buy_request_id=$2 AND fee_id=$3 FOR UPDATE`,
       [tenant,reqId,feeId]);
     const fee=snapshot.rows[0];if(!fee)fail(404,"COOPERATIVE_FEE_NOT_FOUND");
     if(fee.payer_mode!=="BUYER")fail(409,"FEE_PAYER_POLICY_NOT_SUPPORTED");
     const old=await c.query(`SELECT * FROM ${LAB}.lab_fee_payment_reports
       WHERE tenant_id=$1 AND payer_id=$2 AND idempotency_key=$3`,[tenant,actorId,key]);
     if(old.rows[0]){
       const p=old.rows[0];
       if(p.buy_request_id!==reqId||p.fee_id!==feeId||
          BigInt(p.amount)!==BigInt(value)||p.external_reference!==reference||
          p.beneficiary_reference!==beneficiary)
         fail(409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
       return {reportId:p.report_id,status:"PAYMENT_REPORTED",idempotent:true};
     }
     if(fee.status!=="UNPAID")fail(409,"COOPERATIVE_FEE_REPORT_ALREADY_EXISTS");
     if(BigInt(fee.fee_amount)!==BigInt(value))fail(409,"COOPERATIVE_FEE_AMOUNT_MISMATCH");
     const progress=await c.query(`SELECT state FROM ${LAB}.lab_trade_progress
       WHERE tenant_id=$1 AND buy_request_id=$2`,[tenant,reqId]);
     if(progress.rows[0]?.state!=="PAYMENT_CONFIRMED")
       fail(409,"SELLER_RECEIPT_OR_DISPUTE_UNRESOLVED");
     const report=await c.query(`INSERT INTO ${LAB}.lab_fee_payment_reports
       (report_id,tenant_id,buy_request_id,fee_id,payer_id,amount,
        external_reference,beneficiary_reference,idempotency_key,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'UNVERIFIED_EXTERNAL_FEE_REPORT')
       RETURNING report_id`,[randomUUID(),tenant,reqId,feeId,actorId,
          String(value),reference,beneficiary,key]);
     await c.query(`UPDATE ${LAB}.lab_fee_policy_snapshots SET status='PAYMENT_REPORTED'
       WHERE tenant_id=$1 AND buy_request_id=$2 AND fee_id=$3`,[tenant,reqId,feeId]);
     return {reportId:report.rows[0].report_id,status:"PAYMENT_REPORTED",idempotent:false};
   });
   return {status:201,value:{...result,externalPaymentEvidenceOnly:true,
     officialCooperativeFeePaid:false,platformHeldFunds:false,appointmentEnabled:false,
     legalOwnershipChanged:false}};
 }
 if(req.method==="GET"&&action==="test-appointment-readiness"){
   const checks=await tx(pool,async c=>{
     await allowParticipant(c,tenant,reqId,actorId);
     const progress=await c.query(`SELECT state FROM ${LAB}.lab_trade_progress
       WHERE tenant_id=$1 AND buy_request_id=$2`,[tenant,reqId]);
     const fees=await c.query(`SELECT status FROM ${LAB}.lab_fee_policy_snapshots
       WHERE tenant_id=$1 AND buy_request_id=$2`,[tenant,reqId]);
     const reasons=["NO_AUTHENTICATED_LEGAL_BOARD_MANDATE",
                    "NO_OFFICIALLY_VERIFIED_COOPERATIVE_FEE_SETTLEMENT",
                    "INDEPENDENT_LEGAL_ACCEPTANCE_NOT_GRANTED"];
     if(!progress.rows[0]||progress.rows[0].state!=="PAYMENT_CONFIRMED")
       reasons.push(progress.rows[0]?.state==="PAYMENT_DISPUTED"?
         "OPEN_PAYMENT_DISPUTE":"SELLER_PAYMENT_CONFIRMATION_MISSING");
     if(!fees.rows.length||fees.rows.some(x=>x.status!=="PAYMENT_REPORTED"))
       reasons.push("COOPERATIVE_FEE_EVIDENCE_MISSING");
     return reasons;
   });
   return {status:200,value:{readyForAppointment:false,appointmentCreated:false,
     blockingReasons:checks,officialRegisterUpdated:false,legalOwnershipChanged:false}};
 }
 return null;
}
