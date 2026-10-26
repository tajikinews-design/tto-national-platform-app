"use strict";
/**
 * Phase 4C real-transport E2E: Chromium -> Next.js BFF -> NestJS ->
 * DISPOSABLE PostgreSQL 17. Real (synthetic seeded) PG sessions, NO mocked HTTP.
 * Never run against an external DB, SMS service, real user or production.
 */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {randomUUID,randomBytes,createHash}=require("node:crypto");
const {resolve}=require("node:path");
const {createRequire}=require("node:module");
const {chromium}=require("playwright");
const ROOT=resolve(__dirname,"..");
const {Client}=createRequire(resolve(ROOT,"services/api/package.json"))("pg");
const DB_URL=process.env.TEST_ADMIN_DATABASE_URL;
const SOURCE_SHA=process.env.TTO_PHASE4C_EXPECTED_SOURCE_SHA??"UNSET";
if(!/^postgresql:\/\/postgres@127\.0\.0\.1:5432\/tto$/.test(DB_URL??""))
 throw Error("PHASE4C_DISPOSABLE_LOCAL_POSTGRES_ONLY");
if(process.env.APIIR_TOKEN||process.env.VERCEL||process.env.TTO_API_BASE_URL)
 throw Error("PHASE4C_EXTERNAL_SERVICE_ENV_FORBIDDEN");
