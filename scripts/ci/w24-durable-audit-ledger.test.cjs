"use strict";
/**
 * W2.4 durable synthetic audit file / checkpoint / restart regression.
 * Only local OS temp files on GitHub Runner; no DB, Docker, network or secrets.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const os=require("node:os");
const path=require("node:path");
const {randomUUID}=require("node:crypto");
const {W24SyntheticAuditJournal,labOnly,readState,SCHEMA}=
 require("../security/w24-durable-synthetic-audit.cjs");
if(!labOnly())throw Error("W24_LAB_NOT_ENABLED");
const event=(requestId=randomUUID(),phase="BFF_PREFLIGHT",
 decision="CANDIDATE",reasonCode="BFF_ACCEPTED")=>({
 requestId,phase,decision,reasonCode
});
const other=e=>({...e,requestId:randomUUID()});
async function temp(){return fs.mkdtemp(path.join(os.tmpdir(),"tto-w24-"))}
async function dispose(dir,j){
 if(j)await j.close().catch(()=>{});
 await fs.rm(dir,{recursive:true,force:true});
}
async function records(dir){
 const s=await fs.readFile(path.join(dir,"events.ndjson"),"utf8");
 return s.trim()?s.trimEnd().split("\n").map(JSON.parse):[];
}
test("W2.4 fsync-backed synthetic audit chain and fail-closed integrity",async t=>{
 await t.test("append/restart persists hashed metadata and no identity fields",async()=>{
  const dir=await temp();let j;
  const id=randomUUID();
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   await j.append(event(id));
   await j.append(event(id,"NEST_SCOPE","CANDIDATE","NEST_ACCEPTED"));
   await j.append(event(id,"PDP_RESULT","SIMULATED_ONLY","PDP_SIMULATED"));
   await j.append(event(id,"BFF_RESPONSE","DENY","RESPONSE_CLOSED"));
   const first=await j.verify();
   assert.equal(first.valid,true);assert.equal(first.sequence,4);
   const traces=await j.verifyTraces();
   assert.deepEqual(traces,{valid:true,requestCount:1,
    preflightDenials:0,simulatedOnly:1,eventCount:4});
   const raw=await fs.readFile(path.join(dir,"events.ndjson"),"utf8");
   const rows=await records(dir);
   assert.deepEqual(Object.keys(rows[0]).sort(),[
    "schemaVersion","sequence","requestId","phase","decision","reasonCode",
    "at","prevHash","hash"].sort());
   assert.equal(rows[0].schemaVersion,SCHEMA);
   for(const unsafe of ["tenantKey","ownerKey","party","session","cookie",
                        "token","email","phone","role","data","sourceVersion"])
    assert.equal(raw.includes('"'+unsafe+'"'),false,unsafe);
   await j.close();j=null;
   j=await W24SyntheticAuditJournal.open(dir);
   assert.deepEqual(await j.verifyTraces(),traces);
   const audit=await j.append(event(randomUUID(),"BFF_PREFLIGHT","DENY","BFF_DENIED"));
   assert.equal(audit.sequence,5);
   await j.append(event(audit.requestId,"BFF_RESPONSE","DENY","RESPONSE_CLOSED"));
   assert.deepEqual(await j.verifyTraces(),{
    valid:true,requestCount:2,preflightDenials:1,simulatedOnly:1,eventCount:6
   });
  }finally{await dispose(dir,j)}
 });
 console.log("TTO_W24_DURABLE_FSYNC_RESTART_TRACE=PASS");

 await t.test("concurrent audit writers serialize within one journal and never duplicate sequence",async()=>{
  const dir=await temp();let j;
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   const keys=Array.from({length:40},()=>randomUUID());
   await Promise.all(keys.map(requestId=>j.append(event(requestId))));
   const checked=await j.verify();
   assert.equal(checked.sequence,40);
   assert.deepEqual((await records(dir)).map(x=>x.sequence),
    Array.from({length:40},(_,i)=>i+1));
   assert.equal(new Set((await records(dir)).map(x=>x.hash)).size,40);
  }finally{await dispose(dir,j)}
 });
 console.log("TTO_W24_CONCURRENT_APPEND_SEQUENCED=PASS");

 await t.test("single-writer lock refuses another process/journal until clean close",async()=>{
  const dir=await temp();let j,second;
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   await assert.rejects(W24SyntheticAuditJournal.open(dir),
    /AUDIT_SINGLE_WRITER_UNAVAILABLE/);
   await j.close();j=null;
   second=await W24SyntheticAuditJournal.open(dir);
   assert.equal((await second.verify()).valid,true);
  }finally{await dispose(dir,second||j)}
 });
 console.log("TTO_W24_EXCLUSIVE_WRITER_LOCK=PASS");

 await t.test("invalid event cannot leak arbitrary source, identity, freeform reason or secret",async()=>{
  const dir=await temp();let j;
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   for(const bad of [
    {...event(),cookie:"SECRET"},
    {...event(),reasonCode:"sourceApproved=true"},
    {...event(),requestId:"not-a-uuid"},
    {...event(),decision:"ALLOW"},
    {...event(),decision:"SIMULATED_ONLY"},
    {...event(),phase:"TRADE"},
    {...event(),phase:"PDP_RESULT",decision:"SIMULATED_ONLY",
     reasonCode:"GRANTED"},
    {...event(),reasonCode:"BFF_DENIED"},
   ]){
    await assert.rejects(j.append(bad),/AUDIT_EVENT_INVALID/);
   }
   assert.equal((await j.verify()).sequence,0);
  }finally{await dispose(dir,j)}
 });
 console.log("TTO_W24_STRICT_AUDIT_METADATA_ALLOWLIST=PASS");

 await t.test("hash-chain tamper in persisted event stops verification and future appends",async()=>{
  const dir=await temp();let j;
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   await j.append(event());
   const p=path.join(dir,"events.ndjson");
   const before=await fs.readFile(p,"utf8");
   await fs.writeFile(p,before.replace("BFF_ACCEPTED","BFF_DENIED"));
   await assert.rejects(j.verify(),/AUDIT_CHAIN_INVALID|AUDIT_EVENT_INVALID/);
   await assert.rejects(j.append(event()),/AUDIT_STORE_UNAVAILABLE/);
  }finally{await dispose(dir,j)}
 });
 console.log("TTO_W24_HASH_CHAIN_TAMPER_DETECTED=PASS");

 await t.test("checkpoint rollback or unauthorized truncation fails closed",async()=>{
  const dir=await temp();let j;
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   await j.append(event());await j.append(event());
   const anchor=path.join(dir,"checkpoint.json");
   const doc=JSON.parse(await fs.readFile(anchor,"utf8"));
   await fs.writeFile(anchor,JSON.stringify({...doc,sequence:1})+"\n");
   await assert.rejects(j.verify(),/AUDIT_CHECKPOINT_MISMATCH/);
   await assert.rejects(j.append(event()),/AUDIT_STORE_UNAVAILABLE/);
  }finally{await dispose(dir,j)}
 });
 console.log("TTO_W24_ANCHOR_ROLLBACK_DETECTED=PASS");

 await t.test("tail deletion of complete line is detected by separate checkpoint",async()=>{
  const dir=await temp();let j;
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   await j.append(event());await j.append(event());
   const p=path.join(dir,"events.ndjson");
   const lines=(await fs.readFile(p,"utf8")).trimEnd().split("\n");
   await fs.writeFile(p,lines[0]+"\n");
   await assert.rejects(j.append(event()),/AUDIT_STORE_UNAVAILABLE/);
   await assert.rejects(j.verify(),/AUDIT_STORE_UNAVAILABLE/);
  }finally{await dispose(dir,j)}
 });
 console.log("TTO_W24_TAIL_TRUNCATION_CLOSED=PASS");

 await t.test("partial/torn write and malformed JSON prevent restart",async()=>{
  const dir=await temp();let j;
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   await j.append(event());await j.close();j=null;
   await fs.appendFile(path.join(dir,"events.ndjson"),'{"sequence":');
   await assert.rejects(W24SyntheticAuditJournal.open(dir),/AUDIT_STORE_UNAVAILABLE/);
   assert.equal((await fs.readdir(dir)).includes("writer.lock"),false);
  }finally{await dispose(dir,j)}
 });
 console.log("TTO_W24_TORN_WRITE_RESTART_DENIED=PASS");

 await t.test("checkpoint and ledger symlink replacement are rejected",async()=>{
  const dir=await temp();let j;
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   const original=path.join(dir,"checkpoint.json");
   const moved=path.join(dir,"checkpoint-original.json");
   await fs.rename(original,moved);
   await fs.symlink(moved,original);
   await assert.rejects(j.append(event()),/AUDIT_STORE_UNAVAILABLE/);
  }finally{await dispose(dir,j)}
 });
 console.log("TTO_W24_SYMLINK_SWAP_DENIED=PASS");

 await t.test("incomplete trace, missing BFF response and mismatched phase flagged",async()=>{
  const dir=await temp();let j;
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   await j.append(event());
   await assert.rejects(j.verifyTraces(),/AUDIT_TRACE_INCOMPLETE/);
   await j.append(event(randomUUID(),"BFF_RESPONSE","DENY","RESPONSE_CLOSED"));
   await assert.rejects(j.verifyTraces(),/AUDIT_TRACE_INCOMPLETE/);
  }finally{await dispose(dir,j)}
 });
 console.log("TTO_W24_CAUSAL_TRACE_COMPLETENESS_REQUIRED=PASS");

 await t.test("late error cannot silently resume same poisoned journal",async()=>{
  const dir=await temp();let j;
  try{
   j=await W24SyntheticAuditJournal.open(dir,{create:true});
   await j.append(event());
   const anchor=path.join(dir,"checkpoint.json");
   await fs.writeFile(anchor,"{not-json}\n");
   await assert.rejects(j.append(event()),/AUDIT_STORE_UNAVAILABLE/);
   const s=await fs.readFile(anchor,"utf8");
   assert.ok(s.includes("not-json"));
   await assert.rejects(j.append(event()),/AUDIT_STORE_UNAVAILABLE/);
  }finally{await dispose(dir,j)}
 });
 console.log("TTO_W24_FAIL_CLOSED_AFTER_PERSISTENCE_OUTAGE=PASS");

 await t.test("lab disabled rejects opening a real directory or other environment",async()=>{
  const dir=await temp();
  const old=process.env.TTO_W24_AUDIT_LAB;
  delete process.env.TTO_W24_AUDIT_LAB;
  try{
   await assert.rejects(W24SyntheticAuditJournal.open(dir,{create:true}),
    /AUDIT_LAB_DISABLED/);
   assert.equal((await fs.readdir(dir)).length,0);
  }finally{
   if(old===undefined)delete process.env.TTO_W24_AUDIT_LAB;
   else process.env.TTO_W24_AUDIT_LAB=old;
   await fs.rm(dir,{recursive:true,force:true});
  }
 });
 console.log("TTO_W24_PRODUCTION_LAB_GUARD_DISABLED=PASS");
 console.log("TTO_W24_NO_DB_NO_DOCKER_NO_OPERATIONAL_ALLOW=PASS");
});
