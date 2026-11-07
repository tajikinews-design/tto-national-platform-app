/**
 * TEST ONLY §51 board attestation / seller continuation / buyer payment report /
 * seller receipt evidence. No production route, real mandate, bank transfer,
 * actual source sync or official share-register writes.
 * The Ed25519 trust root is created by the isolated test runner, never
 * embedded in source code; successful verification is LAB_TEST_ONLY.
 */
import {randomUUID, verify as cryptoVerify} from "node:crypto";
import type {IncomingMessage} from "node:http";
import type {Pool,PoolClient} from "pg";
export class PostBoardLabError extends Error {
  constructor(readonly status:number,readonly code:string){super(code);}
}
type Input={req:IncomingMessage;parts:string[];tenant:string;actorId:string;
  key:string|null;pool:Pool;parseBody:()=>Promise<Record<string,unknown>>};
type Answer={status:number;value:Record<string,unknown>};
const LAB="market_v3_disposable";
function fail(status:number,code:string):never{throw new PostBoardLabError(status,code)}
function validText(value:unknown,min=8,max=140):string{
  if(typeof value!=="string"||value.length<min||value.length>max||
     !/^[a-zA-Z0-9_.:-]+$/.test(value))return fail(422,"INVALID_EVIDENCE_REFERENCE");
  return value;
}
function isoDate(d:unknown):string {
  if(d instanceof Date)return d.toISOString().slice(0,10);
  return String(d).slice(0,10);
}
function amount(v:unknown):bigint{
  if(typeof v!=="number"||!Number.isSafeInteger(v)||v<=0)return fail(422,"INVALID_REPORTED_AMOUNT");
  return BigInt(v);
}
function serialize(c:PoolClient,key:string){return c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[key]);}
async function tx<T>(p:Pool,cb:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await p.connect();
  try{await c.query("BEGIN");const x=await cb(c);await c.query("COMMIT");return x}
  catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
}
async function role(c:PoolClient,tenant:string,actorId:string,expected:string){
  const r=await c.query(`SELECT role,status,source_verified FROM ${LAB}.actors
    WHERE tenant_id=$1 AND actor_id=$2`,[tenant,actorId]);
  if(r.rows[0]?.status!=="ACTIVE"||r.rows[0]?.role!==expected||
     r.rows[0]?.source_verified!==true)fail(403,"ROLE_OR_TENANT_DENIED");
}
export function syntheticBoardSigningMessage(args:{
  tenantId:string;requestId:string;decisionId:string;sourceId:string;
  sourceVersion:number;meetingReference:string;resolutionReference:string;
  attachmentReference:string;legalBasisReference:string;decisionDate:string;
  decision:string;
}):Buffer {
  return Buffer.from(JSON.stringify({
    purpose:"TTO_PH12_DISPOSABLE_BOARD_TEST_NOT_LEGAL",
    tenantId:args.tenantId,requestId:args.requestId,decisionId:args.decisionId,
    sourceId:args.sourceId,sourceVersion:args.sourceVersion,
    meetingReference:args.meetingReference,resolutionReference:args.resolutionReference,
    attachmentReference:args.attachmentReference,legalBasisReference:args.legalBasisReference,
    decisionDate:args.decisionDate,decision:args.decision
  }),"utf8");
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const noLegal={legalBoardApprovalGranted:false,realPaymentProcessed:false,
 officialRegisterUpdated:false,legalOwnershipChanged:false,syntheticLabOnly:true};
export async function handlePostBoardLab(input:Input):Promise<Answer|null>{
  const {parts,tenant,actorId,key,pool,parseBody,req}=input;
  // All routes deliberately live underneath /lab, never Nest production API.
  if(parts.length===6&&parts[3]==="buy-requests"&&uuid.test(parts[4])
     &&parts[5]==="test-board-source-attestation"&&req.method==="POST"){
    const requestId=parts[4],b=await parseBody();
    const sourceId=validText(b.sourceId),sourceVersion=b.sourceVersion;
    if(typeof sourceVersion!=="number"||!Number.isSafeInteger(sourceVersion)||sourceVersion<1)
      fail(422,"SOURCE_VERSION_INVALID");
    if(typeof b.signature!=="string"||!/^[A-Za-z0-9+/]{80,200}={0,2}$/.test(b.signature))
      fail(422,"INVALID_TEST_SIGNATURE");
    const sig=Buffer.from(b.signature,"base64");
    if(sig.length!==64||sig.toString("base64")!==b.signature)fail(422,"INVALID_TEST_SIGNATURE");
    const result=await tx(pool,async c=>{
      await role(c,tenant,actorId,"BOARD_EVIDENCE_REVIEWER");
      await serialize(c,`board-attest:${tenant}:${requestId}`);
      const row=await c.query(`SELECT d.* FROM ${LAB}.board_decision_drafts d
        WHERE d.tenant_id=$1 AND d.buy_request_id=$2 FOR SHARE`,[tenant,requestId]);
      const d=row.rows[0];if(!d)fail(404,"BOARD_DRAFT_NOT_FOUND");
      if(d.decision!=="APPROVE")fail(409,"BOARD_DRAFT_NOT_APPROVAL");
      const review=await c.query(`SELECT check_id,checked_by FROM ${LAB}.board_evidence_metadata_reviews
        WHERE tenant_id=$1 AND decision_id=$2`,[tenant,d.decision_id]);
      if(!review.rows[0]||review.rows[0].checked_by!==actorId||d.entered_by===actorId)
        fail(409,"INDEPENDENT_METADATA_CHECK_REQUIRED");
      const source=await c.query(`SELECT * FROM ${LAB}.lab_source_keys
        WHERE tenant_id=$1 AND source_id=$2 AND source_version=$3
          AND source_status='LAB_TEST_ONLY'
          AND valid_from<=clock_timestamp() AND valid_until>clock_timestamp()`,
        [tenant,sourceId,sourceVersion]);
      if(!source.rows[0])fail(409,"TRUSTED_LAB_SOURCE_UNAVAILABLE");
      const message=syntheticBoardSigningMessage({
        tenantId:tenant,requestId,decisionId:d.decision_id,sourceId,sourceVersion,
        meetingReference:d.meeting_reference,resolutionReference:d.resolution_reference,
        attachmentReference:d.attachment_reference,legalBasisReference:d.legal_basis_reference,
        decisionDate:isoDate(d.decision_date),decision:d.decision
      });
      if(!cryptoVerify(null,message,source.rows[0].public_key_pem,sig))
        fail(409,"SYNTHETIC_SIGNATURE_NOT_VERIFIED");
      const prev=await c.query(`SELECT * FROM ${LAB}.lab_board_attestations
        WHERE tenant_id=$1 AND reviewed_by=$2 AND idempotency_key=$3`,[tenant,actorId,key]);
      if(prev.rows[0]){
        if(prev.rows[0].buy_request_id!==requestId||
          prev.rows[0].source_id!==sourceId||
          Number(prev.rows[0].source_version)!==sourceVersion||
          prev.rows[0].evidence_signature_base64!==b.signature)
          fail(409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
        return {attestationId:prev.rows[0].attestation_id,idempotent:true};
      }
      const exists=await c.query(`SELECT 1 FROM ${LAB}.lab_board_attestations
        WHERE tenant_id=$1 AND buy_request_id=$2`,[tenant,requestId]);
      if(exists.rowCount)fail(409,"BOARD_LAB_ATTESTATION_EXISTS");
      const ins=await c.query(`INSERT INTO ${LAB}.lab_board_attestations
        (attestation_id,tenant_id,buy_request_id,decision_id,source_id,source_version,
         evidence_signature_base64,reviewed_by,attestation_type,idempotency_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'SYNTHETIC_SIGNATURE_TEST_NOT_LEGAL',$9)
        RETURNING attestation_id`,
        [randomUUID(),tenant,requestId,d.decision_id,sourceId,sourceVersion,b.signature,actorId,key]);
      return {attestationId:ins.rows[0].attestation_id,idempotent:false};
    });
    return {status:201,value:{...result,attestationType:"LAB_SIGNED_SOURCE_TEST_ONLY",...noLegal}};
  }
  if(parts.length===6&&parts[3]==="buy-requests"&&uuid.test(parts[4])&&
     parts[5]==="test-seller-continuation"&&req.method==="POST"){
    const requestId=parts[4],b=await parseBody();
    if(b.accept!==true)fail(422,"EXPLICIT_SELLER_CONTINUATION_REQUIRED");
    const result=await tx(pool,async c=>{
      await role(c,tenant,actorId,"SELLER");
      await serialize(c,`seller-continue:${tenant}:${requestId}`);
      const previous=await c.query(`SELECT * FROM ${LAB}.lab_trade_progress
        WHERE tenant_id=$1 AND seller_id=$2 AND seller_continuation_key=$3`,
        [tenant,actorId,key]);
      if(previous.rows[0]){
        if(previous.rows[0].buy_request_id!==requestId)fail(409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
        return {state:previous.rows[0].state,idempotent:true};
      }
      const trade=await c.query(`SELECT b.state,b.buyer_id,b.quantity,o.seller_id,o.unit_price
        FROM ${LAB}.buy_requests b JOIN ${LAB}.offers o
        ON o.offer_id=b.offer_id AND o.tenant_id=b.tenant_id
        WHERE b.tenant_id=$1 AND b.buy_request_id=$2 FOR SHARE OF b,o`,[tenant,requestId]);
      const t=trade.rows[0];if(!t)fail(404,"TRADE_NOT_FOUND");
      if(t.seller_id!==actorId)fail(403,"SELLER_NOT_OWNER");
      if(t.state!=="BOARD_APPROVAL_PENDING")fail(409,"BOARD_REVIEW_NOT_READY");
      const evidence=await c.query(`SELECT a.attestation_id FROM ${LAB}.lab_board_attestations a
        JOIN ${LAB}.lab_source_keys k
        ON a.tenant_id=k.tenant_id AND a.source_id=k.source_id AND a.source_version=k.source_version
        WHERE a.tenant_id=$1 AND a.buy_request_id=$2
          AND k.source_status='LAB_TEST_ONLY'
          AND k.valid_from<=clock_timestamp() AND k.valid_until>clock_timestamp()`,
        [tenant,requestId]);
      if(!evidence.rows[0])fail(409,"VALID_LAB_BOARD_SOURCE_REQUIRED");
      const bank=await c.query(`SELECT bank_reference FROM ${LAB}.lab_seller_bank_refs
        WHERE tenant_id=$1 AND seller_id=$2 AND source_state='LAB_TEST_ONLY'`,
        [tenant,actorId]);
      if(!bank.rows[0])fail(409,"VERIFIED_LAB_BANK_REFERENCE_REQUIRED");
      const gross=BigInt(t.quantity)*BigInt(t.unit_price);
      if(gross<=0n||gross>BigInt(Number.MAX_SAFE_INTEGER))fail(409,"INVALID_TRADE_SNAPSHOT");
      const created=await c.query(`INSERT INTO ${LAB}.lab_trade_progress
        (tenant_id,buy_request_id,seller_id,buyer_id,bank_reference,expected_gross,
         state,seller_continuation_key)
        VALUES($1,$2,$3,$4,$5,$6,'PAYMENT_PENDING',$7)
        RETURNING state`,[tenant,requestId,actorId,t.buyer_id,bank.rows[0].bank_reference,gross.toString(),key]);
      return {state:created.rows[0].state,expectedGross:gross.toString(),idempotent:false};
    });
    return {status:201,value:{...result,customerCanOnlyPaySellerExternally:true,...noLegal}};
  }
  if(parts.length===6&&parts[3]==="buy-requests"&&uuid.test(parts[4])&&
     parts[5]==="test-payment-instructions"&&req.method==="GET"){
    const requestId=parts[4];
    const result=await tx(pool,async c=>{
      await role(c,tenant,actorId,"BUYER");
      const r=await c.query(`SELECT bank_reference,expected_gross,state FROM ${LAB}.lab_trade_progress
        WHERE tenant_id=$1 AND buy_request_id=$2 AND buyer_id=$3`,[tenant,requestId,actorId]);
      if(!r.rows[0])fail(403,"BUYER_NOT_AUTHORIZED_FOR_TRADE");
      return {bankReference:r.rows[0].bank_reference,
       expectedGross:r.rows[0].expected_gross,tradeState:r.rows[0].state};
    });
    return {status:200,value:{...result,directBuyerToSellerOnly:true,
      bankReferenceIsSynthetic:true,...noLegal}};
  }
  if(parts.length===6&&parts[3]==="buy-requests"&&uuid.test(parts[4])&&
    parts[5]==="test-payment-report"&&req.method==="POST"){
    const requestId=parts[4],b=await parseBody(),value=amount(b.amount);
    const bankLabel=validText(b.bankLabel),tracking=validText(b.trackingReference),
      receiptRef=validText(b.receiptReference),paymentDate=b.paymentDate;
    if(typeof paymentDate!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(paymentDate)||
       Number.isNaN(Date.parse(paymentDate)))fail(422,"PAYMENT_DATE_INVALID");
    const result=await tx(pool,async c=>{
      await role(c,tenant,actorId,"BUYER");
      await serialize(c,`payment-report:${tenant}:${requestId}`);
      const r=await c.query(`SELECT * FROM ${LAB}.lab_trade_progress
        WHERE tenant_id=$1 AND buy_request_id=$2 FOR UPDATE`,[tenant,requestId]);
      const t=r.rows[0];if(!t)fail(404,"LAB_TRADE_NOT_READY");
      if(t.buyer_id!==actorId)fail(403,"BUYER_NOT_AUTHORIZED_FOR_TRADE");
      const prev=await c.query(`SELECT * FROM ${LAB}.lab_payment_reports
        WHERE tenant_id=$1 AND buyer_id=$2 AND idempotency_key=$3`,[tenant,actorId,key]);
      if(prev.rows[0]){
        const p=prev.rows[0];
        if(p.buy_request_id!==requestId||BigInt(p.amount)!==value||
           p.bank_label!==bankLabel||p.tracking_reference!==tracking||
           p.receipt_reference!==receiptRef||isoDate(p.payment_date)!==paymentDate)
          fail(409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
        return {reportId:p.report_id,state:"PAYMENT_REPORTED",idempotent:true};
      }
      if(t.state!=="PAYMENT_PENDING")fail(409,"PAYMENT_REPORT_NOT_EXPECTED");
      if(BigInt(t.expected_gross)!==value)fail(409,"REPORTED_AMOUNT_NOT_TRADE_GROSS");
      const payment=await c.query(`INSERT INTO ${LAB}.lab_payment_reports
        (report_id,tenant_id,buy_request_id,buyer_id,amount,bank_label,tracking_reference,
         receipt_reference,payment_date,idempotency_key,state)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'BUYER_REPORTED_UNVERIFIED')
        RETURNING report_id`,[randomUUID(),tenant,requestId,actorId,value.toString(),
         bankLabel,tracking,receiptRef,paymentDate,key]);
      await c.query(`UPDATE ${LAB}.lab_trade_progress
        SET state='PAYMENT_REPORTED' WHERE tenant_id=$1 AND buy_request_id=$2`,[tenant,requestId]);
      return {reportId:payment.rows[0].report_id,state:"PAYMENT_REPORTED",idempotent:false};
    });
    return {status:201,value:{...result,receiptNotYetConfirmed:true,...noLegal}};
  }
  if(parts.length===6&&parts[3]==="buy-requests"&&uuid.test(parts[4])&&
    parts[5]==="test-seller-receipt"&&req.method==="POST"){
    const requestId=parts[4],b=await parseBody();
    if(!["RECEIVED_FULL","NOT_RECEIVED","AMOUNT_MISMATCH"].includes(String(b.response)))
      fail(422,"INVALID_SELLER_RECEIPT_RESPONSE");
    const response=b.response as string;
    const reason=response==="RECEIVED_FULL"?null:
      response==="NOT_RECEIVED"?"PAYMENT_NOT_RECEIVED":"PAYMENT_AMOUNT_MISMATCH";
    const result=await tx(pool,async c=>{
      await role(c,tenant,actorId,"SELLER");
      await serialize(c,`seller-receipt:${tenant}:${requestId}`);
      const r=await c.query(`SELECT * FROM ${LAB}.lab_trade_progress
         WHERE tenant_id=$1 AND buy_request_id=$2 FOR UPDATE`,[tenant,requestId]);
      const t=r.rows[0];if(!t)fail(404,"LAB_TRADE_NOT_READY");
      if(t.seller_id!==actorId)fail(403,"SELLER_NOT_OWNER");
      const prev=await c.query(`SELECT * FROM ${LAB}.lab_seller_receipts
        WHERE tenant_id=$1 AND seller_id=$2 AND idempotency_key=$3`,[tenant,actorId,key]);
      if(prev.rows[0]){
        if(prev.rows[0].buy_request_id!==requestId||prev.rows[0].response!==response)
          fail(409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
        return {receiptId:prev.rows[0].receipt_id,state:t.state,idempotent:true};
      }
      if(t.state!=="PAYMENT_REPORTED")fail(409,"SELLER_CONFIRMATION_NOT_READY");
      const saved=await c.query(`INSERT INTO ${LAB}.lab_seller_receipts
        (receipt_id,tenant_id,buy_request_id,seller_id,response,reason_code,idempotency_key)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING receipt_id`,
        [randomUUID(),tenant,requestId,actorId,response,reason,key]);
      const stage=response==="RECEIVED_FULL"?"PAYMENT_CONFIRMED":"PAYMENT_DISPUTED";
      await c.query(`UPDATE ${LAB}.lab_trade_progress SET state=$3
        WHERE tenant_id=$1 AND buy_request_id=$2`,[tenant,requestId,stage]);
      return {receiptId:saved.rows[0].receipt_id,state:stage,idempotent:false};
    });
    return {status:201,value:{...result,receiptIsOnlySellerClaim:true,
       mandatoryFeesResolved:false,readyForOfficialRegister:false,...noLegal}};
  }
  return null;
}
