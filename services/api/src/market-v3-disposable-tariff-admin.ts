/**
 * PH12 v3 §§21-25 isolated management APIs, NOT production endpoints.
 * User-supplied policy: editable per-cooperative tariffs, changed by new versions,
 * board-resolution reference before LAB activation, and FINANCE+CEO receipt.
 * No service claims to verify an actual board signature or bank account.
 */
import {randomUUID} from "node:crypto";
import type {IncomingMessage} from "node:http";
import type {Pool,PoolClient} from "pg";
import {PostBoardLabError} from "./market-v3-disposable-postboard";
type Input={req:IncomingMessage;parts:string[];tenant:string;actorId:string;key:string|null;
 pool:Pool;parseBody:()=>Promise<Record<string,unknown>>};
const LAB="market_v3_disposable";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function deny(status:number,code:string):never{throw new PostBoardLabError(status,code)}
function label(s:unknown){if(typeof s!=="string"||!/^[A-Z0-9_.:-]{8,160}$/.test(s))
 deny(422,"INVALID_APPROVAL_REFERENCE");return s;}
function integer(s:unknown,min:number,max:number){
 if(typeof s!=="number"||!Number.isSafeInteger(s)||s<min||s>max)deny(422,"INVALID_TARIFF_VALUE");
 return s;
}
async function tx<T>(pool:Pool,fn:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await pool.connect();try{await c.query("BEGIN");
 const r=await fn(c);await c.query("COMMIT");return r;}
 catch(e){await c.query("ROLLBACK");throw e}finally{c.release();}
}
async function role(c:PoolClient,tenant:string,id:string,want:string){
 const r=await c.query(`SELECT * FROM ${LAB}.actors
 WHERE tenant_id=$1 AND actor_id=$2`,[tenant,id]);
 if(r.rows[0]?.role!==want||r.rows[0]?.status!=="ACTIVE"||
    r.rows[0]?.source_verified!==true)deny(403,"ROLE_OR_TENANT_DENIED");
}
async function currentMandate(c:PoolClient,tenant:string,actor:string,roleName:string){
 const table=roleName==="COOP_CEO"?"lab_ceo_mandates":"lab_finance_mandates";
 const col=roleName==="COOP_CEO"?"ceo_id":"reviewer_id";
 const q=await c.query(`SELECT * FROM ${LAB}.${table}
 WHERE tenant_id=$1 AND ${col}=$2 ORDER BY mandate_version DESC LIMIT 1`,[tenant,actor]);
 const m=q.rows[0];
 if(!m||m.state!=="LAB_ATTESTED"||
    new Date(m.valid_from).getTime()>Date.now()||
    new Date(m.valid_until).getTime()<=Date.now()||
    (roleName!=="COOP_CEO"&&m.scope!=="FEE_DOCUMENTARY_REVIEW_TEST_ONLY"))
 deny(403,"BOARD_MANDATE_SOURCE_NOT_VERIFIED");
 return m;
}
const noAuthority={legalBoardApproval:false,officialFeePaid:false,
 platformReceivedMoney:false,appointmentEnabled:false,legalShareTransfer:false,
 syntheticLabOnly:true};
