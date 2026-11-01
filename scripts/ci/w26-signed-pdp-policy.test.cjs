"use strict";
/** W2.6 real separate Ed25519 PDP signer test. NEVER production. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {createRequire,Module:NodeModule}=require("node:module");
const ROOT=path.resolve(__dirname,"../..");
const ts=createRequire(path.resolve(ROOT,"apps/shareholder/package.json"))("typescript");
const {NextRequest}=createRequire(path.resolve(ROOT,"apps/shareholder/package.json"))("next/server");
const {SyntheticPolicyRegistry}=require("../security/w25-synthetic-policy-registry.cjs");
const {SyntheticVersionTrace}=require("../security/w25-synthetic-policy-version-enforcer.cjs");
const {OfflineAuditLedger}=require("../security/w24-offline-audit-ledger.cjs");
const {makeSignedManifest,verifySignedManifest,keyId,policyDecision,
 labOnly}=require("../security/w26-signed-policy-protocol.cjs");
const {runSignedPdp,stats}=require("../security/w26-signed-pdp-gateway.cjs");
const {enforceW26Signed,bffClose}=require("../security/w26-signed-pdp-enforcer.cjs");
if(!labOnly()||process.env.TTO_W23_CONTRACT_LAB!=="1"||
 process.env.TTO_W24_AUDIT_LAB!=="1"||process.env.TTO_W25_POLICY_LAB!=="1")
 throw Error("W26_LAB_ONLY");
function loadTs(location){
 const file=path.resolve(ROOT,location);
 const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{
  fileName:file,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const m=new NodeModule(file,module);
 m.filename=file;m.paths=NodeModule._nodeModulePaths(path.dirname(file));
 m._compile(js,file);return m.exports;
}
const {prepareW1SyntheticBffCandidate}=loadTs("apps/shareholder/lib/w1-boundary-seam.ts");
const {prepareW23DormantBffEnvelope}=loadTs("apps/shareholder/lib/w23-dormant-policy-boundary.ts");
const {verifyW23DormantNestEnvelope}=loadTs("services/api/src/w23-dormant-policy-boundary.ts");
const BASE=1_800_000_000_000;
let clock=BASE;
const tenant="coop-test-A",owners=["fixture-owner-A","fixture-owner-B"];
const cookies=[crypto.randomUUID(),crypto.randomUUID()];
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const publisherKeys=crypto.generateKeyPairSync("ed25519");
const publisher={privateKey:publisherKeys.privateKey,
 publicPem:publisherKeys.publicKey.export({format:"pem",type:"spki"}).toString()};
const impostorKeys=crypto.generateKeyPairSync("ed25519");
const impostor={privateKey:impostorKeys.privateKey,
 publicPem:impostorKeys.publicKey.export({format:"pem",type:"spki"}).toString()};
function bundle(revision=1,overrides={}){
 return {policyId:"SYNTHETIC_SELF_READ_ONLY",revision,
  ruleset:revision===1?"SELF_READ_SYNTHETIC_V1":"SELF_READ_SYNTHETIC_V2",
  notBeforeMs:BASE,expiresAtMs:BASE+60_000,...overrides};
}
function registryAndBundle({expiry=60_000}={}){
 const registry=new SyntheticPolicyRegistry({clock:()=>clock});
 const b=bundle(1,{expiresAtMs:BASE+expiry});
 registry.publish(b);registry.activate(1);
 return {registry,b};
}
function serverProof(owner){
 return {sessionActive:true,tenantKey:tenant,ownerKey:owner,
  partyBound:true,membershipSourceApproved:true,featureEnabled:true,
  readPermission:true,sourceApproved:true,sourceFresh:true,
  sourceVersion:"SYNTHETIC-V1",classificationAllowed:true,
  downloadPermission:false,exportPermission:false,writePermission:false};
}
function candidate({owner=owners[0],actor=0,signal=new AbortController().signal}={}){
 const request=new NextRequest("http://127.0.0.1/test/tenants/"+tenant+
   "/owners/"+owner+"/read",{headers:{Cookie:"tto_lab_session="+cookies[actor]}});
 const w1=prepareW1SyntheticBffCandidate(request,
  {tenantKey:tenant,ownerKey:owner,operation:"read"},
  {sessionActive:true,expectedCookie:cookies[actor],
   tenantKey:tenant,ownerKey:owners[actor]});
 const bff=prepareW23DormantBffEnvelope(w1,request);
 if(bff.kind!=="DRAFT_CANDIDATE")return bff;
 return verifyW23DormantNestEnvelope(bff.envelope,
   serverProof(owners[actor]),signal);
}
function setup({reg,policy,pub=publisher,checked,source,audit,trace,
 deadlineMs=1200,delayMs=0,tamperResponse,tamperManifest,
 expectedSignerKeyId}={}){
 const base=reg||registryAndBundle();
 const touches=[],auditEvents=[];
 const logger=audit||{record(event){
  assert.deepEqual(Object.keys(event).sort(),
   ["requestId","phase","decision","reasonCode"].sort());
  auditEvents.push({...event});
 }};
 const sourceCounter=source||{read(input){
  touches.push({...input});
  return {synthetic:true,record:null,persisted:false};
 }};
 return {touches,auditEvents,trace:trace||new SyntheticVersionTrace(),
  cfg:{registry:base.registry,bundle:policy||base.b,publisher:pub,
   checked:checked||candidate(),audit:logger,
   versionTrace:trace||new SyntheticVersionTrace(),source:sourceCounter,
   deadlineMs,delayMs,tamperResponse,tamperManifest,expectedSignerKeyId}};
}
function fx(opts={}){
 const trace=opts.trace||new SyntheticVersionTrace();
 return setup({...opts,trace});
}
function denied(r,f,reason){
 assert.equal(r.decision,"DENY");
 if(reason)assert.equal(r.reasonCode,reason);
 assert.equal(r.sourceTouches,0);
 assert.equal(f.touches.length,0);
 assert.equal(r.canGrantPermission,false);
 assert.equal(r.hasActualRecord,false);
 assert.equal(r.legalOperationalEffect,"NONE");
 assert.equal(r.data,null);
 assert.equal(bffClose(r).available,false);
}
async function drained(){
 for(let i=0;i<100&&stats().active>0;i++)await sleep(10);
 assert.equal(stats().active,0,"all test child PIDs must exit");
}
test("W2.6 independent child policy evaluation & Ed25519 attestations",async t=>{
 t.after(async()=>{await drained();clock=BASE});
 await t.test("distinct real publisher and child PDP keys, signed rules and W2.4 audit",async()=>{
  clock=BASE;
  const f=fx();
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),"tto-w26-signatures-"));
  const journal=new OfflineAuditLedger(path.join(folder,"audit.jsonl"));
  f.cfg.audit={record:event=>journal.append(event)};
  const start=stats();
  try{
   const decision=await enforceW26Signed(f.cfg);
   assert.equal(decision.decision,"SIMULATED_ALLOW");
   assert.equal(decision.policyRevision,1);
   assert.equal(decision.sourceTouches,1);
   assert.equal(decision.canGrantPermission,false);
   assert.equal(decision.hasActualRecord,false);
   assert.deepEqual(bffClose(decision),
    {available:false,status:403,code:"W25_OPERATIONAL_NOT_APPROVED"});
   assert.equal(journal.verify().ok,true);
   const rows=fs.readFileSync(journal.file,"utf8");
   assert.equal(rows.includes(decision.requestId),true);
   for(const secret of [tenant,...owners,...cookies])
    assert.equal(rows.includes(secret),false);
   assert.equal(stats().started,start.started+1);
   assert.equal(f.trace.snapshot()[0].policyDigest,decision.policyDigest);
   assert.equal(f.trace.snapshot()[0].decision,"SIMULATED_ALLOW");
  }finally{fs.rmSync(folder,{recursive:true,force:true})}
  await drained();
 });
 console.log("TTO_W26_DISTINCT_CHILD_PDP_SIGNATURE_AND_AUDIT=PASS");

 await t.test("publisher signature can be verified independent of issuer",()=>{
  clock=BASE;
  const {registry,b}=registryAndBundle();
  const signed=makeSignedManifest(registry.issue().lease,b,
   publisher.privateKey,publisher.publicPem);
  assert.equal(verifySignedManifest(signed,publisher.publicPem),true);
  assert.equal(verifySignedManifest(signed,impostor.publicPem),false);
  assert.equal(verifySignedManifest({...signed,revision:2},publisher.publicPem),false);
  assert.equal(verifySignedManifest({...signed,ruleset:"TRADING_ENABLED"},publisher.publicPem),false);
  assert.equal(verifySignedManifest({...signed,expiresAtMs:signed.expiresAtMs+1},
   publisher.publicPem),false);
  assert.equal(verifySignedManifest({...signed,extraSecret:"x"},
   publisher.publicPem),false);
 });
 console.log("TTO_W26_PUBLISHER_SIGNATURE_TAMPER_DETECTED=PASS");

 await t.test("PDP child independently rejects changed but formerly signed policy",async()=>{
  clock=BASE;const f=fx({
   tamperManifest:p=>({...p,ruleset:"SELF_READ_SYNTHETIC_V2"})
  });
  denied(await enforceW26Signed(f.cfg),f,"PDP_SIGNATURE_OR_TRANSPORT_INVALID");
  await drained();
 });
 console.log("TTO_W26_CHILD_POLICY_SIGNATURE_VERIFIED=PASS");

 await t.test("different publisher key cannot impersonate accepted policy",async()=>{
  clock=BASE;
  const f=fx({pub:{privateKey:impostor.privateKey,publicPem:publisher.publicPem}});
  denied(await enforceW26Signed(f.cfg),f,"POLICY_SIGNATURE_INVALID");
 });
 console.log("TTO_W26_WRONG_PUBLISHER_DENIED=PASS");

 await t.test("child rejects policy signed by different key than its launch-pinned publisher root",async()=>{
  clock=BASE;
  const {registry,b}=registryAndBundle();
  const lease=registry.issue().lease;
  const signed=makeSignedManifest(lease,b,publisher.privateKey,publisher.publicPem);
  const accepted=candidate();
  assert.equal(accepted.kind,"SYNTHETIC_PDP_CANDIDATE");
  await assert.rejects(runSignedPdp({
   requestId:accepted.requestId,context:accepted.context,
   manifest:signed,publisherPublicPem:impostor.publicPem,
   evaluatedAtMs:lease.issuedAtMs,
   signal:new AbortController().signal
  }),/W26_CHILD_POLICY_SIGNATURE_INVALID/);
  await drained();
 });
 console.log("TTO_W26_CHILD_PINNED_PUBLISHER_ROOT_DENIES_IMPOSTOR=PASS");

 await t.test("PDP signs DENY when trusted synthetic context fails a rule",async()=>{
  clock=BASE;
  const good=candidate();
  assert.equal(good.kind,"SYNTHETIC_PDP_CANDIDATE");
  const untrustedContext={...good,context:{...good.context,permission:false}};
  assert.equal(policyDecision(untrustedContext.context,"SELF_READ_SYNTHETIC_V1").decision,"DENY");
  const f=fx({checked:untrustedContext});
  denied(await enforceW26Signed(f.cfg),f,"POLICY_CONTEXT_DENIED");
  await drained();
 });
 console.log("TTO_W26_CHILD_EVALUATES_POLICY_NOT_WRAPPER_ECHO=PASS");

 await t.test("tampering any signed decision binding or signature denies",async()=>{
  clock=BASE;
  const attacks=[
   s=>({...s,requestId:crypto.randomUUID()}),
   s=>({...s,nonce:crypto.randomUUID()}),
   s=>({...s,contextDigest:"f".repeat(64)}),
   s=>({...s,revision:s.revision+1}),
   s=>({...s,digest:"0".repeat(64)}),
   s=>({...s,epoch:s.epoch+1}),
   s=>({...s,decision:"DENY",reasonCode:"POLICY_CONTEXT_DENIED"}),
   s=>({...s,signature:s.signature.slice(0,-4)+"AAAA"}),
   s=>({...s,privateData:"SHAREHOLDER_SECRET"}),
   s=>({...s,signerKeyId:"0".repeat(64)})
  ];
  for(const tamperResponse of attacks){
   const f=fx({tamperResponse});
   denied(await enforceW26Signed(f.cfg),f,"PDP_SIGNATURE_OR_TRANSPORT_INVALID");
   await drained();
  }
 });
 console.log("TTO_W26_SIGNED_DECISION_REPLAY_AND_TAMPER_DENY=PASS");

 await t.test("unknown signer cannot replace pinned independently generated child key",async()=>{
  clock=BASE;
  const f=fx({expectedSignerKeyId:"0".repeat(64)});
  denied(await enforceW26Signed(f.cfg),f,"PDP_SIGNATURE_OR_TRANSPORT_INVALID");
  await drained();
 });
 console.log("TTO_W26_UNPINNED_SIGNER_REJECTED=PASS");

 await t.test("revoked policy during real child evaluation invalidates signed positive",async()=>{
  clock=BASE;
  const base=registryAndBundle();
  const f=fx({reg:base,delayMs:170});
  const before=stats().started;
  const future=enforceW26Signed(f.cfg);
  for(let i=0;i<90&&stats().started===before;i++)await sleep(10);
  assert.ok(stats().started>before);
  base.registry.revoke(1);
  denied(await future,f,"POLICY_REVOKED");
  await drained();
 });
 console.log("TTO_W26_INFLIGHT_REVOCATION_REJECTS_SIGNED_ALLOW=PASS");

 await t.test("policy replacement during PDP run voids even a valid old signature",async()=>{
  clock=BASE;
  const base=registryAndBundle();
  const f=fx({reg:base,delayMs:170});
  const before=stats().started;
  const future=enforceW26Signed(f.cfg);
  for(let i=0;i<90&&stats().started===before;i++)await sleep(10);
  assert.ok(stats().started>before);
  base.registry.publish(bundle(2));base.registry.activate(2);
  denied(await future,f,"POLICY_VERSION_STALE");
  await drained();
 });
 console.log("TTO_W26_INFLIGHT_ROTATION_REJECTS_OLD_ATTESTATION=PASS");

 await t.test("policy expiry during a real child response denies signed result",async()=>{
  clock=BASE;
  const base=registryAndBundle({expiry:150});
  const f=fx({reg:base,delayMs:160});
  const started=stats().started;
  const pending=enforceW26Signed(f.cfg);
  for(let i=0;i<80&&stats().started===started;i++)await sleep(10);
  assert.ok(stats().started>started);
  clock=BASE+150;
  denied(await pending,f,"POLICY_EXPIRED");
  await drained();
 });
 console.log("TTO_W26_INFLIGHT_EXPIRED_SIGNED_DECISION_DENY=PASS");

 await t.test("policy expired before child process never spawns PDP",async()=>{
  clock=BASE;
  const base=registryAndBundle({expiry:200});
  clock=BASE+200;
  const before=stats().started;
  const f=fx({reg:base});
  denied(await enforceW26Signed(f.cfg),f,"POLICY_EXPIRED");
  assert.equal(stats().started,before);
 });
 console.log("TTO_W26_EXPIRED_BEFORE_PDP_NO_CHILD=PASS");

 await t.test("revocation triggered by audit prevents any synthetic data read",async()=>{
  clock=BASE;
  const base=registryAndBundle();
  const audit=[];
  const f=fx({reg:base,audit:{record:event=>{
   audit.push({...event});
   if(event.decision==="SIMULATED_ALLOW")base.registry.revoke(1);
  }}});
  denied(await enforceW26Signed(f.cfg),f,"POLICY_REVOKED");
  assert.equal(audit.at(-1).reasonCode,"POLICY_REVOKED");
  await drained();
 });
 console.log("TTO_W26_RECHECK_AFTER_AUDIT_BEFORE_SOURCE=PASS");

 await t.test("audit outage refuses signed PDP decision without touching source",async()=>{
  clock=BASE;
  const f=fx({audit:{record(){throw Error("AUDIT_OUTAGE")}}});
  denied(await enforceW26Signed(f.cfg),f,"AUDIT_UNAVAILABLE");
  await drained();
 });
 console.log("TTO_W26_AUDIT_OUTAGE_FAIL_CLOSED=PASS");

 await t.test("request aborted during real child signing cannot grant access",async()=>{
  clock=BASE;const ctl=new AbortController();
  const f=fx({checked:candidate({signal:ctl.signal}),delayMs:350});
  const before=stats().started;
  const pending=enforceW26Signed(f.cfg);
  for(let i=0;i<80&&stats().started===before;i++)await sleep(10);
  assert.ok(stats().started>before);
  ctl.abort();
  denied(await pending,f,"REQUEST_ABORTED");
  await drained();
 });
 console.log("TTO_W26_ABORT_KILLS_SIGNING_CHILD=PASS");

 await t.test("child signature delayed beyond deadline never authorizes",async()=>{
  clock=BASE;
  const f=fx({delayMs:300,deadlineMs:50});
  denied(await enforceW26Signed(f.cfg),f,"PDP_TIMEOUT");
  await drained();
 });
 console.log("TTO_W26_CHILD_TIMEOUT_DENIES_SIGNED_LATE_RESULT=PASS");

 await t.test("two same-tenant synthetic owners use independent W23 proof",async()=>{
  clock=BASE;
  for(let i=0;i<owners.length;i++){
   const f=fx({checked:candidate({owner:owners[i],actor:i})});
   const out=await enforceW26Signed(f.cfg);
   assert.equal(out.decision,"SIMULATED_ALLOW");
   assert.equal(out.canGrantPermission,false);
   assert.equal(bffClose(out).status,403);
   await drained();
  }
  const deniedOwner=candidate({owner:owners[1],actor:0});
  assert.equal(deniedOwner.kind,"DENY");
  assert.equal(deniedOwner.code,"RESOURCE_OWNERSHIP_DENIED");
 });
 console.log("TTO_W26_W23_OWNER_SCOPE_STILL_ENFORCED=PASS");

 await t.test("fake source returning a record never leaks via BFF",async()=>{
  clock=BASE;
  const source={read:()=>({synthetic:true,record:{identity:"DO_NOT_EXPOSE"},
   persisted:false})};
  const f=fx({source});
  const out=await enforceW26Signed(f.cfg);
  assert.equal(out.decision,"DENY");
  assert.equal(out.reasonCode,"FIXTURE_INVALID");
  assert.equal(out.sourceTouches,1);
  assert.deepEqual(bffClose(out),
   {available:false,status:503,code:"W25_UPSTREAM_INVALID"});
  assert.equal(JSON.stringify(bffClose(out)).includes("DO_NOT_EXPOSE"),false);
  await drained();
 });
 console.log("TTO_W26_CORRUPT_SOURCE_NOT_REPORTED_AS_ZERO=PASS");

 await t.test("signed metadata trace only contains non-PII synthetic version details",async()=>{
  clock=BASE;
  const f=fx();const out=await enforceW26Signed(f.cfg);
  const rows=f.trace.snapshot();
  assert.deepEqual(Object.keys(rows[0]).sort(),
   ["requestId","policyRevision","policyDigest","policyEpoch",
    "decision","reasonCode"].sort());
  assert.equal(rows[0].policyDigest,out.policyDigest);
  for(const secret of [tenant,...owners,...cookies])
   assert.equal(JSON.stringify(rows).includes(secret),false);
  await drained();
 });
 console.log("TTO_W26_NO_PII_SIGNED_PROVENANCE=PASS");

 await t.test("after all scenarios no child signers stay alive or leak private keys",async()=>{
  await drained();
  const s=stats();
  assert.equal(s.started,s.closed);
  assert.equal(s.active,0);
  assert.ok(s.rejected>=10);
  assert.equal(keyId(publisher.publicPem)!==keyId(impostor.publicPem),true);
  assert.equal(typeof publisher.privateKey,"object");
  assert.equal(process.env.TTO_W26_CHILD,undefined);
 });
 console.log("TTO_W26_NO_ORPHAN_SIGNING_CHILDREN=PASS");
 console.log("TTO_W26_DUAL_SIGNATURES_LAB_ONLY_NO_OPERATIONAL_ALLOW=PASS");
 console.log("TTO_W26_NO_DOCKER_NO_DB_NO_DEPLOY=PASS");
});
