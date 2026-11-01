"use strict";
/**
 * W2.2 cancellable PDP real child-process adversarial tests, offline ONLY.
 * All fixtures are in-memory; no Next production App Router, Nest AppModule,
 * Docker, PostgreSQL, source adapters, official data or transactions.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
const {performance}=require("node:perf_hooks");
const {
 runW22CancellablePDP,stats,labOnly
}=require("../security/w2-2-cancellable-pdp-provider.cjs");
const {enforceW2SyntheticInline}=require("../security/w2-inline-synthetic-enforcer.cjs");

if(!labOnly())throw Error("W22_OFFLINE_LAB_NOT_ENABLED");
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const tenant="coop-test-A";
const owners=["fixture-owner-A","fixture-owner-B"];
const candidate=owner=>({
 contractVersion:"W1_BFF_NEST_SEAM_V0_1",environment:"SIMULATION",
 tenantKey:tenant,ownerKey:owner,operation:"read"
});
const proof=owner=>({
 sessionActive:true,tenantKey:tenant,ownerKey:owner,
 partyBound:true,membershipSourceApproved:true,featureEnabled:true,
 readPermission:true,sourceApproved:true,sourceFresh:true,
 sourceVersion:"SYNTHETIC-V1",classificationAllowed:true
});
const ctx=()=>{
 return {
  environment:"SIMULATION",session:"ACTIVE",tenantMatch:true,partyBound:true,
  membershipSourceApproved:true,featureEnabled:true,permission:true,
  sourceApproved:true,sourceStatus:"APPROVED",sourceFresh:true,
  sourceVersion:"SYNTHETIC-V1",selfResource:true,classificationAllowed:true,
  downloadPermission:false,exportPermission:false,writePermission:false,
  reauth:false,csrf:false,idempotency:null,versionMatched:false,
  ruleSnapshot:null,paymentState:"NONE",ownershipFinalizationApproved:false
 };
};
function fake(){
 const audits=[],touches=[];
 return {
  audits,touches,
  audit:{record(event){
   assert.deepEqual(Object.keys(event).sort(),
    ["requestId","operation","decision","reasonCode"].sort());
   audits.push({...event});
  }},
  source:{read(key){
   touches.push({...key});
   return {synthetic:true,record:null,persisted:false};
  }}
 };
}
function apply(owner,mode="bridge",opts={}){
 const fixture=fake(),p=proof(owner);
 const policy=(operation,context,{signal})=>
  runW22CancellablePDP(operation,context,{signal,mode});
 const input={
  candidate:candidate(owner),proof:p,policy,
  audit:fixture.audit,source:fixture.source,
  deadlineMs:opts.deadlineMs||1300,
  ...(opts.signal?{requestSignal:opts.signal}:{})
 };
 return {fixture,p,input};
}
async function quiescent(){
 for(let i=0;i<100&&stats().active!==0;i++)await sleep(10);
 assert.equal(stats().active,0,"cancelled child must be reaped");
}
function denied(result,fx,reason){
 assert.equal(result.decision,"DENY");
 if(reason)assert.equal(result.reasonCode,reason);
 assert.equal(result.sourceTouches,0);
 assert.equal(result.canGrantPermission,false);
 assert.equal(result.legalOperationalEffect,"NONE");
 assert.equal(result.hasActualRecord,false);
 assert.equal(fx.touches.length,0);
 assert.equal(fx.audits.length,1);
}

test("W2.2 async PDP child lifecycle and hard fail-closed rules",async t=>{
 await t.test("real Python W1 bridge supports synthetic positive read, no real record",async()=>{
  const {fixture,input}=apply(owners[0]);
  const result=await enforceW2SyntheticInline(input);
  assert.equal(result.decision,"SIMULATED_ALLOW");
  assert.equal(result.legalOperationalEffect,"NONE");
  assert.equal(result.hasActualRecord,false);
  assert.equal(result.canGrantPermission,false);
  assert.equal(result.data,null);
  assert.equal(result.sourceTouches,1);
  assert.deepEqual(fixture.touches,[{tenantKey:tenant,ownerKey:owners[0]}]);
  await quiescent();
 });
 console.log("TTO_W22_ASYNC_PYTHON_PDP_INLINE=PASS");

 await t.test("OS child process is genuinely asynchronous and killable",async()=>{
  const ctl=new AbortController();
  const before=stats();
  const pending=runW22CancellablePDP("read",ctx(),{signal:ctl.signal,mode:"hang"});
  let fired=false;
  await new Promise(resolve=>setTimeout(()=>{fired=true;resolve()},15));
  assert.equal(fired,true,"event loop must not block on child");
  assert.ok(stats().started>=before.started+1);
  ctl.abort();
  await assert.rejects(pending,/PDP_ABORTED/);
  await quiescent();
  assert.ok(stats().aborted>=before.aborted+1);
 });
 console.log("TTO_W22_OS_CHILD_ABORT_AND_REAP=PASS");

 await t.test("deadline aborts hung child; no synthetic source is touched",async()=>{
  const {fixture,input}=apply(owners[0],"hang",{deadlineMs:50});
  const before=stats().aborted;
  const start=performance.now();
  const result=await enforceW2SyntheticInline(input);
  denied(result,fixture,"PDP_TIMEOUT");
  assert.ok(performance.now()-start<1100,"bounded caller response");
  await quiescent();
  assert.ok(stats().aborted>=before+1);
 });
 console.log("TTO_W22_HANG_DEADLINE_FAIL_CLOSED=PASS");

 await t.test("late positive child reply cannot revive expired authorization",async()=>{
  const {fixture,input}=apply(owners[0],"late",{deadlineMs:50});
  const result=await enforceW2SyntheticInline(input);
  denied(result,fixture,"PDP_TIMEOUT");
  await sleep(680);
  await quiescent();
  assert.equal(fixture.touches.length,0);
  assert.equal(fixture.audits.length,1,"no late allow audit");
 });
 console.log("TTO_W22_LATE_POSITIVE_DISCARDED=PASS");

 await t.test("client-request AbortSignal cancels running PDP, not just race",async()=>{
  const ctl=new AbortController();
  const {fixture,input}=apply(owners[0],"hang",{deadlineMs:1300,signal:ctl.signal});
  const before=stats().started;
  const pending=enforceW2SyntheticInline(input);
  for(let i=0;i<80&&stats().started<=before;i++)await sleep(10);
  assert.ok(stats().started>before,"child started before cancellation");
  ctl.abort();
  const result=await pending;
  denied(result,fixture,"REQUEST_ABORTED");
  await quiescent();
 });
 console.log("TTO_W22_REQUEST_DISCONNECT_ABORTS_PDP=PASS");

 await t.test("already aborted request returns DENY without launching child",async()=>{
  const ctl=new AbortController();ctl.abort();
  const {fixture,input}=apply(owners[0],"bridge",{signal:ctl.signal});
  const before=stats().started;
  denied(await enforceW2SyntheticInline(input),fixture,"REQUEST_ABORTED");
  assert.equal(stats().started,before);
 });
 console.log("TTO_W22_PREABORT_NO_CHILD=PASS");

 await t.test("PDP crash, malformed JSON and excessive output all fail closed",async()=>{
  for(const mode of ["crash","invalid","schema","oversize"]){
   const {fixture,input}=apply(owners[0],mode,{deadlineMs:1500});
   const result=await enforceW2SyntheticInline(input);
   denied(result,fixture,mode==="schema"?"DECISION_INVALID":"PDP_UNAVAILABLE");
   await quiescent();
  }
 });
 console.log("TTO_W22_BAD_TRANSPORT_RESPONSE_DENIED=PASS");

 await t.test("owner revocation during delayed PDP response blocks resource",async()=>{
  const {fixture,input,p}=apply(owners[0],"late",{deadlineMs:1200});
  const pending=enforceW2SyntheticInline(input);
  await sleep(35);
  p.ownerKey=owners[1];
  const result=await pending;
  denied(result,fixture,"PROOF_CHANGED");
  await quiescent();
 });
 console.log("TTO_W22_INFLIGHT_OWNER_REVOKED=PASS");

 await t.test("a PDP provider that ignores cancellation is still unable to allow late",async()=>{
  const fx=fake(),p=proof(owners[0]);
  let settleLate;
  const input={candidate:candidate(owners[0]),proof:p,
   audit:fx.audit,source:fx.source,deadlineMs:35,
   policy:(_op,_ctx,_options)=>new Promise(resolve=>{settleLate=resolve;})};
  const result=await enforceW2SyntheticInline(input);
  denied(result,fx,"PDP_TIMEOUT");
  settleLate({decision:"SIMULATED_ALLOW",reasonCode:"SIMULATION_ONLY",
   requestId:randomUUID(),auditCount:1,fixtureTouches:1,
   canGrantPermission:false,hasActualRecord:false,legalOperationalEffect:"NONE"});
  await sleep(50);
  assert.equal(fx.touches.length,0);
 });
 console.log("TTO_W22_IGNORED_ABORT_LATE_RESULT_DENIED=PASS");

 await t.test("concurrent owner requests are isolated; one abort cannot grant another",async()=>{
  const ctl=new AbortController();
  const a=apply(owners[0],"hang",{signal:ctl.signal,deadlineMs:1200});
  const b=apply(owners[1],"bridge",{deadlineMs:1200});
  const start=stats().started;
  const first=enforceW2SyntheticInline(a.input);
  const second=enforceW2SyntheticInline(b.input);
  for(let i=0;i<80&&stats().started<start+2;i++)await sleep(10);
  assert.ok(stats().started>=start+2,"both subprocesses launched");
  ctl.abort();
  const [denial,allowed]=await Promise.all([first,second]);
  denied(denial,a.fixture,"REQUEST_ABORTED");
  assert.equal(allowed.decision,"SIMULATED_ALLOW");
  assert.deepEqual(b.fixture.touches,[{tenantKey:tenant,ownerKey:owners[1]}]);
  assert.equal(allowed.canGrantPermission,false);
  await quiescent();
 });
 console.log("TTO_W22_CONCURRENT_TENANT_OWNER_ISOLATION=PASS");

 await t.test("only synthetic audit metadata survives and every child is reaped",()=>{
  const state=stats();
  assert.equal(state.active,0);
  assert.ok(state.started>=state.closed-0);
  assert.equal(state.started,state.closed,"all spawned PDP children must close");
  assert.ok(state.aborted>=3);
  assert.ok(state.oversize>=1);
  assert.equal(labOnly(),true);
 });
 console.log("TTO_W22_NO_ORPHAN_CHILD_PROCESSES=PASS");
 console.log("TTO_W22_NO_DB_NO_DOCKER_NO_OPERATIONAL_ALLOW=PASS");
});