const DB=new Client({connectionString:DB_URL});
const API="http://127.0.0.1:32971";
const APP="http://127.0.0.1:32972";
const TENANT=randomUUID(),OTHER=randomUUID(),USER=randomUUID(),PARTY=randomUUID();
const running=[],results=[],checks=[];
let browser=null;
function ok(value,label){assert.ok(value,label);checks.push(label);}
function eq(actual,expected,label){assert.deepEqual(actual,expected,label);checks.push(label);}
async function ready(url,child,label){
 for(let i=0;i<120;i++){
  if(child.exitCode!==null)throw Error(label+" exited before ready");
  try{const x=await fetch(url,{signal:AbortSignal.timeout(1300)});if(x.ok)return;}
  catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 throw Error(label+" readiness deadline");
}
function spawnNode(args,cwd,env){
 const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:"ignore"});
 running.push(child);child.on("error",()=>{});
 return child;
}
async function http(path,cookie,method="GET"){
 return fetch(APP+path,{method,redirect:"manual",cache:"no-store",
  headers:cookie?{Cookie:"tto_session="+cookie}:undefined,
  signal:AbortSignal.timeout(9500)});
}
async function assertJson(path,cookie,status,body,label){
 const r=await http(path,cookie);
 eq(r.status,status,label+" status");
 eq(await r.json(),body,label+" body");
 ok(/no-store/i.test(r.headers.get("cache-control")??""),label+" no-store");
 return r;
}
async function provision(){
 await DB.connect();
 const server=await DB.query("SELECT current_database() AS db, current_user AS actor");
 eq(server.rows[0].db,"tto","local db identity");
 eq(server.rows[0].actor,"postgres","test fixture admin identity");
 await DB.query("ALTER ROLE tto_app LOGIN");
 await DB.query("INSERT INTO tto.user_accounts(user_id) VALUES($1)",[USER]);
 await DB.query("INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES($1,$2,'Phase4C Fixture Coop','ACTIVE'),($3,$4,'Out Of Scope Coop','ACTIVE')",
 [TENANT,"p4c-"+TENANT.slice(0,8),OTHER,"p4c-"+OTHER.slice(0,8)]);
 await DB.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'MEMBER')",
 [randomUUID(),USER,TENANT]);
 await DB.query("INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES($1,'PERSON','Phase4C Synthetic Only')",[PARTY]);
 await DB.query("INSERT INTO tto.user_party_links(user_id,party_id,verified_at) VALUES($1,$2,now())",[USER,PARTY]);
 await DB.query("INSERT INTO tto.relationship_projections(tenant_id,party_id,membership_status,source_event_id) VALUES($1,$2,'ACTIVE',$3)",
 [TENANT,PARTY,randomUUID()]);
 const nest=spawnNode(["dist/main.js"],resolve(ROOT,"services/api"),{
  DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto",PORT:"32971",
  NODE_ENV:"test",APIIR_TOKEN:"",TTO_MOCK_SMSOTP_PROVIDER:"false",
  AUTH_CHALLENGE_HMAC_SECRET:"phase4c-test-only-32-character-aaaaaaaaaaa",
  AUTH_ABUSE_HMAC_SECRET:"phase4c-test-only-other-32-char-bbbbbbbb"
 });
 await ready(API+"/ready",nest,"Nest PG17");
 const cwd=resolve(ROOT,"apps/shareholder");
 const next=spawnNode([resolve(cwd,"node_modules/next/dist/bin/next"),"start","-p","32972"],cwd,{
  NODE_ENV:"test",CI:"true",TTO_LOOPBACK_E2E:"1",TTO_API_BASE_URL:API,
  NEXT_TELEMETRY_DISABLED:"1",PORT:"32972",APIIR_TOKEN:""
 });
 await ready(APP+"/",next,"Next shareholder BFF");
 const anonymous=await assertJson("/api/auth/session",null,200,{authenticated:false},"anonymous");
 ok(!anonymous.headers.get("set-cookie"),"anonymous check does not issue session");
 const initial=await http("/modules/nav-04",null);
 eq(initial.status,200,"protected shell returns safe page without auth");
 const initialHtml=await initial.text();
 ok(!initialHtml.includes("Phase4C Synthetic Only"),"no owner PII in SSR");
}
async function newSession(){
 const token=randomBytes(48).toString("base64url");
 const digest=createHash("sha256").update(token).digest();
 const sessionId=randomUUID();
 const actor=await DB.query("SELECT security_epoch FROM tto.user_accounts WHERE user_id=$1",[USER]);
 eq(actor.rowCount,1,"synthetic actor exists");
 await DB.query("INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '15 minutes')",
 [sessionId,USER,digest,actor.rows[0].security_epoch]);
 return {token,sessionId};
}
async function freshPage(session){
 const context=await browser.newContext({viewport:{width:390,height:844},locale:"fa-IR",reducedMotion:"reduce"});
 await context.addCookies([{name:"tto_session",value:session.token,url:APP,httpOnly:true,secure:true,sameSite:"Lax"}]);
 const cookieCheck=await context.cookies(APP);
 ok(cookieCheck.some(c=>c.name==="tto_session"&&c.value===session.token&&c.httpOnly&&c.secure),
  "browser accepted secure HttpOnly loopback fixture cookie");
 const page=await context.newPage();
 const consoleErrors=[];
 page.on("pageerror",e=>consoleErrors.push(e.message));
 await page.goto(APP+"/modules/nav-04",{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator("section.sw").waitFor({state:"visible",timeout:20000});
 ok(consoleErrors.length===0,"hydration and runtime have no JS errors");
 await page.locator("#sw-tenant").waitFor({state:"visible",timeout:15000});
 await page.locator("#sw-tenant option[value='"+TENANT+"']").waitFor({state:"attached",timeout:15000});
 ok(await page.locator("section.sw").count()===1,"real authenticated workspace mounted");
 return {context,page};
}
async function exercise(name,fn){
 const before=checks.length;
 try{await fn();results.push({name,pass:true,checks:checks.length-before});console.log("PASS "+name);}
 catch(err){results.push({name,pass:false,error:String(err?.message??err)});console.error("FAIL "+name+": "+String(err?.message??err));}
}
async function locked(page,label){
 await page.locator("section.sw").waitFor({state:"detached",timeout:15000});
 ok(await page.locator("section.sw").count()===0,label+" private React state unmounted");
 await page.locator("#tto-mobile").waitFor({state:"attached",timeout:15000});
 ok(await page.locator(".sw-confirmed").count()===0,label+" no private confirmed card");
}
async function checkLiveTenant(token,label){
 const url="/api/tenants/"+TENANT+"/context";
 await assertJson("/api/auth/session",token,200,{authenticated:true},label+" session live");
 await assertJson(url,token,200,{tenantContextVerified:true,tenantId:TENANT},label+" scope live");
 await assertJson("/api/tenants/"+OTHER+"/context",token,403,{tenantContextVerified:false,code:"TENANT_ACCESS_DENIED"},label+" tenant B denied");
 const r=await http("/api/me/tenant-options",token);
 eq(r.status,200,label+" discovery live");
 const data=await r.json();
 ok(Array.isArray(data.items)&&data.items.length===1&&data.items[0].tenantId===TENANT,label+" only own tenant");
 ok(!JSON.stringify(data).includes(token),label+" no token in discovery");
}
async function checkDead(token,label){
 await assertJson("/api/auth/session",token,200,{authenticated:false},label+" session invalid");
 const ctx=await http("/api/tenants/"+TENANT+"/context",token);
 eq(ctx.status,401,label+" tenant context blocked");
 eq((await ctx.json()).code,"SESSION_REQUIRED",label+" context generic 401");
 const discovery=await http("/api/me/tenant-options",token);
 eq(discovery.status,401,label+" discovery blocked");
 const membership=await http("/api/tenants/"+TENANT+"/me/member-record",token);
 eq(membership.status,401,label+" membership blocked");
 const shares=await http("/api/tenants/"+TENANT+"/me/shareholding",token);
 eq(shares.status,401,label+" shareholding blocked");
 for(const domain of ["trade-requests","notices"]){
  const source=await http("/api/tenants/"+TENANT+"/me/"+domain,token);
  eq(source.status,401,label+" "+domain+" blocked");
 }
 const direct=await fetch(API+"/v1/auth/session",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
 eq(direct.status,401,label+" Nest rejects revoked bearer");
}
async function go(){
 await provision();
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 await exercise("real-out-of-band-revocation",async()=>{
  const s=await newSession();
  await checkLiveTenant(s.token,"revocation baseline");
  const {context,page}=await freshPage(s);
  try{
   await page.locator("#sw-tenant").selectOption(TENANT);
   await page.getByRole("button",{name:"تأیید محدوده و استعلام"}).click();
   await page.locator(".sw-scope-ok").waitFor({state:"visible",timeout:12000});
   const change=await DB.query("UPDATE tto.user_sessions SET revoked_at=clock_timestamp() WHERE session_id=$1 AND revoked_at IS NULL RETURNING session_id",[s.sessionId]);
   eq(change.rowCount,1,"server session remotely revoked once");
   // Independent BFF must reject stale cookie before prompting browser focus.
   await checkDead(s.token,"revoked");
   await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
   await locked(page,"remote revocation");
   const cookies=await context.cookies(APP);
   ok(!cookies.some(c=>c.name==="tto_session"&&c.value===s.token),"revoked cookie cleared by BFF");
  }finally{await context.close();}
 });
 await exercise("real-database-expiration",async()=>{
  const s=await newSession();
  await checkLiveTenant(s.token,"expiry baseline");
  const {context,page}=await freshPage(s);
  try{
   const expire=await DB.query("UPDATE tto.user_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE session_id=$1 RETURNING session_id",[s.sessionId]);
   eq(expire.rowCount,1,"session expired in actual PG17");
   await checkDead(s.token,"expired");
   await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
   await locked(page,"expired");
  }finally{await context.close();}
 });
 await exercise("security-epoch-revocation",async()=>{
  const s=await newSession();
  await checkLiveTenant(s.token,"epoch baseline");
  const {context,page}=await freshPage(s);
  try{
   const before=await DB.query("SELECT security_epoch FROM tto.user_accounts WHERE user_id=$1",[USER]);
   const bump=await DB.query("UPDATE tto.user_accounts SET security_epoch=security_epoch+1 WHERE user_id=$1 RETURNING security_epoch",[USER]);
   ok(BigInt(bump.rows[0].security_epoch)===BigInt(before.rows[0].security_epoch)+1n,"PG actor epoch changed");
   await checkDead(s.token,"security epoch");
   await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
   await locked(page,"security epoch");
  }finally{await context.close();}
 });
 await exercise("real-session-logout-through-BFF",async()=>{
  const s=await newSession();
  await checkLiveTenant(s.token,"logout baseline");
  const {context,page}=await freshPage(s);
  try{
   await page.getByRole("button",{name:"خروج از حساب"}).click();
   await locked(page,"logout");
   await checkDead(s.token,"logout");
   const dbstate=await DB.query("SELECT revoked_at IS NOT NULL AS revoked FROM tto.user_sessions WHERE session_id=$1",[s.sessionId]);
   ok(dbstate.rows[0]?.revoked===true,"server PG session actually marked revoked");
  }finally{await context.close();}
 });
 const passed=results.filter(r=>r.pass).length;
 const summary={
  suite:"TTO_PHASE4C_REAL_BROWSER_NEXT_NEST_PG17",
  sourceSha:SOURCE_SHA,
  realNextNestPostgres:true,
  browserNetworkMocking:false,
  syntheticActorsOnly:true,
  realOtpProviderUsed:false,
  realSourcesApproved:false,
  casesExecuted:results.length,casesPassed:passed,checksPassed:checks.length,
  pass:results.length===4&&passed===4,
  cases:results
 };
 console.log("TTO_PHASE4C_REAL_BROWSER_CASES="+passed+"/"+results.length);
 console.log("TTO_PHASE4C_REAL_BROWSER_CHECKS="+checks.length);
 console.log("TTO_PHASE4C_REAL_BROWSER_FAILURES="+(results.length-passed));
 console.log("TTO_PHASE4C_REAL_BROWSER_REPORT="+JSON.stringify(summary));
 if(summary.pass)console.log("TTO_PHASE4C_REAL_NEXT_NEST_PG17_BROWSER_PASS_SHA="+SOURCE_SHA);
 else process.exitCode=1;
}
go().catch(e=>{console.error("PHASE4C_INFRA_FAILURE="+String(e?.message??e));process.exitCode=1;})
.finally(async()=>{
 if(browser)await browser.close().catch(()=>{});
 for(const child of running)if(child.exitCode===null)child.kill("SIGTERM");
 await DB.end().catch(()=>{});
});
