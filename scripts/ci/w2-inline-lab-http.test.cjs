"use strict";
/**
 * W2 test-only inline PEP over REAL NextRequest/NextResponse and a REAL Nest
 * lab-only Fastify controller. NO app routes, DB, Docker, deploy or sources.
 * The accepted Python PEP/PDP is IN the decision path, before fake source.read.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const {randomUUID}=require("node:crypto");
// W2.2: Python bridge is launched with cancellable spawn, never spawnSync.
// Accepted Python endpoint remains scripts.security.w1_isolated_http_bridge.
const {createRequire,Module:NodeModule}=require("node:module");
const {resolve,dirname}=require("node:path");
const {readFileSync}=require("node:fs");
const ROOT=resolve(__dirname,"../..");
if(process.env.CI!=="true"||process.env.NODE_ENV!=="test"||
   process.env.TTO_LOOPBACK_E2E!=="1"||
   process.env.TTO_W1_BOUNDARY_LAB!=="1"||
   process.env.TTO_W2_OFFLINE_LAB!=="1"||
   process.env.TTO_W22_CANCELLABLE_LAB!=="1"||
   process.env.VERCEL||process.env.DATABASE_URL||
   process.env.TTO_API_BASE_URL||process.env.APIIR_TOKEN||
   process.env.TEST_ADMIN_DATABASE_URL||process.env.TTO_DB_POOLER_HOST||
   process.env.TTO_DB_APP_PASSWORD)
 throw Error("W2_INLINE_OFFLINE_ONLY");
const fromNext=createRequire(resolve(ROOT,"apps/shareholder/package.json"));
const fromApi=createRequire(resolve(ROOT,"services/api/package.json"));
fromApi("reflect-metadata");
const ts=fromNext("typescript");
const {NextRequest,NextResponse}=fromNext("next/server");
const {Controller,Post,Req,Module,HttpException}=fromApi("@nestjs/common");
const {NestFactory}=fromApi("@nestjs/core");
const {FastifyAdapter}=fromApi("@nestjs/platform-fastify");
const {
 enforceW2SyntheticInline,sanitizeW2SyntheticPublicResponse
}=require("../security/w2-inline-synthetic-enforcer.cjs");
const {
 runW22CancellablePDP,stats:pdpStats
}=require("../security/w2-2-cancellable-pdp-provider.cjs");
function loadW1Bff(){
 const file=resolve(ROOT,"apps/shareholder/lib/w1-boundary-seam.ts");
 const code=ts.transpileModule(readFileSync(file,"utf8"),{
  fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const m=new NodeModule(file,module);
 m.filename=file;m.paths=NodeModule._nodeModulePaths(dirname(file));
 m._compile(code,file);return m.exports;
}
const {prepareW1SyntheticBffCandidate}=loadW1Bff();
const tenant="coop-test-A",otherTenant="coop-test-B";
const owners=["fixture-owner-A","fixture-owner-B"];
const cookies=[randomUUID(),randomUUID()];
const handles=[randomUUID(),randomUUID()],channel=randomUUID();
const actors=new Map();
const byHandle=new Map();
const audits=[],touches=[];
let nestRequests=0;
const current={policyMode:"normal",auditFail:false,sourceApproved:true,
 resumePolicy:null,injectNestResponse:null};
for(let i=0;i<2;i++){
 const proof={sessionActive:true,tenantKey:tenant,ownerKey:owners[i],
  partyBound:true,membershipSourceApproved:true,featureEnabled:true,
  readPermission:true,sourceApproved:true,sourceFresh:true,
  sourceVersion:"SYNTHETIC-V1",classificationAllowed:true};
 const info={cookie:cookies[i],handle:handles[i],proof};
 actors.set(cookies[i],info);byHandle.set(handles[i],info);
}
function safeAudit(event){
 if(current.auditFail)throw Error("SYNTHETIC_AUDIT_UNAVAILABLE");
 assert.deepEqual(Object.keys(event).sort(),
  ["decision","operation","reasonCode","requestId"].sort());
 audits.push(event);
}
const source={
 read(key){
  touches.push({...key});
  if(!owners.includes(key.ownerKey)||key.tenantKey!==tenant)throw Error("FAKE_SCOPE_DENIED");
  return {synthetic:true,record:null,persisted:false};
 }
};
function policy(operation,ctx,{signal}={}){
 if(current.policyMode==="throw")throw Error("SYNTHETIC_PDP_ERROR");
 if(current.policyMode==="timeout")return new Promise(()=>{});
 if(current.policyMode==="invalid")return {decision:"ALLOW",canGrantPermission:true,pii:"NEVER"};
 if(current.policyMode==="deferred"){
  // Simulates a PDP ignoring cancellation. The enforcer must still discard
  // a positive response after request abort/deadline/proof revocation.
  return new Promise(resolve=>{
   current.resumePolicy=()=>{
    current.policyMode="normal";
    resolve(policy(operation,ctx,{signal}));
   };
  });
 }
 // W1's accepted Python simulator runs via an async child process. AbortSignal
 // kills that child at the real OS process boundary, not just a Promise.
 const mode=["hang","late","crash","oversize"].includes(current.policyMode)?
   current.policyMode:"bridge";
 return runW22CancellablePDP(operation,ctx,{signal,mode});
}
class W2Controller{
 async evaluate(req){
  nestRequests++;
  if(req.headers["x-w2-internal-channel"]!==channel)
   throw new HttpException({code:"INTERNAL_CHANNEL_REQUIRED"},403);
  const handle=req.headers["x-w2-synthetic-handle"];
  const actor=byHandle.get(handle);
  const aborter=new AbortController();
  const connection=req.raw?.socket;
  const onDisconnect=()=>aborter.abort();
  connection?.once("close",onDisconnect);
  let decision;
  try{
   decision=await enforceW2SyntheticInline({
    candidate:req.body,proof:actor?.proof,policy,
    requestSignal:aborter.signal,
    audit:{record:safeAudit},source,
    deadlineMs:current.policyMode==="timeout"?35:
     current.policyMode==="hang"?2000:1200
   });
  }finally{
   connection?.off("close",onDisconnect);
  }
  // Adversarial test-only upstream corruption: ensure the BFF never forwards
  // an untrusted Nest response verbatim. This is NOT an application controller.
  if(current.injectNestResponse==="extra")
   return {...decision,privateAccount:"PRIVATE_SYNTHETIC_CANARY"};
  if(current.injectNestResponse==="allow")
   return {...decision,decision:"ALLOW",canGrantPermission:true};
  return decision;
 }
}
Req()(W2Controller.prototype,"evaluate",0);
Post("evaluate")(W2Controller.prototype,"evaluate",Object.getOwnPropertyDescriptor(W2Controller.prototype,"evaluate"));
Controller("w2-offline-only")(W2Controller);
class W2LabModule{}
Module({controllers:[W2Controller]})(W2LabModule);
let nest,bff,nestUrl,bffUrl;
function nextReply(res,nextResponse){
 res.writeHead(nextResponse.status,Object.fromEntries(nextResponse.headers));
 return nextResponse.text().then(text=>res.end(text));
}
async function handleBFF(nodeReq,nodeRes){
 const url="http://127.0.0.1"+nodeReq.url;
 const request=new NextRequest(url,{method:nodeReq.method,headers:nodeReq.headers});
 const fail=(status,code)=>NextResponse.json({
  decision:"DENY",reasonCode:code,
  // A 503 from an invalid upstream response cannot prove zero source touches.
  // Only preflight denials are known to have touched no source.
  sourceTouches:status===503?null:0,
  data:null,hasActualRecord:false,canGrantPermission:false,
  legalOperationalEffect:"NONE"
 },{status,headers:{"Cache-Control":"private, no-store"}});
 const match=/^\/test\/tenants\/(coop-test-[AB])\/owners\/(fixture-owner-[AB])\/(read|download|export|write|trade|finalize)$/.exec(new URL(url).pathname);
 if(!match){await nextReply(nodeRes,fail(404,"UNKNOWN_ROUTE"));return}
 const actor=actors.get(request.cookies.get("tto_lab_session")?.value);
 const preflight=prepareW1SyntheticBffCandidate(request,{
  tenantKey:match[1],ownerKey:match[2],operation:match[3]
 },{sessionActive:actor?.proof.sessionActive===true,
   expectedCookie:actor?.cookie??"",
   tenantKey:actor?.proof.tenantKey??"",
   ownerKey:actor?.proof.ownerKey??""});
 if(preflight.kind!=="CANDIDATE"){
  await nextReply(nodeRes,fail(preflight.status,preflight.reasonCode));return;
 }
 try{
  // Identity headers from browser deliberately excluded: no x-role,
  // x-party, authorization, source approval or browser-chosen session handle.
  const upstreamAbort=new AbortController();
  const onClientDisconnect=()=>upstreamAbort.abort();
  nodeRes.once("close",onClientDisconnect);
  const upstream=await fetch(nestUrl+"/w2-offline-only/evaluate",{
   method:"POST",cache:"no-store",redirect:"error",
   signal:AbortSignal.any([upstreamAbort.signal,AbortSignal.timeout(3000)]),
   headers:{"Content-Type":"application/json",
    "x-w2-internal-channel":channel,
    "x-w2-synthetic-handle":actor.handle},
   body:JSON.stringify(preflight.candidate)
  });
  if(!upstream.ok){await nextReply(nodeRes,fail(503,"NEST_UNAVAILABLE"));return}
  const raw=await upstream.json();
  nodeRes.off("close",onClientDisconnect);
  const safe=sanitizeW2SyntheticPublicResponse(raw);
  if(!safe){
   await nextReply(nodeRes,fail(503,"UPSTREAM_CONTRACT_INVALID"));return;
  }
  await nextReply(nodeRes,NextResponse.json(safe,{
   status:safe.decision==="SIMULATED_ALLOW"?200:403,
   headers:{"Cache-Control":"private, no-store"}
  }));
 }catch{
  if(!nodeRes.destroyed)await nextReply(nodeRes,fail(503,"CHAIN_UNAVAILABLE"));
 }
}
async function listen(srv){return new Promise((yes,no)=>{
 srv.once("error",no);
 srv.listen(0,"127.0.0.1",()=>yes("http://127.0.0.1:"+srv.address().port));
})}
function relative(owner=owners[0],tn=tenant,op="read"){
 return "/test/tenants/"+tn+"/owners/"+owner+"/"+op;
}
async function call(p,{method="GET",user=0,headers={}}={}){
 const requestHeaders={...headers};
 if(user!==null)requestHeaders.Cookie="tto_lab_session="+cookies[user];
 const r=await fetch(bffUrl+p,{method,headers:requestHeaders,signal:AbortSignal.timeout(5000)});
 return {status:r.status,body:await r.json(),headers:r.headers};
}
test("W2 real HTTP NextRequest -> Nest lab inline Python PDP/PEP -> fake source, NO Docker",async t=>{
 nest=await NestFactory.create(W2LabModule,new FastifyAdapter({logger:false}),{logger:false});
 await nest.listen(0,"127.0.0.1");nestUrl=await nest.getUrl();
 bff=http.createServer((req,res)=>{handleBFF(req,res).catch(()=>{
  if(!res.headersSent)res.writeHead(503);res.end();
 })});
 bffUrl=await listen(bff);
 t.after(async()=>{
  await new Promise(done=>bff.close(done));
  await nest.close();
 });
 await t.test("anonymous and forged browser headers never call Nest or source",async()=>{
  const n=nestRequests,s=touches.length;
  const result=await call(relative(),{user:null,headers:{
   Authorization:"Bearer forged","x-role":"SUPERUSER",
   "x-tenant-id":tenant,"x-w2-internal-channel":channel,
   "x-w2-synthetic-handle":handles[0]
  }});
  assert.equal(result.status,401);assert.equal(nestRequests,n);assert.equal(touches.length,s);
 });
 console.log("TTO_W2_ANONYMOUS_ZERO_NEST_TOUCH=PASS");
 await t.test("two distinct fake owners in SAME tenant can only read own marker",async()=>{
  for(let i=0;i<2;i++){
   const before=touches.length;
   const result=await call(relative(owners[i]),{user:i});
   assert.equal(result.status,200);
   assert.equal(result.body.decision,"SIMULATED_ALLOW");
   assert.equal(result.body.canGrantPermission,false);
   assert.equal(result.body.hasActualRecord,false);
   assert.equal(result.body.legalOperationalEffect,"NONE");
   assert.equal(result.body.data,null);
   assert.equal(result.body.sourceTouches,1);
   assert.equal(touches.length,before+1);
   assert.deepEqual(touches.at(-1),{tenantKey:tenant,ownerKey:owners[i]});
   assert.match(result.headers.get("cache-control"),/no-store/);
  }
 });
 console.log("TTO_W2_SAME_TENANT_TWO_OWNERS_ISOLATED=PASS");
 await t.test("cross-owner and cross-tenant denied before Nest and fixture",async()=>{
  for(const [user,p] of [
   [0,relative(owners[1])],[1,relative(owners[0])],
   [0,relative(owners[0],otherTenant)],[1,relative(owners[1],otherTenant)]
  ]){
   const n=nestRequests,s=touches.length;
   const r=await call(p,{user});
   assert.equal(r.status,403);assert.equal(r.body.sourceTouches,0);
   assert.equal(nestRequests,n);assert.equal(touches.length,s);
  }
 });
 await t.test("forged user headers cannot select other owner with valid cookie",async()=>{
  const before=touches.length;
  const r=await call(relative(owners[1]),{user:0,headers:{
   "x-tenant-id":tenant,"x-role":"PLATFORM_ADMIN",
   "x-party-id":owners[1],"x-source-approved":"true",
   "x-w2-synthetic-handle":handles[1],
   Authorization:"Bearer spoofed"
  }});
  assert.equal(r.status,403);
  assert.equal(touches.length,before);
 });
 await t.test("direct Nest forged candidate cannot override trusted handle",async()=>{
  const before=touches.length;
  for(const data of [
   {contractVersion:"W1_BFF_NEST_SEAM_V0_1",environment:"SIMULATION",
    tenantKey:tenant,ownerKey:owners[1],operation:"read"},
   {contractVersion:"W1_BFF_NEST_SEAM_V0_1",environment:"PRODUCTION",
    tenantKey:tenant,ownerKey:owners[0],operation:"read"},
   {contractVersion:"W1_BFF_NEST_SEAM_V0_1",environment:"SIMULATION",
    tenantKey:tenant,ownerKey:owners[0],operation:"read",sourceApproved:true}
  ]){
   const r=await fetch(nestUrl+"/w2-offline-only/evaluate",{
    method:"POST",headers:{"Content-Type":"application/json",
     "x-w2-internal-channel":channel,"x-w2-synthetic-handle":handles[0]},
    body:JSON.stringify(data)
   });
   assert.equal(r.status,201);
   const body=await r.json();assert.equal(body.decision,"DENY");
   assert.equal(body.sourceTouches,0);
   assert.equal(touches.length,before);
  }
  const withoutChannel=await fetch(nestUrl+"/w2-offline-only/evaluate",{
   method:"POST",headers:{"Content-Type":"application/json",
    "x-w2-synthetic-handle":handles[0]},
   body:JSON.stringify({tenantKey:tenant,ownerKey:owners[0],operation:"read"})
  });
  assert.equal(withoutChannel.status,403);
 });
 await t.test("unapproved source or Party denied INSIDE Nest BEFORE resource",async()=>{
  const actor=actors.get(cookies[0]);
  for(const [field,val] of [["sourceApproved",false],
   ["partyBound",false],["sessionActive",false],
   ["membershipSourceApproved",false],["sourceFresh",false]]){
   const old=actor.proof[field],before=touches.length;
   actor.proof[field]=val;
   try{
    const r=await fetch(nestUrl+"/w2-offline-only/evaluate",{
     method:"POST",headers:{"Content-Type":"application/json",
      "x-w2-internal-channel":channel,"x-w2-synthetic-handle":handles[0]},
     body:JSON.stringify({contractVersion:"W1_BFF_NEST_SEAM_V0_1",
      environment:"SIMULATION",tenantKey:tenant,ownerKey:owners[0],operation:"read"})
    });
    assert.equal(r.status,201);
    assert.equal((await r.json()).decision,"DENY");
    assert.equal(touches.length,before);
   }finally{actor.proof[field]=old}
  }
 });
 console.log("TTO_W2_INLINE_DENIED_SOURCE_TOUCHES=0");
 await t.test("policy exception, timeout, malformed response all fail closed",async()=>{
  for(const mode of ["throw","timeout","invalid"]){
   const before=touches.length;current.policyMode=mode;
   try{
    const r=await call(relative(),{user:0});
    assert.equal(r.status,403);
    assert.equal(r.body.decision,"DENY");
    assert.equal(r.body.sourceTouches,0);
    assert.equal(touches.length,before);
   }finally{current.policyMode="normal"}
  }
 });
 console.log("TTO_W2_PDP_FAILURE_AND_TIMEOUT_DENY=PASS");

 await t.test("real HTTP browser disconnect cancels the Nest PDP child before deadline",async()=>{
  // This is a real loopback HTTP abort, not merely a direct AbortController
  // passed to the enforcer. A killed client must cancel BFF fetch, Nest socket,
  // and finally the Python/fake child without ever touching source.read().
  current.policyMode="hang";
  const controller=new AbortController();
  const start=pdpStats(),beforeTouches=touches.length;
  let pending;
  try{
   pending=fetch(bffUrl+relative(),{
    headers:{Cookie:"tto_lab_session="+cookies[0]},
    signal:controller.signal
   });
   for(let i=0;i<100&&pdpStats().started===start.started;i++)
    await new Promise(ok=>setTimeout(ok,10));
   assert.ok(pdpStats().started>start.started,"PDP process must have started");
   const abortedAt=Date.now();
   controller.abort();
   await assert.rejects(pending,error=>error?.name==="AbortError");
   for(let i=0;i<120&&(pdpStats().aborted<=start.aborted||
                        pdpStats().active!==0);i++)
    await new Promise(ok=>setTimeout(ok,10));
   assert.ok(pdpStats().aborted>start.aborted,
    "HTTP disconnect must abort the PDP child");
   assert.equal(pdpStats().active,0,"disconnected PDP child must be reaped");
   assert.ok(Date.now()-abortedAt<1500,
    "disconnect must terminate subprocess before 2000ms PDP deadline");
   assert.equal(touches.length,beforeTouches,"disconnected request never reads fake source");
  }finally{
   controller.abort();current.policyMode="normal";
  }
 });
 console.log("TTO_W22_HTTP_DISCONNECT_TERMINATES_PDP=PASS");

 await t.test("audit sink outage blocks resource even on valid read",async()=>{
  const before=touches.length;current.auditFail=true;
  try{
   const r=await call(relative(),{user:0});
   assert.equal(r.status,403);
   assert.equal(r.body.reasonCode,"AUDIT_UNAVAILABLE");
   assert.equal(r.body.sourceTouches,0);
   assert.equal(touches.length,before);
  }finally{current.auditFail=false}
 });
 console.log("TTO_W2_AUDIT_FAILURE_FAIL_CLOSED=PASS");
 await t.test("download export write trade finalize are never eligible inline",async()=>{
  for(const op of ["download","export","write","trade","finalize"]){
   const method=["write","trade","finalize"].includes(op)?"POST":"GET";
   const before=touches.length;
   const r=await call(relative(owners[0],tenant,op),{user:0,method});
   assert.equal(r.status,403);
   assert.equal(r.body.sourceTouches,0);
   assert.equal(touches.length,before);
  }
 });
 console.log("TTO_W2_MUTATING_AND_EXPORT_OPERATIONS_CLOSED=PASS");
 await t.test("production mode disables inline enforcer and source touches",async()=>{
  const old=process.env.VERCEL, n=nestRequests, before=touches.length;
  process.env.VERCEL="1";
  try{
   const r=await call(relative(),{user:0});
   assert.equal(r.status,503);
   assert.equal(r.body.decision,"DENY");
   assert.equal(touches.length,before);
   assert.equal(nestRequests,n);
  }finally{
   if(old===undefined)delete process.env.VERCEL;
   else process.env.VERCEL=old;
  }
 });
 console.log("TTO_W2_PRODUCTION_LAB_GATE_CLOSED=PASS");
 await t.test("audits are allowlisted and never store any identity or secret",()=>{
  assert.ok(audits.length>=6);
  for(const event of audits){
   assert.deepEqual(Object.keys(event).sort(),[
    "decision","operation","reasonCode","requestId"].sort());
   const serialized=JSON.stringify(event);
   for(const secret of [...owners,tenant,...cookies,...handles,channel])
    assert.equal(serialized.includes(secret),false);
  }
 });
 console.log("TTO_W2_INMEMORY_AUDIT_ALLOWLIST=PASS");

 await t.test("strict public contract strips no data and rejects injected Nest fields",()=>{
  const positive={decision:"SIMULATED_ALLOW",reasonCode:"SIMULATION_ONLY",
   requestId:randomUUID(),sourceTouches:1,hasActualRecord:false,
   canGrantPermission:false,legalOperationalEffect:"NONE",data:null};
  const sanitized=sanitizeW2SyntheticPublicResponse(positive);
  assert.deepEqual(sanitized,positive);
  for(const [name,unsafe] of [
   ["extra secret field",{...positive,secret:"DO_NOT_LEAK"}],
   ["fake operational allow",{...positive,decision:"ALLOW"}],
   ["marked authorized",{...positive,canGrantPermission:true}],
   ["actual record",{...positive,hasActualRecord:true}],
   ["sensitive data",{...positive,data:{shareholderId:"PRIVATE"}}],
   ["invalid request ID",{...positive,requestId:"bad"}],
   ["dishonest touch",{...positive,sourceTouches:0}],
   ["fake reason",{...positive,reasonCode:"GRANTED"}],
   ["missing field",(()=>{
    const v={...positive};delete v.legalOperationalEffect;return v;
   })()],
   ["denied after source touched",{...positive,decision:"DENY",sourceTouches:1}],
   ["negative sourceTouches",{...positive,decision:"DENY",sourceTouches:-1}]
  ]){
   assert.equal(sanitizeW2SyntheticPublicResponse(unsafe),null,name);
  }
 });
 console.log("TTO_W2_STRICT_RESPONSE_ALLOWLIST=PASS");

 await t.test("BFF rejects corrupted actual Nest response without leaking fields",async()=>{
  for(const corruption of ["extra","allow"]){
   const before=touches.length;
   current.injectNestResponse=corruption;
   try{
    const r=await call(relative(),{user:0});
    assert.equal(r.status,503);
    assert.equal(r.body.decision,"DENY");
    assert.equal(r.body.reasonCode,"UPSTREAM_CONTRACT_INVALID");
    assert.equal(r.body.sourceTouches,null,"BFF cannot assert zero touches after upstream error");
    assert.equal(r.body.canGrantPermission,false);
    assert.equal(r.body.hasActualRecord,false);
    assert.equal(JSON.stringify(r.body).includes("PRIVATE_SYNTHETIC_CANARY"),false);
    assert.equal(touches.length,before+1,"the fake upstream ran, but BFF leaked no body");
   }finally{current.injectNestResponse=null}
  }
 });
 console.log("TTO_W2_BFF_REJECTS_CORRUPT_NEST_PAYLOAD=PASS");

 await t.test("revocation DURING async policy rejects before fake source touch",async()=>{
  const actor=actors.get(cookies[0]);
  const before=touches.length,initialAudit=audits.length;
  current.policyMode="deferred";
  current.resumePolicy=null;
  const pending=call(relative(),{user:0});
  try{
   for(let n=0;n<50&&!current.resumePolicy;n++)
    await new Promise(resolve=>setTimeout(resolve,10));
   assert.equal(typeof current.resumePolicy,"function","PDP must be in flight");
   actor.proof.sourceApproved=false;
   current.resumePolicy();
   const r=await pending;
   assert.equal(r.status,403);
   assert.equal(r.body.reasonCode,"PROOF_CHANGED");
   assert.equal(r.body.sourceTouches,0);
   assert.equal(touches.length,before);
   assert.equal(audits.length,initialAudit+1,"DENY must be audited");
  }finally{
   actor.proof.sourceApproved=true;
   current.policyMode="normal";
   current.resumePolicy=null;
  }
 });
 console.log("TTO_W2_POLICY_INFLIGHT_REVOCATION_DENY=PASS");

 await t.test("audit callback revocation also blocks source after policy success",async()=>{
  const actor=actors.get(cookies[0]);
  const before=touches.length;
  const candidate={
   contractVersion:"W1_BFF_NEST_SEAM_V0_1",environment:"SIMULATION",
   tenantKey:tenant,ownerKey:owners[0],operation:"read"
  };
  try{
   const r=await enforceW2SyntheticInline({
    candidate,proof:actor.proof,policy,source,deadlineMs:500,
    audit:{record(event){
     safeAudit(event);
     if(event.decision==="SIMULATED_ALLOW")actor.proof.partyBound=false;
    }}
   });
   assert.equal(r.decision,"DENY");
   assert.equal(r.reasonCode,"PROOF_CHANGED");
   assert.equal(r.sourceTouches,0);
   assert.equal(touches.length,before);
  }finally{actor.proof.partyBound=true}
 });
 console.log("TTO_W2_POST_AUDIT_REVOCATION_DENY=PASS");

 await t.test("invalid synthetic fixture response is denied and touch truth preserved",async()=>{
  const candidate={
   contractVersion:"W1_BFF_NEST_SEAM_V0_1",environment:"SIMULATION",
   tenantKey:tenant,ownerKey:owners[0],operation:"read"
  };
  const before=touches.length;
  const badSource={read(key){
   touches.push({...key});
   return {synthetic:true,record:null,persisted:false,secret:"DO_NOT_LEAK"};
  }};
  const response=await enforceW2SyntheticInline({
   candidate,proof:actors.get(cookies[0]).proof,policy,
   audit:{record:safeAudit},source:badSource,deadlineMs:500
  });
  assert.equal(response.decision,"DENY");
  assert.equal(response.reasonCode,"FIXTURE_INVALID");
  assert.equal(response.sourceTouches,1,"attempted source access must not be reported zero");
  assert.equal(response.data,null);
  assert.equal(touches.length,before+1);
  assert.equal(sanitizeW2SyntheticPublicResponse(response),null,
   "BFF must not forward a DENY that already touched fake source");
 });
 console.log("TTO_W2_POST_SOURCE_INVALID_RESPONSE_BLOCKED=PASS");
 console.log("TTO_W2_INLINE_POLICY_BEFORE_SOURCE=PASS");
 console.log("TTO_W2_SYNTHETIC_ONLY_NO_OPERATIONAL_ALLOW=PASS");
 console.log("TTO_W2_NO_DB_NO_DOCKER_NO_DEPLOY=PASS");
});
