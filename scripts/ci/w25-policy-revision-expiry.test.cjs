"use strict";
/**
 * W2.5 version-locked policy decision adversarial tests — CI ONLY.
 * Uses actual-location W2.3 Nest proof shape, W2.2 real cancellable
 * Python PDP bridge and W2.4 hash-chained temporary audit where requested.
 * No database, Docker, production route, legal source, trade or real data.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {randomUUID}=require("node:crypto");
const {createRequire,Module:NodeModule}=require("node:module");
const ROOT=path.resolve(__dirname,"../..");
const requireApi=createRequire(path.resolve(ROOT,"services/api/package.json"));
const requireNext=createRequire(path.resolve(ROOT,"apps/shareholder/package.json"));
const ts=requireNext("typescript");
const {NextRequest}=requireNext("next/server");
const {SyntheticPolicyRegistry,enabled,POLICY_ID}=require("../security/w25-synthetic-policy-registry.cjs");
const {SyntheticVersionTrace,bindW25SyntheticPDP,enforceW25Revision,
 closeW25DormantBffResult}=require("../security/w25-synthetic-policy-version-enforcer.cjs");
const {OfflineAuditLedger}=require("../security/w24-offline-audit-ledger.cjs");
const {runW22CancellablePDP,stats}=require("../security/w2-2-cancellable-pdp-provider.cjs");
if(!enabled()||process.env.TTO_W24_AUDIT_LAB!=="1"||
 process.env.TTO_W23_CONTRACT_LAB!=="1"||
 process.env.TTO_W22_CANCELLABLE_LAB!=="1")
 throw Error("W25_GITHUB_DISPOSABLE_ONLY");
function loadTs(location){
 const file=path.resolve(ROOT,location);
 const code=ts.transpileModule(fs.readFileSync(file,"utf8"),{
  fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const mod=new NodeModule(file,module);
 mod.filename=file;mod.paths=NodeModule._nodeModulePaths(path.dirname(file));
 mod._compile(code,file);return mod.exports;
}
const {prepareW1SyntheticBffCandidate}=loadTs("apps/shareholder/lib/w1-boundary-seam.ts");
const {prepareW23DormantBffEnvelope}=loadTs("apps/shareholder/lib/w23-dormant-policy-boundary.ts");
const {verifyW23DormantNestEnvelope}=loadTs("services/api/src/w23-dormant-policy-boundary.ts");
const START=1_800_000_000_000;
const tenant="coop-test-A",owners=["fixture-owner-A","fixture-owner-B"];
const credential=[randomUUID(),randomUUID()];
let clock=START;
const time=()=>clock;
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
function makeRegistry(){
 return new SyntheticPolicyRegistry({clock:time});
}
function bundle(revision,overrides={}){
 return {
  policyId:POLICY_ID,revision,
  ruleset:revision===1?"SELF_READ_SYNTHETIC_V1":"SELF_READ_SYNTHETIC_V2",
  notBeforeMs:START,expiresAtMs:START+60000,
  ...overrides
 };
}
function activate(registry,revision=1){
 const b=bundle(revision);
 const published=registry.publish(b);
 const active=registry.activate(revision);
 assert.equal(active.digest,published.digest);
 return active;
}
function proof(owner){
 return {sessionActive:true,tenantKey:tenant,ownerKey:owner,
  partyBound:true,membershipSourceApproved:true,
  featureEnabled:true,readPermission:true,sourceApproved:true,
  sourceFresh:true,sourceVersion:"SYNTHETIC-V1",
  classificationAllowed:true,downloadPermission:false,
  exportPermission:false,writePermission:false};
}
function checked(owner=owners[0],actorIndex=0,signal=new AbortController().signal){
 const request=new NextRequest("http://127.0.0.1/test/tenants/"+tenant+
  "/owners/"+owner+"/read",{
   headers:{Cookie:"tto_lab_session="+credential[actorIndex]}
  });
 const w1=prepareW1SyntheticBffCandidate(request,
  {tenantKey:tenant,ownerKey:owner,operation:"read"},
  {sessionActive:true,expectedCookie:credential[actorIndex],
   tenantKey:tenant,ownerKey:owners[actorIndex]});
 const candidate=prepareW23DormantBffEnvelope(w1,request);
 if(candidate.kind!=="DRAFT_CANDIDATE")return candidate;
 return verifyW23DormantNestEnvelope(candidate.envelope,
  proof(owners[actorIndex]),signal);
}
function goodVerdict(){
 return {decision:"SIMULATED_ALLOW",reasonCode:"SIMULATION_ONLY",
  requestId:randomUUID(),fixtureTouches:1,auditCount:1,
  legalOperationalEffect:"NONE",canGrantPermission:false,hasActualRecord:false};
}
function localProvider({lease}){
 return Promise.resolve({
  policyId:lease.policyId,revision:lease.revision,
  digest:lease.digest,epoch:lease.epoch,verdict:goodVerdict()
 });
}
function fixture({registry=makeRegistry(),owner=owners[0],
 checkedOverride,provider=localProvider,audit,trace,source,deadlineMs=1000}={}){
 const calls=[],traces=trace||new SyntheticVersionTrace(),touches=[];
 const auditor=audit||{record(e){
  assert.deepEqual(Object.keys(e).sort(),
   ["requestId","phase","decision","reasonCode"].sort());
  calls.push({...e});
 }};
 const dataSource=source||{read(arg){
  touches.push({...arg});
  return {synthetic:true,record:null,persisted:false};
 }};
 return {registry,calls,traces,touches,
  cfg:{registry,checked:checkedOverride||checked(owner,owners.indexOf(owner)),
   provider,audit:auditor,versionTrace:traces,source:dataSource,deadlineMs}};
}
function deny(out,f,reason){
 assert.equal(out.decision,"DENY");
 assert.equal(out.reasonCode,reason);
 assert.equal(out.sourceTouches,0);
 assert.equal(out.canGrantPermission,false);
 assert.equal(out.hasActualRecord,false);
 assert.equal(out.legalOperationalEffect,"NONE");
 assert.equal(out.data,null);
 assert.equal(f.touches.length,0);
 assert.equal(closeW25DormantBffResult(out,out.requestId).available,false);
}
function deferred(){
 let proceed,started;
 const start=new Promise(ok=>{started=ok});
 const provider=({lease})=>{
  started(lease);
  return new Promise(ok=>{
   proceed=()=>ok({
    policyId:lease.policyId,revision:lease.revision,
    digest:lease.digest,epoch:lease.epoch,verdict:goodVerdict()
   });
  });
 };
 return {provider,start,resume:()=>proceed()};
}
test("W2.5 versioned policy registry and async security decisions fail closed",async t=>{
 t.after(()=>{clock=START});
 await t.test("versioned real W1 Python decision bound to trusted rev/digest/epoch",async()=>{
  clock=START;
  const r=makeRegistry();const activated=activate(r);
  const f=fixture({registry:r,provider:bindW25SyntheticPDP});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"tto-w25-policy-audit-"));
  const disk=new OfflineAuditLedger(path.join(dir,"audit.jsonl"));
  try{
   f.cfg.audit={record:e=>disk.append(e)};
   const out=await enforceW25Revision(f.cfg);
   assert.equal(out.decision,"SIMULATED_ALLOW");
   assert.equal(out.policyRevision,1);
   assert.equal(out.policyDigest,activated.digest);
   assert.equal(out.policyEpoch,activated.epoch);
   assert.equal(out.sourceTouches,1);
   assert.equal(out.canGrantPermission,false);
   assert.equal(out.legalOperationalEffect,"NONE");
   assert.equal(disk.verify().ok,true);
   const auditRows=fs.readFileSync(disk.file,"utf8");
   assert.equal(auditRows.includes(out.requestId),true);
   for(const secret of [tenant,owners[0],credential[0]])
    assert.equal(auditRows.includes(secret),false);
   const trace=f.traces.snapshot();
   assert.deepEqual(trace.map(e=>e.policyRevision),[1]);
   assert.deepEqual(trace.map(e=>e.policyDigest),[activated.digest]);
   assert.deepEqual(f.touches,[{requestId:out.requestId,policyRevision:1}]);
   const bff=closeW25DormantBffResult(out,out.requestId);
   assert.deepEqual(bff,{available:false,status:403,code:"W25_OPERATIONAL_NOT_APPROVED"});
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 });
 console.log("TTO_W25_POLICY_VERSION_BOUND_TO_PDP_AND_AUDIT=PASS");

 await t.test("absent active policy denied before calling any PDP or source",async()=>{
  clock=START;
  const r=makeRegistry();let invoked=0;
  const f=fixture({registry:r,provider:()=>{invoked++;return localProvider();}});
  deny(await enforceW25Revision(f.cfg),f,"POLICY_NOT_ACTIVE");
  assert.equal(invoked,0);
  assert.equal(f.traces.snapshot()[0].policyRevision,null);
 });
 console.log("TTO_W25_MISSING_POLICY_DENIED_BEFORE_PDP=PASS");

 await t.test("revision is monotonic; reusing or reverting to retired policy denied",()=>{
  clock=START;
  const r=makeRegistry();activate(r,1);
  assert.throws(()=>r.publish(bundle(1)),/POLICY_BUNDLE_INVALID/);
  r.publish(bundle(2));r.activate(2);
  assert.throws(()=>r.activate(1),/POLICY_ACTIVATION_INVALID/);
  assert.throws(()=>r.activate(2),/POLICY_ACTIVATION_INVALID/);
  r.revoke(2);
  assert.throws(()=>r.activate(2),/POLICY_ACTIVATION_INVALID/);
  assert.throws(()=>r.activate(1),/POLICY_ACTIVATION_INVALID/);
  assert.equal(r.issue().ok,false);
  assert.throws(()=>r.publish(bundle(1)),/POLICY_BUNDLE_INVALID/);
 });
 console.log("TTO_W25_NO_VERSION_ROLLBACK_OR_REUSE=PASS");

 await t.test("notBefore policy cannot activate before trusted clock",()=>{
  clock=START;const r=makeRegistry();
  r.publish(bundle(1,{notBeforeMs:START+500}));
  assert.throws(()=>r.activate(1),/POLICY_ACTIVATION_INVALID/);
  clock=START+500;r.activate(1);
  assert.equal(r.issue().ok,true);
  clock=START+400;
  assert.equal(r.check(r.issue().lease??{}).ok,false);
 });
 console.log("TTO_W25_NOT_BEFORE_AND_TRUSTED_CLOCK_GATE=PASS");

 await t.test("untrusted bundles with extra field, huge clock or invalid content rejected",()=>{
  clock=START;const r=makeRegistry();
  for(const invalid of [
   {...bundle(1),ownerKey:owners[0]},
   {...bundle(1),policyId:"OPERATIONAL"},
   {...bundle(1),ruleset:"TRADING_ENABLED"},
   bundle(1,{expiresAtMs:START}),
   bundle(1,{notBeforeMs:START+60*24*3600*1000}),
   bundle(1,{revision:1.5})
  ])assert.throws(()=>r.publish(invalid),/POLICY_BUNDLE_INVALID/);
  assert.equal(r.state().maxRevision,0);
 });
 console.log("TTO_W25_POLICY_BUNDLE_STRICT_SCHEMA=PASS");

 await t.test("expiration before PDP means no PDP execution",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  clock=START+60000;
  let called=false;const f=fixture({registry:r,provider:()=>{called=true}});
  deny(await enforceW25Revision(f.cfg),f,"POLICY_EXPIRED");
  assert.equal(called,false);
 });
 console.log("TTO_W25_EXPIRED_POLICY_PRE_PDP_DENIED=PASS");

 await t.test("policy expires WHILE PDP is pending: late positive rejected",async()=>{
  clock=START;const r=makeRegistry();
  r.publish(bundle(1,{expiresAtMs:START+100}));r.activate(1);
  const d=deferred();const f=fixture({registry:r,provider:d.provider});
  const future=enforceW25Revision(f.cfg);
  await d.start;clock=START+100;d.resume();
  deny(await future,f,"POLICY_EXPIRED");
  assert.equal(f.traces.snapshot().at(-1).reasonCode,"POLICY_EXPIRED");
 });
 console.log("TTO_W25_INFLIGHT_EXPIRY_DISCARDS_PDP_ALLOW=PASS");

 await t.test("revocation WHILE PDP is pending: zero synthetic source touches",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  const d=deferred(),f=fixture({registry:r,provider:d.provider});
  const future=enforceW25Revision(f.cfg);
  await d.start;r.revoke(1);d.resume();
  deny(await future,f,"POLICY_REVOKED");
 });
 console.log("TTO_W25_INFLIGHT_POLICY_REVOCATION_DENY=PASS");

 await t.test("replacement of active revision WHILE PDP pending invalidates ticket",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  const d=deferred(),f=fixture({registry:r,provider:d.provider});
  const future=enforceW25Revision(f.cfg);
  await d.start;r.publish(bundle(2));r.activate(2);d.resume();
  deny(await future,f,"POLICY_VERSION_STALE");
  assert.equal(r.issue().lease.revision,2);
 });
 console.log("TTO_W25_INFLIGHT_REVISION_SWAP_DENY=PASS");

 await t.test("stale replay, wrong fingerprint and wrong epoch in response fail closed",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  const now=r.issue().lease;
  for(const override of [
   {revision:2},{digest:"f".repeat(64)},{epoch:now.epoch+1},
   {policyId:"ACTUAL_TRADING"}, {extraUserClaim:true}
  ]){
   const f=fixture({registry:r,provider:({lease})=>({
    policyId:lease.policyId,revision:lease.revision,digest:lease.digest,
    epoch:lease.epoch,verdict:goodVerdict(),...override
   })});
   deny(await enforceW25Revision(f.cfg),f,"POLICY_RESPONSE_MISMATCH");
  }
  const token={...now,digest:"0".repeat(64)};
  assert.equal(r.check(token).reasonCode,"POLICY_LEASE_UNTRUSTED");
  assert.equal(r.check({...now}).reasonCode,"POLICY_LEASE_UNTRUSTED");
  assert.equal(r.check(now).ok,true,"original frozen server-issued lease remains valid");
 });
 console.log("TTO_W25_STALE_DIGEST_EPOCH_REPLAY_DENY=PASS");

 await t.test("post-audit revocation prevents source after PDP simulated allow",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  let logs=0;
  const f=fixture({registry:r,audit:{record(){
   logs++;
   if(logs===1)r.revoke(1);
  }}});
  deny(await enforceW25Revision(f.cfg),f,"POLICY_REVOKED");
  assert.ok(logs>=2);
  assert.equal(f.traces.snapshot().at(-1).reasonCode,"POLICY_REVOKED");
 });
 console.log("TTO_W25_RECHECK_AFTER_AUDIT_BEFORE_SOURCE=PASS");

 await t.test("metadata version journal failure denies without resource touches",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  const f=fixture({registry:r,trace:{record(){throw Error("DISK_FAILURE")}}});
  deny(await enforceW25Revision(f.cfg),f,"AUDIT_UNAVAILABLE");
 });
 console.log("TTO_W25_VERSION_AUDIT_FAILURE_DENY=PASS");

 await t.test("PDP crash, malformed response and no attestation never grant",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  for(const provider of [
   ()=>Promise.reject(Error("CRASH")),
   ()=>Promise.resolve({decision:"SIMULATED_ALLOW"}),
   ({lease})=>Promise.resolve({...localProviderSync(lease),verdict:{...goodVerdict(),canGrantPermission:true}})
  ]){
   const f=fixture({registry:r,provider});
   const response=await enforceW25Revision(f.cfg);
   assert.equal(response.decision,"DENY");
   assert.equal(response.sourceTouches,0);
   assert.equal(f.touches.length,0);
  }
 });
 console.log("TTO_W25_UNATTESTED_OR_MALFORMED_DECISIONS_DENY=PASS");

 await t.test("request abort prevents late source touch even with stubborn provider",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  const ctl=new AbortController();
  const w=checked(owners[0],0,ctl.signal);
  const d=deferred();
  const f=fixture({registry:r,checkedOverride:w,provider:d.provider});
  const pending=enforceW25Revision(f.cfg);
  await d.start;ctl.abort();d.resume();
  deny(await pending,f,"REQUEST_ABORTED");
 });
 console.log("TTO_W25_REQUEST_ABORT_FAIL_CLOSED=PASS");

 await t.test("PDP timeout rejects a provider that never returns",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  const f=fixture({registry:r,provider:()=>new Promise(()=>{}),deadlineMs:30});
  deny(await enforceW25Revision(f.cfg),f,"PDP_TIMEOUT");
 });
 console.log("TTO_W25_DEADLINE_DENIES_LATE_DECISIONS=PASS");

 await t.test("same synthetic tenant two independent owners; forged owner denied at Nest",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  for(const owner of owners){
   const f=fixture({registry:r,owner});
   const result=await enforceW25Revision(f.cfg);
   assert.equal(result.decision,"SIMULATED_ALLOW");
   assert.equal(result.canGrantPermission,false);
   assert.equal(f.touches.length,1);
   assert.equal(closeW25DormantBffResult(result,result.requestId).status,403);
  }
  const cross=checked(owners[1],0);
  assert.equal(cross.kind,"DENY");
 });
 console.log("TTO_W25_SAME_TENANT_OWNER_AND_REVISION_SCOPE=PASS");

 await t.test("corrupt fake source may report attempted access, but BFF never leaks",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  const f=fixture({registry:r,source:{read(){
   return {synthetic:true,record:{SHAREHOLDER:"LEAK"},persisted:false};
  }}});
  const result=await enforceW25Revision(f.cfg);
  assert.equal(result.decision,"DENY");
  assert.equal(result.reasonCode,"FIXTURE_INVALID");
  assert.equal(result.sourceTouches,1);
  assert.deepEqual(closeW25DormantBffResult(result,result.requestId),
   {available:false,status:503,code:"W25_UPSTREAM_INVALID"});
 });
 console.log("TTO_W25_CORRUPT_SOURCE_NEVER_REPORTED_ZERO=PASS");

 await t.test("trace metadata never includes tenant, owner, token, source data",async()=>{
  clock=START;const r=makeRegistry();activate(r);
  const f=fixture({registry:r});
  await enforceW25Revision(f.cfg);
  const rows=f.traces.snapshot();
  assert.deepEqual(Object.keys(rows[0]).sort(),
   ["requestId","policyRevision","policyDigest","policyEpoch","decision","reasonCode"].sort());
  for(const secret of [tenant,...owners,...credential])
   assert.equal(JSON.stringify(rows).includes(secret),false);
  assert.equal(f.calls.length,1);
 });
 console.log("TTO_W25_NO_PII_VERSION_PROVENANCE=PASS");
 console.log("TTO_W25_SYNTHETIC_ONLY_NO_OPERATIONAL_ALLOW=PASS");
 console.log("TTO_W25_NO_DOCKER_NO_DB_NO_DEPLOY=PASS");
});
function localProviderSync(lease){
 return {policyId:lease.policyId,revision:lease.revision,
  digest:lease.digest,epoch:lease.epoch,verdict:goodVerdict()};
}
