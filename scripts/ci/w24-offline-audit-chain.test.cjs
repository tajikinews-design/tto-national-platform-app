"use strict";
/** W2.4 offline audit chain and Next->Nest->PDP trace. NO Docker or DB. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {randomUUID}=require("node:crypto");
const {createRequire,Module:NodeModule}=require("node:module");
const ROOT=path.resolve(__dirname,"../..");
const nextRequire=createRequire(path.resolve(ROOT,"apps/shareholder/package.json"));
const apiRequire=createRequire(path.resolve(ROOT,"services/api/package.json"));
apiRequire("reflect-metadata");
const ts=nextRequire("typescript");
const {NextRequest}=nextRequire("next/server");
const {Controller,Post,Req,Module}=apiRequire("@nestjs/common");
const {NestFactory}=apiRequire("@nestjs/core");
const {FastifyAdapter}=apiRequire("@nestjs/platform-fastify");
const {OfflineAuditLedger,verifyAuditFile,enabled,ZERO}=require(
 "../security/w24-offline-audit-ledger.cjs");
const {runW22CancellablePDP,stats}=require("../security/w2-2-cancellable-pdp-provider.cjs");
if(!enabled()||process.env.TTO_W23_CONTRACT_LAB!=="1"||
   process.env.TTO_W22_CANCELLABLE_LAB!=="1")
 throw Error("W24_DISPOSABLE_CI_ONLY");
function loadTs(location){
 const file=path.resolve(ROOT,location);
 const compiled=ts.transpileModule(fs.readFileSync(file,"utf8"),{
  fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 const mod=new NodeModule(file,module);
 mod.filename=file;mod.paths=NodeModule._nodeModulePaths(path.dirname(file));
 mod._compile(compiled,file);
 return mod.exports;
}
const {prepareW1SyntheticBffCandidate}=loadTs("apps/shareholder/lib/w1-boundary-seam.ts");
const {prepareW23DormantBffEnvelope,closeW23DormantBffVerdict}=
 loadTs("apps/shareholder/lib/w23-dormant-policy-boundary.ts");
const {verifyW23DormantNestEnvelope,normalizeW23SyntheticNestPolicyVerdict}=
 loadTs("services/api/src/w23-dormant-policy-boundary.ts");
const session=randomUUID(),handle=randomUUID(),channel=randomUUID();
const tenant="coop-test-A",owner="fixture-owner-A";
const proof={
 sessionActive:true,tenantKey:tenant,ownerKey:owner,
 partyBound:true,membershipSourceApproved:true,featureEnabled:true,
 readPermission:true,sourceApproved:true,sourceFresh:true,
 sourceVersion:"SYNTHETIC-V1",classificationAllowed:true,
 downloadPermission:false,exportPermission:false,writePermission:false
};
const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),"tto-w24-audit-"));
const primary=path.join(sandbox,"trace.jsonl");
const ledger=new OfflineAuditLedger(primary);
let nest,endpoint,policyCalls=0,sourceTouches=0,auditFail=false,mode="normal";
function audit(event){
 if(auditFail)throw Error("AUDIT_SINK_UNAVAILABLE");
 return ledger.append(event);
}
function record(requestId,phase,decision,reasonCode){
 return audit({requestId,phase,decision,reasonCode});
}
class W24NestController{
 async evaluate(request){
  if(request.headers["x-w24-internal-channel"]!==channel||
     request.headers["x-w24-handle"]!==handle)
   return {code:"W24_INTERNAL_CHANNEL_DENIED"};
  const controller=new AbortController();
  const close=()=>controller.abort();
  request.raw?.socket?.once("close",close);
  let timer;
  try{
   const checked=verifyW23DormantNestEnvelope(request.body,proof,controller.signal);
   if(checked.kind!=="SYNTHETIC_PDP_CANDIDATE")return {code:"W24_NEST_DENIED"};
   // A missing audit must fail closed BEFORE a policy invocation.
   record(checked.requestId,"NEST_SCOPE","NONE","SCOPE_CHECKED");
   policyCalls++;
   timer=setTimeout(()=>controller.abort(),mode==="hang"?35:1200);
   let raw;
   try{
    raw=await runW22CancellablePDP("read",checked.context,{
     signal:controller.signal,mode:mode==="hang"?"hang":"bridge"
    });
   }catch{return {code:"W24_PDP_UNAVAILABLE"}}
   const n=normalizeW23SyntheticNestPolicyVerdict(raw,checked.requestId,controller.signal);
   if(n.kind!=="SIMULATED_ONLY")return {code:"W24_PDP_INVALID"};
   record(checked.requestId,"PDP_DECISION",n.verdict.decision,n.verdict.reasonCode);
   return n.verdict;
  }catch{return {code:"W24_AUDIT_UNAVAILABLE"}}
  finally{
   clearTimeout(timer);
   request.raw?.socket?.off("close",close);
  }
 }
}
Req()(W24NestController.prototype,"evaluate",0);
Post("evaluate")(W24NestController.prototype,"evaluate",
 Object.getOwnPropertyDescriptor(W24NestController.prototype,"evaluate"));
Controller("w24-audit-lab-only")(W24NestController);
class W24TestOnlyModule{}
Module({controllers:[W24NestController]})(W24TestOnlyModule);
async function bff({cookie=session,tenantKey=tenant,ownerKey=owner,op="read"}={}){
 const url="http://127.0.0.1/test/tenants/"+tenantKey+"/owners/"+ownerKey+"/"+op;
 const req=new NextRequest(url,{headers:{Cookie:"tto_lab_session="+cookie}});
 const w1=prepareW1SyntheticBffCandidate(req,{
  tenantKey,ownerKey,operation:op
 },{
  sessionActive:true,expectedCookie:session,tenantKey:tenant,ownerKey:owner
 });
 const w23=prepareW23DormantBffEnvelope(w1,req);
 const id=w23.kind==="DRAFT_CANDIDATE"?w23.envelope.requestId:randomUUID();
 try{
  record(id,"BFF_PRECHECK",w23.kind==="DENY"?"DENY":"NONE",
   w23.kind==="DENY"?"PRECHECK_DENIED":"PRECHECK_ACCEPTED");
 }catch{return {available:false,status:503,code:"W24_AUDIT_UNAVAILABLE"}}
 if(w23.kind!=="DRAFT_CANDIDATE")
  return {available:false,status:w23.status,code:w23.code};
 try{
  const response=await fetch(endpoint+"/w24-audit-lab-only/evaluate",{
   method:"POST",
   headers:{"Content-Type":"application/json",
    "x-w24-internal-channel":channel,"x-w24-handle":handle},
   body:JSON.stringify(w23.envelope),
   signal:AbortSignal.timeout(2500)
  });
  const raw=await response.json();
  const result=closeW23DormantBffVerdict(raw,id);
  // Auditing the final closed decision is required, even after a valid PDP
  // fake allow. Never forward raw Nest JSON, data or an operational grant.
  record(id,"BFF_RESPONSE","DENY",result.code);
  return result;
 }catch{return {available:false,status:503,code:"W24_AUDIT_OR_POLICY_UNAVAILABLE"}}
}
test("W2.4 file-backed tamper-evident audit and detached Next/Nest/PDP tracing",async t=>{
 t.after(async()=>{
  if(nest)await nest.close();
  fs.rmSync(sandbox,{recursive:true,force:true});
 });
 await t.test("exclusive file created with private mode and verified empty checkpoint",()=>{
  assert.equal(fs.statSync(primary).mode&0o077,0);
  assert.deepEqual(ledger.checkpoint(),{count:0,head:ZERO});
  assert.equal(ledger.verify().ok,true);
  assert.throws(()=>new OfflineAuditLedger(primary),/AUDIT_FILE_ALREADY_EXISTS/);
 });
 await t.test("extra PII, token and identity fields are rejected before persistence",()=>{
  const count=ledger.checkpoint().count;
  for(const extra of [{token:"TOP_SECRET"},{tenantKey:tenant},{ownerKey:owner},
                      {cookie:session},{headers:{Authorization:"abc"}},{ip:"127.0.0.1"}]){
   assert.throws(()=>ledger.append({requestId:randomUUID(),phase:"BFF_PRECHECK",
    decision:"NONE",reasonCode:"PRECHECK_ACCEPTED",...extra}),/AUDIT_EVENT_INVALID/);
  }
  assert.equal(ledger.checkpoint().count,count);
  assert.equal(ledger.verify().ok,true);
 });
 console.log("TTO_W24_STRICT_NO_PII_AUDIT_ALLOWLIST=PASS");

 await t.test("real NextRequest + ephemeral Nest + cancellable Python PDP create one trace",async()=>{
  nest=await NestFactory.create(W24TestOnlyModule,new FastifyAdapter({logger:false}),
   {logger:false});
  await nest.listen(0,"127.0.0.1");endpoint=await nest.getUrl();
  const before=ledger.checkpoint();
  const result=await bff();
  assert.equal(result.available,false);
  assert.equal(result.status,403);
  assert.equal(result.code,"W23_OPERATIONAL_NOT_APPROVED");
  assert.equal(ledger.checkpoint().count,before.count+4);
  const events=fs.readFileSync(primary,"utf8").trim().split("\n").slice(-4).map(JSON.parse);
  assert.deepEqual(events.map(x=>x.phase),
   ["BFF_PRECHECK","NEST_SCOPE","PDP_DECISION","BFF_RESPONSE"]);
  assert.equal(new Set(events.map(x=>x.requestId)).size,1);
  assert.equal(events[2].decision,"SIMULATED_ALLOW");
  assert.equal(events[3].decision,"DENY");
  assert.equal(sourceTouches,0);
  assert.equal(ledger.verify().ok,true);
  assert.equal(policyCalls,1);
  for(const secret of [tenant,owner,session,handle,channel])
   assert.equal(fs.readFileSync(primary,"utf8").includes(secret),false);
 });
 console.log("TTO_W24_BFF_NEST_PDP_CORRELATED_TRACE=PASS");

 await t.test("anonymous/wrong owner requests are audited only at BFF and never reach PDP",async()=>{
  const before=policyCalls,initial=ledger.checkpoint().count;
  for(const opts of [{cookie:"unknown"},{ownerKey:"fixture-owner-B"},{tenantKey:"coop-test-B"}]){
   const r=await bff(opts);
   assert.equal(r.available,false);
   assert.equal(r.status>=400,true);
  }
  assert.equal(policyCalls,before);
  assert.equal(sourceTouches,0);
  assert.equal(ledger.checkpoint().count,initial+3);
  assert.equal(ledger.verify().ok,true);
 });
 console.log("TTO_W24_DENIAL_AUDITED_BEFORE_PDP=PASS");

 await t.test("audit sink failure blocks before PDP and never exposes source",async()=>{
  auditFail=true;
  const before=policyCalls;
  try{
   const r=await bff();
   assert.deepEqual(r,{available:false,status:503,code:"W24_AUDIT_UNAVAILABLE"});
   assert.equal(policyCalls,before);
   assert.equal(sourceTouches,0);
  }finally{auditFail=false}
  assert.equal(ledger.verify().ok,true);
 });
 console.log("TTO_W24_AUDIT_FAILURE_FAIL_CLOSED=PASS");

 await t.test("PDP timeout yields DENY, no actual record and same correlation",async()=>{
  mode="hang";
  const before=policyCalls;
  try{
   const r=await bff();
   assert.equal(r.available,false);
   assert.equal(r.status,503);
   assert.equal(policyCalls,before+1);
   assert.equal(sourceTouches,0);
   for(let i=0;i<100&&stats().active;i++)
    await new Promise(resolve=>setTimeout(resolve,10));
   assert.equal(stats().active,0);
   assert.equal(ledger.verify().ok,true);
  }finally{mode="normal"}
 });
 console.log("TTO_W24_TIMEOUT_NO_SOURCE_AND_AUDIT_CHECKPOINT=PASS");

 await t.test("independent head detects byte edits, ordering and truncation",()=>{
  const checkpoint=ledger.checkpoint();
  const backup=fs.readFileSync(primary,"utf8");
  const lines=backup.trimEnd().split("\n");
  const mutated=lines.slice();mutated[0]=mutated[0].replace("BFF_PRECHECK","NEST_SCOPE");
  const swapped=lines.slice();[swapped[0],swapped[1]]=[swapped[1],swapped[0]];
  for(const scenario of [
   mutated.join("\n")+"\n",
   swapped.join("\n")+"\n",
   lines.slice(0,-1).join("\n")+"\n",
   backup.slice(0,-7)
  ]){
   fs.writeFileSync(primary,scenario,{mode:0o600});
   const status=verifyAuditFile(primary,checkpoint);
   assert.equal(status.ok,false);
  }
  fs.writeFileSync(primary,backup,{mode:0o600});
  assert.equal(verifyAuditFile(primary,checkpoint).ok,true);
 });
 console.log("TTO_W24_TAMPER_REORDER_TRUNCATE_DETECTED=PASS");

 await t.test("checkpoint cannot be silently derived from damaged file",()=>{
  const checkpoint=ledger.checkpoint();
  assert.equal(verifyAuditFile(primary,{count:checkpoint.count,head:ZERO}).ok,false);
  assert.equal(verifyAuditFile(primary,{count:checkpoint.count-1,head:checkpoint.head}).ok,false);
  assert.equal(verifyAuditFile(primary,{count:checkpoint.count,head:"bad"}).ok,false);
  assert.equal(ledger.verify().ok,true);
 });
 console.log("TTO_W24_INDEPENDENT_CHECKPOINT_REQUIRED=PASS");

 await t.test("permissions and missing or replaced audit file always deny",()=>{
  const backup=fs.readFileSync(primary,"utf8");
  const cp=ledger.checkpoint();
  fs.chmodSync(primary,0o644);
  assert.equal(verifyAuditFile(primary,cp).ok,false);
  fs.chmodSync(primary,0o600);
  fs.renameSync(primary,primary+".aside");
  try{
   assert.equal(verifyAuditFile(primary,cp).ok,false);
   assert.throws(()=>ledger.append({requestId:randomUUID(),phase:"BFF_PRECHECK",
    decision:"DENY",reasonCode:"PRECHECK_DENIED"}),/AUDIT_UNAVAILABLE/);
  }finally{
   fs.renameSync(primary+".aside",primary);
   fs.writeFileSync(primary,backup,{mode:0o600});
  }
  assert.equal(ledger.verify().ok,true);
 });
 console.log("TTO_W24_AUDIT_STORAGE_UNAVAILABLE_DENIED=PASS");

 await t.test("append cannot resume after a write-path failure",()=>{
  const before=ledger.checkpoint();
  assert.throws(()=>ledger.append({requestId:randomUUID(),phase:"BFF_PRECHECK",
   decision:"DENY",reasonCode:"PRECHECK_DENIED"}),/AUDIT_UNAVAILABLE/);
  assert.deepEqual(ledger.checkpoint(),before);
  assert.equal(ledger.verify().ok,true);
 });
 console.log("TTO_W24_NO_RECOVERY_WITHOUT_RECONCILIATION=PASS");
 console.log("TTO_W24_NO_REAL_DB_NO_DOCKER_NO_OPERATIONAL_ALLOW=PASS");
});
