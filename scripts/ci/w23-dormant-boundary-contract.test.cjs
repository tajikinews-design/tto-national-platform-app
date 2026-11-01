"use strict";
/**
 * W2.3 detached interface proof using real NextRequest/NextResponse objects,
 * actual-location BFF/Nest contract TypeScript, ephemeral Nest/Fastify lab and
 * W2.2 cancellable Python PDP. Never imports a production Route/AppModule.
 * No Docker, database, official source, persistent audit or operational ALLOW.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const {randomUUID}=require("node:crypto");
const {createRequire,Module:NodeModule}=require("node:module");
const {resolve,dirname}=require("node:path");
const {readFileSync}=require("node:fs");
const ROOT=resolve(__dirname,"../..");
if(process.env.CI!=="true"||process.env.NODE_ENV!=="test"||
 process.env.TTO_LOOPBACK_E2E!=="1"||
 process.env.TTO_W1_BOUNDARY_LAB!=="1"||
 process.env.TTO_W2_OFFLINE_LAB!=="1"||
 process.env.TTO_W22_CANCELLABLE_LAB!=="1"||
 process.env.TTO_W23_CONTRACT_LAB!=="1"||
 process.env.VERCEL||process.env.DATABASE_URL||
 process.env.TTO_API_BASE_URL||process.env.APIIR_TOKEN||
 process.env.TEST_ADMIN_DATABASE_URL||
 process.env.TTO_DB_POOLER_HOST||process.env.TTO_DB_APP_PASSWORD)
 throw Error("W23_DORMANT_GITHUB_ONLY");
const nextRequire=createRequire(resolve(ROOT,"apps/shareholder/package.json"));
const apiRequire=createRequire(resolve(ROOT,"services/api/package.json"));
apiRequire("reflect-metadata");
const ts=nextRequire("typescript");
const {NextRequest,NextResponse}=nextRequire("next/server");
const {Controller,Post,Req,Module,HttpException}=apiRequire("@nestjs/common");
const {NestFactory}=apiRequire("@nestjs/core");
const {FastifyAdapter}=apiRequire("@nestjs/platform-fastify");
const {runW22CancellablePDP,stats}=require("../security/w2-2-cancellable-pdp-provider.cjs");

function loadTs(path) {
 const file=resolve(ROOT,path);
 const code=ts.transpileModule(readFileSync(file,"utf8"),{
  fileName:file,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const m=new NodeModule(file,module);
 m.filename=file;m.paths=NodeModule._nodeModulePaths(dirname(file));
 m._compile(code,file);
 return m.exports;
}
const {prepareW1SyntheticBffCandidate}=loadTs("apps/shareholder/lib/w1-boundary-seam.ts");
const {prepareW23DormantBffEnvelope,closeW23DormantBffVerdict}=
 loadTs("apps/shareholder/lib/w23-dormant-policy-boundary.ts");
const {verifyW23DormantNestEnvelope,normalizeW23SyntheticNestPolicyVerdict}=
 loadTs("services/api/src/w23-dormant-policy-boundary.ts");
const actors=new Map(),handles=new Map();
const tenant="coop-test-A",otherTenant="coop-test-B";
const owners=["fixture-owner-A","fixture-owner-B"];
const channel=randomUUID();
const cookies=[randomUUID(),randomUUID()];
const tokens=[randomUUID(),randomUUID()];
let nestRequests=0,sourceTouches=0,policyCalls=0,mode="normal";
for(let i=0;i<2;i++){
 const proof={
  sessionActive:true,tenantKey:tenant,ownerKey:owners[i],
  partyBound:true,membershipSourceApproved:true,featureEnabled:true,
  readPermission:true,sourceApproved:true,sourceFresh:true,
  sourceVersion:"SYNTHETIC-V1",classificationAllowed:true,
  downloadPermission:false,exportPermission:false,writePermission:false
 };
 const actor={cookie:cookies[i],handle:tokens[i],proof};
 actors.set(actor.cookie,actor);handles.set(actor.handle,actor);
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let nest,app,nestUrl,appUrl;
const deny=(status,code)=>NextResponse.json({available:false,code},
 {status,headers:{"Cache-Control":"private, no-store"}});
async function send(nodeRes,reply){
 const responseBody=await reply.text();
 nodeRes.writeHead(reply.status,Object.fromEntries(reply.headers));
 nodeRes.end(responseBody);
}
class W23LabController{
 async evaluate(request){
  nestRequests++;
  if(request.headers["x-w23-internal-channel"]!==channel)
   throw new HttpException({available:false,code:"W23_CHANNEL_DENIED"},403);
  const actor=handles.get(request.headers["x-w23-handle"]);
  const proof=actor?.proof;
  const controller=new AbortController();
  const onDisconnect=()=>controller.abort();
  request.raw?.socket?.once("close",onDisconnect);
  let timer;
  try{
   const checked=verifyW23DormantNestEnvelope(request.body,proof,controller.signal);
   if(checked.kind!=="SYNTHETIC_PDP_CANDIDATE")
    return {available:false,code:checked.code};
   const timeout=mode==="timeout"?45:1000;
   timer=setTimeout(()=>controller.abort(),timeout);
   let raw;
   policyCalls++;
   try{
    raw=await runW22CancellablePDP("read",checked.context,{
     signal:controller.signal,mode:mode==="timeout"?"hang":"bridge"
    });
   }catch{
    return {available:false,code:"W23_PDP_UNAVAILABLE"};
   }
   if(mode==="corrupt_extra")
    return {...raw,privateShareholder:"DO_NOT_LEAK",requestId:checked.requestId};
   if(mode==="corrupt_allow")
    return {...raw,decision:"ALLOW",canGrantPermission:true,
     requestId:checked.requestId};
   const parsed=normalizeW23SyntheticNestPolicyVerdict(
    raw,checked.requestId,controller.signal
   );
   if(parsed.kind!=="SIMULATED_ONLY")
    return {available:false,code:parsed.code};
   return parsed.verdict;
  }finally{
   clearTimeout(timer);
   request.raw?.socket?.off("close",onDisconnect);
  }
 }
}
Req()(W23LabController.prototype,"evaluate",0);
Post("evaluate")(W23LabController.prototype,"evaluate",
 Object.getOwnPropertyDescriptor(W23LabController.prototype,"evaluate"));
Controller("w23-dormant-test-only")(W23LabController);
class W23TestOnlyModule{}
Module({controllers:[W23LabController]})(W23TestOnlyModule);

async function serveBff(req,res){
 try{
  const incoming=new NextRequest("http://127.0.0.1"+req.url,{
   method:req.method,headers:req.headers
  });
  const match=/^\/test\/tenants\/(coop-test-[AB])\/owners\/(fixture-owner-[AB])\/(read|download|export|write|trade|finalize)$/
   .exec(new URL(incoming.url).pathname);
  if(!match){await send(res,deny(404,"W23_UNKNOWN_ROUTE"));return}
  const actor=actors.get(incoming.cookies.get("tto_lab_session")?.value);
  const w1=prepareW1SyntheticBffCandidate(incoming,{
   tenantKey:match[1],ownerKey:match[2],operation:match[3]
  },{
   sessionActive:actor?.proof.sessionActive===true,
   expectedCookie:actor?.cookie||"",tenantKey:actor?.proof.tenantKey||"",
   ownerKey:actor?.proof.ownerKey||""
  });
  const w23=prepareW23DormantBffEnvelope(w1,incoming);
  if(w23.kind!=="DRAFT_CANDIDATE"){
   await send(res,deny(w23.status,w23.code));return
  }
  const abort=new AbortController();
  const onClose=()=>abort.abort();
  res.once("close",onClose);
  try{
   // The six-field W2.3 envelope is the ENTIRE serialized payload.
   // No browser Authorization, cookies, roles, Party or source claims.
   const upstream=await fetch(nestUrl+"/w23-dormant-test-only/evaluate",{
    method:"POST",cache:"no-store",redirect:"error",
    headers:{"Content-Type":"application/json",
     "x-w23-internal-channel":channel,
     "x-w23-handle":actor.handle},
    body:JSON.stringify(w23.envelope),
    signal:AbortSignal.any([abort.signal,w23.signal,AbortSignal.timeout(2500)])
   });
   if(upstream.status!==201){
    await send(res,deny(503,"W23_UPSTREAM_UNAVAILABLE"));return
   }
   const raw=await upstream.json();
   const closed=closeW23DormantBffVerdict(raw,w23.envelope.requestId);
   await send(res,deny(closed.status,closed.code));
  }catch{
   if(!res.destroyed)
    await send(res,deny(503,"W23_UPSTREAM_UNAVAILABLE"));
  }finally{
   res.off("close",onClose);
  }
 }catch{
  if(!res.destroyed)await send(res,deny(503,"W23_BFF_UNAVAILABLE"));
 }
}
function location(owner=owners[0],scope=tenant,op="read"){
 return "/test/tenants/"+scope+"/owners/"+owner+"/"+op;
}
async function request(path,{user=0,headers={},method="GET"}={}){
 const h={...headers};
 if(user!==null)h.Cookie="tto_lab_session="+cookies[user];
 const r=await fetch(appUrl+path,{
  method,headers:h,signal:AbortSignal.timeout(3500)
 });
 return {status:r.status,body:await r.json(),headers:r.headers};
}
test("W2.3 DORMANT actual-location boundary contract remains fail closed",async t=>{
 nest=await NestFactory.create(W23TestOnlyModule,new FastifyAdapter({logger:false}),
  {logger:false});
 await nest.listen(0,"127.0.0.1");nestUrl=await nest.getUrl();
 app=http.createServer((req,res)=>serveBff(req,res));
 await new Promise((done,fail)=>{
  app.once("error",fail);
  app.listen(0,"127.0.0.1",done);
 });
 appUrl="http://127.0.0.1:"+app.address().port;
 t.after(async()=>{
  await new Promise(done=>app.close(done));
  await nest.close();
 });
 await t.test("two owners same tenant: simulated positive always yields HTTP 403",async()=>{
  for(let i=0;i<2;i++){
   const before=policyCalls;
   const r=await request(location(owners[i]),{user:i});
   assert.deepEqual(r.body,{available:false,code:"W23_OPERATIONAL_NOT_APPROVED"});
   assert.equal(r.status,403);
   assert.ok((r.headers.get("cache-control")||"").includes("no-store"));
   assert.equal(policyCalls,before+1);
   assert.equal(sourceTouches,0);
  }
 });
 console.log("TTO_W23_SIMULATED_ALLOW_CANNOT_GRANT_REAL_READ=PASS");

 await t.test("anonymous, wrong owner and wrong tenant never reach Nest",async()=>{
  const matrix=[
   [null,location(owners[0])],
   [0,location(owners[1])],[1,location(owners[0])],
   [0,location(owners[0],otherTenant)]
  ];
  for(const [user,path] of matrix){
   const before=nestRequests;
   const r=await request(path,{user});
   assert.ok([401,403].includes(r.status));
   assert.equal(r.body.available,false);
   assert.equal(nestRequests,before,"rejected at W1 BFF preflight");
  }
 });
 console.log("TTO_W23_W1_BFF_PRE_SOURCE_DENIAL=PASS");

 await t.test("forged headers cannot override owner, source or role",async()=>{
  const before=nestRequests;
  const r=await request(location(owners[1]),{
   user:0,
   headers:{Authorization:"Bearer forged","x-role":"PLATFORM_ADMIN",
    "x-party-id":owners[1],"x-source-approved":"true",
    "x-w23-handle":tokens[1],"x-w23-internal-channel":channel}
  });
  assert.equal(r.status,403);
  assert.equal(nestRequests,before);
  assert.equal(sourceTouches,0);
 });
 console.log("TTO_W23_BROWSER_IDENTITY_HEADERS_IGNORED=PASS");

 await t.test("download, export, write, trade and finalize never create a PDP candidate",async()=>{
  for(const op of ["download","export","write","trade","finalize"]){
   const before=nestRequests;
   const method=["write","trade","finalize"].includes(op)?"POST":"GET";
   const r=await request(location(owners[0],tenant,op),{user:0,method});
   assert.equal(r.status,405);
   assert.equal(r.body.available,false);
   assert.equal(nestRequests,before);
  }
 });
 console.log("TTO_W23_ALL_MUTATING_AND_EXPORT_OPERATIONS_BLOCKED=PASS");

 await t.test("direct Nest rejects malformed payload, wrong owner, wrong tenant and proof revocation",async()=>{
  const wire={
   contractVersion:"W2_3_DORMANT_BOUNDARY_V0_1",environment:"SIMULATION",
   operation:"read",tenantKey:tenant,ownerKey:owners[0],requestId:randomUUID()
  };
  const proof=actors.get(cookies[0]).proof;
  for(const [label,v,p] of [
   ["extra browser authority",{...wire,sourceApproved:true},proof],
   ["wrong tenant",{...wire,tenantKey:otherTenant},proof],
   ["wrong owner",{...wire,ownerKey:owners[1]},proof],
   ["wrong operation",{...wire,operation:"trade"},proof],
   ["bad request ID",{...wire,requestId:"nope"},proof],
   ["unapproved source",wire,{...proof,sourceApproved:false}],
   ["invalid session",wire,{...proof,sessionActive:false}],
   ["unbound Party",wire,{...proof,partyBound:false}],
   ["missing permission",wire,{...proof,readPermission:false}]
  ]){
   const before=policyCalls;
   const checked=verifyW23DormantNestEnvelope(v,p,new AbortController().signal);
   assert.equal(checked.kind,"DENY",label);
   assert.equal(policyCalls,before);
   assert.equal(sourceTouches,0);
  }
 });
 console.log("TTO_W23_NEST_INDEPENDENT_TENANT_OWNER_SOURCE_GATES=PASS");

 await t.test("Nest HTTP internal channel cannot be forged as browser authorization",async()=>{
  const r=await fetch(nestUrl+"/w23-dormant-test-only/evaluate",{
   method:"POST",headers:{"Content-Type":"application/json",
    Authorization:"Bearer fake",
    "x-role":"PLATFORM_ADMIN",
    "x-w23-handle":tokens[0]},
   body:JSON.stringify({tenantKey:tenant,ownerKey:owners[0]})
  });
  assert.equal(r.status,403);
  assert.equal(policyCalls>=2,true);
 });
 console.log("TTO_W23_NEST_LAB_CHANNEL_REQUIRED=PASS");

 await t.test("Nest injected extra data and fake ALLOW are never forwarded",async()=>{
  for(const injection of ["corrupt_extra","corrupt_allow"]){
   const before=sourceTouches;
   mode=injection;
   try{
    const r=await request(location(owners[0]),{user:0});
    assert.equal(r.status,503);
    assert.deepEqual(r.body,{available:false,code:"W23_UPSTREAM_CONTRACT_INVALID"});
    assert.equal(JSON.stringify(r.body).includes("DO_NOT_LEAK"),false);
    assert.equal(sourceTouches,before);
   }finally{mode="normal"}
  }
 });
 console.log("TTO_W23_UPSTREAM_EXACT_ALLOWLIST_NO_DISCLOSURE=PASS");

 await t.test("Nest timeout/crashed PDP cannot return authorized data",async()=>{
  mode="timeout";
  try{
   const before=stats().aborted;
   const r=await request(location(),{user:0});
   assert.equal(r.status,503);
   assert.equal(r.body.available,false);
   assert.equal(sourceTouches,0);
   assert.ok(stats().aborted>before,"Nest deadline killed child");
  }finally{mode="normal"}
  for(let i=0;i<100&&stats().active;i++)await sleep(10);
  assert.equal(stats().active,0);
 });
 console.log("TTO_W23_NEST_PDP_TIMEOUT_FAIL_CLOSED=PASS");

 await t.test("pre-aborted signal never yields candidate",()=>{
  const ctl=new AbortController();ctl.abort();
  const request=new NextRequest("http://127.0.0.1"+location(),{
   headers:{Cookie:"tto_lab_session="+cookies[0]}
  });
  const w1=prepareW1SyntheticBffCandidate(request,{
   tenantKey:tenant,ownerKey:owners[0],operation:"read"
  },{
   sessionActive:true,expectedCookie:cookies[0],
   tenantKey:tenant,ownerKey:owners[0]
  });
  const r=prepareW23DormantBffEnvelope(w1,{signal:ctl.signal});
  assert.equal(r.kind,"DENY");
  const nestResult=verifyW23DormantNestEnvelope({
   contractVersion:"W2_3_DORMANT_BOUNDARY_V0_1",
   environment:"SIMULATION",operation:"read",tenantKey:tenant,
   ownerKey:owners[0],requestId:randomUUID()
  },actors.get(cookies[0]).proof,ctl.signal);
  assert.equal(nestResult.kind,"DENY");
 });
 console.log("TTO_W23_ABORT_SIGNAL_NOT_SERIALIZED=PASS");

 await t.test("runtime flag disabled: neither BFF nor Nest candidate is valid",()=>{
  const request=new NextRequest("http://127.0.0.1"+location(),{
   headers:{Cookie:"tto_lab_session="+cookies[0]}
  });
  const w1=prepareW1SyntheticBffCandidate(request,{
   tenantKey:tenant,ownerKey:owners[0],operation:"read"
  },{
   sessionActive:true,expectedCookie:cookies[0],
   tenantKey:tenant,ownerKey:owners[0]
  });
  const original=process.env.TTO_W23_CONTRACT_LAB;
  delete process.env.TTO_W23_CONTRACT_LAB;
  try{
   const b=prepareW23DormantBffEnvelope(w1,request);
   assert.equal(b.kind,"DENY");
   const n=verifyW23DormantNestEnvelope({},null,new AbortController().signal);
   assert.equal(n.kind,"DENY");
   assert.equal(n.status,503);
  }finally{process.env.TTO_W23_CONTRACT_LAB=original}
 });
 console.log("TTO_W23_RUNTIME_NOT_REGISTERED_DENY=PASS");

 await t.test("all response paths deny real reads, no fake source access",()=>{
  assert.equal(sourceTouches,0);
  assert.equal(stats().active,0);
  const expected=randomUUID();
  for(const raw of [
   {decision:"ALLOW",canGrantPermission:true},
   {decision:"SIMULATED_ALLOW",reasonCode:"SIMULATION_ONLY",requestId:expected,
    fixtureTouches:1,auditCount:1,legalOperationalEffect:"NONE",
    canGrantPermission:false,hasActualRecord:false,account:"SECRET"},
   {decision:"DENY",reasonCode:"SOURCE_UNAVAILABLE",requestId:expected,
    fixtureTouches:1,auditCount:1,legalOperationalEffect:"NONE",
    canGrantPermission:false,hasActualRecord:false}
  ]){
   const d=closeW23DormantBffVerdict(raw,expected);
   assert.equal(d.available,false);
   assert.equal(d.status,503);
  }
 });
 console.log("TTO_W23_NO_SOURCE_TOUCHES_NO_OPERATIONAL_ALLOW=PASS");
 console.log("TTO_W23_GITHUB_ONLY_CONTRACT=PASS");
});
