"use strict";
/**
 * Real HTTP E2E: each Next.js BFF -> NestJS -> ephemeral PostgreSQL 17.
 * No external SMS, no real people, no Production. No credentials printed.
 */
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { resolve } = require("node:path");
const { createRequire } = require("node:module");
const ROOT = resolve(__dirname,"..");
const { Client } = createRequire(resolve(ROOT,"services/api/package.json"))("pg");
const ADMIN_DB = process.env.TEST_ADMIN_DATABASE_URL;
if(!ADMIN_DB) throw Error("EPHEMERAL_POSTGRES_REQUIRED");
if(process.env.APIIR_TOKEN) throw Error("REAL_SMS_SECRET_MUST_NOT_BE_IN_TEST_ENV");
const db = new Client({connectionString:ADMIN_DB});
const NEXT = ["shareholder","cooperative-management","national-admin"];
const MOBILE = "09123456789"; // synthetic CI-only fixture, no actual delivery
const OTP = "111222"; // existing NODE_ENV=test mock code
const ALLOWED_TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const BACKEND_PORT = 31994;
const API = "http://127.0.0.1:" + BACKEND_PORT;
const running=[];
let checks=0;
function assertStatus(result,expected,what) { assert.equal(result.status,expected,what+" returned "+result.status);checks++; }
async function untilReady(url,proc,label) {
  for(let i=0;i<120;i++){
    if(proc.exitCode!==null)throw Error(label+" exited before readiness");
    try {const r=await fetch(url,{signal:AbortSignal.timeout(1000)}); if(r.ok)return;}
    catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  throw Error(label+" never became ready");
}
function startNode(args,cwd,env) {
 const proc=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:"ignore"});
 running.push(proc);
 proc.on("error",()=>{});
 return proc;
}
async function post(url,payload,opts={}) {
 const headers={...(payload?{"Content-Type":"application/json"}:{}),...(opts.headers??{})};
 return fetch(url,{method:"POST",headers,body:payload?JSON.stringify(payload):undefined,redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(9500)});
}
async function setup(){
 await db.connect();
 await db.query("ALTER ROLE tto_app LOGIN");
 await db.query("INSERT INTO tto.auth_policy(policy_key,max_attempts,session_ttl_minutes) VALUES('SESSION_CHALLENGE',3,15) ON CONFLICT(policy_key) DO NOTHING");
 const userId=randomUUID();
 await db.query("INSERT INTO tto.user_accounts(user_id) VALUES($1)",[userId]);
 await db.query("INSERT INTO tto.verified_mobile_identifiers(mobile,user_id,verified_at) VALUES($1,$2,now())",[MOBILE,userId]);
 // Disposable fixtures only: real CF02 RLS resolves a scoped active role.
 await db.query("INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES($1,$2,$3,'ACTIVE'),($4,$5,$6,'ACTIVE')",
  [ALLOWED_TENANT,"ci-allowed","CI Allowed",OTHER_TENANT,"ci-other","CI Other"]);
 await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'MEMBER')",
  [randomUUID(),userId,ALLOWED_TENANT]);
 const nest=startNode(["dist/main.js"],resolve(ROOT,"services/api"),{
  DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto", PORT:String(BACKEND_PORT),
  NODE_ENV:"test", TTO_MOCK_SMSOTP_PROVIDER:"true", APIIR_TOKEN:"",
  AUTH_CHALLENGE_HMAC_SECRET:"ci-fake-pepper-32chars-aaaaaaaaaaaaaaaaaa",
  AUTH_ABUSE_HMAC_SECRET:"ci-dedicated-abuse-pepper-32-characters-abcdef",
  TTO_ENFORCE_ABUSE_GUARD:"true"
 });
 await untilReady(API+"/ready",nest,"Nest");
}
async function checkPortal(slug,index) {
 const cwd=resolve(ROOT,"apps",slug),port=32300+index,url="http://127.0.0.1:"+port;
 const next=startNode([resolve(cwd,"node_modules/next/dist/bin/next"),"start","-p",String(port)],cwd,{
  NODE_ENV:"test", TTO_API_BASE_URL:API, TTO_LOOPBACK_E2E:"1", CI:"true", NEXT_TELEMETRY_DISABLED:"1",PORT:String(port),
  APIIR_TOKEN:"",TTO_MOCK_SMSOTP_PROVIDER:""
 });
 await untilReady(url+"/",next,"Next "+slug);
 const homepage=await fetch(url+"/");
 const html=await homepage.text();
 assert.ok(html.includes('در حال بررسی نشست ورود'),slug+" session restoration SSR shell must be visible");checks++;
 assert.ok(!html.includes("در این نسخه پیش‌نمایش، پایگاه داده"),slug+" still claims backend unavailable");checks++;

 const initial=await fetch(url+"/api/auth/session",{cache:"no-store"});
 assertStatus(initial,200,slug+" anonymous session status");
 assert.deepEqual(await initial.json(),{authenticated:false});checks++;
 assert.match(initial.headers.get("cache-control")??"",/no-store/);checks++;

 const malformed=await fetch(url+"/api/auth/session",{headers:{Cookie:"tto_session=invalid"},cache:"no-store"});
 assertStatus(malformed,200,slug+" malformed-cookie session denial");
 assert.deepEqual(await malformed.json(),{authenticated:false});checks++;
 assert.match(malformed.headers.get("set-cookie")??"",/max-age=0/i);checks++;

 const noSession=await post(url+"/api/auth/logout");
 assertStatus(noSession,204,slug+" anonymous logout");

 const issued=await post(url+"/api/auth/otp/request",{mobile:MOBILE});
 if(issued.status!==200){const safeCode=(await issued.clone().json().catch(()=>({}))).error;console.error("CF01_E2E_OTP_REQUEST_FAIL_CODE="+(typeof safeCode==="string"?safeCode:"UNCLASSIFIED"));}
 assertStatus(issued,200,slug+" OTP request");
 const {requestId,status}=await issued.json();
 assert.match(requestId,/^[a-f0-9-]{36}$/i);checks++;
 assert.equal(status,"ACCEPTED");checks++;
 const bad=await post(url+"/api/auth/otp/verify",{challengeId:requestId,otp:"999999"});
 assertStatus(bad,401,slug+" incorrect OTP");
 assert.ok(!bad.headers.get("set-cookie"),slug+" bad code set session cookie");checks++;

 const verified=await post(url+"/api/auth/otp/verify",{challengeId:requestId,otp:OTP});
 assertStatus(verified,200,slug+" confirmed OTP");
 assert.deepEqual(await verified.json(),{verified:true});checks++;
 const cookie=verified.headers.get("set-cookie")??"";
 assert.match(cookie,/^tto_session=[A-Za-z0-9_-]{32,256};/);checks++;
 assert.match(cookie,/httponly/i);checks++;
 assert.match(cookie,/secure/i);checks++;
 assert.match(cookie,/samesite=lax/i);checks++;
 const token=/^tto_session=([A-Za-z0-9_-]+)/.exec(cookie)?.[1];
 assert.ok(token);checks++;
 const browserSession=await fetch(url+"/api/auth/session",{headers:{Cookie:"tto_session="+token},cache:"no-store"});
 assertStatus(browserSession,200,slug+" post-verify session restore");
 const sessionPayload=await browserSession.json();
 assert.deepEqual(sessionPayload,{authenticated:true});checks++;
 assert.ok(!(JSON.stringify(sessionPayload)).includes(token),slug+" must not leak bearer");checks++;
 assert.match(browserSession.headers.get("cache-control")??"",/no-store/);checks++;


 // Browser Authorization and forged role headers cannot substitute the HttpOnly session.
 const allowedUrl=url+"/api/tenants/"+ALLOWED_TENANT+"/context";
 const anonymousContext=await fetch(allowedUrl,{headers:{Authorization:"Bearer "+token,"X-Role":"COOPERATIVE_MANAGER"}});
 assertStatus(anonymousContext,401,slug+" tenant gate forged bearer blocked");
 assert.deepEqual(await anonymousContext.json(),{tenantContextVerified:false,code:"SESSION_REQUIRED"});checks++;
 const malformedContext=await fetch(url+"/api/tenants/not-a-uuid/context",{headers:{Cookie:"tto_session="+token}});
 assertStatus(malformedContext,400,slug+" malformed tenant ID blocked");
 const authorizedContext=await fetch(allowedUrl,{headers:{Cookie:"tto_session="+token}});
 assertStatus(authorizedContext,200,slug+" verified same-tenant read-only context");
 const authPayload=await authorizedContext.json();
 assert.deepEqual(authPayload,{tenantContextVerified:true,tenantId:ALLOWED_TENANT});checks++;
 assert.match(authorizedContext.headers.get("cache-control")??"",/no-store/);checks++;
 assert.ok(!JSON.stringify(authPayload).includes(token),slug+" tenant gate leaked credential");checks++;
 const crossContext=await fetch(url+"/api/tenants/"+OTHER_TENANT+"/context",{headers:{Cookie:"tto_session="+token}});
 assertStatus(crossContext,403,slug+" cross-tenant access blocked by RLS");
 assert.deepEqual(await crossContext.json(),{tenantContextVerified:false,code:"TENANT_ACCESS_DENIED"});checks++;
 const backendSession=await fetch(API+"/v1/auth/session",{headers:{Authorization:"Bearer "+token}});
 assertStatus(backendSession,200,slug+" direct Nest PG17 validation");
 assert.deepEqual(await backendSession.json(),{authenticated:true});checks++;

 const replay=await post(url+"/api/auth/otp/verify",{challengeId:requestId,otp:OTP});
 assertStatus(replay,401,slug+" replay rejection");

 const crossSite=await post(url+"/api/auth/logout",null,{headers:{Cookie:"tto_session="+token,Origin:"https://evil.invalid"}});
 assertStatus(crossSite,403,slug+" cross-site origin rejection");

 const logout=await post(url+"/api/auth/logout",null,{headers:{Cookie:"tto_session="+token,Origin:url}});
 assertStatus(logout,204,slug+" logout through BFF to Nest");
 const expiry=logout.headers.get("set-cookie")??"";
 assert.match(expiry,/^tto_session=;/);checks++;
 assert.match(expiry,/max-age=0/i);checks++;
 assert.match(expiry,/httponly/i);checks++;
 assert.match(expiry,/secure/i);checks++;

 const stale=await fetch(url+"/api/auth/session",{headers:{Cookie:"tto_session="+token},cache:"no-store"});
 assertStatus(stale,200,slug+" revoked-cookie session denial");
 assert.deepEqual(await stale.json(),{authenticated:false});checks++;
 assert.match(stale.headers.get("set-cookie")??"",/max-age=0/i);checks++;

 const revokedContext=await fetch(allowedUrl,{headers:{Cookie:"tto_session="+token}});
 assertStatus(revokedContext,401,slug+" revoked session denied for tenant context");
 const revoked=await post(API+"/v1/auth/logout",null,{headers:{Authorization:"Bearer "+token}});
 assertStatus(revoked,401,slug+" revoked bearer replay rejected by Nest/PG17");
 console.log("CF01_THREE_PORTAL_E2E_"+slug.toUpperCase().replace(/-/g,"_")+"_PASS");
 next.kill("SIGTERM");
 await new Promise(r=>setTimeout(r,350));
}
async function main() {
 await setup();
 for(let i=0;i<NEXT.length;i++)await checkPortal(NEXT[i],i);
 // Unknown/enrolled mobiles return indistinguishable status; XFF cannot bypass request.ip.
 const unknown="09110000000";
 for(let n=0;n<4;n++){
  const response=await post(API+"/v1/auth/challenges/request",{mobile:unknown},{
   headers:{"X-Forwarded-For":"198.51.100."+String(n+20)}
  });
  assertStatus(response,202,"unknown mobile capacity/response");
  const body=await response.json();
  assert.equal(body.status,"ACCEPTED");checks++;
 }
 let events=await db.query("SELECT count(*)::integer AS n FROM tto.otp_request_throttle_events");
 assert.equal(events.rows[0].n,6,"only 3 known plus 3 unknown requests reserved");checks++;
 // Concurrency cannot bypass 30 source-IP/15m even with forged forwarded addresses.
 const concurrent=await Promise.all(Array.from({length:40},(_,n)=>
   post(API+"/v1/auth/challenges/request",{mobile:"0911"+String(n+1).padStart(7,"0")},{
      headers:{"X-Forwarded-For":"203.0.113."+String(n+1)}
   })
 ));
 for(const response of concurrent){
  assertStatus(response,202,"parallel synthetic attempt generic response");
  const body=await response.json();
  assert.equal(body.status,"ACCEPTED");checks++;
 }
 events=await db.query("SELECT count(*)::integer AS n, count(*) FILTER (WHERE octet_length(ip_digest)=32 AND octet_length(mobile_digest)=32)::integer AS hashed FROM tto.otp_request_throttle_events");
 assert.equal(events.rows[0].n,30,"cross-mobile source-IP concurrency cap");checks++;
 assert.equal(events.rows[0].hashed,30,"only HMAC digests persisted");checks++;
 const restricted=new Client({connectionString:"postgresql://tto_app@127.0.0.1:5432/tto"});
 await restricted.connect();
 try{
  await assert.rejects(()=>restricted.query("SELECT * FROM tto.otp_request_throttle_events"),error=>error.code==="42501");
  checks++;
 }finally{await restricted.end();}

 const count=await db.query("SELECT count(*)::integer AS n FROM tto.auth_challenges WHERE purpose='SMSOTP_LOGIN'");
 assert.equal(count.rows[0].n,3);checks++;
 console.log("CF01_THREE_PORTAL_NEXT_NEST_PG17_LOGIN_LOGOUT_E2E_PASS_CHECKS="+checks);
 console.log("CF01_TEST_FIXTURE_ONLY_NO_REAL_SMS_NO_PRODUCTION");
}
main().catch(e=>{console.error("CF01_THREE_PORTAL_E2E_FAIL:",e?.message??String(e));process.exitCode=1;})
.finally(async()=>{
 for(const proc of running)if(proc.exitCode===null)proc.kill("SIGTERM");
 await db.end().catch(()=>{});
});
