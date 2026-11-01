"use strict";
/** W2.11 OS child-process isolation + serialized synthetic authority broker.
 * IMPORTANT: single trusted parent event loop is NOT distributed consensus.
 */
const test=require("node:test"),assert=require("node:assert/strict");
const {fork}=require("node:child_process"),path=require("node:path"),crypto=require("node:crypto");
if(process.env.CI!=="true"||process.env.NODE_ENV!=="test"||
 process.env.TTO_W211_MULTIPROCESS_LAB!=="1"||
 process.env.DATABASE_URL||process.env.VERCEL)throw Error("W211_LAB_DISABLED");
const workerFile=path.join(__dirname,"w211-fencing-worker.cjs");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function broker(){
 let epoch=1,active=true,connected=true,seq=0;
 const tickets=new Map(),seen=new Set(),effects=[];
 return {
  events:()=>effects.map(e=>({...e})),
  epoch:()=>epoch,
  dispatch(owner,action,p={}){
   if(!connected)return {ok:false,reason:"PARTITION"};
   if(action==="PREPARE"){
    if(!active||seen.has(p.ticket)||tickets.has(p.ticket)||typeof p.ticket!=="string")
     return {ok:false,reason:"PREPARE_DENIED"};
    tickets.set(p.ticket,{owner,epoch});return {ok:true,epoch,simulationOnly:true};
   }
   if(action==="COMMIT"){
    const t=tickets.get(p.ticket);
    if(!t||t.owner!==owner)return {ok:false,reason:"FENCED"};
    tickets.delete(p.ticket);
    if(seen.has(p.ticket)||!active||t.epoch!==epoch)return {ok:false,reason:"STALE"};
    seen.add(p.ticket);
    const e={ticket:p.ticket,epoch,sequence:++seq,synthetic:true,canGrantPermission:false};
    effects.push(e);return {ok:true,effect:e,canGrantPermission:false};
   }
   if(action==="REVOKE"){active=false;epoch++;return {ok:true,epoch}}
   if(action==="ROTATE"){active=true;epoch++;return {ok:true,epoch}}
   if(action==="STATUS")return {ok:true,epoch,active};
   return {ok:false,reason:"UNKNOWN_ACTION"};
  },
  partition(v){connected=v===true},
  cleanup(owner){for(const [id,t] of tickets)if(t.owner===owner)tickets.delete(id)}
 };
}
function spawn(t,b){
 const proc=fork(workerFile,[],{env:{...process.env,NODE_ENV:"test",TTO_W211_MULTIPROCESS_LAB:"1"},
 stdio:["ignore","ignore","ignore","ipc"],execArgv:[]});
 t.after(()=>{if(proc.exitCode===null&&!proc.killed)proc.kill("SIGKILL")});
 let index=0;const pending=new Map();let ready;
 const started=new Promise((resolve,reject)=>{ready=resolve;proc.once("error",reject)});
 proc.on("message",m=>{
  if(m.kind==="READY"){ready();return}
  if(m.kind==="REQUEST"){
   const result=b.dispatch(String(proc.pid),m.action,m.payload);
   proc.send({kind:"REPLY",id:m.id,result});return;
  }
  if(m.kind==="RESULT"){const done=pending.get(m.id);if(done){pending.delete(m.id);done(m.result)}}
 });
 proc.on("exit",()=>{b.cleanup(String(proc.pid));for(const resolve of pending.values())resolve({ok:false,reason:"WORKER_EXIT"});pending.clear()});
 return {pid:proc.pid,ready:started,
  call(action,payload={},delay=0){
   const id=crypto.randomUUID();
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error("W211_IPC_TIMEOUT"))},5000);
    pending.set(id,result=>{clearTimeout(timer);resolve(result)});
    setTimeout(()=>{if(proc.connected)proc.send({kind:"COMMAND",id,action,payload});
     else{clearTimeout(timer);pending.delete(id);resolve({ok:false,reason:"DISCONNECTED"})}},delay);
   });
  },
  kill(){proc.kill("SIGKILL")}
 };
}
test("W2.11 independent OS-process fencing laboratory (no Docker)",async t=>{
 await t.test("two independent PIDs and serial synthetic commit",async t=>{
  const b=broker(),a=spawn(t,b),c=spawn(t,b);await Promise.all([a.ready,c.ready]);
  assert.notEqual(a.pid,c.pid);
  assert.equal((await a.call("PREPARE",{ticket:"a"})).ok,true);
  assert.equal((await c.call("PREPARE",{ticket:"b"})).ok,true);
  const r=await Promise.all([a.call("COMMIT",{ticket:"a"}),c.call("COMMIT",{ticket:"b"})]);
  assert.deepEqual(r.map(x=>x.effect.sequence).sort(),[1,2]);
  assert.equal(r.every(x=>x.canGrantPermission===false),true);
 });console.log("TTO_W211_REAL_OS_PROCESSES=PASS");
 await t.test("revocation on another PID fences prepared commit",async t=>{
  const b=broker(),a=spawn(t,b),c=spawn(t,b);await Promise.all([a.ready,c.ready]);
  await a.call("PREPARE",{ticket:"stale"});
  await c.call("REVOKE");
  assert.equal((await a.call("COMMIT",{ticket:"stale"})).ok,false);
  assert.equal(b.events().length,0);
 });console.log("TTO_W211_CROSS_PROCESS_REVOKE=PASS");
 await t.test("delayed message arrives after revocation and is denied",async t=>{
  const b=broker(),a=spawn(t,b),c=spawn(t,b);await Promise.all([a.ready,c.ready]);
  await a.call("PREPARE",{ticket:"delayed"});
  const pending=a.call("COMMIT",{ticket:"delayed"},90);
  await c.call("REVOKE");
  assert.equal((await pending).ok,false);assert.equal(b.events().length,0);
 });console.log("TTO_W211_DELAYED_IPC_DENIED=PASS");
 await t.test("partition returns deny not cached authority",async t=>{
  const b=broker(),a=spawn(t,b);await a.ready;
  await a.call("PREPARE",{ticket:"offline"});
  b.partition(false);assert.equal((await a.call("COMMIT",{ticket:"offline"})).ok,false);
  b.partition(true);await a.call("REVOKE");
  assert.equal((await a.call("COMMIT",{ticket:"offline"})).ok,false);
 });console.log("TTO_W211_PARTITION_FAIL_CLOSED=PASS");
 await t.test("child crash expires pending ticket; new child cannot replay",async t=>{
  const b=broker(),a=spawn(t,b);await a.ready;
  await a.call("PREPARE",{ticket:"crashed"});a.kill();await sleep(120);
  const c=spawn(t,b);await c.ready;
  assert.equal((await c.call("COMMIT",{ticket:"crashed"})).ok,false);
  assert.equal(b.events().length,0);
 });console.log("TTO_W211_CRASH_REPLAY_DENIED=PASS");
 await t.test("epoch rotation also fences old tickets",async t=>{
  const b=broker(),a=spawn(t,b),c=spawn(t,b);await Promise.all([a.ready,c.ready]);
  await a.call("PREPARE",{ticket:"rotated"});await c.call("ROTATE");
  assert.equal((await a.call("COMMIT",{ticket:"rotated"})).ok,false);
 });console.log("TTO_W211_ROTATION_EPOCH_FENCE=PASS");
 await t.test("duplicate effect is denied from a separate child",async t=>{
  const b=broker(),a=spawn(t,b),c=spawn(t,b);await Promise.all([a.ready,c.ready]);
  await a.call("PREPARE",{ticket:"once"});
  assert.equal((await a.call("COMMIT",{ticket:"once"})).ok,true);
  assert.equal((await c.call("COMMIT",{ticket:"once"})).ok,false);
  assert.equal((await c.call("PREPARE",{ticket:"once"})).ok,false);
  assert.equal(b.events().length,1);
 });console.log("TTO_W211_CROSS_PROCESS_DUPLICATE_DENIED=PASS");
});
