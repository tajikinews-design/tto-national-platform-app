/**
 * Share Market v3 §51: disposable HTTP vertical slice.
 * NOT imported into production Nest module, not a deployable API.
 * Starts only under CI with a fresh loopback-only PG17 fixture; no hosted DB.
 * The official share register remains the cooperative's legal source.
 * This module has NO payment, board authorization, registry or finalization route.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const LAB="market_v3_disposable";
type Role="SELLER"|"BUYER"|"COOP_MARKET_MANAGER"|"COOP_OPERATOR";
class LabError extends Error {
  constructor(readonly status:number,readonly code:string){ super(code); }
}
function deny(status:number,code:string):never {throw new LabError(status,code);}
type Actor={tenant_id:string;actor_id:string;role:Role;status:string;source_verified:boolean;classification:string;buyer_cap:string};
function json(res:ServerResponse,status:number,value:unknown):void {
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  res.end(JSON.stringify(value));
}
function integer(value:unknown):bigint {
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<=0)deny(400,"INVALID_QUANTITY");
  return BigInt(value as number);
}
function idemKey(req:IncomingMessage):string {
  const key=req.headers["idempotency-key"];
  if(typeof key!=="string"||!/^[a-zA-Z0-9_-]{12,128}$/.test(key))deny(400,"IDEMPOTENCY_KEY_REQUIRED");
  return key as string;
}
async function body(req:IncomingMessage):Promise<Record<string,unknown>> {
  const pieces:Buffer[]=[];let length=0;
  for await(const chunk of req) {
    const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as string);
    length+=b.length;if(length>8192)deny(413,"BODY_TOO_LARGE");pieces.push(b);
  }
  try {
    const decoded=JSON.parse(Buffer.concat(pieces).toString("utf8")) as unknown;
    if(decoded===null||typeof decoded!=="object"||Array.isArray(decoded))deny(400,"INVALID_JSON");
    return decoded as Record<string,unknown>;
  }catch(e) {
    if(e instanceof LabError)throw e;
    return deny(400,"INVALID_JSON");
  }
}
async function transaction<T>(pool:Pool,operation:(client:PoolClient)=>Promise<T>):Promise<T> {
  const c=await pool.connect();
  try {
    await c.query("BEGIN");
    const r=await operation(c);
    await c.query("COMMIT");
    return r;
  }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
}
async function actor(c:PoolClient,tenant:string,id:string,role:Role):Promise<Actor> {
  const r=await c.query<Actor>(`SELECT * FROM ${LAB}.actors WHERE tenant_id=$1 AND actor_id=$2`,[tenant,id]);
  const a=r.rows[0];if(!a||a.status!=="ACTIVE"||a.role!==role)deny(403,"ROLE_OR_TENANT_DENIED");
  return a;
}
async function serialize(client:PoolClient,scope:string):Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[scope]);
}
export function createDisposableMarketApi(){
  // This gate cannot be enabled by a user-facing HTTP request or prod deployment.
  if(process.env.CI!=="true"||process.env.TTO_MARKET_DISPOSABLE_LAB!=="1"||
     process.env.VERCEL||process.env.TTO_PRODUCTION_DB_URL||
     !/^[a-f0-9]{64}$/.test(process.env.TTO_MARKET_LAB_SECRET??"")){
    throw Error("MARKET_LAB_CI_LOOPBACK_ONLY");
  }
  const secret=Buffer.from(process.env.TTO_MARKET_LAB_SECRET!,"utf8");
  const pool=new Pool({host:"127.0.0.1",port:5432,database:"tto",user:"postgres",
    max:4,connectionTimeoutMillis:5000,application_name:"tto_market_v3_disposable_lab"});
  const server=createServer(async(req,res)=>{
    try {
      if(req.socket.remoteAddress!=="127.0.0.1"&&req.socket.remoteAddress!=="::ffff:127.0.0.1")
        deny(403,"LOOPBACK_ONLY");
      const header=req.headers["x-lab-secret"];
      if(typeof header!=="string")deny(401,"LAB_AUTH_REQUIRED");
      const got=Buffer.from(header as string,"utf8");
      if(got.length!==secret.length||!timingSafeEqual(got,secret))deny(401,"LAB_AUTH_REQUIRED");
      const actorId=req.headers["x-lab-actor"];
      if(typeof actorId!=="string"||!uuid.test(actorId))deny(401,"LAB_ACTOR_REQUIRED");
      const pathname=new URL(req.url??"/","http://127.0.0.1").pathname;
      const parts=pathname.split("/").filter(Boolean);
      if(parts[0]!=="lab"||parts[1]!=="tenants"||!uuid.test(parts[2]??""))deny(404,"LAB_ROUTE_NOT_FOUND");
      const tenant=parts[2];const key=req.method==="POST"?idemKey(req):null;
      // Every route is explicitly enumerated; NO payment, registry or transfer endpoints.
      if(req.method==="POST"&&parts.length===4&&parts[3]==="sell-orders"){
        const input=await body(req);const qty=integer(input.quantity);
        if(input.saleMode!=="FULL_OFFER")deny(422,"MVP_FULL_OFFER_ONLY");
        const result=await transaction(pool,async c=>{
          await actor(c,tenant,actorId,"SELLER");
          await serialize(c,`sell:${tenant}:${actorId}:${key}`);
          const previous=await c.query(`SELECT offer_id,status FROM ${LAB}.offers
            WHERE tenant_id=$1 AND seller_id=$2 AND idempotency_key=$3`,[tenant,actorId,key]);
          if(previous.rowCount)return {offerId:previous.rows[0].offer_id,status:previous.rows[0].status,idempotent:true};
          const h=await c.query(`SELECT * FROM ${LAB}.holdings WHERE tenant_id=$1 AND actor_id=$2 FOR UPDATE`,[tenant,actorId]);
          const own=h.rows[0];
          if(!own||!own.source_verified)deny(409,"OFFICIAL_HOLDING_SOURCE_UNAVAILABLE");
          if(!own.commitment_clear)deny(409,"UNPAID_COMMITMENT_REVIEW_REQUIRED");
          if(own.legal_hold)deny(409,"SELLER_LEGAL_HOLD");
          const prior=await c.query(`SELECT coalesce(sum(requested_quantity),0) AS locked FROM ${LAB}.offers
            WHERE tenant_id=$1 AND seller_id=$2 AND status IN ('QUEUED','LISTED','RESERVED','COOP_REVIEWED')`,[tenant,actorId]);
          if(BigInt(own.registered_quantity)-BigInt(prior.rows[0].locked)<qty)deny(409,"INSUFFICIENT_AVAILABLE_SHARES");
          const price=await c.query(`SELECT * FROM ${LAB}.market_policy WHERE tenant_id=$1`,[tenant]);
          if(!price.rows[0]?.valuation_valid)deny(409,"NO_ACTIVE_APPROVED_PRICING_RULE");
          const r=await c.query(`INSERT INTO ${LAB}.offers
            (offer_id,tenant_id,seller_id,requested_quantity,unit_price,pricing_rule_version,idempotency_key)
            VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING offer_id,status`,
            [randomUUID(),tenant,actorId,qty.toString(),price.rows[0].unit_price,price.rows[0].pricing_rule_version,key]);
          return {offerId:r.rows[0].offer_id,status:r.rows[0].status,idempotent:false};
        });
        return json(res,201,{...result,legalOwnershipChanged:false,financialTransaction:false});
      }
      if(req.method==="POST"&&parts.length===6&&parts[3]==="offers"&&uuid.test(parts[4])&&parts[5]==="publish"){
        const offerId=parts[4];
        const result=await transaction(pool,async c=>{
          await actor(c,tenant,actorId,"COOP_MARKET_MANAGER");
          await serialize(c,`publish:${tenant}:${offerId}:${key}`);
          const r=await c.query(`SELECT * FROM ${LAB}.offers WHERE offer_id=$1 AND tenant_id=$2 FOR UPDATE`,[offerId,tenant]);
          if(!r.rows[0])deny(404,"OFFER_NOT_FOUND");
          if(r.rows[0].status==="LISTED")return {offerId,status:"LISTED",idempotent:true};
          if(r.rows[0].status!=="QUEUED")deny(409,"OFFER_NOT_QUEUED");
          const earliest=await c.query(`SELECT offer_id FROM ${LAB}.offers
            WHERE tenant_id=$1 AND status='QUEUED' ORDER BY accepted_at,offer_id LIMIT 1`,[tenant]);
          if(earliest.rows[0]?.offer_id!==offerId)deny(409,"FIFO_QUEUE_ORDER_REQUIRED");
          const policy=await c.query(`SELECT * FROM ${LAB}.market_policy WHERE tenant_id=$1`,[tenant]);
          if(!policy.rows[0]?.fifo||!policy.rows[0]?.valuation_valid)deny(409,"MARKET_POLICY_NOT_APPROVED");
          const active=await c.query(`SELECT count(*) AS count FROM ${LAB}.offers
            WHERE tenant_id=$1 AND status='LISTED'`,[tenant]);
          if(Number(active.rows[0].count)>=Number(policy.rows[0].max_active_listings))deny(409,"LISTING_CAPACITY_EXCEEDED");
          await c.query(`UPDATE ${LAB}.offers SET status='LISTED' WHERE offer_id=$1`,[offerId]);
          return {offerId,status:"LISTED",idempotent:false};
        });
        return json(res,200,{...result,legalOwnershipChanged:false});
      }
      if(req.method==="GET"&&parts.length===4&&parts[3]==="market-offers"){
        const offers=await transaction(pool,async c=>{
          const a=await c.query(`SELECT role,status FROM ${LAB}.actors WHERE tenant_id=$1 AND actor_id=$2`,[tenant,actorId]);
          if(!a.rows[0]||a.rows[0].status!=="ACTIVE")deny(403,"ROLE_OR_TENANT_DENIED");
          const rows=await c.query(`SELECT offer_id,requested_quantity,unit_price,pricing_rule_version
            FROM ${LAB}.offers WHERE tenant_id=$1 AND status='LISTED'
            ORDER BY accepted_at,offer_id`,[tenant]);
          return rows.rows;
        });
        return json(res,200,{offers,publicSellerBankAccountNeverExposed:true});
      }
      if(req.method==="POST"&&parts.length===6&&parts[3]==="offers"&&uuid.test(parts[4])&&parts[5]==="buy"){
        const input=await body(req);const qty=integer(input.quantity);const offerId=parts[4];
        const result=await transaction(pool,async c=>{
          const a=await actor(c,tenant,actorId,"BUYER");
          if(!a.source_verified||a.classification!=="MEMBER")deny(409,"BUYER_LEGAL_ELIGIBILITY_NOT_CONFIRMED");
          await serialize(c,`buy:${tenant}:${actorId}:${key}`);
          const previous=await c.query(`SELECT buy_request_id,state FROM ${LAB}.buy_requests
            WHERE tenant_id=$1 AND buyer_id=$2 AND idempotency_key=$3`,[tenant,actorId,key]);
          if(previous.rowCount)return {buyRequestId:previous.rows[0].buy_request_id,state:previous.rows[0].state,idempotent:true};
          const o=await c.query(`SELECT * FROM ${LAB}.offers WHERE offer_id=$1 AND tenant_id=$2 FOR UPDATE`,[offerId,tenant]);
          if(!o.rows[0])deny(404,"OFFER_NOT_FOUND");
          if(o.rows[0].status!=="LISTED")deny(409,"OFFER_NOT_AVAILABLE");
          if(o.rows[0].seller_id===actorId)deny(409,"SELF_BUY_DENIED");
          if(BigInt(o.rows[0].requested_quantity)!==qty)deny(422,"MVP_FULL_OFFER_ONLY");
          const h=await c.query(`SELECT registered_quantity FROM ${LAB}.holdings
            WHERE tenant_id=$1 AND actor_id=$2`,[tenant,actorId]);
          if(!h.rows[0])deny(409,"BUYER_OFFICIAL_HOLDING_UNAVAILABLE");
          const pending=await c.query(`SELECT coalesce(sum(quantity),0) AS qty FROM ${LAB}.buy_requests
            WHERE tenant_id=$1 AND buyer_id=$2 AND state IN ('COOP_REVIEW','BOARD_APPROVAL_PENDING')`,[tenant,actorId]);
          if(BigInt(h.rows[0].registered_quantity)+BigInt(pending.rows[0].qty)+qty>BigInt(a.buyer_cap))
            deny(409,"BUYER_ACTIVE_CAP_EXCEEDED");
          const b=await c.query(`INSERT INTO ${LAB}.buy_requests
            (buy_request_id,tenant_id,offer_id,buyer_id,quantity,state,idempotency_key)
            VALUES($1,$2,$3,$4,$5,'COOP_REVIEW',$6) RETURNING buy_request_id,state`,
            [randomUUID(),tenant,offerId,actorId,qty.toString(),key]);
          await c.query(`UPDATE ${LAB}.offers SET status='RESERVED' WHERE offer_id=$1`,[offerId]);
          return {buyRequestId:b.rows[0].buy_request_id,state:b.rows[0].state,idempotent:false};
        });
        return json(res,201,{...result,boardApprovalGranted:false,legalOwnershipChanged:false});
      }
      if(req.method==="POST"&&parts.length===6&&parts[3]==="buy-requests"&&uuid.test(parts[4])&&parts[5]==="review"){
        const input=await body(req);
        if(input.verdict!=="REFER_TO_BOARD")deny(422,"COOPERATIVE_REVIEW_IS_NOT_BOARD_APPROVAL");
        const requestId=parts[4];
        const result=await transaction(pool,async c=>{
          await actor(c,tenant,actorId,"COOP_OPERATOR");
          await serialize(c,`review:${tenant}:${requestId}:${key}`);
          const prev=await c.query(`SELECT review_id FROM ${LAB}.coop_reviews
            WHERE tenant_id=$1 AND reviewer_id=$2 AND idempotency_key=$3`,[tenant,actorId,key]);
          if(prev.rowCount)return {reviewId:prev.rows[0].review_id,state:"BOARD_APPROVAL_PENDING",idempotent:true};
          const b=await c.query(`SELECT * FROM ${LAB}.buy_requests WHERE buy_request_id=$1 AND tenant_id=$2 FOR UPDATE`,[requestId,tenant]);
          if(!b.rows[0])deny(404,"BUY_REQUEST_NOT_FOUND");
          if(b.rows[0].state!=="COOP_REVIEW")deny(409,"COOPERATIVE_REVIEW_ALREADY_DECIDED");
          const r=await c.query(`INSERT INTO ${LAB}.coop_reviews
            (review_id,tenant_id,buy_request_id,reviewer_id,verdict,idempotency_key)
            VALUES($1,$2,$3,$4,'REFER_TO_BOARD',$5) RETURNING review_id`,
            [randomUUID(),tenant,requestId,actorId,key]);
          await c.query(`UPDATE ${LAB}.buy_requests SET state='BOARD_APPROVAL_PENDING' WHERE buy_request_id=$1`,[requestId]);
          await c.query(`UPDATE ${LAB}.offers SET status='COOP_REVIEWED' WHERE offer_id=$1`,[b.rows[0].offer_id]);
          return {reviewId:r.rows[0].review_id,state:"BOARD_APPROVAL_PENDING",idempotent:false};
        });
        return json(res,200,{...result,boardApprovalGranted:false,legalOwnershipChanged:false});
      }
      return json(res,404,{code:"LAB_ROUTE_NOT_FOUND"});
    }catch(e){
      if(e instanceof LabError)return json(res,e.status,{code:e.code});
      const msg=e instanceof Error?e.message:"unknown";
      // Sensitive SQL and credentials are never returned to the caller.
      process.stderr.write("MARKET_LAB_INTERNAL_ERROR "+msg.slice(0,140)+"\n");
      return json(res,500,{code:"LAB_INTERNAL_ERROR"});
    }
  });
  return {server,pool};
}
