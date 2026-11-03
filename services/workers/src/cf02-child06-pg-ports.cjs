"use strict";
// Issue #154: explicit one-shot PostgreSQL adapter. Not started or scheduled by default.
// A separately provisioned, non-web login role must be a member of NOLOGIN
// tto_cf02_consumer. Never use migration owner or tto_app credentials.
const {createRequire}=require("node:module"),{resolve}=require("node:path");
const {Client}=createRequire(resolve(__dirname,"../../../services/api/package.json"))("pg");
const {consumeOne}=require("./cf02-child06-consumer.cjs");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function consumeOnce({databaseUrl,tenantId,actorId,enable=false,clientFactory=(url)=>new Client({connectionString:url})}={}){
 if(enable!==true)return {status:"DISABLED"};
 if(typeof databaseUrl!=="string"||!databaseUrl||!UUID.test(tenantId)||!UUID.test(actorId))return {status:"DISABLED"};
 const db=clientFactory(databaseUrl);
 await db.connect();
 try{
  // This authentication check precedes all transaction-local context assignment.
  const identity=await db.query("SELECT session_user AS login, pg_has_role(session_user,'tto_cf02_consumer','MEMBER') AS member");
  if(identity.rowCount!==1||!identity.rows[0].member||["postgres","tto_app","tto_cf02_consumer"].includes(identity.rows[0].login))return {status:"DENIED"};
  const transact=async(fn)=>{
   await db.query("BEGIN");
   try{
    await db.query("SET LOCAL ROLE tto_cf02_consumer");
    await db.query("SELECT set_config('tto.actor_id',$1,true)",[actorId]);
    await db.query("SELECT set_config('tto.tenant_id',$1,true)",[tenantId]);
    const val=await fn();
    await db.query("COMMIT");
    return val;
   }catch(e){await db.query("ROLLBACK");throw e}
  };
  const claimed=await transact(async()=>db.query("SELECT * FROM tto.cf02_consumer_claim($1,30)",[tenantId]));
  if(!claimed.rows.length)return {status:"NO_EVENT"};
  const {event_id: eventId,claim_token:token}=claimed.rows[0];
  // Contractual source event always re-read under its own dedicated DB session.
  const ports={
   readSource:async(id,tenant)=>transact(async()=>{
    const q=await db.query("SELECT event_id,tenant_id,party_id,relationship_id,source_version,event_name FROM tto.cooperative_relationship_outbox WHERE event_id=$1 AND tenant_id=$2",[id,tenant]);
    return q.rowCount?{...q.rows[0],source_version:Number(q.rows[0].source_version)}:null;
   }),
   project:async(tenant,id)=>transact(async()=>{
    const q=await db.query("SELECT tto.cf02_project_child06_relationship_event($1,$2) AS result",[tenant,id]);
    return q.rows[0].result;
   }),
   ack:async(id,tenant)=>transact(async()=>{
    const q=await db.query("SELECT tto.cf02_consumer_complete($1,$2,$3) AS result",[tenant,id,token]);
    if(q.rows[0].result!=="ACKED")throw Error("DURABLE_ACK_NOT_COMMITTED");
   }),
   retry:async(id,tenant)=>transact(async()=>db.query("SELECT tto.cf02_consumer_retry($1,$2,$3,30)",[tenant,id,token])),
   quarantine:async()=>{throw Error("QUARANTINE_REQUIRES_EXPLICIT_OPERATOR_REVIEW")}
  };
  const envelope=await ports.readSource(eventId,tenantId);
  if(!envelope)return {status:"UNKNOWN_SOURCE_EVENT"};
  return await consumeOne(envelope,{enabled:true,authorized:true,ports});
 }finally{await db.end()}
}
module.exports={consumeOnce};
