const {Client}=require("pg");
const {spawn}=require("node:child_process");
const {createHash,createHmac,randomUUID,randomBytes}=require("node:crypto");
const assert=require("node:assert/strict");
const path=require("node:path");
const url=process.env.TEST_ADMIN_DATABASE_URL;
const pepper=process.env.AUTH_CHALLENGE_HMAC_SECRET;
if(!url || !pepper || Buffer.byteLength(pepper)<32) throw Error("TEST_DB_AND_HMAC_REQUIRED");
const admin=new Client({connectionString:url});
const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userA="11111111-1111-4111-8111-111111111111";
const userC="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const reviewer="44444444-4444-4444-8444-444444444444";
const doc="cccc3333-3333-4333-8333-cccccccccccc";
let proc,count=0,syntheticNestErrorLog="";
const key=(token)=>token?{authorization:"Bearer "+token}:{};
const root="http://127.0.0.1:31665";
async function call(method,p,token,body,status){
 const res=await fetch(root+p,{method,headers:{...(body?{"content-type":"application/json"}:{}),...key(token)},body:body?JSON.stringify(body):undefined});
 if(res.status!==status){
   // Isolated synthetic CI only; print Nest diagnostics, never authorization header/OTP.
   const short=syntheticNestErrorLog.slice(-2000).replace(/Bearer\\s+[A-Za-z0-9_-]+/g,"Bearer [MASKED]");
   console.error("TTO_PH04_SYNTHETIC_NEST_STDERR",short);
 }
 assert.equal(res.status,status,method+" "+p+" expected "+status+" actual "+res.status);
 count++;
 return status===204?null:res.json();
}
async function tokenFor(uid){
 const token=randomBytes(48).toString("base64url");
 await admin.query("INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at) VALUES($1,$2,$3,0,now()+interval '5 min')",
 [randomUUID(),uid,createHash("sha256").update(token).digest()]);
 return token;
}
async function main(){
 await admin.connect();
 await admin.query("ALTER ROLE tto_app LOGIN");
 await admin.query("INSERT INTO tto.user_accounts(user_id) VALUES($1)",[reviewer]);
 await admin.query("INSERT INTO tto.verified_mobile_identifiers(mobile,user_id,verified_at) VALUES('09120000001',$1,now())",[userA]);
 await admin.query("INSERT INTO tto.platform_operator_authorizations(user_id,approved_by,evidence_id,expires_at) VALUES($1,$2,$3,now()+interval '1 day')",
 [reviewer,userC,"33333333-3333-4333-8333-333333333331"]);
 const challenge=randomUUID(),otp="73491826";
 await admin.query(
 "INSERT INTO tto.auth_challenges(challenge_id,user_id,purpose,verifier_hash,expires_at) VALUES($1,$2,'LOGIN',$3,now()+interval '5 min')",
 [challenge,userA,createHmac("sha256",pepper).update(challenge+":"+otp).digest()]
 );
 proc=spawn(process.execPath,["dist/main.js"],{cwd:path.resolve(__dirname,".."),
  env:{...process.env,NODE_ENV:"test",TTO_MOCK_SMSOTP_PROVIDER:"true",DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto",PORT:"31665"},stdio:["ignore","pipe","pipe"]});
 for(const stream of [proc.stdout,proc.stderr]){
   stream.on("data",buf=>{syntheticNestErrorLog+=String(buf);
     if(syntheticNestErrorLog.length>12000)syntheticNestErrorLog=syntheticNestErrorLog.slice(-12000);});
 }
 for(let i=0;i<70;i++){try{const res=await fetch(root+"/health");if(res.ok)break;}catch{}
  if(proc.exitCode!==null)throw Error("NEST_API_EXITED");
  await new Promise(r=>setTimeout(r,250));
 }
 await call("POST","/v1/auth/challenges/verify",null,{challengeId:challenge,otp:"00000000"},401);
 const login=await call("POST","/v1/auth/challenges/verify",null,{challengeId:challenge,otp},200);
 assert.equal(typeof login.accessToken,"string");
 await call("POST","/v1/auth/challenges/verify",null,{challengeId:challenge,otp},401);
 console.log("CORE_AUTH_AT005_OTP_REPLAY_SECOND_REJECT_HTTP_PASS");
 const actorToken=login.accessToken;
 // DED.CORE-AUTH-AT-008: expired challenge must not issue a session.
 const expiredChallenge=randomUUID(),expiredOtp="86410327";
 await admin.query(
  "INSERT INTO tto.auth_challenges(challenge_id,user_id,purpose,verifier_hash,expires_at) VALUES($1,$2,'LOGIN',$3,now()-interval '1 second')",
  [expiredChallenge,userA,createHmac("sha256",pepper).update(expiredChallenge+":"+expiredOtp).digest()]
 );
 await call("POST","/v1/auth/challenges/verify",null,{challengeId:expiredChallenge,otp:expiredOtp},401);
 // DED.CORE-AUTH-AT-016: two concurrent verifications -> exactly one success.
 const concurrentChallenge=randomUUID(),concurrentOtp="73816429";
 await admin.query(
  "INSERT INTO tto.auth_challenges(challenge_id,user_id,purpose,verifier_hash,expires_at) VALUES($1,$2,'LOGIN',$3,now()+interval '5 minutes')",
  [concurrentChallenge,userA,createHmac("sha256",pepper).update(concurrentChallenge+":"+concurrentOtp).digest()]
 );
 const parallelVerify=()=>fetch(root+"/v1/auth/challenges/verify",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({challengeId:concurrentChallenge,otp:concurrentOtp})
 });
 const parallelResult=await Promise.all([parallelVerify(),parallelVerify()]);
 assert.deepEqual(parallelResult.map(x=>x.status).sort((x,y)=>x-y),[200,401],
  "DED.CORE-AUTH-AT-016: only one concurrent Verify may succeed");
 count+=2;
 await call("GET","/v1/tenants/"+a+"/context",actorToken,null,200);
 // DED.CORE-AUTH-AT-001: separate tenant roles are independent.
 const tenantBRole=randomUUID();
 await admin.query(
  "INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'DOCUMENT_REVIEWER')",
  [tenantBRole,userA,b]
 );
 await call("GET","/v1/tenants/"+b+"/context",actorToken,null,200);
 // DED-001: tenant-B document-read permission must not grant tenant-A manager permissions.
 await call("GET","/v1/tenants/"+b+"/documents",actorToken,null,200);
 await admin.query("UPDATE tto.role_assignments SET revoked_at=now() WHERE assignment_id=$1",[tenantBRole]);
 await call("GET","/v1/tenants/"+b+"/context",actorToken,null,403);
 await call("GET","/v1/tenants/"+a+"/context",actorToken,null,200);
 console.log("CORE_AUTH_AT001_TWO_TENANT_ROLE_INDEPENDENCE_HTTP_PASS");
 const tenantMismatch=await call("GET","/v1/tenants/"+b+"/context",actorToken,null,403);
 assert.equal(tenantMismatch.code,"CROSS_TENANT_ACCESS_DENIED","DED-002 exact cross-tenant error");
 console.log("CORE_AUTH_AT002_CROSS_TENANT_URL_EXACT_DENIAL_HTTP_PASS");
 const national=await tokenFor(reviewer);
 await call("GET","/v1/tenants/"+a+"/documents",national,null,403);
 console.log("CORE_AUTH_AT004_PLATFORM_ADMIN_NO_JIT_TENANT_DENIAL_HTTP_PASS");
 const requested=await call("POST","/v1/tenants/"+a+"/jit/requests",national,
   {purpose:"Synthetic document review request",minutes:10},201);
 assert.equal(requested.status,"PENDING");
 await call("POST","/v1/tenants/"+a+"/jit/requests/"+requested.requestId+"/decision",national,{approve:true},403);
 console.log("CORE_AUTH_AT007_JIT_REQUESTOR_SELF_APPROVAL_DENIED_HTTP_PASS");
 await call("POST","/v1/tenants/"+a+"/jit/requests/"+requested.requestId+"/decision",actorToken,{approve:true},201);
 const after=await call("GET","/v1/tenants/"+a+"/documents",national,null,200);
 assert.ok(after.items.length>=1);
 assert.ok(after.items.every(d=>d.classification==="RESTRICTED"));
 // DED.CORE-AUTH-AT-011: previously approved but expired JIT fails closed.
 await admin.query(
  "UPDATE tto.jit_access_grants SET requested_at=now()-interval '30 minutes', expires_at=now()-interval '1 second' WHERE grant_id=$1",
  [requested.requestId]
 );
 await call("GET","/v1/tenants/"+a+"/documents",national,null,403);
 const roleAuditBaseline=await admin.query(
  "SELECT count(*)::integer AS n FROM tto.audit_events WHERE tenant_id=$1 AND event_name='ROLE_ASSIGNED'",[a]);
 const roleRequestId=randomUUID();
 const pendingRole={targetId:userC,roleCode:"MEMBER",
   legalAuthorityId:"aaaa0001-0001-4001-8001-aaaaaaaaaaaa",requestId:roleRequestId};
 const noStepUp=await call("POST","/v1/tenants/"+a+"/roles/assign",actorToken,pendingRole,403);
 assert.equal(noStepUp.code,"STEP_UP_REQUIRED","DED-018: OTP-only bearer must not assign");
 const stepUp=await call("POST","/v1/auth/step-up/request",actorToken,{},202);
 assert.equal(stepUp.status,"ACCEPTED");
 await call("POST","/v1/auth/step-up/verify",actorToken,
   {challengeId:stepUp.requestId,otp:"000000"},401);
 const otherSameUserToken=await tokenFor(userA);
 await call("POST","/v1/auth/step-up/verify",otherSameUserToken,
   {challengeId:stepUp.requestId,otp:"111222"},401);
 const elevated=await call("POST","/v1/auth/step-up/verify",actorToken,
   {challengeId:stepUp.requestId,otp:"111222"},200);
 assert.equal(elevated.elevated,true,"DED-018 proof belongs to existing session");
 await call("POST","/v1/auth/step-up/verify",actorToken,
   {challengeId:stepUp.requestId,otp:"111222"},401);
 await call("POST","/v1/auth/challenges/verify",null,
   {challengeId:stepUp.requestId,otp:"111222"},401);
 const assign=await call("POST","/v1/tenants/"+a+"/roles/assign",actorToken,pendingRole,201);
 assert.equal(assign.assigned,true);assert.equal(assign.alreadyApplied,false);
 const replay=await call("POST","/v1/tenants/"+a+"/roles/assign",actorToken,pendingRole,201);
 assert.equal(replay.alreadyApplied,true,"DED-015: replay is effect-free");
 const conflict=await call("POST","/v1/tenants/"+a+"/roles/assign",actorToken,
   {...pendingRole,targetId:reviewer},409);
 assert.equal(conflict.code,"IDEMPOTENCY_CONFLICT","DED-015: payload drift rejected");
 const grantAudit=await admin.query("SELECT count(*)::integer AS n FROM tto.audit_events WHERE tenant_id=$1 AND event_name='ROLE_ASSIGNED'",[a]);
 assert.equal(grantAudit.rows[0].n,roleAuditBaseline.rows[0].n+1,
  "DED-015: exactly one additional role audit despite request replay");
 const userCToken=await tokenFor(userC);
 await call("GET","/v1/tenants/"+a+"/context",userCToken,null,200);
 // DED.CORE-AUTH-AT-003: an expired role rejects even with active session.
 await admin.query(
  "UPDATE tto.role_assignments SET expires_at=now()-interval '1 second' WHERE user_id=$1 AND tenant_id=$2 AND role_code='MEMBER'",
  [userC,a]
 );
 await call("GET","/v1/tenants/"+a+"/context",userCToken,null,403);
 console.log("CORE_AUTH_AT003_EXPIRED_ROLE_ACTIVE_SESSION_HTTP_DENIED_PASS");
 await admin.query(
  "UPDATE tto.role_assignments SET expires_at=NULL WHERE user_id=$1 AND tenant_id=$2 AND role_code='MEMBER'",
  [userC,a]
 );
 await call("GET","/v1/tenants/"+a+"/context",userCToken,null,200);
 // DED-004 targeted negative: an untrusted UI may display a role-mutation button
 // to a MEMBER. The API MUST independently deny the forged click and leave
 // the target role and audit table unchanged. Synthetic UI representation only,
 // not a human/Chromium UX certification.
 const untrustedUiButton='<button type="button" data-action="assign-role">Assign role</button>';
 assert.ok(untrustedUiButton.includes('data-action="assign-role"'));
 const beforeDeniedUi=await admin.query(
  "SELECT count(*)::integer AS n FROM tto.role_assignments WHERE user_id=$1 AND tenant_id=$2 AND role_code='MEMBER'",
  [reviewer,a]);
 const beforeDeniedAudit=await admin.query(
  "SELECT count(*)::integer AS n FROM tto.audit_events WHERE tenant_id=$1 AND event_name='ROLE_ASSIGNED'",[a]);
 const deniedUiClick=await call("POST","/v1/tenants/"+a+"/roles/assign",userCToken,
  {targetId:reviewer,roleCode:"MEMBER",legalAuthorityId:randomUUID(),requestId:randomUUID()},403);
 assert.equal(deniedUiClick.code,"PERMISSION_DENIED","DED-004 forged visible control must not grant server permission");
 const afterDeniedUi=await admin.query(
  "SELECT count(*)::integer AS n FROM tto.role_assignments WHERE user_id=$1 AND tenant_id=$2 AND role_code='MEMBER'",
  [reviewer,a]);
 const afterDeniedAudit=await admin.query(
  "SELECT count(*)::integer AS n FROM tto.audit_events WHERE tenant_id=$1 AND event_name='ROLE_ASSIGNED'",[a]);
 assert.equal(afterDeniedUi.rows[0].n,beforeDeniedUi.rows[0].n,"DED-004 role table changed after unauthorized UI");
 assert.equal(afterDeniedAudit.rows[0].n,beforeDeniedAudit.rows[0].n,"DED-004 audit changed after unauthorized UI");
 console.log("TTO_PH04_DED004_SYNTHETIC_UI_VISIBLE_SERVER_DENIAL_NO_EFFECT_PASS");
 // DED-006 technical fail-closed boundary: there is intentionally no admitted
 // share transfer or settlement command in PH04. A lifecycle/manager actor
 // cannot use a fictitious route to mutate finance or shares. This is NOT a
 // full regulated domain-command acceptance until Child06/07/market is active.
 const preFinancial=await admin.query("SELECT count(*)::integer AS n FROM tto.shareholding_source_snapshots");
 await call("POST","/v1/tenants/"+a+"/shares/transfer",actorToken,
  {targetId:reviewer,quantity:1},404);
 await call("POST","/v1/tenants/"+a+"/financial/settlement",actorToken,
  {targetId:reviewer,amount:1},404);
 const postFinancial=await admin.query("SELECT count(*)::integer AS n FROM tto.shareholding_source_snapshots");
 assert.equal(postFinancial.rows[0].n,preFinancial.rows[0].n,"DED-006 unimplemented endpoint changed shareholding");
 console.log("TTO_PH04_DED006_UNREGISTERED_SHARE_FINANCE_ROUTES_FAIL_CLOSED_ONLY");
 // CHILD-02 AT-008 companion: absence of public Party enumeration endpoints;
 // DB GRANT/RLS coverage is tested separately on PostgreSQL.
 await call("GET","/v1/parties",null,null,404);
 await call("GET","/v1/tenants/"+a+"/parties",userCToken,null,404);
 console.log("TTO_PH04_CF02_AT008_HTTP_NO_ENUMERATION_ROUTE_PASS");
 // DED-004: actual Chromium button click -> live Nest HTTP 403, no database effect.
 // This is an adversarial visible-control fixture hosted on Nest's own origin,
 // NOT a claim that a production manager feature is currently rendered.
 if(process.env.PH04_BROWSER_DED004==="1"){
  const {chromium}=require("playwright");
  const fs=require("node:fs");
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},locale:"fa-IR"});
   try{
    const page=await context.newPage();
    const health=await page.goto(root+"/health",{waitUntil:"domcontentloaded"});
    assert.equal(health.status(),200,"Live Nest test origin must be reachable");
    await page.setContent('<!doctype html><html lang="fa" dir="rtl"><body><main><h1>سناریوی کنترل نامعتبر</h1><button id="forged" type="button">واگذاری نقش بدون مجوز</button><p id="outcome" role="status">آماده</p></main></body></html>');
    const beforeRole=await admin.query("SELECT count(*)::integer AS n FROM tto.role_assignments WHERE user_id=$1 AND tenant_id=$2 AND role_code='MEMBER'",[reviewer,a]);
    const beforeAudit=await admin.query("SELECT count(*)::integer AS n FROM tto.audit_events WHERE tenant_id=$1 AND event_name='ROLE_ASSIGNED'",[a]);
    await page.evaluate(({token,tenant,target})=>{
     document.getElementById("forged").addEventListener("click",async()=>{
      const response=await fetch("/v1/tenants/"+tenant+"/roles/assign",{
       method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},
       body:JSON.stringify({targetId:target,roleCode:"MEMBER",
        legalAuthorityId:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        requestId:"ffffffff-ffff-4fff-8fff-ffffffffffff"})
      });
      const result=await response.json();
      document.getElementById("outcome").textContent=response.status+":"+result.code;
     });
    },{token:userCToken,tenant:a,target:reviewer});
    await page.getByRole("button",{name:"واگذاری نقش بدون مجوز"}).click();
    await page.getByRole("status").getByText("403:PERMISSION_DENIED").waitFor({timeout:10000});
    const afterRole=await admin.query("SELECT count(*)::integer AS n FROM tto.role_assignments WHERE user_id=$1 AND tenant_id=$2 AND role_code='MEMBER'",[reviewer,a]);
    const afterAudit=await admin.query("SELECT count(*)::integer AS n FROM tto.audit_events WHERE tenant_id=$1 AND event_name='ROLE_ASSIGNED'",[a]);
    assert.equal(afterRole.rows[0].n,beforeRole.rows[0].n,"DED004 Chromium click created unauthorized role");
    assert.equal(afterAudit.rows[0].n,beforeAudit.rows[0].n,"DED004 Chromium click changed role audit");
    fs.mkdirSync("ph04-screenshots",{recursive:true});
    await page.screenshot({path:"ph04-screenshots/ded004-chromium-forged-control-mobile.png",fullPage:true});
    console.log("TTO_PH04_DED004_REAL_CHROMIUM_ADVERSARIAL_BUTTON_TO_NEST_DENIAL_PASS");
   }finally{await context.close();}
  }finally{await browser.close();}
 }
 // DED-017: a software manager role without separately verified legal
 // authority must not execute role-management; return exact AUTHORITY_REQUIRED
 // and guarantee no effect on the target User's role assignments.
 const unbackedManagerRole=randomUUID();
 await admin.query(
  "INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'COOPERATIVE_MANAGER')",
  [unbackedManagerRole,userC,a]
 );
 const deniedByAuthority=await call("POST","/v1/tenants/"+a+"/roles/assign",userCToken,
  {targetId:reviewer,roleCode:"MEMBER",legalAuthorityId:randomUUID(),requestId:randomUUID()},403);
 assert.equal(deniedByAuthority.code,"AUTHORITY_REQUIRED","DED-017 exact authority decision");
 await admin.query("UPDATE tto.role_assignments SET revoked_at=now() WHERE assignment_id=$1",[unbackedManagerRole]);
 const unauthorizedEffect=await admin.query(
  "SELECT count(*)::integer AS n FROM tto.role_assignments WHERE user_id=$1 AND tenant_id=$2 AND role_code='MEMBER'",
  [reviewer,a]
 );
 assert.equal(unauthorizedEffect.rows[0].n,0,"DED-017: no unauthorized role assigned");
 console.log("CORE_AUTH_AT008_PERMISSION_WITHOUT_LEGAL_AUTHORITY_HTTP_DENIED_PASS");
 const assigned=await admin.query("SELECT assignment_id FROM tto.role_assignments WHERE user_id=$1 AND tenant_id=$2 AND role_code='MEMBER'",[userC,a]);
 assert.equal(assigned.rowCount,1);
 await call("POST","/v1/tenants/"+a+"/roles/"+assigned.rows[0].assignment_id+"/revoke",actorToken,{expectedVersion:1},201);
 await call("GET","/v1/tenants/"+a+"/context",userCToken,null,403);
 console.log("CORE_AUTH_AT006_REVOKED_ROLE_STALE_TOKEN_HTTP_DENIED_PASS");
 // DED-013: an actor authorized within A must not mutate a document owned by B.
 const foreignDocumentId=randomUUID();
 await admin.query("INSERT INTO tto.documents(document_id,tenant_id,title,classification) VALUES($1,$2,'Synthetic foreign doc','MEMBER')",[foreignDocumentId,b]);
 await call("POST","/v1/tenants/"+a+"/documents/"+foreignDocumentId+"/versions",actorToken,
   {cleanFileId:"dddddddd-dddd-4ddd-8ddd-ddddddddddd1",version:1},403);
 const unaffectedForeign=await admin.query("SELECT count(*)::integer AS n FROM tto.document_versions WHERE document_id=$1",[foreignDocumentId]);
 assert.equal(unaffectedForeign.rows[0].n,0,"DED-013: resource tenant mismatch has no write effect");
  await admin.query("INSERT INTO tto.documents(document_id,tenant_id,title,classification) VALUES($1,$2,'Synthetic publish API','MEMBER')",[doc,a]);
 await call("POST","/v1/tenants/"+a+"/documents/"+doc+"/versions",actorToken,
  {cleanFileId:"dddddddd-dddd-4ddd-8ddd-ddddddddddd2",version:1},403);
 await call("POST","/v1/tenants/"+a+"/documents/"+doc+"/versions",actorToken,
  {cleanFileId:"dddddddd-dddd-4ddd-8ddd-ddddddddddd1",version:1},201);
 await call("POST","/v1/tenants/"+a+"/documents/"+doc+"/legal-holds",actorToken,
  {ruleReference:"LEGAL-CASE-2026",reason:"Synthetic preservation required"},201);
 const userBToken=await tokenFor("22222222-2222-4222-8222-222222222222");
 const holdDoc=await admin.query("SELECT hold_id FROM tto.legal_holds WHERE document_id=$1 ORDER BY applied_at DESC LIMIT 1",[doc]);
 assert.equal(holdDoc.rowCount,1);
 const releasePath="/v1/tenants/"+a+"/legal-holds/"+holdDoc.rows[0].hold_id+"/release";
 await call("POST",releasePath,actorToken,{releaseEvidenceId:randomUUID()},403);
 await call("POST",releasePath,userBToken,{releaseEvidenceId:randomUUID()},201);
 await call("POST",releasePath,userBToken,{releaseEvidenceId:randomUUID()},403);
 await call("POST","/v1/tenants/cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa/lifecycle/transition",actorToken,
 {fromStatus:"ACTIVE",toStatus:"SUSPENDED",expectedVersion:3},201);
 await call("POST","/v1/tenants/cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa/lifecycle/transition",actorToken,
 {fromStatus:"ACTIVE",toStatus:"SUSPENDED",expectedVersion:3},403);
 const oldParty=randomUUID(),currentParty=randomUUID();
 await admin.query("INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES($1,'PERSON','Synthetic origin'),($2,'PERSON','Synthetic target')",[oldParty,currentParty]);
 await call("POST","/v1/tenants/"+a+"/parties/aliases/merge",userBToken,
 {oldPartyId:oldParty,currentPartyId:currentParty},403);
 await call("POST","/v1/tenants/"+a+"/parties/aliases/merge",actorToken,
 {oldPartyId:oldParty,currentPartyId:currentParty},201);
 await call("POST","/v1/tenants/"+a+"/parties/aliases/merge",actorToken,
 {oldPartyId:oldParty,currentPartyId:currentParty},403);
 await call("POST","/v1/auth/logout",actorToken,null,204);
 await call("GET","/v1/tenants/"+a+"/context",actorToken,null,401);
 // DED-014 (partial): verify actual audit event values never contain test OTP,
 // access token or raw challenge secret; schema/retention audit remains open.
 const audit=await admin.query("SELECT * FROM tto.audit_events");
 assert.ok(audit.rowCount>0,"DED-014 requires emitted audit evidence");
 for(const row of audit.rows){
  assert.equal(typeof row.event_name,"string");
  for(const secret of [otp,expiredOtp,concurrentOtp,actorToken]){
   assert.equal(JSON.stringify(row).includes(secret),false,"DED-014 full audit row leaked test secret");
  }
 }
 console.log("TTO_CF01_DED014_AUDIT_EVENT_NO_RAW_SECRETS_PASS");
 console.log("TTO_CF01_03_REAL_HTTP_WORKFLOWS_PASS="+count);
}
main().catch(err=>{console.error("TTO_CF01_03_HTTP_WORKFLOWS_FAIL",err.message);process.exitCode=1})
.finally(async()=>{if(proc && proc.exitCode===null)proc.kill("SIGTERM");await admin.end().catch(()=>{})});
