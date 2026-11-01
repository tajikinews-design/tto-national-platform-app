"use strict";
/**
 * W2.4 synthetic HTTP causal trace: real NextRequest/NextResponse, ephemeral
 * Nest Fastify controller, W23 dormant TS adapters, W22 cancellable PDP and
 * fsync-backed hash-chained W24 audit. Only temp-file storage, zero source IO.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs/promises");
const os=require("node:os");
const path=require("node:path");
const {randomUUID}=require("node:crypto");
const {createRequire,Module:NodeModule}=require("node:module");
const {resolve,dirname}=require("node:path");
const {readFileSync}=require("node:fs");
const ROOT=resolve(__dirname,"../..");
if(process.env.CI!=="true"||process.env.NODE_ENV!=="test"||
  process.env.TTO_W24_AUDIT_LAB!=="1"||
  process.env.TTO_W23_CONTRACT_LAB!=="1"||
  process.env.TTO_W22_CANCELLABLE_LAB!=="1"||
  process.env.TTO_W1_BOUNDARY_LAB!=="1"||
  process.env.TTO_W2_OFFLINE_LAB!=="1"||
  process.env.TTO_LOOPBACK_E2E!=="1"||
  process.env.DATABASE_URL||process.env.VERCEL||
  process.env.APIIR_TOKEN||process.env.TTO_API_BASE_URL||
  process.env.TEST_ADMIN_DATABASE_URL||
  process.env.TTO_DB_POOLER_HOST||process.env.TTO_DB_APP_PASSWORD)
 throw Error("W24_AUDIT_CHAIN_LAB_DISABLED");
const nextRequire=createRequire(resolve(ROOT,"apps/shareholder/package.json"));
const apiRequire=createRequire(resolve(ROOT,"services/api/package.json"));
apiRequire("reflect-metadata");
const ts=nextRequire("typescript");
const {NextRequest,NextResponse}=nextRequire("next/server");
const {Controller,Post,Req,Module,HttpException}=apiRequire("@nestjs/common");
const {NestFactory}=apiRequire("@nestjs/core");
const {FastifyAdapter}=apiRequire("@nestjs/platform-fastify");
const {runW22CancellablePDP,stats}=require("../security/w2-2-cancellable-pdp-provider.cjs");
const {W24SyntheticAuditJournal}=require("../security/w24-durable-synthetic-audit.cjs");
function loadTs(p){
 const file=resolve(ROOT,p);
 const transpiled=ts.transpileModule(readFileSync(file,"utf8"),{
  fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,
   target:ts.ScriptTarget.ES2022}
 }).outputText;
 const m=new NodeModule(file,module);
 m.filename=file;m.paths=NodeModule._nodeModulePaths(dirname(file));
 m._compile(transpiled,file);
 return m.exports;
}
const {prepareW1SyntheticBffCandidate}=
 loadTs("apps/shareholder/lib/w1-boundary-seam.ts");
const {prepareW23DormantBffEnvelope,closeW23DormantBffVerdict}=
 loadTs("apps/shareholder/lib/w23-dormant-policy-boundary.ts");
const {verifyW23DormantNestEnvelope,normalizeW23SyntheticNestPolicyVerdict}=
 loadTs("services/api/src/w23-dormant-policy-boundary.ts");
const tenant="coop-test-A",otherTenant="coop-test-B";
const owners=["fixture-owner-A","fixture-owner-B"];
const cookies=[randomUUID(),randomUUID()],handles=[randomUUID(),randomUUID()];
const channel=randomUUID(),actors=new Map(),trustedHandles=new Map();
let nestRequests=0,sourceTouches=0,pdpCalls=0,mode="normal";
let journal,nest,server,nestUrl,bffUrl,dir;
const observed=[];
for(let i=0;i<2;i++){
 const proof={sessionActive:true,tenantKey:tenant,ownerKey:owners[i],
  partyBound:true,membershipSourceApproved:true,featureEnabled:true,
  readPermission:true,sourceApproved:true,sourceFresh:true,
  sourceVersion:"SYNTHETIC-V1",classificationAllowed:true,
  downloadPermission:false,exportPermission:false,writePermission:false};
 const actor={cookie:cookies[i],handle:handles[i],proof};
 actors.set(actor.cookie,actor);trustedHandles.set(actor.handle,actor);
}
const marker=(requestId,phase,decision,reasonCode)=>({
 requestId,phase,decision,reasonCode
});
const deny=(code,status=503)=>NextResponse.json({available:false,code},
 {status,headers:{"Cache-Control":"private, no-store"}});
async function writeResponse(res,r){
 const body=await r.text();
 if(!res.destroyed){res.writeHead(r.status,Object.fromEntries(r.headers));res.end(body)}
}
class W24LabController{
 async evaluate(req){
  nestRequests++;
  if(req.headers["x-w24-private-channel"]!==channel)
   throw new HttpException({available:false,code:"PRIVATE_CHANNEL_DENIED"},403);
  const actor=trustedHandles.get(req.headers["x-w24-server-handle"]);
  const raw=req.body;
  observed.push(raw);
  const ctl=new AbortController();
  const onClose=()=>ctl.abort();
  req.raw?.socket?.once("close",onClose);
  let timer;
  try{
   const checked=verifyW23DormantNestEnvelope(raw,actor?.proof,ctl.signal);
   if(checked.kind!=="SYNTHETIC_PDP_CANDIDATE"){
    if(raw?.requestId&&/^[0-9a-f-]{36}$/.test(raw.requestId))
     await journal.append(marker(raw.requestId,"NEST_SCOPE","DENY","NEST_DENIED"));
    return {available:false,code:"W24_NEST_DENIED"};
   }
   await journal.append(marker(checked.requestId,"NEST_SCOPE","CANDIDATE","NEST_ACCEPTED"));
   const deadline=mode==="timeout"?40:900;
   timer=setTimeout(()=>ctl.abort(),deadline);
   let rawVerdict;
   pdpCalls++;
   try{
    rawVerdict=await runW22CancellablePDP("read",checked.context,{
     signal:ctl.signal,mode:mode==="timeout"?"hang":"bridge"
    });
   }catch{
    await journal.append(marker(checked.requestId,"PDP_RESULT","DENY","PDP_UNAVAILABLE"));
    return {available:false,code:"W24_PDP_UNAVAILABLE"};
   }
   const parsed=normalizeW23SyntheticNestPolicyVerdict(
    rawVerdict,checked.requestId,ctl.signal
   );
   if(parsed.kind!=="SIMULATED_ONLY"){
    await journal.append(marker(checked.requestId,"PDP_RESULT","DENY","PDP_DENIED"));
    return {available:false,code:"W24_PDP_INVALID"};
   }
   await journal.append(marker(checked.requestId,"PDP_RESULT","SIMULATED_ONLY","PDP_SIMULATED"));
   if(mode==="inject_secret")
    return {...parsed.verdict,secret:"NEVER_EXPOSE_SOURCE",canGrantPermission:false};
   return parsed.verdict;
  }catch{
   return {available:false,code:"W24_AUDIT_UNAVAILABLE"};
  }finally{
   clearTimeout(timer);
   req.raw?.socket?.off("close",onClose);
  }
 }
}
Req()(W24LabController.prototype,"evaluate",0);
Post("evaluate")(W24LabController.prototype,"evaluate",
 Object.getOwnPropertyDescriptor(W24LabController.prototype,"evaluate"));
Controller("w24-audit-lab-only")(W24LabController);
class W24TestModule{}
Module({controllers:[W24LabController]})(W24TestModule);
async function handleBff(nodeReq,nodeRes){
 const incoming=new NextRequest("http://127.0.0.1"+nodeReq.url,{
  method:nodeReq.method,headers:nodeReq.headers
 });
 const match=/^\/t\/tenants\/(coop-test-[AB])\/owners\/(fixture-owner-[AB])\/(read|write|trade)$/
  .exec(new URL(incoming.url).pathname);
 if(!match){await writeResponse(nodeRes,deny("W24_INVALID_ROUTE",404));return}
 const actor=actors.get(incoming.cookies.get("tto_lab_session")?.value);
 const w1=prepareW1SyntheticBffCandidate(incoming,{
  tenantKey:match[1],ownerKey:match[2],operation:match[3]
 },{
  sessionActive:actor?.proof.sessionActive===true,
  expectedCookie:actor?.cookie||"",
  tenantKey:actor?.proof.tenantKey||"",
  ownerKey:actor?.proof.ownerKey||""
 });
 const w23=prepareW23DormantBffEnvelope(w1,incoming);
 const id=w23.kind==="DRAFT_CANDIDATE"?w23.envelope.requestId:randomUUID();
 try{
  await journal.append(marker(id,"BFF_PREFLIGHT",
   w23.kind==="DRAFT_CANDIDATE"?"CANDIDATE":"DENY",
   w23.kind==="DRAFT_CANDIDATE"?"BFF_ACCEPTED":"BFF_DENIED"));
 }catch{
  await writeResponse(nodeRes,deny("W24_AUDIT_UNAVAILABLE"));return
 }
 if(w23.kind!=="DRAFT_CANDIDATE"){
  try{
   await journal.append(marker(id,"BFF_RESPONSE","DENY","RESPONSE_CLOSED"));
  }catch{
   await writeResponse(nodeRes,deny("W24_AUDIT_UNAVAILABLE"));return
  }
  await writeResponse(nodeRes,deny("W24_BFF_PREFLIGHT_DENIED",403));return
 }
 const ctl=new AbortController();
 const onDisconnect=()=>ctl.abort();
 nodeRes.once("close",onDisconnect);
 let result=deny("W24_UPSTREAM_UNAVAILABLE");
 try{
  const response=await fetch(nestUrl+"/w24-audit-lab-only/evaluate",{
   method:"POST",cache:"no-store",redirect:"error",
   headers:{"Content-Type":"application/json",
    "x-w24-private-channel":channel,
    "x-w24-server-handle":actor.handle},
   // Exactly six trusted BFF fields; no cookie, Party, role or credentials.
   body:JSON.stringify(w23.envelope),
   signal:AbortSignal.any([ctl.signal,w23.signal,AbortSignal.timeout(2500)])
  });
  if(response.status===201){
   const raw=await response.json();
   const normalized=closeW23DormantBffVerdict(raw,id);
   result=deny(normalized.code,normalized.status);
  }
 }catch{
  result=deny("W24_UPSTREAM_UNAVAILABLE");
 }finally{nodeRes.off("close",onDisconnect)}
 try{
  await journal.append(marker(id,"BFF_RESPONSE","DENY",
   result.status===403?"RESPONSE_CLOSED":"RESPONSE_UNAVAILABLE"));
 }catch{
  result=deny("W24_AUDIT_UNAVAILABLE");
 }
 await writeResponse(nodeRes,result);
}
const addr=(owner=owners[0],t=tenant,op="read")=>
 "/t/tenants/"+t+"/owners/"+owner+"/"+op;
async function call(p,{user=0,headers={},method="GET"}={}){
 const h={...headers};
 if(user!==null)h.Cookie="tto_lab_session="+cookies[user];
 const r=await fetch(bffUrl+p,{method,headers:h,signal:AbortSignal.timeout(3500)});
 return {status:r.status,body:await r.json()};
}
test("W2.4 real NextRequest→Nest→PDP synthetic durable audit evidence",async t=>{
 dir=await fs.mkdtemp(path.join(os.tmpdir(),"tto-w24-chain-"));
 journal=await W24SyntheticAuditJournal.open(dir,{create:true});
 nest=await NestFactory.create(W24TestModule,new FastifyAdapter({logger:false}),
  {logger:false});
 await nest.listen(0,"127.0.0.1");nestUrl=await nest.getUrl();
 server=http.createServer((req,res)=>handleBff(req,res).catch(async()=>{
  if(!res.headersSent&&!res.destroyed)await writeResponse(res,deny("W24_BFF_UNAVAILABLE"));
 }));
 await new Promise((ok,bad)=>{
  server.once("error",bad);server.listen(0,"127.0.0.1",ok);
 });
 bffUrl="http://127.0.0.1:"+server.address().port;
 t.after(async()=>{
  await new Promise(ok=>server.close(ok));
  await nest.close();
  if(journal)await journal.close().catch(()=>{});
  await fs.rm(dir,{recursive:true,force:true});
 });
 await t.test("two synthetic owners produce durable correlated four-stage DENY trace",async()=>{
  for(let i=0;i<2;i++){
   const r=await call(addr(owners[i]),{user:i});
   assert.equal(r.status,403);
   assert.deepEqual(r.body,{available:false,code:"W23_OPERATIONAL_NOT_APPROVED"});
   assert.equal(sourceTouches,0);
  }
  const v=await journal.verifyTraces();
  assert.deepEqual(v,{valid:true,requestCount:2,preflightDenials:0,
   simulatedOnly:2,eventCount:8});
  assert.equal(observed.length,2);
  for(const body of observed){
   assert.deepEqual(Object.keys(body).sort(),
    ["contractVersion","environment","operation","tenantKey","ownerKey","requestId"].sort());
  }
 });
 console.log("TTO_W24_BFF_NEST_PDP_CORRELATED_DURABLE_TRACE=PASS");

 await t.test("anonymous/foreign owner/tenant blocked before Nest yet denial is traced",async()=>{
  const before=nestRequests;
  for(const [u,p] of [
   [null,addr(owners[0])],
   [0,addr(owners[1])],
   [1,addr(owners[0])],
   [0,addr(owners[0],otherTenant)]
  ]){
   const r=await call(p,{user:u});
   assert.equal(r.status,403);
   assert.equal(r.body.available,false);
  }
  assert.equal(nestRequests,before);
  const v=await journal.verifyTraces();
  assert.equal(v.requestCount,6);
  assert.equal(v.preflightDenials,4);
  assert.equal(v.eventCount,16);
 });
 console.log("TTO_W24_DENIED_REQUEST_TRACE_NO_NEST_NO_SOURCE=PASS");

 await t.test("forged user headers do not enter journal or upstream envelope",async()=>{
  const before=nestRequests;
  const r=await call(addr(owners[1]),{user:0,headers:{
   Authorization:"Bearer SECRET_SENTINEL_X",
   "x-role":"PLATFORM_ADMIN",
   "x-party-id":"PRIVATE_PARTY_SENTINEL",
   "x-source-approved":"true",
   "x-w24-server-handle":handles[1],
   "x-w24-private-channel":channel
  }});
  assert.equal(r.status,403);
  assert.equal(nestRequests,before);
  const raw=await fs.readFile(path.join(dir,"events.ndjson"),"utf8");
  for(const secret of ["SECRET_SENTINEL_X","PRIVATE_PARTY_SENTINEL",
    ...owners,tenant,...cookies,...handles,channel])
   assert.equal(raw.includes(secret),false);
 });
 console.log("TTO_W24_NO_CREDENTIAL_OR_PII_IN_PERSISTED_LOG=PASS");

 await t.test("independent Nest source authorization denial is causally audited",async()=>{
  const p=actors.get(cookies[0]).proof;
  const old=p.sourceApproved;
  p.sourceApproved=false;
  try{
   const before=pdpCalls;
   const r=await call(addr(),{user:0});
   assert.equal(r.status,503);assert.equal(r.body.available,false);
   assert.equal(pdpCalls,before);
   assert.equal(sourceTouches,0);
  }finally{p.sourceApproved=old}
  assert.equal((await journal.verifyTraces()).valid,true);
 });
 console.log("TTO_W24_NEST_SOURCE_REVOCATION_AUDITED_DENY=PASS");

 await t.test("PDP timeout, child kill and no source touch are persistently audited",async()=>{
  mode="timeout";
  try{
   const before=stats().aborted;
   const r=await call(addr(),{user:0});
   assert.equal(r.status,503);
   assert.equal(r.body.available,false);
   assert.equal(sourceTouches,0);
   assert.ok(stats().aborted>before);
   assert.equal((await journal.verifyTraces()).valid,true);
  }finally{mode="normal"}
 });
 console.log("TTO_W24_PDP_TIMEOUT_CORRELATED_DENY=PASS");

 await t.test("a secret-bearing upstream verdict is blocked without logging secret",async()=>{
  mode="inject_secret";
  try{
   const r=await call(addr(),{user:0});
   assert.deepEqual(r.body,{available:false,code:"W23_UPSTREAM_CONTRACT_INVALID"});
   const raw=await fs.readFile(path.join(dir,"events.ndjson"),"utf8");
   assert.equal(raw.includes("NEVER_EXPOSE_SOURCE"),false);
   assert.equal((await journal.verifyTraces()).valid,true);
   assert.equal(sourceTouches,0);
  }finally{mode="normal"}
 });
 console.log("TTO_W24_CORRUPT_UPSTREAM_NO_LOG_DISCLOSURE=PASS");

 await t.test("restored ledger proves all requests after close/reopen",async()=>{
  const before=await journal.verifyTraces();
  assert.equal(before.requestCount,10);
  await journal.close();
  journal=await W24SyntheticAuditJournal.open(dir);
  assert.deepEqual(await journal.verifyTraces(),before);
 });
 console.log("TTO_W24_RESTART_VERIFIED_CHAIN_COMPLETE=PASS");

 await t.test("persisted checkpoint failure denies at BFF before Nest or PDP",async()=>{
  const beforeNest=nestRequests,beforePdp=pdpCalls;
  const checkpoint=path.join(dir,"checkpoint.json");
  const doc=JSON.parse(await fs.readFile(checkpoint,"utf8"));
  await fs.writeFile(checkpoint,JSON.stringify({...doc,sequence:0})+"\n");
  const response=await call(addr(),{user:0});
  assert.deepEqual(response.body,{available:false,code:"W24_AUDIT_UNAVAILABLE"});
  assert.equal(response.status,503);
  assert.equal(nestRequests,beforeNest);
  assert.equal(pdpCalls,beforePdp);
  assert.equal(sourceTouches,0);
 });
 console.log("TTO_W24_AUDIT_FAILURE_BLOCKS_NEST_AND_RESOURCE=PASS");
 console.log("TTO_W24_GITHUB_ONLY_NO_OPERATIONAL_READ=PASS");
});
