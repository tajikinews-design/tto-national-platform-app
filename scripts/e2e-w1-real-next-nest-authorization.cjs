"use strict";
/**
 * W1 isolated REAL production-build HTTP routes:
 * Next.js shareholder BFF -> transparent loopback counting relay -> real Nest
 * AppModule -> disposable PG17 + synthetic unapproved source snapshots.
 *
 * NO mocks of Next or Nest HTTP responses; no app/module/runtime source edits.
 * A Python PDP/PEP shadow probe checks simulation invariants separately.
 * IMPORTANT: shadow decisions DO NOT enforce real HTTP routes.
 */
const assert=require("node:assert/strict");
const http=require("node:http");
const {spawn,spawnSync}=require("node:child_process");
const {randomUUID,randomBytes,createHash}=require("node:crypto");
const {createRequire}=require("node:module");
const {resolve}=require("node:path");
const ROOT=resolve(__dirname,"..");
const DB_URL="postgresql://postgres@127.0.0.1:5432/tto";
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||
   process.env.TTO_W1_REAL_ROUTE_LAB!=="1"||
   process.env.TEST_ADMIN_DATABASE_URL!==DB_URL||
   process.env.VERCEL||process.env.APIIR_TOKEN||process.env.TTO_API_BASE_URL||
   process.env.DATABASE_URL||process.env.TTO_DB_APP_PASSWORD||
   process.env.TTO_DB_POOLER_HOST)throw Error("W1_REAL_ROUTES_DISPOSABLE_PG_ONLY");