export async function handleTariffAdminLab(input:Input):
 Promise<{status:number;value:Record<string,unknown>}|null>{
 const {req,parts,tenant,actorId,key,pool,parseBody}=input;
 if(parts[3]==="test-tariffs"&&parts.length===4&&req.method==="GET"){
  const list=await tx(pool,async c=>{
   await role(c,tenant,actorId,"COOP_MARKET_MANAGER");
   const rows=await c.query(`SELECT draft_id,fee_id,proposed_version,
      calculation_mode,payer_mode,fixed_amount,percentage_rate_bps,
      buyer_percent,seller_percent,status,board_resolution_reference
      FROM ${LAB}.lab_tariff_drafts WHERE tenant_id=$1
      ORDER BY created_at,draft_id`,[tenant]);
   return rows.rows;
  });
  return {status:200,value:{tariffDrafts:list,allManagementPerCooperative:true,...noAuthority}};
 }
 if(parts[3]==="test-tariffs"&&parts.length===4&&req.method==="POST"){
  const b=await parseBody(),feeId=label(b.feeId),legalRef=label(b.legalBasisReference);
  const version=integer(b.version,1,1000000),fixed=integer(b.fixedAmount,0,1000000000),
    bps=integer(b.percentBps,0,10000),buyer=integer(b.buyerPercent,0,100),
    seller=integer(b.sellerPercent,0,100);
  if(typeof b.title!=="string"||b.title.length<8||b.title.length>130||
     !["COOP_APPROVED_FEE","STATUTORY_FEE","PLATFORM_SERVICE_FEE"].includes(String(b.feeType))||
     !["FIXED","PERCENTAGE","FIXED_PLUS_PERCENTAGE"].includes(String(b.calculationMode))||
     !["BUYER","SELLER","SPLIT"].includes(String(b.payerMode))||
     !["TRADE_GROSS_VALUE","SHARE_VALUE","CUSTOM_APPROVED_BASE"].includes(String(b.percentageBasis))||
     buyer+seller!==100||
     (b.payerMode==="BUYER"&&buyer!==100)||
     (b.payerMode==="SELLER"&&seller!==100)||
     (b.payerMode==="SPLIT"&&(buyer===0||seller===0)))
     deny(422,"TARIFF_POLICY_INVALID");
  const start=Date.parse(String(b.effectiveFrom)),end=Date.parse(String(b.effectiveTo));
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)deny(422,"INVALID_EFFECTIVE_WINDOW");
  const result=await tx(pool,async c=>{
   await role(c,tenant,actorId,"COOP_MARKET_MANAGER");
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [`tariff:${tenant}:${feeId}`]);
   const latest=await c.query(`SELECT COALESCE(MAX(source_version),0) AS version
      FROM ${LAB}.lab_fee_policy_sources WHERE tenant_id=$1 AND fee_id=$2`,[tenant,feeId]);
   const draftLatest=await c.query(`SELECT COALESCE(MAX(proposed_version),0) AS version
      FROM ${LAB}.lab_tariff_drafts WHERE tenant_id=$1 AND fee_id=$2`,[tenant,feeId]);
   if(version<=Math.max(Number(latest.rows[0].version),Number(draftLatest.rows[0].version)))
     deny(409,"TARIFF_VERSION_MUST_INCREASE");
   const id=randomUUID();
   await c.query(`INSERT INTO ${LAB}.lab_tariff_drafts
    (draft_id,tenant_id,fee_id,proposed_version,fee_title,fee_type,
     calculation_mode,payer_mode,fixed_amount,percentage_rate_bps,
     percentage_basis,buyer_percent,seller_percent,proposed_from,
     proposed_until,legal_basis_reference,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [id,tenant,feeId,version,b.title,b.feeType,b.calculationMode,b.payerMode,
      fixed,bps,b.percentageBasis,buyer,seller,new Date(start).toISOString(),
      new Date(end).toISOString(),legalRef,actorId]);
   return {draftId:id,version};
  });
  return {status:201,value:{...result,status:"DRAFT",mustProvideBoardResolution:true,...noAuthority}};
 }
 if(parts[3]==="test-tariffs"&&parts.length===6&&uuid.test(parts[4]??"")&&
   parts[5]==="test-board-record"&&req.method==="POST"){
  const draftId=parts[4],b=await parseBody();
  const resolution=label(b.resolutionReference),evidence=label(b.evidenceReference);
  const result=await tx(pool,async c=>{
   await role(c,tenant,actorId,"BOARD_SECRETARIAT");
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [`tariff-board:${tenant}:${draftId}`]);
   const q=await c.query(`SELECT * FROM ${LAB}.lab_tariff_drafts
    WHERE tenant_id=$1 AND draft_id=$2 FOR UPDATE`,[tenant,draftId]);
   const d=q.rows[0];if(!d)deny(404,"TARIFF_DRAFT_NOT_FOUND");
   if(d.created_by===actorId)deny(403,"MAKER_CHECKER_REQUIRED");
   if(d.status!=="DRAFT")deny(409,"TARIFF_ALREADY_REFERENCED");
   if(new Date(d.proposed_until).getTime()<=Date.now())deny(409,"TARIFF_EXPIRED");
   // A resolution *reference* is not an authenticated board signature.
   await c.query(`INSERT INTO ${LAB}.lab_tariff_board_events
    (event_id,tenant_id,draft_id,submitted_by,resolution_reference,
     evidence_reference,status) VALUES($1,$2,$3,$4,$5,$6,'LAB_BOARD_REFERENCE_NOT_SIGNATURE')`,
    [randomUUID(),tenant,draftId,actorId,resolution,evidence]);
   await c.query(`UPDATE ${LAB}.lab_tariff_drafts
    SET status='LAB_BOARD_REFERENCED',board_resolution_reference=$3,
        board_record_reference=$4,board_recorded_by=$5
    WHERE tenant_id=$1 AND draft_id=$2`,[tenant,draftId,resolution,evidence,actorId]);
   // Only lab source, valid for FUTURE trades; no production or legal activation.
   await c.query(`INSERT INTO ${LAB}.lab_fee_policy_sources
    (tenant_id,fee_id,source_version,fee_title,legal_fee_type,calculation_mode,
     payer_mode,fixed_amount,percentage_rate_bps,percentage_basis,buyer_percent,
     seller_percent,approval_reference,legal_basis_reference,valid_from,valid_until,
     evidence_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'LAB_TEST_ATTESTED')`,
     [tenant,d.fee_id,d.proposed_version,d.fee_title,d.fee_type,d.calculation_mode,
      d.payer_mode,d.fixed_amount,d.percentage_rate_bps,d.percentage_basis,
      d.buyer_percent,d.seller_percent,resolution,d.legal_basis_reference,
      d.proposed_from,d.proposed_until]);
   return {draftId,feeId:d.fee_id,version:d.proposed_version};
  });
  return {status:201,value:{...result,labStatus:"LAB_BOARD_REFERENCE_NOT_SIGNATURE",
   futureTradeOnly:true,...noAuthority}};
 }
 if(parts[3]==="buy-requests"&&parts.length===6&&uuid.test(parts[4]??"")&&
   parts[5]==="test-dual-receipt-endorse"&&req.method==="POST"){
  const requestId=parts[4],b=await parseBody();
  const reportId=String(b.reportId??""),reference=label(b.reference);
  if(!uuid.test(reportId))deny(422,"INVALID_REPORT_ID");
  const result=await tx(pool,async c=>{
   const a=await c.query(`SELECT role,status,source_verified FROM ${LAB}.actors
     WHERE tenant_id=$1 AND actor_id=$2`,[tenant,actorId]);
   const who=a.rows[0],roleName=who?.role;
   if(!who||who.status!=="ACTIVE"||!who.source_verified||
      !["COOP_FINANCE_OPERATOR","COOP_CEO"].includes(roleName))
      deny(403,"DUAL_ROLE_REQUIRED");
   const mandate=await currentMandate(c,tenant,actorId,roleName);
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
     [`dual-receipt:${tenant}:${reportId}`]);
   const r=await c.query(`SELECT * FROM ${LAB}.lab_fee_component_reports
    WHERE tenant_id=$1 AND report_id=$2 AND buy_request_id=$3`,
    [tenant,reportId,requestId]);
   if(!r.rows[0])deny(404,"RECEIPT_REPORT_NOT_FOUND");
   if(r.rows[0].payer_id===actorId)deny(403,"FOUR_EYES_REVIEW_REQUIRED");
   // Re-check underlying source and original finance mandate at endorsement
   // time. A once-valid metadata match never survives revocation.
   const checked=await c.query(`SELECT r.check_id FROM ${LAB}.lab_coop_receipt_checks r
    JOIN ${LAB}.lab_coop_statement_sources s ON s.tenant_id=r.tenant_id
      AND s.source_reference=r.source_reference AND s.source_version=r.source_version
    JOIN ${LAB}.lab_finance_mandates m ON m.tenant_id=r.tenant_id
      AND m.reviewer_id=r.reviewer_id AND m.mandate_version=r.mandate_version
    WHERE r.tenant_id=$1 AND r.report_id=$2
      AND s.evidence_state='LAB_TEST_ATTESTED'
      AND s.valid_from<=clock_timestamp() AND s.valid_until>clock_timestamp()
      AND m.state='LAB_ATTESTED'
      AND m.valid_from<=clock_timestamp() AND m.valid_until>clock_timestamp()
      AND m.mandate_version=(SELECT max(z.mandate_version)
        FROM ${LAB}.lab_finance_mandates z
        WHERE z.tenant_id=r.tenant_id AND z.reviewer_id=r.reviewer_id)`,[tenant,reportId]);
   if(!checked.rows[0])deny(409,"SOURCE_BOUND_RECEIPT_CHECK_REQUIRED");
   const existing=await c.query(`SELECT * FROM ${LAB}.lab_dual_receipt_endorsements
    WHERE tenant_id=$1 AND actor_id=$2 AND idempotency_key=$3`,[tenant,actorId,key]);
   if(existing.rows[0]){
     if(existing.rows[0].report_id!==reportId||existing.rows[0].reference!==reference)
       deny(409,"IDEMPOTENCY_PAYLOAD_MISMATCH");
   }else{
     const prior=await c.query(`SELECT 1 FROM ${LAB}.lab_dual_receipt_endorsements
       WHERE tenant_id=$1 AND report_id=$2 AND approver_role=$3`,[tenant,reportId,roleName]);
     if(prior.rows[0])deny(409,"ROLE_ALREADY_ENDORSED");
     await c.query(`INSERT INTO ${LAB}.lab_dual_receipt_endorsements
      (event_id,tenant_id,report_id,actor_id,approver_role,board_mandate_version,
       reference,idempotency_key,outcome)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'LAB_ENDORSED_NOT_OFFICIAL_PAID')`,
      [randomUUID(),tenant,reportId,actorId,roleName,mandate.mandate_version,reference,key]);
   }
   const statuses=await c.query(`SELECT approver_role FROM ${LAB}.lab_dual_receipt_endorsements
     WHERE tenant_id=$1 AND report_id=$2`,[tenant,reportId]);
   const roles=new Set(statuses.rows.map(x=>x.approver_role));
   return {financeReviewed:roles.has("COOP_FINANCE_OPERATOR"),
      ceoReviewed:roles.has("COOP_CEO"),bothLabEndorsementsPresent:roles.size===2};
  });
  return {status:201,value:{...result,
    reviewState:result.bothLabEndorsementsPresent?
     "LAB_DUAL_REVIEW_COMPLETE_NOT_LEGAL_PAID":"LAB_AWAITING_SECOND_APPROVER",
    ...noAuthority}};
 }
 return null;
}
