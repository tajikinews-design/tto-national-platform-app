"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {fork}=require("node:child_process");
const {RecoveredIpcBroker}=require("../security/w213-integrated-recovery-broker.cjs");
const childFile=path.join(__dirname,"w211-fencing-worker.cjs");
function lab(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"w213-")),file=path.join(dir,"journal.jsonl");
 t.after(()=>fs.rmSync(dir,{force:true,recursive:true}));
 let broker=new RecoveredIpcBroker({file,create:true});
 return {file,get broker(){return broker},restart(){broker=new RecoveredIpcBroker({file});return broker}};
}
function worker(t,getBroker){
 const p=fork(childFile,[],{env:{...process.env,NODE_ENV:"test",TTO_W211_MULTIPROCESS_LAB:"1"},execArgv:[],stdio:["ignore","ignore","ignore","ipc"]});
 const pending=new Map();
 const ready=new Promise((resolve,reject)=>{p.on("error",reject);p.on("message",m=>{if(m?.kind==="READY")resolve()})});
 p.on("message",m=>{
  if(m?.kind==="REQUEST"){let result;try{result=getBroker().dispatch(String(p.pid),m.action,m.payload)}catch{result={ok:false,reason:"W213_UNCERTAIN"}}if(p.connected)p.send({kind:"REPLY",id:m.id,result});}
  if(m?.kind==="RESULT"){const cb=pending.get(m.id);if(cb){pending.delete(m.id);cb(m.result)}}
 });
 p.on("exit",()=>{getBroker().killOwner(String(p.pid));for(const cb of pending.values())cb({ok:false,reason:"EXIT"});pending.clear()});
 t.after(()=>{if(p.exitCode===null)p.kill("SIGKILL")});
 return {pid:p.pid,ready,call(action,payload={}){const id=crypto.randomUUID();return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error("W213_TIMEOUT"))},4000);
  pending.set(id,result=>{clearTimeout(timer);resolve(result)});
  p.send({kind:"COMMAND",id,action,payload});
 })},kill(){p.kill("SIGKILL")}};
}
test("W2.13 multi-process journal-backed recovered broker",async t=>{
 await t.test("durable commit survived coordinator restart; repeated ticket no duplicate",async t=>{
  const s=lab(t),a=worker(t,()=>s.broker);await a.ready;
  assert.equal((await a.call("PREPARE",{ticket:"one"})).ok,true);
  assert.equal((await a.call("COMMIT",{ticket:"one"})).ok,true);
  assert.equal(s.restart().status().sequence,1);
  assert.equal((await a.call("PREPARE",{ticket:"one"})).ok,true);
  assert.equal((await a.call("COMMIT",{ticket:"one"})).ok,false);
  assert.equal(s.broker.status().sequence,1);
 });console.log("TTO_W213_ACK_LOSS_NO_DUPLICATE=PASS");
 await t.test("pending ticket is lost when coordinator restarts",async t=>{
  const s=lab(t),a=worker(t,()=>s.broker);await a.ready;
  await a.call("PREPARE",{ticket:"pending"});s.restart();
  assert.equal((await a.call("COMMIT",{ticket:"pending"})).ok,false);
  assert.equal(s.broker.status().sequence,0);
 });console.log("TTO_W213_RESTART_PENDING_DENIED=PASS");
 await t.test("revocation by second OS worker persists beyond broker restart",async t=>{
  const s=lab(t),a=worker(t,()=>s.broker),b=worker(t,()=>s.broker);
  await Promise.all([a.ready,b.ready]);assert.notEqual(a.pid,b.pid);
  await a.call("PREPARE",{ticket:"old"});await b.call("REVOKE");s.restart();
  assert.equal((await a.call("COMMIT",{ticket:"old"})).ok,false);
  assert.equal(s.broker.status().active,false);
  assert.equal((await b.call("PREPARE",{ticket:"new"})).ok,false);
 });console.log("TTO_W213_REVOKE_RESTART_FENCED=PASS");
 await t.test("torn WAL is quarantined on next restart",async t=>{
  const s=lab(t),a=worker(t,()=>s.broker);await a.ready;
  await a.call("REVOKE");fs.appendFileSync(s.file,"{");
  assert.throws(()=>s.restart(),/W212_TORN_TAIL/);
 });console.log("TTO_W213_TORN_JOURNAL_DENIED=PASS");
 await t.test("simulated IPC partition never commits cached ticket",async t=>{
  const s=lab(t),a=worker(t,()=>s.broker);await a.ready;
  await a.call("PREPARE",{ticket:"blocked"});
  s.broker.partition(false);
  assert.equal((await a.call("COMMIT",{ticket:"blocked"})).ok,false);
  s.broker.partition(true);await a.call("REVOKE");
  assert.equal((await a.call("COMMIT",{ticket:"blocked"})).ok,false);
 });console.log("TTO_W213_PARTITION_DENY=PASS");
 await t.test("two workers writing through one owner broker get distinct ordered commits",async t=>{
  const s=lab(t),a=worker(t,()=>s.broker),b=worker(t,()=>s.broker);
  await Promise.all([a.ready,b.ready]);
  await Promise.all([a.call("PREPARE",{ticket:"a"}),b.call("PREPARE",{ticket:"b"})]);
  const results=await Promise.all([a.call("COMMIT",{ticket:"a"}),b.call("COMMIT",{ticket:"b"})]);
  assert.equal(results.every(x=>x.ok===true&&x.canGrantPermission===false),true);
  assert.deepEqual(results.map(x=>x.sequence).sort(),[1,2]);
  assert.equal(s.restart().status().sequence,2);
 });console.log("TTO_W213_MULTIPROCESS_SERIAL_ORDER=PASS");
});