const {Client}=createRequire(resolve(ROOT,"services/api/package.json"))("pg");
const db=new Client({connectionString:DB_URL,connectionTimeoutMillis:8000});
const API="http://127.0.0.1:32981";
const APP="http://127.0.0.1:32982";
const RELAY="http://127.0.0.1:32983";
const A=randomUUID(),B=randomUUID(),USER_A=randomUUID(),USER_B=randomUUID();
const PARTY_A=randomUUID(),PARTY_B=randomUUID();
const TOKEN_A=randomBytes(48).toString("base64url");
const TOKEN_B=randomBytes(48).toString("base64url");
const SEAL_A="W1_PRIVATE_SYNTHETIC_ONLY_A_"+randomUUID();
const SEAL_B="W1_PRIVATE_SYNTHETIC_ONLY_B_"+randomUUID();
const SOURCES_A="W1-SYNTHETIC-UNAPPROVED-A";
const SOURCES_B="W1-SYNTHETIC-UNAPPROVED-B";
const appChildren=[];
const requests=[];
const errors=[];
let relay=null,dbConnected=false,checks=0,cases=0;
function eq(actual,expected,label){assert.deepEqual(actual,expected,label);checks++}
function ok(value,label){assert.ok(value,label);checks++}
function path(tenant,domain){return "/api/tenants/"+tenant+"/me/"+domain}
function nestPath(tenant,domain){return "/v1/tenants/"+tenant+"/me/"+domain}
async function jsonCall(base,p,token,{method="GET",headers={}}={}){
 const hdr={...headers};
 if(token) {
  if(base===APP)hdr.Cookie="tto_session="+token;
  else hdr.Authorization="Bearer "+token;
 }
 const r=await fetch(base+p,{method,headers:hdr,cache:"no-store",redirect:"manual",
  signal:AbortSignal.timeout(9500)});
 const text=await r.text();
 let body;
 try {body=JSON.parse(text)}catch {body={nonJson:true}}
 return {status:r.status,body,headers:r.headers};
}
function noLeak(r,label){
 const text=JSON.stringify(r.body);
 for(const secret of [SEAL_A,SEAL_B,"9123456701","1234567899",TOKEN_A,TOKEN_B]){
  ok(!text.includes(secret),label+" no canary/token");
 }
 ok(r.body?.available!==true,label+" cannot declare approved source");
}
function denied(r,status,label){
 eq(r.status,status,label+" status");
 noLeak(r,label);
 ok((r.headers.get("cache-control")??"").includes("no-store"),label+" no-store");
}
function proxyRequestsFrom(start){return requests.slice(start)}
async function launch(args,cwd,env,probe,label){
 const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},
  stdio:["ignore","pipe","pipe"]});
 appChildren.push(child);
 for(const stream of ["stderr","stdout"]){
  child[stream].on("data",b=>{
   const text=b.toString("utf8");
   const codes=(text.match(/\b(?:EADDRINUSE|EACCES|MODULE_NOT_FOUND|DATABASE_URL_NOT_CONFIGURED)\b/g)||[]);
   if(codes.length)errors.push(label+":"+codes[0]);
  });
 }
 for(let attempt=0;attempt<120;attempt++){
  if(child.exitCode!==null||child.signalCode!==null)
   throw Error(label+" exited; diagnostic="+errors.join("|"));
  try{const r=await fetch(probe,{signal:AbortSignal.timeout(1000)});if(r.ok)return child}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error(label+" readiness failed; diagnostic="+errors.join("|"));
}
async function startRelay(){
 relay=http.createServer(async(req,res)=>{
  const url=new URL(req.url??"/",RELAY);
  // In-memory counting only. Never record Authorization/Cookie/body.
  requests.push({method:req.method,path:url.pathname});
  if(!url.pathname.startsWith("/v1/")){
   res.writeHead(502,{"Content-Type":"application/json"});res.end('{"code":"PROXY_PATH_DENIED"}');return;
  }
  try{
   const h={};
   if(typeof req.headers.authorization==="string")h.Authorization=req.headers.authorization;
   const response=await fetch(API+url.pathname,{
    method:req.method,headers:h,cache:"no-store",redirect:"error",
    signal:AbortSignal.timeout(9000)
   });
   const data=Buffer.from(await response.arrayBuffer());
   if(data.length>1048576)throw Error("PROXY_RESPONSE_TOO_LARGE");
   res.writeHead(response.status,{"Content-Type":response.headers.get("content-type")||"application/json",
    "Cache-Control":"no-store"});
   res.end(data);
  }catch{
   res.writeHead(503,{"Content-Type":"application/json","Cache-Control":"no-store"});
   res.end('{"code":"SYNTHETIC_RELAY_UNAVAILABLE"}');
  }
 });
 await new Promise((resolve,reject)=>{
  relay.once("error",reject);
  relay.listen(32983,"127.0.0.1",resolve);
 });
}
async function syntheticAccount(user,tenant,party,token,tag,sourceRef,quantity){
 const event=randomUUID(),account=randomUUID();
 await db.query("INSERT INTO tto.user_accounts(user_id) VALUES($1)",[user]);
 await db.query("INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES($1,$2,$3,'ACTIVE')",
  [tenant,"w1-route-"+tag+"-"+tenant.slice(0,8),"W1 Synthetic Test Coop "+tag]);
 await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'MEMBER')",
  [randomUUID(),user,tenant]);
 await db.query("INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES($1,'PERSON',$2)",
  [party,tag==="A"?SEAL_A:SEAL_B]);
 await db.query("INSERT INTO tto.user_party_links(user_id,party_id,verified_at) VALUES($1,$2,now())",
  [user,party]);
 await db.query("INSERT INTO tto.relationship_projections(tenant_id,party_id,membership_status,source_event_id,source_version) VALUES($1,$2,'ACTIVE',$3,1)",
  [tenant,party,event]);
 await db.query("INSERT INTO tto.member_source_snapshots(tenant_id,party_id,source_ref,source_event_id,source_version,membership_status,source_as_of) VALUES($1,$2,$3,$4,1,'ACTIVE',now()-interval '1 minute')",
  [tenant,party,sourceRef,event]);
 await db.query("INSERT INTO tto.shareholder_source_accounts(tenant_id,party_id,shareholder_account_id,source_ref,source_version,account_status) VALUES($1,$2,$3,$4,1,'ACTIVE')",
  [tenant,party,account,sourceRef]);
 await db.query("INSERT INTO tto.shareholding_source_snapshots(snapshot_id,tenant_id,shareholder_account_id,source_ref,ledger_entry_ref,ledger_version,share_quantity,ledger_as_of) VALUES($1,$2,$3,$4,$5,1,$6,now()-interval '1 minute')",
  [randomUUID(),tenant,account,"W1-SYNTHETIC-HOLDINGS-"+tag,randomUUID(),quantity]);
 const hash=createHash("sha256").update(token).digest();
 await db.query("INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at) VALUES($1,$2,$3,0,now()+interval '15 minutes')",
  [randomUUID(),user,hash]);
}
async function counts(){
 const r=await db.query(`
 SELECT
  (SELECT count(*)::int FROM tto.member_source_snapshots WHERE tenant_id=ANY($1::uuid[])) AS member,
  (SELECT count(*)::int FROM tto.shareholding_source_snapshots WHERE tenant_id=ANY($1::uuid[])) AS holding,
  (SELECT count(*)::int FROM tto.source_contract_approvals WHERE tenant_id=ANY($1::uuid[])) AS approvals,
  (SELECT count(*)::int FROM tto.source_import_batches WHERE tenant_id=ANY($1::uuid[])) AS batches
 `,[[A,B]]);
 return r.rows[0];
}
async function init(){
 await db.connect();dbConnected=true;
 const id=await db.query("SELECT current_database() AS db,current_user AS u,current_setting('server_version_num')::int AS version");
 eq(id.rows[0].db,"tto","disposable DB name");
 eq(id.rows[0].u,"postgres","disposable fixture admin");
 ok(id.rows[0].version>=170000&&id.rows[0].version<180000,"only PG17");
 await db.query("ALTER ROLE tto_app LOGIN");
 await syntheticAccount(USER_A,A,PARTY_A,TOKEN_A,"A",SOURCES_A,"9123456701");
 await syntheticAccount(USER_B,B,PARTY_B,TOKEN_B,"B",SOURCES_B,"1234567899");
 eq(await counts(),{member:2,holding:2,approvals:0,batches:0},
  "both source snapshots exist but NO approved source/batch");
 await launch(["dist/main.js"],resolve(ROOT,"services/api"),{
  DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto",
  PORT:"32981",NODE_ENV:"test",APIIR_TOKEN:"",
  TTO_MOCK_SMSOTP_PROVIDER:"false",TTO_ENABLE_REAL_SMSOTP_DELIVERY:"false"
 },API+"/ready","real Nest AppModule");
 await startRelay();
 const cwd=resolve(ROOT,"apps/shareholder");
 await launch([resolve(cwd,"node_modules/next/dist/bin/next"),"start","-p","32982"],cwd,{
  NODE_ENV:"test",CI:"true",TTO_LOOPBACK_E2E:"1",TTO_API_BASE_URL:RELAY,
  PORT:"32982",NEXT_TELEMETRY_DISABLED:"1",APIIR_TOKEN:""
 },APP+"/","real Next production-build route");
}
async function one(label,fn){
 await fn();cases++;console.log("PASS W1_REAL_ROUTE "+String(cases).padStart(2,"0")+" "+label);
}
function syntheticPEP(operation,patch={}){
 const base={
  environment:"SIMULATION",session:"ACTIVE",tenantMatch:true,partyBound:true,
  membershipSourceApproved:true,featureEnabled:true,permission:true,
  sourceApproved:true,sourceStatus:"APPROVED",sourceFresh:true,
  sourceVersion:"SYNTHETIC-V1",selfResource:true,classificationAllowed:true,
  downloadPermission:false,exportPermission:false,writePermission:false,
  reauth:false,csrf:false,idempotency:null,versionMatched:true,
  ruleSnapshot:null,paymentState:"NONE",ownershipFinalizationApproved:false
 };
 const proc=spawnSync("python3",["-m","scripts.security.w1_isolated_http_bridge"],{
  cwd:ROOT,input:JSON.stringify({operation,context:{...base,...patch}}),
  encoding:"utf8",timeout:4500,maxBuffer:8192,
  env:{PATH:process.env.PATH??"/usr/bin:/bin",PYTHONDONTWRITEBYTECODE:"1"}
 });
 if(proc.error||proc.status!==0)throw Error("W1_SHADOW_PEP_UNAVAILABLE");
 const v=JSON.parse(proc.stdout);
 ok(v.canGrantPermission===false&&v.legalOperationalEffect==="NONE"&&
    v.hasActualRecord===false,"PEP has no operational authority");
 eq(v.auditCount,1,"PEP synthetic audit recorded");
 ok(typeof v.requestId==="string"&&v.requestId.length===36,"PEP tracking ID");
 return v;
}
async function run(){
 await init();
 await one("anonymous blocked by actual Next before any Nest contact",async()=>{
  for(const domain of ["member-record","shareholding","trade-requests","notices"]){
   const before=requests.length;
   const r=await jsonCall(APP,path(A,domain),null);
   denied(r,401,domain+" anonymous");
   eq(requests.length,before,"zero Nest calls without cookie");
  }
  const before=requests.length;
  denied(await jsonCall(APP,"/api/tenants/"+A+"/context",null),401,"context anonymous");
  eq(requests.length,before,"context anonymous no Nest");
 });
 console.log("TTO_W1_REAL_BFF_ANONYMOUS_NO_NEST_CONTACT=PASS");
 await one("malformed tenant and forged identity headers rejected at Next",async()=>{
  for(const suffix of ["context","me/member-record","me/shareholding","me/trade-requests"]){
   const before=requests.length;
   denied(await jsonCall(APP,"/api/tenants/not-a-uuid/"+suffix,null),400,"malformed tenant");
   eq(requests.length,before,"invalid tenant preflight no Nest");
  }
  const before=requests.length;
  const forged=await jsonCall(APP,path(A,"member-record"),null,{headers:{
   Authorization:"Bearer "+TOKEN_A,"X-Role":"PLATFORM_ADMIN","X-Tenant-Id":A,
   "X-Party-Id":PARTY_A,"X-Source-Approved":"true"
  }});
  denied(forged,401,"forged browser headers");
  eq(requests.length,before,"browser headers do not traverse Next boundary");
 });
 await one("real BFF and Nest authorize only tenant context of active synthetic session",async()=>{
  for(const [token,own,other] of [[TOKEN_A,A,B],[TOKEN_B,B,A]]){
   const valid=await jsonCall(APP,"/api/tenants/"+own+"/context",token);
   eq(valid.status,200,"own active tenant context");
   eq(valid.body,{tenantContextVerified:true,tenantId:own},"scoped whitelisted result");
   ok((valid.headers.get("cache-control")??"").includes("no-store"),"no-store own scope");
   const rejected=await jsonCall(APP,"/api/tenants/"+other+"/context",token);
   denied(rejected,403,"cross tenant context");
   eq(rejected.body.code,"TENANT_ACCESS_DENIED","generic non-enumerating denial");
  }
 });
 await one("unapproved synthetic source snapshots never disclosed by real read routes",async()=>{
  for(const [token,tenant] of [[TOKEN_A,A],[TOKEN_B,B]]){
   for(const domain of ["member-record","shareholding"]){
    const r=await jsonCall(APP,path(tenant,domain),token);
    denied(r,403,"unapproved "+domain);
    eq(r.body,{available:false,code:"SOURCE_OR_PERMISSION_NOT_APPROVED"},
     "source approval blocked despite existing sealed snapshot");
   }
  }
  eq((await counts()).approvals,0,"no approvals accidentally issued");
 });
 await one("cross-tenant source and ownership reads remain denied",async()=>{
  for(const [token,other] of [[TOKEN_A,B],[TOKEN_B,A]]){
   for(const domain of ["member-record","shareholding"]){
    const r=await jsonCall(APP,path(other,domain),token);
    denied(r,403,"cross-tenant "+domain);
    eq(r.body.available,false,"never grants other tenant resource");
   }
  }
  // Valid cookie, but browser requests an unrelated owner via forged headers.
  // The existing /me route has no owner selector: never trust X-Party/Owner.
  for(const domain of ["member-record","shareholding"]){
   const before=requests.length;
   const r=await jsonCall(APP,path(A,domain),TOKEN_A,{headers:{
    "X-Tenant-Id":B,"X-Party-Id":PARTY_B,"X-Owner-Id":USER_B,
    "X-Role":"PLATFORM_ADMIN","X-Source-Approved":"true"
   }});
   denied(r,403,"valid session cannot select other owner via headers");
   eq(r.body.available,false,"forged same-route ownership ignored");
   ok(requests.length===before+1,"only actual scoped Nest resource call occurs");
  }
 });
 await one("trade and notice routes cannot be unlocked by valid session or source claims",async()=>{
  for(const domain of ["trade-requests","notices"]){
   const start=requests.length;
   const r=await jsonCall(APP,path(A,domain),TOKEN_A,{headers:{
    "X-Role":"PLATFORM_ADMIN","X-Source-Approved":"true","X-Party-Id":PARTY_A
   }});
   denied(r,403,"independent "+domain);
   eq(r.body.code,"SOURCE_OR_PERMISSION_NOT_APPROVED","source policy still denied");
   const paths=proxyRequestsFrom(start).map(x=>x.path);
   ok(paths.includes("/v1/tenants/"+A+"/context"),
      "BFF checks real Nest tenant context for "+domain);
   ok(!paths.some(p=>p.includes("/me/"+domain)),
      "BFF never accesses unapproved "+domain+" resource");
  }
 });
 console.log("TTO_W1_REAL_TRADE_NOTICE_NO_SOURCE_ADAPTER=PASS");
 await one("mutating trade requests cannot reach real Nest from browser",async()=>{
  for(const domain of ["trade-requests","member-record","shareholding","notices"]){
   const before=requests.length;
   const r=await jsonCall(APP,path(A,domain),TOKEN_A,{method:"POST"});
   eq(r.status,405,"Next method whitelist blocks POST "+domain);
   eq(requests.length,before,"no Nest forwarded POST "+domain);
  }
 });
 console.log("TTO_W1_REAL_TRADE_MUTATION_DISABLED=PASS");
 await one("direct actual Nest API independently verifies session, tenant and source",async()=>{
  for(const domain of ["member-record","shareholding","trade-requests","notices"]){
   const resource=nestPath(A,domain);
   const anon=await jsonCall(API,resource,null);
   eq(anon.status,401,"direct Nest denies anonymous "+domain);
   const own=await jsonCall(API,resource,TOKEN_A);
   eq(own.status,403,"direct Nest denies unapproved own "+domain);
  }
  const other=await jsonCall(API,"/v1/tenants/"+B+"/context",TOKEN_A);
  eq(other.status,403,"direct Nest cross tenant denied");
  const forbiddenPost=await jsonCall(API,nestPath(A,"trade-requests"),TOKEN_A,{method:"POST"});
  ok(forbiddenPost.status===404||forbiddenPost.status===405,
   "direct Nest trade POST has no handler");
 });
 await one("a revoked actual PG session cannot access real Next or Nest reads",async()=>{
  const hash=createHash("sha256").update(TOKEN_A).digest();
  const revoked=await db.query(
   "UPDATE tto.user_sessions SET revoked_at=clock_timestamp() WHERE session_hash=$1 AND revoked_at IS NULL RETURNING session_id",
   [hash]);
  eq(revoked.rowCount,1,"real disposable PG session revoked");
  for(const domain of ["member-record","shareholding","trade-requests","notices"]){
   const r=await jsonCall(APP,path(A,domain),TOKEN_A);
   denied(r,401,"revoked "+domain);
  }
  const api=await jsonCall(API,nestPath(A,"member-record"),TOKEN_A);
  eq(api.status,401,"direct Nest revoked bearer");
 });
 await one("independent PEP/PDP shadow refuses cross-tenant, owner and operations",async()=>{
  for(const [operation,patch] of [
   ["read",{tenantMatch:false}],["read",{selfResource:false}],
   ["read",{session:"REVOKED"}],["read",{sourceApproved:false}],
   ["read",{partyBound:false}],["download",{}],["export",{}],
   ["write",{}],["trade",{}],["finalize",{}]
  ]){
   const v=syntheticPEP(operation,patch);
   eq(v.decision,"DENY","shadow "+operation+" denied");
   eq(v.fixtureTouches,0,"shadow denial before synthetic fixture");
  }
  const candidate=syntheticPEP("read");
  eq(candidate.decision,"SIMULATED_ALLOW","shadow positive stays simulated");
  eq(candidate.fixtureTouches,1,"shadow positive uses only fake fixture");
  ok(candidate.canGrantPermission===false&&candidate.hasActualRecord===false,
     "shadow allow cannot authorize real service");
 });
 console.log("TTO_W1_SHADOW_PEP_PDP_NO_OPERATIONAL_ALLOW=PASS");
 await one("disposable legal-source and immutable source snapshots remain unchanged",async()=>{
  eq(await counts(),{member:2,holding:2,approvals:0,batches:0},
   "no legal source approvals, imports, asset transfers or snapshot mutation");
  ok(requests.length>0,"actual Next BFF has used real Nest HTTP API");
  ok(requests.every(x=>x.method==="GET"&&x.path.startsWith("/v1/tenants/")),
     "relay observed only scoped read/context requests");
 });
 eq(cases,11,"W1 actual-route case total");
 console.log("TTO_W1_REAL_NEXT_NEST_PG17_CASES="+cases+"/11");
 console.log("TTO_W1_REAL_NEXT_NEST_PG17_CHECKS="+checks);
 console.log("TTO_W1_REAL_NEXT_NEST_PG17_ROUTES=PASS");
 console.log("TTO_W1_REAL_SOURCE_DISCLOSURE=ZERO");
 console.log("TTO_W1_REAL_SOURCE_APPROVALS=ZERO");
 console.log("TTO_W1_REAL_LIVE_OPERATIONS=BLOCKED");
 console.log("TTO_W1_NO_MERGE_NO_DEPLOY=PASS");
}
run().catch(e=>{
 // Report only assertion description, no request tokens, evidence or database values.
 const diagnostic=String(e?.message??e).replace(/[A-Za-z0-9_-]{45,}/g,"[REDACTED]");
 console.error("TTO_W1_REAL_NEXT_NEST_PG17=FAILED; reason="+diagnostic.slice(0,180));
 process.exitCode=1;
}).finally(async()=>{
 for(const child of appChildren){
  if(child.exitCode===null)child.kill("SIGTERM");
 }
 if(relay)await new Promise(done=>relay.close(done)).catch(()=>{});
 if(dbConnected)await db.end().catch(()=>{});
});
