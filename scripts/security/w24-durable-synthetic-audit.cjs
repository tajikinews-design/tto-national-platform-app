"use strict";
/**
 * W2.4 DRAFT: durable, single-process-owner synthetic audit journal.
 *
 * No database, external network, real identity, tenant or shareholder payload.
 * A hash chain PLUS a separately fsynced checkpoint detects accidental / naive
 * modification, torn writes and single-file truncation. It is NOT cryptographic
 * non-repudiation: an attacker who controls both files can rewrite both.
 *
 * Lab-only: never import in Next production routes or Nest AppModule.
 */
const fs=require("node:fs/promises");
const {constants}=require("node:fs");
const {resolve,join}=require("node:path");
const {createHash,randomUUID}=require("node:crypto");

const GENESIS="0".repeat(64);
const SCHEMA="W24_SYNTHETIC_AUDIT_V0_1";
const EVENT_KEYS=["at","decision","hash","phase","prevHash",
 "reasonCode","requestId","schemaVersion","sequence"].sort();
const ANCHOR_KEYS=["headHash","schemaVersion","sequence"].sort();
const PHASES=new Set(["BFF_PREFLIGHT","NEST_SCOPE","PDP_RESULT","BFF_RESPONSE"]);
const DECISIONS=new Set(["DENY","CANDIDATE","SIMULATED_ONLY"]);
const REASONS=new Set([
 "BFF_ACCEPTED","BFF_DENIED","NEST_ACCEPTED","NEST_DENIED",
 "PDP_SIMULATED","PDP_DENIED","PDP_UNAVAILABLE","RESPONSE_CLOSED",
 "RESPONSE_UNAVAILABLE","REQUEST_ABORTED"
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX=/^[0-9a-f]{64}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const MAX_LINES=20000,MAX_BYTES=4_000_000;
const sha256=data=>createHash("sha256").update(data).digest("hex");
const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const exact=(o,keys)=>JSON.stringify(Object.keys(o).sort())===JSON.stringify(keys);
const fail=code=>Object.assign(new Error(code),{code});
function labOnly(){
 return process.env.CI==="true"&&process.env.NODE_ENV==="test"&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  process.env.TTO_W2_OFFLINE_LAB==="1"&&
  process.env.TTO_W24_AUDIT_LAB==="1"&&
  !process.env.VERCEL&&!process.env.DATABASE_URL&&
  !process.env.TTO_API_BASE_URL&&!process.env.APIIR_TOKEN&&
  !process.env.TEST_ADMIN_DATABASE_URL&&
  !process.env.TTO_DB_POOLER_HOST&&!process.env.TTO_DB_APP_PASSWORD;
}
function validateInput(v){
 if(!isRecord(v)||!exact(v,["decision","phase","reasonCode","requestId"]))
  throw fail("AUDIT_EVENT_INVALID");
 if(!PHASES.has(v.phase)||!DECISIONS.has(v.decision)||
    !REASONS.has(v.reasonCode)||!UUID.test(v.requestId))
  throw fail("AUDIT_EVENT_INVALID");
 const combinations={
  BFF_PREFLIGHT:{CANDIDATE:"BFF_ACCEPTED",DENY:"BFF_DENIED"},
  NEST_SCOPE:{CANDIDATE:"NEST_ACCEPTED",DENY:"NEST_DENIED"},
  PDP_RESULT:{SIMULATED_ONLY:"PDP_SIMULATED",DENY:"PDP_DENIED"},
  BFF_RESPONSE:{DENY:"RESPONSE_CLOSED"}
 };
 const expected=combinations[v.phase]?.[v.decision];
 // Availability outcomes use dedicated bounded codes; never freeform strings.
 if(v.reasonCode!==expected&&!(
     v.phase==="PDP_RESULT"&&v.decision==="DENY"&&v.reasonCode==="PDP_UNAVAILABLE"
   )&&!(
     v.phase==="BFF_RESPONSE"&&v.decision==="DENY"&&v.reasonCode==="RESPONSE_UNAVAILABLE"
   )&&!(
     v.phase==="BFF_RESPONSE"&&v.decision==="DENY"&&v.reasonCode==="REQUEST_ABORTED"
   ))
   throw fail("AUDIT_EVENT_INVALID");
}
function unsigned(e){
 return {schemaVersion:e.schemaVersion,sequence:e.sequence,requestId:e.requestId,
  phase:e.phase,decision:e.decision,reasonCode:e.reasonCode,at:e.at,
  prevHash:e.prevHash};
}
function sign(e){
 return sha256(e.prevHash+"\n"+JSON.stringify(unsigned(e)));
}
function validateAnchor(a){
 return isRecord(a)&&exact(a,ANCHOR_KEYS)&&a.schemaVersion===SCHEMA&&
  Number.isSafeInteger(a.sequence)&&a.sequence>=0&&a.sequence<=MAX_LINES&&
  typeof a.headHash==="string"&&HEX.test(a.headHash);
}
async function regularFile(path){
 const st=await fs.lstat(path);
 if(!st.isFile()||st.isSymbolicLink()||st.size>MAX_BYTES)
  throw fail("AUDIT_STORE_INVALID");
 return st;
}
async function readState(dir){
 if(!labOnly())throw fail("AUDIT_LAB_DISABLED");
 const path=join(dir,"events.ndjson"),checkpoint=join(dir,"checkpoint.json");
 await regularFile(path);await regularFile(checkpoint);
 const bytes=await fs.readFile(path);
 if(bytes.length>MAX_BYTES)throw fail("AUDIT_STORE_INVALID");
 const input=bytes.toString("utf8");
 if(input&& !input.endsWith("\n"))throw fail("AUDIT_TORN_WRITE");
 const lines=input?input.trimEnd().split("\n"):[];
 if(lines.length>MAX_LINES)throw fail("AUDIT_CAPACITY_EXCEEDED");
 let previous=GENESIS;
 for(let i=0;i<lines.length;i++){
  let e;
  try{e=JSON.parse(lines[i]);}catch{throw fail("AUDIT_TORN_WRITE")}
  if(!isRecord(e)||!exact(e,EVENT_KEYS)||e.schemaVersion!==SCHEMA||
     e.sequence!==i+1||e.prevHash!==previous||
     typeof e.at!=="string"||!ISO.test(e.at)||
     Number.isNaN(Date.parse(e.at))||typeof e.hash!=="string"||
     !HEX.test(e.hash))throw fail("AUDIT_CHAIN_INVALID");
  validateInput({requestId:e.requestId,phase:e.phase,
   decision:e.decision,reasonCode:e.reasonCode});
  if(e.hash!==sign(e))throw fail("AUDIT_CHAIN_INVALID");
  previous=e.hash;
 }
 let anchor;
 try{anchor=JSON.parse(await fs.readFile(checkpoint,"utf8"))}
 catch{throw fail("AUDIT_CHECKPOINT_INVALID")}
 if(!validateAnchor(anchor)||anchor.sequence!==lines.length||
    anchor.headHash!==previous)throw fail("AUDIT_CHECKPOINT_MISMATCH");
 return {sequence:lines.length,headHash:previous};
}
async function fsyncDir(dir){
 const fh=await fs.open(dir,"r");
 try{await fh.sync()}finally{await fh.close()}
}
async function checkpointAtomic(dir,state){
 const path=join(dir,"checkpoint.json");
 const temporary=join(dir,".checkpoint-"+randomUUID()+".tmp");
 let fh;
 try{
  fh=await fs.open(temporary,"wx",0o600);
  await fh.writeFile(JSON.stringify({schemaVersion:SCHEMA,
   sequence:state.sequence,headHash:state.headHash})+"\n");
  await fh.sync();
  await fh.close();fh=null;
  await fs.rename(temporary,path);
  await fsyncDir(dir);
 }finally{
  if(fh)await fh.close().catch(()=>{});
  await fs.unlink(temporary).catch(()=>{});
 }
}
class W24SyntheticAuditJournal{
 constructor(dir,lock,state){
  this.dir=dir;this.lock=lock;this.state=state;this.queue=Promise.resolve();
  this.closed=false;this.poisoned=false;
 }
 static async open(directory,{create=false}={}){
  if(!labOnly())throw fail("AUDIT_LAB_DISABLED");
  const dir=resolve(directory);
  const st=await fs.lstat(dir);
  if(!st.isDirectory()||st.isSymbolicLink())throw fail("AUDIT_STORE_INVALID");
  let lock;
  try{lock=await fs.open(join(dir,"writer.lock"),"wx",0o600)}
  catch{throw fail("AUDIT_SINGLE_WRITER_UNAVAILABLE")}
  try{
   if(create){
    const handle=await fs.open(join(dir,"events.ndjson"),"wx",0o600);
    try{await handle.sync()}finally{await handle.close()}
    await checkpointAtomic(dir,{sequence:0,headHash:GENESIS});
   }
   const state=await readState(dir);
   return new W24SyntheticAuditJournal(dir,lock,state);
  }catch{
   await lock.close();
   await fs.unlink(join(dir,"writer.lock")).catch(()=>{});
   throw fail("AUDIT_STORE_UNAVAILABLE");
  }
 }
 async append(input){
  const job=this.queue.then(async()=>{
   if(this.closed||this.poisoned||!labOnly())
    throw fail("AUDIT_STORE_UNAVAILABLE");
   validateInput(input);
   try{
    // Verify *again* before every write so external file tampering, checkpoint
    // rollback, truncation and a torn write prevent a later synthetic grant.
    const state=await readState(this.dir);
    if(state.sequence!==this.state.sequence||
       state.headHash!==this.state.headHash)
      throw fail("AUDIT_STATE_CHANGED");
    if(state.sequence>=MAX_LINES)throw fail("AUDIT_CAPACITY_EXCEEDED");
    const event={schemaVersion:SCHEMA,sequence:state.sequence+1,
     requestId:input.requestId,phase:input.phase,decision:input.decision,
     reasonCode:input.reasonCode,at:new Date().toISOString(),
     prevHash:state.headHash};
    const next={...event,hash:sign(event)};
    const path=join(this.dir,"events.ndjson");
    const handle=await fs.open(path,constants.O_WRONLY|constants.O_APPEND|constants.O_NOFOLLOW);
    try{
     await handle.writeFile(JSON.stringify(next)+"\n");
     await handle.sync();
    }finally{await handle.close()}
    await checkpointAtomic(this.dir,{
     sequence:next.sequence,headHash:next.hash
    });
    this.state={sequence:next.sequence,headHash:next.hash};
    return Object.freeze({sequence:next.sequence,requestId:next.requestId});
   }catch{
    this.poisoned=true;
    throw fail("AUDIT_STORE_UNAVAILABLE");
   }
  });
  this.queue=job.catch(()=>{});
  return job;
 }
 async verify(){
  if(this.closed||this.poisoned)throw fail("AUDIT_STORE_UNAVAILABLE");
  await this.queue;
  const state=await readState(this.dir);
  if(state.sequence!==this.state.sequence||
     state.headHash!==this.state.headHash){
    this.poisoned=true;
    throw fail("AUDIT_STATE_CHANGED");
  }
  return Object.freeze({...state,valid:true});
 }
 async close(){
  await this.queue;
  if(this.closed)return;
  this.closed=true;
  await this.lock.close();
  // Only our own instance owns this lock. Crash leftovers are intentionally
  // NOT automatically stolen; explicit test operator action is required.
  await fs.unlink(join(this.dir,"writer.lock"));
 }
}
module.exports={
 W24SyntheticAuditJournal,labOnly,readState,SCHEMA
};
