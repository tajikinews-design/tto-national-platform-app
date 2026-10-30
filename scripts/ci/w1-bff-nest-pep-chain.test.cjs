"use strict";
/** Ephemeral, isolated test-only chain. Real NextRequest/NextResponse and NestJS
 * controller, synthetic in-memory claims, accepted Python PEP/PDP via subprocess.
 * NEVER an app route. No user identity, DB, source adapter, or external request.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const {randomUUID}=require("node:crypto");
const {spawnSync}=require("node:child_process");
const {createRequire,Module}=require("node:module");
const {readFileSync}=require("node:fs");
const {dirname}=require("node:path");
const {resolve}=require("node:path");
const ROOT=resolve(__dirname,"../..");
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||
   process.env.TTO_W1_CHAIN_LAB!=="1"||process.env.TTO_W1_BOUNDARY_LAB!=="1"||process.env.VERCEL||
   process.env.APIIR_TOKEN||process.env.DATABASE_URL||process.env.TTO_API_BASE_URL)
 throw Error("TTO_W1_CHAIN_LAB_ONLY");
const fromNext=createRequire(resolve(ROOT,"apps/shareholder/package.json"));
const fromApi=createRequire(resolve(ROOT,"services/api/package.json"));
fromApi("reflect-metadata");
const {NextRequest,NextResponse}=fromNext("next/server");
const {Controller,Post,Req,Module,HttpException}=fromApi("@nestjs/common");
const {NestFactory}=fromApi("@nestjs/core");
const {FastifyAdapter}=fromApi("@nestjs/platform-fastify");
// Load the REAL colocated TypeScript seam modules in the isolated lab only.
// Transpilation is memory-only; no generated file, app import or route activation.
const ts=fromNext("typescript");
function loadSeam(relativePath){
 const filename=resolve(ROOT,relativePath);
 const compiled=ts.transpileModule(readFileSync(filename,"utf8"),{
  fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const m=new Module(filename,module);
 m.filename=filename;m.paths=Module._nodeModulePaths(dirname(filename));
 m._compile(compiled,filename);
 return m.exports;
}
const {prepareW1SyntheticBffCandidate,sanitizeW1SyntheticBffDecision}=
 loadSeam("apps/shareholder/lib/w1-boundary-seam.ts");
const {verifyW1SyntheticNestCandidate}=
 loadSeam("services/api/src/w1-boundary-seam.ts");
const MARKER="SYNTHETIC_ONLY";
const tenantA="coop-test-A",tenantB="coop-test-B",ownerA="fixture-owner-A",ownerB="fixture-owner-B";
const session=randomUUID(),internalToken=randomUUID();
let nestRequests=0, bffRequests=0;
const state={sessionActive:true,partyBound:true,sourceApproved:true,readRight:true};
let nestUrl,bffUrl;
const trace=[];
function pythonPEP(operation,ctx){
 const child=spawnSync("python3",["-m","scripts.security.w1_isolated_http_bridge"],{
  cwd:ROOT,input:JSON.stringify({operation,context:ctx}),encoding:"utf8",timeout:3500,
  maxBuffer:8192,env:{PATH:process.env.PATH||"/usr/bin:/bin",PYTHONDONTWRITEBYTECODE:"1"}
 });
 if(child.error||child.status!==0)throw Error("PEP_BRIDGE_FAILED");
 const v=JSON.parse(child.stdout);
 assert.ok(["DENY","SIMULATED_ALLOW"].includes(v.decision));
 assert.equal(v.canGrantPermission,false);
 assert.equal(v.legalOperationalEffect,"NONE");
 return v;
}
function decisionContext({tenant,owner,operation}){
 return {environment:"SIMULATION",session:state.sessionActive?"ACTIVE":"REVOKED",
  tenantMatch:tenant===tenantA,partyBound:state.partyBound,
  membershipSourceApproved:true,featureEnabled:true,permission:state.readRight,
  sourceApproved:state.sourceApproved,sourceStatus:state.sourceApproved?"APPROVED":"REVOKED",
  sourceFresh:true,sourceVersion:"SYNTHETIC-V1",
  selfResource:owner===ownerA,classificationAllowed:true,
  downloadPermission:false,exportPermission:false,writePermission:false,
  reauth:false,csrf:false,idempotency:null,versionMatched:true,
  ruleSnapshot:null,paymentState:"NONE",ownershipFinalizationApproved:false};
}
class LabController {
 evaluate(req){
  nestRequests++;
  if(req.headers["x-w1-lab-channel"]!==internalToken)
   throw new HttpException({code:"INTERNAL_CHANNEL_REQUIRED"},403);
  const input=req.body;
  // Nest independently re-resolves all synthetic proof, never accepts any
  // tenant/owner/source/permission from the BFF JSON or forged browser headers.
  const proof={
   sessionActive:state.sessionActive,tenantKey:tenantA,ownerKey:ownerA,
   partyBound:state.partyBound,membershipSourceApproved:true,
   featureEnabled:true,readPermission:state.readRight,
   sourceApproved:state.sourceApproved,sourceFresh:true,sourceVersion:"SYNTHETIC-V1",
   classificationAllowed:true,downloadPermission:false,exportPermission:false,
   writePermission:false
  };
  const checked=verifyW1SyntheticNestCandidate(input,proof);
  if(checked.kind!=="PEP_CANDIDATE"){
   // Test-only audit metadata; never claims to be production durable audit.
   const denied={decision:"DENY",reasonCode:checked.reasonCode,
    requestId:randomUUID(),fixtureTouches:0,auditCount:1,
    legalOperationalEffect:"NONE",canGrantPermission:false,hasActualRecord:false};
   trace.push({decision:denied.decision,reasonCode:denied.reasonCode,
    fixtureTouches:0,requestId:denied.requestId});
   return denied;
  }
  const result=pythonPEP(checked.operation,checked.context);
  trace.push({decision:result.decision,reasonCode:result.reasonCode,
   fixtureTouches:result.fixtureTouches,requestId:result.requestId});
  return result;
 }
}
Req()(LabController.prototype,"evaluate",0);
Post("evaluate")(LabController.prototype,"evaluate",Object.getOwnPropertyDescriptor(LabController.prototype,"evaluate"));
Controller("w1-isolated-lab")(LabController);
class LabModule {}
Module({controllers:[LabController]})(LabModule);

function response(res,nextResponse){
 res.writeHead(nextResponse.status,Object.fromEntries(nextResponse.headers));
 nextResponse.text().then(text=>res.end(text)).catch(()=>res.end());
}
async function handleBFF(nodeRequest,nodeResponse){
 bffRequests++;
 const url="http://127.0.0.1"+nodeRequest.url;
 const req=new NextRequest(url,{method:nodeRequest.method,headers:nodeRequest.headers});
 const fail=(status,code)=>NextResponse.json({code,canGrantPermission:false},
  {status,headers:{"Cache-Control":"private, no-store"}});
 const pathname=new URL(url).pathname;
 const m=/^\/test\/tenants\/(coop-test-[AB])\/owners\/(fixture-owner-[AB])\/(read|download|export|write)$/.exec(pathname);
 if(!m){await response(nodeResponse,fail(404,"UNKNOWN_ROUTE"));return}
 if((m[3]==="write"&&req.method!=="POST")||(m[3]!=="write"&&req.method!=="GET")){
  await response(nodeResponse,fail(405,"METHOD_DENIED"));return;
 }
 const preflight=prepareW1SyntheticBffCandidate(req,
  {tenantKey:m[1],ownerKey:m[2],operation:m[3]},
  {sessionActive:state.sessionActive,expectedCookie:session,
   tenantKey:tenantA,ownerKey:ownerA});
 if(preflight.kind!=="CANDIDATE"){
  // No Nest request and no source access for BFF-level denial.
  trace.push({decision:"DENY",reasonCode:preflight.reasonCode,
   fixtureTouches:0,requestId:randomUUID()});
  await response(nodeResponse,NextResponse.json({
   decision:"DENY",reasonCode:preflight.reasonCode,fixtureTouches:0,
   hasActualRecord:false,canGrantPermission:false
  },{status:preflight.status,headers:{"Cache-Control":"private, no-store"}}));return;
 }
 try{
  // BFF drops ALL client-supplied identity/role/tenant/approval headers.
  const upstream=await fetch(nestUrl+"/w1-isolated-lab/evaluate",{
   method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(4000),
   headers:{"Content-Type":"application/json","x-w1-lab-channel":internalToken},
   body:JSON.stringify(preflight.candidate)
  });
  if(!upstream.ok){await response(nodeResponse,fail(503,"API_UNAVAILABLE"));return}
  const raw=await upstream.json();
  const safe=sanitizeW1SyntheticBffDecision(raw);
  if(safe.kind!=="VALID"){
   await response(nodeResponse,fail(503,"UPSTREAM_CONTRACT_INVALID"));return;
  }
  await response(nodeResponse,NextResponse.json(safe.response,{
   status:safe.response.decision==="SIMULATED_ALLOW"?200:403,
   headers:{"Cache-Control":"private, no-store"}
  }));
 }catch{await response(nodeResponse,fail(503,"CHAIN_UNAVAILABLE"))}
}
let nest,bff;
function startServer(server){return new Promise((yes,no)=>{
 server.once("error",no);server.listen(0,"127.0.0.1",()=>yes("http://127.0.0.1:"+server.address().port))
})}
function path(tenant=tenantA,owner=ownerA,op="read"){
 return "/test/tenants/"+tenant+"/owners/"+owner+"/"+op;
}
async function call(relative,{method="GET",cookie=true,headers={}}={}){
 const h={...headers};if(cookie)h.Cookie="tto_lab_session="+session;
 const res=await fetch(bffUrl+relative,{method,headers:h,signal:AbortSignal.timeout(5000)});
 return {status:res.status,body:await res.json(),headers:res.headers};
}
test("W1 actual Next request boundary -> Nest controller -> Python PEP/PDP, loopback only",
 async t=>{
  nest=await NestFactory.create(LabModule,new FastifyAdapter({logger:false}),{logger:false});
  await nest.listen(0,"127.0.0.1");nestUrl=await nest.getUrl();
  bff=http.createServer((req,res)=>{handleBFF(req,res).catch(()=>{if(!res.headersSent)res.writeHead(503);res.end()})});
  bffUrl=await startServer(bff);
  t.after(async()=>{await new Promise(done=>bff.close(done));await nest.close()});
  await t.test("anonymous rejected before Nest and fixture",async()=>{
   const before=nestRequests;const r=await call(path(),{cookie:false});
   assert.equal(r.status,401);assert.equal(nestRequests,before);
  });
  await t.test("synthetic permitted read never returns real record",async()=>{
   const r=await call(path());assert.equal(r.status,200);
   assert.equal(r.body.decision,"SIMULATED_ALLOW");assert.equal(r.body.fixtureTouches,1);
   assert.equal(r.body.hasActualRecord,false);assert.equal(r.body.canGrantPermission,false);
   assert.match(r.headers.get("cache-control"),/no-store/);
  });
  await t.test("cross-tenant denied before fixture",async()=>{
   const r=await call(path(tenantB));assert.equal(r.status,403);
   assert.equal(r.body.fixtureTouches,0);assert.equal(r.body.reasonCode,"TENANT_MISMATCH");
  });
  await t.test("other owner denied before fixture",async()=>{
   const r=await call(path(tenantA,ownerB));assert.equal(r.status,403);
   assert.equal(r.body.fixtureTouches,0);assert.equal(r.body.hasActualRecord,false);
  });
  await t.test("read never grants download or export",async()=>{
   for(const op of ["download","export"]){
    const r=await call(path(tenantA,ownerA,op));
    assert.equal(r.status,403);assert.equal(r.body.fixtureTouches,0);
   }
  });
  await t.test("write never reaches resource or mutates",async()=>{
   const r=await call(path(tenantA,ownerA,"write"),{method:"POST"});
   assert.equal(r.status,403);assert.equal(r.body.fixtureTouches,0);
  });
  await t.test("client-side privileged headers cannot override ownership",async()=>{
   const r=await call(path(tenantB,ownerB),{headers:{
    "x-tenant-id":tenantA,"x-role":"SUPERUSER","x-source-approved":"true",
    "authorization":"Bearer fake","x-w1-lab-channel":internalToken}});
   assert.equal(r.status,403);assert.equal(r.body.fixtureTouches,0);
  });
  await t.test("source revoked denies after BFF",async()=>{
   state.sourceApproved=false;
   const r=await call(path());assert.equal(r.status,403);
   assert.equal(r.body.fixtureTouches,0);
   state.sourceApproved=true;
  });
  await t.test("missing Party binding denies",async()=>{
   state.partyBound=false;const r=await call(path());
   assert.equal(r.status,403);assert.equal(r.body.fixtureTouches,0);state.partyBound=true;
  });
  await t.test("revoked session denied before Nest",async()=>{
   state.sessionActive=false;const before=nestRequests;
   const r=await call(path());assert.equal(r.status,401);assert.equal(nestRequests,before);
   state.sessionActive=true;
  });
  await t.test("forged direct Nest request rejected",async()=>{
   const r=await fetch(nestUrl+"/w1-isolated-lab/evaluate",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({tenant:tenantA,owner:ownerA,operation:"read"})});
   assert.equal(r.status,403);
  });
  await t.test("audit trace never stores identities or payload",()=>{
   assert.ok(trace.length>=7);
   for(const ev of trace){
    assert.deepEqual(Object.keys(ev).sort(),["decision","fixtureTouches","reasonCode","requestId"].sort());
    assert.equal(JSON.stringify(ev).includes(tenantA),false);
    assert.equal(JSON.stringify(ev).includes(ownerA),false);
   }
  });
  console.log("TTO_W1_BFF_NEST_PEP_PDP_CHAIN=PASS");
  console.log("TTO_W1_DENIED_FIXTURE_TOUCHES=0");
  console.log("TTO_W1_REAL_DATA_OR_MUTATIONS=NONE");
  console.log("TTO_W1_NO_OPERATIONAL_ALLOW=PASS");
 });
