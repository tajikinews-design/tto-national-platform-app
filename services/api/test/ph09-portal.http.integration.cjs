'use strict';
/** Phase 9 real authenticated Nest HTTP against disposable PostgreSQL17.
 * All cooperative users, evidence and measurements here are artificial.
 */
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {spawn}=require('node:child_process');
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const path=require('node:path');
const connection=process.env.TEST_ADMIN_DATABASE_URL;
if(!connection||process.env.CI!=='true'||process.env.VERCEL||
   process.env.TTO_ENABLE_REAL_SMSOTP_DELIVERY==='true')
 throw Error('PH09_ISOLATED_CI_ONLY');
const db=new Client({connectionString:connection});
const tenant='99000000-0000-4000-8000-000000000001';
const foreign='99000000-0000-4000-8000-000000000002';
const user='99100000-0000-4000-8000-000000000001';
const manager='99100000-0000-4000-8000-000000000002';
const outsider='99100000-0000-4000-8000-000000000003';
const evidence='99200000-0000-4000-8000-000000000001';
const opportunity='9a000000-0000-4000-8000-000000000001';
const foreignOpportunity='9a000000-0000-4000-8000-000000000002';
const method='9a100000-0000-4000-8000-000000000001';
const measurement='9a200000-0000-4000-8000-000000000001';
const claim='9a300000-0000-4000-8000-000000000001';
const case129='9a400000-0000-4000-8000-000000000001';
const caseWhistle='9a400000-0000-4000-8000-000000000002';
const metricDef='9a500000-0000-4000-8000-000000000001';
const snapshot='9a600000-0000-4000-8000-000000000001';
const foreignSnapshot='9a600000-0000-4000-8000-000000000002';
const retentionPolicy='9a700000-0000-4000-8000-000000000001';
const held='9a800000-0000-4000-8000-000000000001';
const eligible='9a800000-0000-4000-8000-000000000002';
const p8project='9c000000-0000-4000-8000-000000000001';
const p8package='9c100000-0000-4000-8000-000000000001';
const p8version='9c200000-0000-4000-8000-000000000001';
const p8poll='9c300000-0000-4000-8000-000000000001';
const p8course='9c400000-0000-4000-8000-000000000001';
const p8event='9c500000-0000-4000-8000-000000000001';
const p8benefit='9c600000-0000-4000-8000-000000000001';
const p8entitlement='9c700000-0000-4000-8000-000000000001';
const p8voucher='9c800000-0000-4000-8000-000000000001';
const p8offer='9c900000-0000-4000-8000-000000000001';
const p8tender='9ca00000-0000-4000-8000-000000000001';
let server,nextServer,shareNextServer,nationalNextServer,stderr='',checks=0;
const port=31677,root='http://127.0.0.1:'+port;
async function token(uid){
 const raw=randomBytes(48).toString('base64url');
 await db.query("INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at) VALUES($1,$2,$3,0,now()+interval '15 minutes')",
 [randomUUID(),uid,createHash('sha256').update(raw).digest()]);
 return raw;
}
async function request(method,route,bearer,status,payload){
 const resp=await fetch(root+route,{method,headers:{...(bearer?{authorization:'Bearer '+bearer}:{}),...(payload?{'content-type':'application/json'}:{})},...(payload?{body:payload}:{})});
 const body=await resp.json().catch(()=>null);
 assert.equal(resp.status,status,method+' '+route+' expected '+status+' got '+resp.status+
 ' '+JSON.stringify(body).slice(0,220));
 checks++;return body;
}
async function seed(){
 await db.query("ALTER ROLE tto_app LOGIN");
 // Synthetic JIT is deliberately scoped to DOCUMENT_REVIEW and must never
 // be interpreted as board approval or live source activation.
 await db.query("INSERT INTO tto.platform_operator_authorizations(user_id,approved_by,evidence_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
 [outsider,manager,evidence]);
 await db.query("INSERT INTO tto.jit_access_grants(grant_id,tenant_id,requester_id,approver_id,purpose,scope,status,expires_at,decided_at) VALUES($1,$2,$3,$4,'Synthetic published document review','DOCUMENT_REVIEW','APPROVED',now()+interval '1 hour',now())",
 [randomUUID(),tenant,outsider,manager]);
 await db.query("INSERT INTO tto.documents(document_id,tenant_id,title,classification,status) VALUES($1,$2,'Synthetic approved-to-display minute','RESTRICTED','PUBLISHED'),($3,$2,'Highly restricted synthetic','HIGHLY_RESTRICTED','PUBLISHED')",
 ['9d000000-0000-4000-8000-000000000001',tenant,'9d000000-0000-4000-8000-000000000002']);

 await db.query("INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until) VALUES($1,$2,$3,'ROLE_MANAGEMENT',$4,$5,now(),now()+interval '1 hour')",
 [randomUUID(),manager,tenant,evidence,user]);

 await db.query("INSERT INTO tto.ph09_opportunities(opportunity_id,tenant_id,title,deadline) VALUES($1,$2,'Member opportunity',now()+interval '1 day'),($3,$4,'Foreign opportunity',now()+interval '1 day')",
 [opportunity,tenant,foreignOpportunity,foreign]);
 await db.query("INSERT INTO tto.ph09_impact_methods(method_id,tenant_id,method_code,version,source_evidence) VALUES($1,$2,'SOURCE_METHOD',1,$3)",[method,tenant,evidence]);
 await db.query("INSERT INTO tto.ph09_impact_measurements(measurement_id,tenant_id,method_id,source_evidence,amount,status) VALUES($1,$2,$3,$4,35,'APPROVED')",[measurement,tenant,method,evidence]);
 await db.query("INSERT INTO tto.ph09_public_impact_claims(claim_id,measurement_id,approved_by,approval_evidence) VALUES($1,$2,$3,$4)",[claim,measurement,manager,evidence]);
 await db.query("INSERT INTO tto.ph09_grc_cases(case_id,tenant_id,kind,source_evidence) VALUES($1,$2,'ARTICLE129',$3),($4,$2,'WHISTLEBLOWER',$3)",[case129,tenant,evidence,caseWhistle]);
 await db.query("INSERT INTO tto.ph09_metric_definitions(metric_id,code,version,source_evidence) VALUES($1,'SYNTHETIC_PEER',1,$2)",[metricDef,evidence]);
 await db.query("INSERT INTO tto.ph09_metric_snapshots(snapshot_id,tenant_id,metric_id,snapshot_version,value,cohort_count) VALUES($1,$2,$3,1,71,2),($4,$5,$3,1,88,20)",
 [snapshot,tenant,metricDef,foreignSnapshot,foreign]);
 await db.query("INSERT INTO tto.ph09_retention_policies(policy_id,tenant_id,policy_code,version,source_evidence) VALUES($1,$2,'POLICY',1,$3)",[retentionPolicy,tenant,evidence]);
 await db.query("INSERT INTO tto.ph09_retention_records(record_id,tenant_id,classification,policy_id) VALUES($1,$2,'INTERNAL',$3),($4,$2,'INTERNAL',$3)",[held,tenant,retentionPolicy,eligible]);
 await db.query("INSERT INTO tto.ph09_legal_holds(hold_id,record_id,reason_evidence) VALUES($1,$2,$3)",[randomUUID(),held,evidence]);
 await db.query("INSERT INTO tto.ph08_projects(project_id,tenant_id,name,county_code,status) VALUES($1,$2,'PH10 Approved Project','COUNTY_X','DRAFT')",[p8project,tenant]);
 await db.query("INSERT INTO tto.ph07_disclosure_packages(package_id,tenant_id,subject_code,classification) VALUES($1,$2,'PH10_PROJECT','MEMBER')",[p8package,tenant]);
 await db.query("INSERT INTO tto.ph07_disclosure_versions(version_id,package_id,version_num,period_start,period_end,source_evidence,report_kind,status,created_by,approved_by) VALUES($1,$2,1,'2026-01-01','2026-12-31',$3,'STATUTORY','PUBLISHED',$4,$5)",[p8version,p8package,evidence,user,manager]);
 await db.query("INSERT INTO tto.ph08_project_disclosures(project_id,disclosure_version_id) VALUES($1,$2)",[p8project,p8version]);
 await db.query("INSERT INTO tto.ph08_polls(poll_id,tenant_id,title,deadline,min_aggregate_size) VALUES($1,$2,'Test Survey',now()+interval '1 day',5)",[p8poll,tenant]);
 await db.query("INSERT INTO tto.ph08_poll_audience(poll_id,user_id) VALUES($1,$2)",[p8poll,user]);
 await db.query("INSERT INTO tto.ph08_courses(course_id,tenant_id,title,status) VALUES($1,$2,'Training Course','ACTIVE')",[p8course,tenant]);
 await db.query("INSERT INTO tto.ph08_training_events(event_id,course_id,tenant_id,capacity,refund_policy_version) VALUES($1,$2,$3,5,'PH10_REFUND_V1')",[p8event,p8course,tenant]);
 await db.query("INSERT INTO tto.ph08_benefits(benefit_id,tenant_id,title,limited,status) VALUES($1,$2,'Noncash Reward',false,'ACTIVE')",[p8benefit,tenant]);
 await db.query("INSERT INTO tto.ph08_benefit_entitlements(entitlement_id,benefit_id,tenant_id,holder_id,noncash_units) VALUES($1,$2,$3,$4,1)",[p8entitlement,p8benefit,tenant,user]);
 await db.query("INSERT INTO tto.ph08_benefit_vouchers(voucher_id,entitlement_id,expires_at) VALUES($1,$2,now()+interval '1 day')",[p8voucher,p8entitlement]);
 await db.query("INSERT INTO tto.ph08_market_offers(offer_id,seller_tenant_id,title,price_snapshot,status) VALUES($1,$2,'Cooperative Product',100,'PUBLISHED')",[p8offer,tenant]);
 await db.query("INSERT INTO tto.ph08_sourcing_tenders(tender_id,tenant_id,deadline,source_policy) VALUES($1,$2,now()+interval '1 day',$3)",[p8tender,tenant,evidence]);
}
async function start(){
 server=spawn(process.execPath,['dist/main.js'],{
 cwd:path.resolve(__dirname,'..'),
 env:{...process.env,NODE_ENV:'test',TTO_MOCK_SMSOTP_PROVIDER:'true',
 DATABASE_URL:'postgresql://tto_app@127.0.0.1:5432/tto',PORT:String(port)},
 stdio:['ignore','pipe','pipe']});
 server.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-5000);});
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw Error('PH09_NEST_FAILED '+server.exitCode+' '+stderr);
  try{let r=await fetch(root+'/health');if(r.status===200)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,220));
 }
 throw Error('PH09_NEST_NOT_READY '+stderr);
}
async function startNextCooperative(){
 const cwd=path.resolve(__dirname,'../../../apps/cooperative-management');
 const binary=require.resolve('next/dist/bin/next',{paths:[cwd]});
 const nextPort=31678;
 let log='';
 nextServer=spawn(process.execPath,[binary,'start','-p',String(nextPort),'-H','127.0.0.1'],{
  cwd,env:{...process.env,NODE_ENV:'production',TTO_API_BASE_URL:root,
    TTO_LOOPBACK_E2E:'1',CI:'true',NEXT_TELEMETRY_DISABLED:'1',
    PORT:String(nextPort)},stdio:['ignore','pipe','pipe']
 });
 for(const stream of [nextServer.stdout,nextServer.stderr])
  stream.on('data',d=>{log=(log+d.toString()).slice(-3000)});
 const base='http://127.0.0.1:'+nextPort;
 for(let i=0;i<100;i++){
  if(nextServer.exitCode!==null)throw Error('PH10_NEXT_EXIT_'+nextServer.exitCode+' '+log);
  try{const res=await fetch(base+'/');if(res.status===200)return base;}catch{}
  await new Promise(ok=>setTimeout(ok,250));
 }
 throw Error('PH10_NEXT_NO_READY '+log);
}
async function testCooperativeBff(memberToken,managerToken){
 const base=await startNextCooperative();
 const url=(nav,t=tenant)=>base+'/api/tenants/'+t+'/ph10/'+nav;
 async function call(nav,bearer,status,t=tenant,forged=false){
  const r=await fetch(url(nav,t),{headers:{
   ...(bearer?{Cookie:'tto_session='+bearer}:{}),
   ...(forged?{Authorization:'Bearer '+managerToken,'X-Role':'COOPERATIVE_MANAGER'}:{})
  }});
  const data=await r.json().catch(()=>null);
  assert.equal(r.status,status,'PH10_NEXT_BFF_'+nav+' expected '+status+
   ' got '+r.status+' '+JSON.stringify(data).slice(0,230));
  assert.match(r.headers.get('cache-control')??'',/no-store/);
  checks++;
  return data;
 }
 let x=await call('NAV-10',managerToken,200);
 assert.equal(x.sourceBound,true);assert.equal(x.readOnly,true);
 assert.equal(x.items.length,1);assert.equal(x.items[0].kind,'ARTICLE129');
 assert.equal(Object.hasOwn(x.items[0],'encrypted_identity_ref'),false);
 x=await call('NAV-10',memberToken,200);
 assert.equal(x.items.length,0);
 x=await call('NAV-07',memberToken,200);
 assert.equal(x.items.length,1);assert.equal(x.items[0].seller_kind,'COOPERATIVE');
 x=await call('NAV-09',memberToken,200);
 assert.equal(x.items.length,1);
 x=await call('NAV-08',memberToken,200);
 assert.equal(x.items.length,1);
 x=await call('NAV-04',managerToken,200);
 assert.equal(x.items.length,0);
 await call('NAV-10',null,401,tenant,true);
 await call('NAV-07',managerToken,403,foreign);
 await call('NAV-03',memberToken,404);
 const invalid=await fetch(base+'/api/tenants/not-uuid/ph10/NAV-10');
 assert.equal(invalid.status,400);checks++;
 for(const nav of ['NAV-04','NAV-05','NAV-07','NAV-08','NAV-09','NAV-10']){
  await call(nav,null,401);
 }
 console.log('PH10_NEXT_BFF_ALL_SIX_ROUTES_REQUIRE_COOKIE_PASS');
 console.log('PH10_NEXT_BFF_AUTHENTICATED_ROLE_TENANT_SOURCE_INTEGRATION_PASS');
}
async function testShareholderBff(memberToken,managerToken){
 const cwd=path.resolve(__dirname,'../../../apps/shareholder');
 const binary=require.resolve('next/dist/bin/next',{paths:[cwd]});
 const port=31679;let log='';
 shareNextServer=spawn(process.execPath,[binary,'start','-p',String(port),'-H','127.0.0.1'],{
  cwd,env:{...process.env,NODE_ENV:'production',TTO_API_BASE_URL:root,TTO_LOOPBACK_E2E:'1',
    CI:'true',NEXT_TELEMETRY_DISABLED:'1',PORT:String(port)},stdio:['ignore','pipe','pipe']
 });
 for(const stream of [shareNextServer.stdout,shareNextServer.stderr])
  stream.on('data',d=>{log=(log+String(d)).slice(-4000);});
 const base='http://127.0.0.1:'+port;
 let ready=false;
 for(let i=0;i<120;i++){
  if(shareNextServer.exitCode!==null)throw Error('SHARE_NEXT_EXIT_'+shareNextServer.exitCode+' '+log);
  try{if((await fetch(base+'/')).status===200){ready=true;break;}}catch{}
  await new Promise(ok=>setTimeout(ok,200));
 }
 if(!ready)throw Error('SHARE_NEXT_NOT_READY '+log);
 const route=(nav,t=tenant)=>base+'/api/tenants/'+t+'/ph10/'+nav;
 async function call(nav,token,status,t=tenant,forged=false){
  const res=await fetch(route(nav,t),{headers:{
   ...(token?{Cookie:'tto_session='+token}:{}),
   ...(forged?{Authorization:'Bearer '+managerToken,'X-Role':'MEMBER'}:{})
  }});
  const body=await res.json().catch(()=>null);
  assert.equal(res.status,status,'PH10_SHAREHOLDER_BFF_'+nav+' expected '+status+
   ' got '+res.status+' '+JSON.stringify(body).slice(0,230));
  assert.match(res.headers.get('cache-control')??'',/no-store/);
  checks++;return body;
 }
 let x=await call('NAV-07',memberToken,200);
 assert.equal(x.items.length,1);assert.equal(x.items[0].title,'Cooperative Product');
 assert.equal(Object.hasOwn(x.items[0],'seller_bank_account'),false);
 x=await call('NAV-08',memberToken,200);
 assert.equal(x.items.length,1);assert.equal(x.items[0].name,'PH10 Approved Project');
 x=await call('NAV-06',memberToken,200);
 assert.equal(x.items.length,1);assert.equal(x.items[0].course_title,'Training Course');
 x=await call('NAV-10',memberToken,200);
 assert.equal(x.items.length,1);assert.equal(x.items[0].amount,'35');
 await call('NAV-07',null,401,tenant,true);
 await call('NAV-08',memberToken,403,foreign);
 await call('NAV-03',memberToken,404);
 const malformed=await fetch(base+'/api/tenants/invalid/ph10/NAV-07');
 assert.equal(malformed.status,400);checks++;
 for(const nav of ['NAV-06','NAV-07','NAV-08','NAV-10']){
  await call(nav,null,401);
 }
 // Create a second artificial course event only after read assertions above.
 // Exercise a real UI-facing POST -> scoped BFF -> canonical Nest -> PG17 command.
 const enrollmentEvent='9c500000-0000-4000-8000-000000000002';
 await db.query("INSERT INTO tto.ph08_training_events(event_id,course_id,tenant_id,capacity,refund_policy_version) VALUES($1,$2,$3,5,'PH10_REFUND_V1')",
  [enrollmentEvent,p8course,tenant]);
 const enrollUrl=base+'/api/tenants/'+tenant+'/ph10/learning/events/'+enrollmentEvent+'/enroll';
 async function enrollRequest(cookie,status,t=tenant,origin=null){
  const uri=base+'/api/tenants/'+t+'/ph10/learning/events/'+enrollmentEvent+'/enroll';
  const headers={...(cookie?{Cookie:'tto_session='+cookie}:{}),...(origin?{Origin:origin}:{})};
  const res=await fetch(uri,{method:'POST',headers});
  const body=await res.json().catch(()=>null);
  assert.equal(res.status,status,'PH10_TRAINING_BFF_ENROLL_'+JSON.stringify(body));
  assert.match(res.headers.get('cache-control')??'',/no-store/);
  checks++;return body;
 }
 await enrollRequest(null,401);
 await enrollRequest(managerToken,403);
 await enrollRequest(memberToken,403,foreign);
 await enrollRequest(memberToken,403,tenant,'https://untrusted.invalid');
 let enrollment=await enrollRequest(memberToken,201);
 assert.equal(enrollment.registered,true);
 assert.equal(enrollment.registration,'CONFIRMED');
 assert.equal(enrollment.courseCompleted,false);
 const stored=await call('NAV-06',memberToken,200);
 assert.equal(stored.items.find(v=>v.event_id===enrollmentEvent)?.registration_state,'CONFIRMED',
  'PH10_TRAINING_ENROLLMENT_MUST_SURVIVE_SOURCE_RELOAD');
 enrollment=await enrollRequest(memberToken,409);
 assert.equal(enrollment.code,'ALREADY_REGISTERED');
 await db.query("UPDATE tto.ph08_event_registrations SET state='CANCELLED' WHERE event_id=$1 AND registered_by=$2",[enrollmentEvent,user]);
 const cancelled=await call('NAV-06',memberToken,200);
 assert.equal(cancelled.items.find(v=>v.event_id===enrollmentEvent)?.registration_state,'CANCELLED');
 console.log('PH10_TRAINING_CANCELLED_STATE_PERSISTED_READ_PASS');
 console.log('PH10_REAL_BROWSER_FACING_MEMBER_EVENT_ENROLLMENT_BFF_NEST_POST_PASS');
 console.log('PH10_SHAREHOLDER_ALL_FOUR_ROUTES_REQUIRE_COOKIE_PASS');
 console.log('PH10_SHAREHOLDER_BFF_SOURCE_ONLY_CROSS_TENANT_GATES_PASS');
}
async function testNationalJitBff(nationalToken,managerToken){
 const cwd=path.resolve(__dirname,'../../../apps/national-admin');
 const binary=require.resolve('next/dist/bin/next',{paths:[cwd]});
 const port=31680;let log='';
 nationalNextServer=spawn(process.execPath,[binary,'start','-p',String(port),'-H','127.0.0.1'],{
  cwd,env:{...process.env,NODE_ENV:'production',TTO_API_BASE_URL:root,TTO_LOOPBACK_E2E:'1',
   CI:'true',NEXT_TELEMETRY_DISABLED:'1',PORT:String(port)},stdio:['ignore','pipe','pipe']
 });
 for(const stream of [nationalNextServer.stdout,nationalNextServer.stderr])
  stream.on('data',d=>{log=(log+String(d)).slice(-4000);});
 const base='http://127.0.0.1:'+port;
 let ready=false;
 for(let i=0;i<120;i++){
  if(nationalNextServer.exitCode!==null)throw Error('NATIONAL_NEXT_EXIT_'+log);
  try{if((await fetch(base+'/')).status===200){ready=true;break;}}catch{}
  await new Promise(ok=>setTimeout(ok,200));
 }
 if(!ready)throw Error('NATIONAL_NEXT_NOT_READY '+log);
 async function call(nav,token,status,t=tenant){
  const res=await fetch(base+'/api/tenants/'+t+'/ph10/'+nav,
   {headers:token?{Cookie:'tto_session='+token}:{}});
  const body=await res.json().catch(()=>null);
  assert.equal(res.status,status,'PH10_NATIONAL_BFF_'+nav+' expected '+status+
    ' got '+res.status+' '+JSON.stringify(body).slice(0,230));
  checks++;return body;
 }
 let x=await call('NAV-09',nationalToken,200);
 assert.equal(x.scope,'JIT_DOCUMENT_REVIEW_ONLY');
 assert.equal(x.officialApproval,false);
 assert.equal(x.items.length,1);
 assert.equal(x.items[0].title,'Synthetic approved-to-display minute');
 assert.equal(x.items.some(z=>z.title==='Highly restricted synthetic'),false);
 await call('NAV-09',managerToken,403);
 await call('NAV-09',nationalToken,403,foreign);
 await call('NAV-09',null,401);
 await call('NAV-03',nationalToken,404);
 console.log('PH10_NATIONAL_JIT_INDEPENDENT_ROLE_TENANT_CLASSIFICATION_PASS');
}
async function browserCleanupWithDeadline(operation,label){
 let timer;
 try{
  return await Promise.race([
   operation(),
   new Promise((_,reject)=>{timer=setTimeout(
    ()=>reject(Error('PH10_BROWSER_CLEANUP_TIMEOUT_'+label)),12000);})
  ]);
 }finally{clearTimeout(timer);}
}
async function testActualAuthenticatedBrowser(memberToken,managerToken){
 if(process.env.PH10_AUTH_CHROMIUM!=='1')return;
 const {chromium}=require('playwright');
 const fs=require('node:fs');
 const evidenceDir=path.resolve(__dirname,'../../../ph10-artifacts');
 fs.mkdirSync(evidenceDir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const profiles=[
   {kind:'shareholder',port:31679,token:memberToken,route:'nav-07',
    select:'#sw-tenant',button:'تأیید محدوده و استعلام',expected:'Cooperative Product'},
   {kind:'cooperative',port:31678,token:managerToken,route:'nav-10',
    select:'#tto-select-cooperative',button:'بررسی مجوز محدوده',expected:'ARTICLE129'},
   {kind:'national',port:31680,token:await token(outsider),route:'nav-09',
    select:'#tto-select-national',button:'بررسی مجوز محدوده',expected:'Synthetic approved-to-display minute'}
  ];
  for(const profile of profiles){
   const context=await browser.newContext({locale:'fa-IR',viewport:{width:390,height:844}});
   // Never let an unbounded click/action consume the whole 40-minute CI job.
   // Timeouts fail the real user journey; they do not skip or mark it PASS.
   context.setDefaultTimeout(12000);
   context.setDefaultNavigationTimeout(30000);
   try{
    await context.addCookies([{name:'tto_session',value:profile.token,domain:'127.0.0.1',
     path:'/',httpOnly:true,secure:false,sameSite:'Lax'}]);
    const page=await context.newPage();
    console.log('PH10_CHROMIUM_START_'+profile.kind.toUpperCase());
    const url='http://127.0.0.1:'+profile.port+'/modules/'+profile.route;
    console.log('PH10_CHROMIUM_BEFORE_INITIAL_NAV_'+profile.kind.toUpperCase());
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    console.log('PH10_CHROMIUM_AFTER_INITIAL_NAV_'+profile.kind.toUpperCase());
    assert.equal(response.status(),200);
    await page.locator(profile.select).waitFor({state:'visible',timeout:25000});
    console.log('PH10_CHROMIUM_AFTER_TENANT_SELECTOR_'+profile.kind.toUpperCase());
    await page.locator(profile.select).selectOption(tenant);
    await page.getByRole('button',{name:profile.button}).click();
    console.log('PH10_CHROMIUM_AFTER_SCOPE_CONFIRM_'+profile.kind.toUpperCase());
    await page.getByText(profile.expected).waitFor({state:'visible',timeout:25000});
    console.log('PH10_CHROMIUM_AFTER_SOURCE_RENDER_'+profile.kind.toUpperCase());
    assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
    assert.equal(await page.getByText(profile.expected).count()>0,true);
    assert.equal((await page.locator('body').innerText()).includes('SEALED_SOURCE_IDENTITY'),false);
    if(profile.kind==='cooperative'){
     // Actual manager UI action -> cookie-only Next BFF -> tenant/role gated
     // Nest GRC policy -> disposable PG17. Inquiry is not legal finalization.
     const policyPath='/api/tenants/'+tenant+'/ph10/grc/cases/'+case129+'/can-finalize';
     const pre=await db.query(
      "SELECT md5(to_jsonb(c)::text) AS fingerprint FROM tto.ph09_grc_cases c WHERE case_id=$1",
      [case129]);
     assert.equal(pre.rows.length,1,'PH10_GRC_FIXTURE_MISSING');
     const preflightReply=page.waitForResponse(reply=>
      reply.url().includes(policyPath)&&reply.request().method()==='GET',
      {timeout:20000});
     await page.getByRole('button',{name:'بررسی امکان نهایی‌سازی پرونده (فقط استعلام)'}).click();
     const reply=await preflightReply;
     assert.equal(reply.status(),200,'PH10_GRC_PRECHECK_HTTP_STATUS');
     const body=await reply.json();
     assert.equal(body.available,true);
     assert.equal(body.allowed,false);
     assert.equal(body.officialApproval,false);
     assert.equal(body.sourceBound,true);
     assert.equal(body.readOnly,true);
     await page.getByText('نهایی‌سازی این پرونده بدون گردش‌کار لازم مسدود است.')
      .waitFor({state:'visible',timeout:12000});
     const post=await db.query(
      "SELECT md5(to_jsonb(c)::text) AS fingerprint FROM tto.ph09_grc_cases c WHERE case_id=$1",
      [case129]);
     assert.equal(post.rows[0]?.fingerprint,pre.rows[0]?.fingerprint,
      'PH10_GRC_PRECHECK_MUTATED_CASE');
     console.log('PH10_BROWSER_GRC_AT001_MANAGER_CLICK_BFF_NEST_PG17_BLOCK_NO_MUTATION_PASS');
     checks++;
    }
    // Capture the real rendered page through Chromium CDP, avoiding
    // Playwright screenshot's font-ready/animation lifecycle wait.
    // Screenshot evidence is mandatory; errors fail the test.
    const capture=await context.newCDPSession(page);
    try{
     await capture.send('Page.enable');
     const shot=await capture.send('Page.captureScreenshot',{
      format:'png',captureBeyondViewport:false,fromSurface:true
     });
     assert.ok(typeof shot.data==='string'&&shot.data.length>100,'PH10_EMPTY_CHROMIUM_CAPTURE');
     fs.writeFileSync(path.join(evidenceDir,'ph10-'+profile.kind+
      '-authenticated-nav07-mobile.png'),Buffer.from(shot.data,'base64'));
     console.log('PH10_CHROMIUM_CDP_SCREENSHOT_PASS_'+profile.kind.toUpperCase());
    }finally{await capture.detach();}
    console.log('PH10_CHROMIUM_AFTER_SCREENSHOT_'+profile.kind.toUpperCase());
    if(profile.kind==='shareholder'){
     // Exact evidence for a potential browser hang after the first screenshot.
     // Abort externally (workflow timeout) rather than accepting an unfinished journey.
     console.log('PH10_CHROMIUM_BEFORE_ENROLLMENT_NAV_SHAREHOLDER');
     // Real browser button -> Next BFF -> Nest POST -> PostgreSQL, not a mock.
     await page.goto('http://127.0.0.1:'+profile.port+'/modules/nav-06',
       {waitUntil:'domcontentloaded',timeout:25000});
     console.log('PH10_CHROMIUM_AFTER_ENROLLMENT_NAV_SHAREHOLDER');
     await page.locator('#sw-tenant').waitFor({state:'visible',timeout:20000});
     console.log('PH10_CHROMIUM_AFTER_ENROLLMENT_SELECTOR_SHAREHOLDER');
     // A visible select is not necessarily enabled or populated. Require the
     // *actual authorized tenant option* before interacting. Missing data fails
     // quickly with the true UI state rather than hanging an entire CI runner.
     try {
      await page.waitForFunction((id)=>{
       const el=document.querySelector('#sw-tenant');
       return el instanceof HTMLSelectElement&&!el.disabled&&
        Array.from(el.options).some(o=>o.value===id);
      },tenant,{timeout:15000});
     }catch(error){
      const observed=await page.locator('#sw-tenant').evaluate(el=>({
       disabled:el.disabled,options:Array.from(el.options).map(o=>o.value),
       visibleAlerts:Array.from(document.querySelectorAll('[role="alert"]'))
        .map(e=>e.textContent?.slice(0,200))
      })).catch(()=>({readbackUnavailable:true}));
      throw Error('PH10_BROWSER_NAV06_TENANT_SCOPE_NOT_READY '+
       JSON.stringify(observed)+' '+String(error?.message).slice(0,130));
     }
     console.log('PH10_CHROMIUM_NAV06_AUTHORIZED_TENANT_READY');
     await page.locator('#sw-tenant').selectOption(tenant,{timeout:15000});
     console.log('PH10_CHROMIUM_NAV06_TENANT_SELECTED');
     const scopeButton=page.getByRole('button',{name:'تأیید محدوده و استعلام'});
     await scopeButton.click({timeout:15000});
     console.log('PH10_CHROMIUM_NAV06_SCOPE_CONFIRM_CLICKED');
     // Confirm the server read model independently before waiting for the UI.
     // A missing permitted event is a real failing journey, not a browser timeout.
     console.log('PH10_CHROMIUM_NAV06_BEFORE_AUTHENTICATED_SOURCE_GET');
     const liveSource=await page.request.get(
      'http://127.0.0.1:'+profile.port+'/api/tenants/'+tenant+'/ph10/NAV-06',
      {timeout:15000});
     const liveFull=await liveSource.text();
     const liveText=liveFull.slice(0,1800);
     console.log('PH10_CHROMIUM_NAV06_SOURCE_STATUS_'+liveSource.status());
     assert.equal(liveSource.status(),200,
      'PH10_NAV06_SOURCE_NOT_READABLE '+liveSource.status()+' '+liveText);
     const live=JSON.parse(liveFull);
     assert.equal(live.sourceBound,true,'PH10_NAV06_SOURCE_NOT_BOUND');
     assert.ok(live.items?.some(x=>
       JSON.stringify(x).includes('PH10 Browser Enrollment Course')),
       'PH10_NAV06_SYNTHETIC_EVENT_NOT_IN_READ_MODEL '+liveText);
     console.log('PH10_CHROMIUM_NAV06_SOURCE_CONTRACT_PASS');
     const course=page.locator('li').filter({hasText:'PH10 Browser Enrollment Course'});
     try{
      await course.getByRole('button',{name:'ثبت‌نام در رویداد آموزشی'})
       .waitFor({state:'visible',timeout:12000});
     }catch(err){
      const ui=(await page.locator('main').innerText().catch(()=>
        '<unavailable>')).slice(-1700);
      throw Error('PH10_NAV06_ENROLLMENT_BUTTON_MISSING ui='+ui+
       ' source='+liveText+' cause='+String(err?.message).slice(0,100));
     }
     console.log('PH10_CHROMIUM_NAV06_ENROLL_BUTTON_READY');
     const enrollResponsePromise=page.waitForResponse(r=>r.request().method()==='POST'&&
       r.url().includes('/ph10/learning/events/'),{timeout:25000});
     await course.getByRole('button',{name:'ثبت‌نام در رویداد آموزشی'}).click({timeout:12000});
     console.log('PH10_CHROMIUM_NAV06_ENROLL_CLICKED');
     const enrollResponse=await enrollResponsePromise;
     console.log('PH10_CHROMIUM_NAV06_ENROLL_POST_RECEIVED_'+enrollResponse.status());
     // Playwright's response.text() may itself block on an unfinished response
     // body after Next emitted 403 headers. Never lose the actual HTTP status
     // behind a global 8-minute CI timeout.
     const enrollStatus=enrollResponse.status();
     if(enrollStatus!==201){
      const detail=await Promise.race([
       enrollResponse.text().then(x=>x.slice(0,300)).catch(()=>'<unavailable>'),
       new Promise(resolve=>setTimeout(()=>resolve('<body-read-timeout>'),1200))
      ]);
      throw Error('PH10_BROWSER_TRAINING_POST_STATUS_'+enrollStatus+
       ' url='+enrollResponse.url()+' body='+detail);
     }
     const enrolledBody=await enrollResponse.json();
     assert.equal(enrolledBody.registered,true);
     assert.equal(enrolledBody.registration,'CONFIRMED');
     assert.equal(enrolledBody.courseCompleted,false);
     assert.equal(enrolledBody.certificateIssued,false);
     console.log('PH10_BROWSER_LEARN_AT001_ENROLLED_NOT_COURSE_COMPLETED_PASS');
     console.log('PH10_CHROMIUM_NAV06_ENROLL_POST_STATUS_201');
     // If a browser result disagrees with POST, retain response and visible UI
     // evidence rather than hiding the actual failed functional journey.
     try{
      await course.getByText('ثبت‌نام تأیید شد').waitFor({state:'visible',timeout:10000});
     }catch(err){
      const visible=(await course.innerText().catch(()=>'<course removed>')).slice(0,1200);
      const readback=await page.request.get(
       'http://127.0.0.1:'+profile.port+'/api/tenants/'+tenant+'/ph10/NAV-06'
      );
      const content=(await readback.text().catch(()=>'<body unavailable>')).slice(0,1400);
      throw Error('PH10_BROWSER_ENROLLMENT_CONFIRMATION_FAILED '+
       'post='+enrollResponse.status()+
       ' source='+readback.status()+' '+content+
       ' visible='+visible+' cause='+String(err?.message).slice(0,180));
     }
     const persisted=await db.query(
      "SELECT count(*)::int AS n FROM tto.ph08_event_registrations WHERE event_id=$1 AND registered_by=$2",
      ['9c500000-0000-4000-8000-000000000003',user]);
     assert.equal(persisted.rows[0]?.n,1);
     // A page reload must display the server-persisted registration, not the
     // local React success state or another user's registration.
     await page.reload({waitUntil:'domcontentloaded',timeout:30000});
     await page.locator('#sw-tenant').waitFor({state:'visible',timeout:25000});
     await page.locator('#sw-tenant').selectOption(tenant);
     await page.getByRole('button',{name:'تأیید محدوده و استعلام'}).click();
     const restored=page.locator('li').filter({hasText:'PH10 Browser Enrollment Course'});
     await restored.getByText('ثبت‌نام تأیید شد').waitFor({state:'visible',timeout:20000});
     assert.equal(await restored.getByRole('button',{name:'ثبت‌نام در رویداد آموزشی'}).count(),0);
     checks++;
     console.log('PH10_SHAREHOLDER_BROWSER_ENROLLMENT_RELOAD_PERSISTENCE_PASS');
     // Cancellation is an authorized pre-existing DB state, not a browser
     // mutation or permission to register again. Verify its true read model.
     await db.query(
      "UPDATE tto.ph08_event_registrations SET state='CANCELLED' WHERE event_id=$1 AND registered_by=$2",
      ['9c500000-0000-4000-8000-000000000003',user]);
     await page.reload({waitUntil:'domcontentloaded',timeout:30000});
     await page.locator('#sw-tenant').waitFor({state:'visible',timeout:25000});
     await page.locator('#sw-tenant').selectOption(tenant);
     await page.getByRole('button',{name:'تأیید محدوده و استعلام'}).click();
     const cancelledCourse=page.locator('li').filter({hasText:'PH10 Browser Enrollment Course'});
     await cancelledCourse.getByText('ثبت‌نام قبلی لغو شده است').waitFor({state:'visible',timeout:20000});
     assert.equal(await cancelledCourse.getByRole('button',{name:'ثبت‌نام در رویداد آموزشی'}).count(),0);
     checks++;
     console.log('PH10_SHAREHOLDER_BROWSER_CANCELLED_NO_FALSE_REENROLL_PASS');

     console.log('PH10_SHAREHOLDER_REAL_BROWSER_ENROLLMENT_DATABASE_PERSISTENCE_PASS');
    }

    // The authenticated session must navigate through every valid module URL,
    // not just the one source-backed showcase. This is navigation/RTL coverage,
    // not evidence that each domain workflow is implemented.
    for(let nav=2;nav<=11;nav++){
     const slot='nav-'+String(nav).padStart(2,'0');
     const tab=await context.newPage();
     try{
      const response=await tab.goto('http://127.0.0.1:'+profile.port+'/modules/'+slot,
        {waitUntil:'domcontentloaded',timeout:30000});
      assert.equal(response.status(),200,
       'PH10_AUTHENTICATED_MODULE_STATUS_'+profile.kind+'_'+slot);
      assert.equal(await tab.locator('html').getAttribute('dir'),'rtl');
      const text=await tab.locator('body').innerText();
      assert.ok(text.length>0,'PH10_AUTHENTICATED_BLANK_MODULE_'+profile.kind+'_'+slot);
      assert.equal(text.includes('SEALED_SOURCE_IDENTITY'),false);
      checks++;
     }finally{await tab.close();}
    }
    console.log('PH10_AUTH_CHROMIUM_'+profile.kind.toUpperCase()+
      '_TEN_MODULE_NAVIGATION_RTL_PASS_NOT_ALL_WORKFLOWS');
    // Revoke only this isolated browser's session cookie, then verify a fresh
    // navigation cannot reuse previously fetched privileged page content.
    await context.clearCookies();
    const afterLogout=await context.newPage();
    try{
     const response=await afterLogout.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
     assert.equal(response.status(),200);
     assert.equal((await afterLogout.locator('body').innerText()).includes(profile.expected),false,
       'PH10_BROWSER_POST_LOGOUT_PRIVATE_RECORD_LEAK_'+profile.kind);
     checks++;
     console.log('PH10_AUTH_CHROMIUM_'+profile.kind.toUpperCase()+'_COOKIE_REVOCATION_PASS');
    }finally{await afterLogout.close();}


    // Same real browser route in a fresh unauthenticated context must not
    // reveal any synthetic tenant-private content observed above.
    const anonymous=await browser.newContext({locale:'fa-IR',viewport:{width:390,height:844}});
    try{
     const denied=await anonymous.newPage();
     const deniedResponse=await denied.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
     assert.equal(deniedResponse.status(),200);
     assert.equal((await denied.locator('body').innerText()).includes(profile.expected),false,
       'PH10_BROWSER_ANONYMOUS_PRIVATE_DATA_LEAK_'+profile.kind);
     assert.equal(await denied.locator('html').getAttribute('dir'),'rtl');
     checks++;
     console.log('PH10_AUTH_CHROMIUM_'+profile.kind.toUpperCase()+'_ANONYMOUS_SOURCE_DENY_PASS');
    // NAV-01 is the dashboard/root slot, not a /modules/[id] page. Assert it
    // is rejected rather than weakening route validation. NAV-02..11 render.
    for(let nav=1;nav<=11;nav++){
     const slot='nav-'+String(nav).padStart(2,'0');
     const publicRoute='http://127.0.0.1:'+profile.port+'/modules/'+slot;
     const pageResponse=await anonymous.newPage();
     try{
      const reply=await pageResponse.goto(publicRoute,{waitUntil:'domcontentloaded',timeout:30000});
      assert.equal(reply.status(),nav===1?404:200,
       'PH10_ANONYMOUS_NAV_HTTP_'+profile.kind+'_'+slot);
      if(nav!==1)assert.equal(await pageResponse.locator('html').getAttribute('dir'),'rtl');
      assert.equal((await pageResponse.locator('body').innerText()).includes(profile.expected),false,
       'PH10_ANONYMOUS_NAV_PRIVATE_RECORD_LEAK_'+profile.kind+'_'+slot);
      checks++;
     }finally{await pageResponse.close();}
    }

    }finally{await browserCleanupWithDeadline(()=>anonymous.close(),profile.kind+'_ANONYMOUS');}
    console.log('PH10_AUTH_CHROMIUM_'+profile.kind.toUpperCase()+'_REAL_SOURCE_RENDER_PASS');
   }finally{
    console.log('PH10_CHROMIUM_CLOSING_'+profile.kind.toUpperCase());
    await browserCleanupWithDeadline(()=>context.close(),profile.kind+'_AUTH_CONTEXT');
    console.log('PH10_CHROMIUM_CLOSED_'+profile.kind.toUpperCase());
   }
  }

  // Actual Chromium pages + browser-cookie-backed BFF -> Nest -> PG17.
  // This is a role/scope SOURCE SLICE, NOT 3 portals x all roles x all workflows.
  // Canonical source IDs and scope are separately checked in the exact-run ledger.
  const roleCases=[
   {id:'SHAREHOLDER_MEMBER',port:31679,token:memberToken,route:'nav-06',nav:'NAV-06',
    expectedStatus:200,requiredField:'course_title',requiredValue:'PH10 Browser Enrollment Course'},
   {id:'COOP_MANAGER',port:31678,token:managerToken,route:'nav-10',nav:'NAV-10',
    expectedStatus:200,requiredField:'kind',requiredValue:'ARTICLE129'},
   {id:'COOP_MEMBER',port:31678,token:memberToken,route:'nav-10',nav:'NAV-10',
    expectedStatus:200,requireEmpty:true},
   {id:'NATIONAL_OPERATOR',port:31680,token:profiles[2].token,route:'nav-09',nav:'NAV-09',
    expectedStatus:200,requiredField:'title',requiredValue:'Synthetic approved-to-display minute'},
   {id:'NATIONAL_MEMBER',port:31680,token:memberToken,route:'nav-09',nav:'NAV-09',
    expectedStatus:403},
   {id:'NATIONAL_MANAGER',port:31680,token:managerToken,route:'nav-09',nav:'NAV-09',
    expectedStatus:403}
  ];
  for(const actor of roleCases){
   const ctx=await browser.newContext({locale:'fa-IR',viewport:{width:390,height:844}});
   ctx.setDefaultTimeout(12000);
   try{
    await ctx.addCookies([{name:'tto_session',value:actor.token,domain:'127.0.0.1',
     path:'/',httpOnly:true,secure:false,sameSite:'Lax'}]);
    const page=await ctx.newPage();
    const nav=await page.goto('http://127.0.0.1:'+actor.port+'/modules/'+actor.route,
     {waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(nav.status(),200,'PH10_ROLE_REAL_PAGE_MISSING_'+actor.id);
    assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
    const source=await page.request.get('http://127.0.0.1:'+actor.port+
     '/api/tenants/'+tenant+'/ph10/'+actor.nav,{timeout:15000});
    assert.equal(source.status(),actor.expectedStatus,
     'PH10_ROLE_SOURCE_HTTP_'+actor.id+'_'+source.status());
    assert.match(source.headers()['cache-control']??'',/no-store/);
    const read=await source.json();
    if(actor.requiredField){
     assert.equal(read.available,true);
     assert.equal(read.sourceBound===true||read.scope==='JIT_DOCUMENT_REVIEW_ONLY',true);
     assert.ok(read.items?.some(x=>x[actor.requiredField]===actor.requiredValue),
      'PH10_ROLE_SOURCE_RECORD_MISSING_'+actor.id);
    }
    if(actor.requireEmpty){
     assert.equal(read.available,true);
     assert.deepEqual(read.items,[],'PH10_ROLE_PRIVILEGED_GRC_EXPOSED_TO_MEMBER');
     assert.equal((await page.locator('body').innerText()).includes('ARTICLE129'),false);
    }
    if(actor.expectedStatus===403){
     assert.equal(read.available,false);
     assert.equal((await page.locator('body').innerText()).includes('Synthetic approved-to-display minute'),false,
       'PH10_ROLE_FORBIDDEN_NATIONAL_DOC_RENDERED');
    }
    checks++;
    console.log('PH10_ROLE_BROWSER_'+actor.id+'_SOURCE_SCOPE_PASS');
    if(actor.id==='SHAREHOLDER_MEMBER'||actor.id==='COOP_MANAGER'||
       actor.id==='NATIONAL_OPERATOR'){
     const foreignRead=await page.request.get('http://127.0.0.1:'+actor.port+
       '/api/tenants/'+foreign+'/ph10/'+actor.nav,{timeout:15000});
     assert.equal(foreignRead.status(),403,'PH10_ROLE_CROSS_TENANT_ACCEPTED_'+actor.id);
     checks++;
     console.log('PH10_ROLE_BROWSER_'+actor.id+'_FOREIGN_TENANT_DENIED_PASS');
    }
   }finally{
    await browserCleanupWithDeadline(()=>ctx.close(),'ROLE_MATRIX_'+actor.id);
   }
  }
  // Role-manager enrollment must be rejected by the real BFF (no mutation).
  const managerCtx=await browser.newContext({locale:'fa-IR',viewport:{width:390,height:844}});
  try{
   await managerCtx.addCookies([{name:'tto_session',value:managerToken,domain:'127.0.0.1',
    path:'/',httpOnly:true,secure:false,sameSite:'Lax'}]);
   const page=await managerCtx.newPage();
   await page.goto('http://127.0.0.1:31679/modules/nav-06',{waitUntil:'domcontentloaded'});
   const rejected=await page.request.post('http://127.0.0.1:31679/api/tenants/'+tenant+
     '/ph10/learning/events/9c500000-0000-4000-8000-000000000003/enroll',
     {timeout:15000});
   assert.equal(rejected.status(),403,'PH10_MANAGER_WAS_ALLOWED_MEMBER_TRAINING_ENROLLMENT');
   console.log('PH10_ROLE_BROWSER_MANAGER_MEMBER_ENROLLMENT_DENIED_PASS');
  }finally{await browserCleanupWithDeadline(()=>managerCtx.close(),'ROLE_MANAGER_DENY');}
  for(const [port,nav] of [[31679,'NAV-06'],[31678,'NAV-10'],[31680,'NAV-09']]){
   const anon=await browser.newContext({locale:'fa-IR',viewport:{width:390,height:844}});
   try{
    const page=await anon.newPage();
    await page.goto('http://127.0.0.1:'+port+'/modules/'+nav.toLowerCase(),
     {waitUntil:'domcontentloaded',timeout:30000});
    const resp=await page.request.get('http://127.0.0.1:'+port+
      '/api/tenants/'+tenant+'/ph10/'+nav,{timeout:15000});
    assert.equal(resp.status(),401,'PH10_ROLE_ANON_AUTH_BYPASS_'+nav);
    checks++;
   }finally{await browserCleanupWithDeadline(()=>anon.close(),'ROLE_ANON_'+nav);}
  }
  console.log('PH10_ROLE_BROWSER_ALL_THREE_PORTAL_ANON_BFF_DENIES_PASS');
 }finally{await browserCleanupWithDeadline(()=>browser.close(),'BROWSER');}
}
async function testFivePreflightBffs(memberToken,managerToken,syntheticOrder,lateTender,openedTender){
 // Real CI: browser/Next BFF -> Nest real HTTP -> disposable PostgreSQL17.
 // Every result remains a preflight, NEVER an executed regulated operation.
 const shareholder='http://127.0.0.1:31679',cooperative='http://127.0.0.1:31678';
 async function call(base,kind,id,token,expected=200,tenantId=tenant){
  const uri=base+'/api/tenants/'+tenantId+'/ph10/preflight/'+kind+'/'+id;
  const res=await fetch(uri,{headers:token?{Cookie:'tto_session='+token}:{}});
  const json=await res.json().catch(()=>null);
  assert.equal(res.status,expected,'PH10_PREFLIGHT_NEXT_BFF_'+kind+' '+JSON.stringify(json).slice(0,240));
  assert.match(res.headers.get('cache-control')??'',/no-store/);
  checks++;
  if(expected===200){
   assert.equal(json.available,true);
   assert.equal(json.readOnly,true);
   assert.equal(json.preflightOnly,true);
   assert.equal(json.operationGate,'BLOCKED');
   assert.equal(json.legalApproval,false);
  }
  return json;
 }
 await call(shareholder,'checkout',p8offer,null,401);
 await call(shareholder,'checkout',p8offer,managerToken,403);
 await call(shareholder,'checkout',p8offer,memberToken,403,foreign);
 const checkout=await call(shareholder,'checkout',p8offer,memberToken);
 assert.equal(checkout.sellerKind,'COOPERATIVE');
 assert.equal(checkout.paymentEnabled,false);
 assert.equal(checkout.orderCreated,false);
 console.log('PH10_REAL_BFF_PH08_MKT_AT002_CHECKOUT_PREFLIGHT_SCOPED_PASS');
 const refund=await call(shareholder,'refund',syntheticOrder,memberToken);
 assert.equal(refund.policyVersion,'PH08_REFUND_POLICY_V1');
 assert.equal(refund.refundExecuted,false);
 console.log('PH10_REAL_BFF_PH08_MKT_AT003_REFUND_PREFLIGHT_SCOPED_PASS');
 await call(shareholder,'refund',syntheticOrder,memberToken,403,foreign);
 for(const [kind,source] of [['bid',lateTender],['criteria',openedTender],['threshold','AUDIT_RFQ_THRESHOLD']]){
  await call(cooperative,kind,source,null,401);
  await call(cooperative,kind,source,memberToken,403);
  await call(cooperative,kind,source,managerToken,403,foreign);
  const row=await call(cooperative,kind,source,managerToken);
  if(kind==='bid'){assert.equal(row.deadlinePassed,true);assert.equal(row.bidSubmissionEnabled,false);}
  if(kind==='criteria'){assert.equal(row.criteriaFrozen,true);assert.equal(row.criteriaEditEnabled,false);}
  if(kind==='threshold'){assert.equal(row.versions.length,2);assert.equal(row.policyMutationEnabled,false);}
  const markers={
   bid:'PH10_REAL_BFF_PH08_PROC_AT001_LATE_BID_PREFLIGHT_SCOPED_PASS',
   criteria:'PH10_REAL_BFF_PH08_PROC_AT003_CRITERIA_LOCK_PREFLIGHT_SCOPED_PASS',
   threshold:'PH10_REAL_BFF_PH08_PROC_AT006_POLICY_VERSIONS_PREFLIGHT_SCOPED_PASS'
  };
  console.log(markers[kind]);
 }
 await call(cooperative,'threshold','lowercase',managerToken,400);
 // Chromium consumes the authenticated same-origin Next route with a real cookie,
 // not a mock of either the BFF or the backend.
 if(process.env.PH10_AUTH_CHROMIUM==='1'){
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
   for(const item of [
    {base:shareholder,token:memberToken,kind:'checkout',source:p8offer,field:'paymentEnabled'},
    {base:cooperative,token:managerToken,kind:'criteria',source:openedTender,field:'criteriaEditEnabled'}
   ]){
    const context=await browser.newContext({locale:'fa-IR',viewport:{width:390,height:844}});
    try{
     await context.addCookies([{name:'tto_session',value:item.token,domain:'127.0.0.1',path:'/',httpOnly:true,secure:false,sameSite:'Lax'}]);
     const page=await context.newPage();
     await page.goto(item.base+(item.kind==='checkout'?'/modules/nav-07':'/modules/nav-10'),{waitUntil:'domcontentloaded',timeout:30000});
     const result=await page.evaluate(async url=>{
      const response=await fetch(url,{credentials:'same-origin'});
      return {status:response.status,data:await response.json()};
     },item.base+'/api/tenants/'+tenant+'/ph10/preflight/'+item.kind+'/'+item.source);
     assert.equal(result.status,200);
     assert.equal(result.data.operationGate,'BLOCKED');
     assert.equal(result.data[item.field],false);
     assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
     checks++;
    }finally{await context.close();}
   }
   console.log('PH10_PH08_CHROMIUM_SAME_ORIGIN_PREFLIGHT_BFF_NEST_PG17_PASS');
  }finally{await browser.close();}
 }
 console.log('PH10_PH08_FIVE_PREFLIGHT_BFF_NEST_REAL_PG17_SCOPE_PASS_NOT_FULL_USER_JOURNEYS');
}
async function main(){
 await db.connect();await seed();
 const memberToken=await token(user),managerToken=await token(manager),foreignToken=await token(outsider);
 await start();
 const me='/v1/tenants/'+tenant+'/ph09';
 const other='/v1/tenants/'+foreign+'/ph09';
 await request('GET',me+'/opportunities',null,401);
 let x=await request('GET',me+'/opportunities',memberToken,200);
 assert.equal(x.items.length,1);assert.equal(x.items[0].title,'Member opportunity');
 x=await request('GET',other+'/opportunities',memberToken,200);
 assert.equal(x.items.length,0);
 await request('POST',me+'/opportunities/'+opportunity+'/apply',memberToken,201);
 await request('POST',me+'/opportunities/'+opportunity+'/apply',memberToken,403);
 await request('POST',me+'/opportunities/'+opportunity+'/apply',managerToken,403);
 await request('POST',other+'/opportunities/'+foreignOpportunity+'/apply',memberToken,403);
 console.log('PH09_REAL_NEST_OPP_MEMBER_ROLE_TENANT_DUPLICATE_HTTP_PASS');
 x=await request('GET',me+'/impact/approved',memberToken,200);
 assert.equal(x.items.length,1);assert.equal(x.items[0].claim_id,claim);
 x=await request('GET',other+'/impact/approved',memberToken,200);assert.equal(x.items.length,0);
 console.log('PH09_REAL_NEST_IMPACT_APPROVED_ONLY_TENANT_HTTP_PASS');
 x=await request('GET',me+'/grc/cases',memberToken,200);assert.equal(x.items.length,0);
 x=await request('GET',me+'/grc/cases',managerToken,200);
 assert.equal(x.items.length,1);assert.equal(x.items[0].kind,'ARTICLE129');
 x=await request('GET',me+'/grc/'+case129+'/can-finalize',managerToken,200);
 assert.equal(x.allowed,false);assert.equal(x.decisionIsLegalApproval,false);
 console.log('PH09_REAL_NEST_GRC_MANAGER_NO_WHISTLEBLOWER_HTTP_PASS');
 x=await request('GET',me+'/network/metrics/'+snapshot,managerToken,200);
 assert.equal(x.label,'SUPPRESSED');assert.equal(x.value,null);
 await request('GET',me+'/network/metrics/'+snapshot,memberToken,403);
 await request('GET',me+'/network/metrics/'+foreignSnapshot,managerToken,403);
 console.log('PH09_REAL_NEST_NI_COHORT_PRIVATE_TENANT_HTTP_PASS');
 x=await request('GET',me+'/data-governance/records',memberToken,200);
 assert.equal(x.items.length,0);
 x=await request('GET',me+'/data-governance/records',managerToken,200);
 assert.ok(x.items.some(v=>v.record_id===held));
 assert.ok(x.items.some(v=>v.record_id===eligible));
 await request('POST',me+'/data-governance/records/'+held+'/dispose',managerToken,403);
 await request('POST',me+'/data-governance/records/'+eligible+'/dispose',memberToken,403);
 x=await request('POST',me+'/data-governance/records/'+eligible+'/dispose',managerToken,201);
 assert.equal(x.disposed,true);
 await request('POST',me+'/data-governance/records/'+eligible+'/dispose',managerToken,403);
 console.log('PH09_REAL_NEST_DG_HOLD_PRIVILEGE_ATOMIC_DISPOSE_HTTP_PASS');

 const p8='/v1/tenants/'+tenant+'/ph08', p8Other='/v1/tenants/'+foreign+'/ph08';

 // Cross-cutting security: every implemented PH08 Nest route MUST reject
 // an unauthenticated request. No real tenant credentials or operations used.
 const protectedPH08=[
  ['GET','/projects/disclosures'],
  ['GET','/voice/open-polls'],
  ['POST','/voice/'+p8poll+'/respond','{"answer":"no token"}'],
  ['GET','/learning/events'],
  ['POST','/learning/events/'+p8event+'/enroll'],
  ['GET','/benefits/my-vouchers'],
  ['POST','/benefits/vouchers/'+p8voucher+'/redeem'],
  ['GET','/market/offers'],
  ['GET','/procurement/tenders']
 ];
 for(const [method,route,payload] of protectedPH08){
  await request(method,p8+route,null,401,payload);
 }
 // Regression: authentication takes precedence over domain validation.
 // An authenticated malformed domain body still reports 400, not 401.
 await request('POST',p8+'/voice/'+p8poll+'/respond',null,401,'{}');
 await request('POST',p8+'/voice/'+p8poll+'/respond',memberToken,400,'{}');
 console.log('PH10_PH08_POLL_AUTH_PRECEDES_DOMAIN_FIELD_VALIDATION_PASS');
 console.log('PH10_PH08_ALL_NINE_REAL_NEST_ROUTES_REQUIRE_BEARER_PASS');
 await request('GET',p8+'/projects/disclosures',null,401);
 let y=await request('GET',p8+'/projects/disclosures',memberToken,200);
 assert.equal(y.items.length,1);assert.equal(y.items[0].name,'PH10 Approved Project');
 y=await request('GET',p8Other+'/projects/disclosures',memberToken,200);
 assert.equal(y.items.length,0);
 console.log('PH10_REAL_HTTP_PH08_APPROVED_PROJECT_DISCLOSURE_PASS');
 // PROJ-AT-004: authenticated disclosure is read-only and never returns a share/title claim.
 const disclosed=await request('GET',p8+'/projects/disclosures',memberToken,200);
 assert.equal(disclosed.items.length,1);assert.equal(disclosed.items[0].project_id,p8project);
 assert.equal(disclosed.readOnly,true);
 assert.ok(disclosed.items.every(v=>!Object.hasOwn(v,'share_quantity')&&!Object.hasOwn(v,'ownership_certificate')));
 console.log('PH10_REAL_HTTP_PH08_PROJ_AT004_READONLY_NO_OWNERSHIP_FIELDS_PASS');
 y=await request('GET',p8+'/voice/open-polls',memberToken,200);
 assert.equal(y.items.length,1);assert.equal(y.items[0].poll_id,p8poll);
 y=await request('GET',p8+'/voice/open-polls',managerToken,200);
 assert.equal(y.items.length,0);
 console.log('PH10_REAL_HTTP_PH08_POLL_AUDIENCE_AND_ROLE_PASS');
 y=await request('GET',p8+'/learning/events',memberToken,200);
 assert.equal(y.items.length,1);assert.equal(y.items[0].refund_policy_version,'PH10_REFUND_V1');
 y=await request('GET',p8Other+'/learning/events',memberToken,200);
 assert.equal(y.items.length,0);
 console.log('PH10_REAL_HTTP_PH08_TRAINING_TENANT_SCOPE_PASS');
 // LEARN-AT-006: published event read retains the explicit policy-version snapshot.
 const refundVersion=await request('GET',p8+'/learning/events',memberToken,200);
 assert.equal(refundVersion.items.find(v=>v.event_id===p8event)?.refund_policy_version,'PH10_REFUND_V1');
 console.log('PH10_REAL_HTTP_PH08_LEARN_AT006_REFUND_POLICY_READ_VERSION_PASS');
 y=await request('GET',p8+'/benefits/my-vouchers',memberToken,200);
 assert.equal(y.items.length,1);assert.equal(y.items[0].voucher_id,p8voucher);
 y=await request('GET',p8+'/benefits/my-vouchers',managerToken,200);
 assert.equal(y.items.length,0);
 console.log('PH10_REAL_HTTP_PH08_NONCASH_BENEFIT_OWNERSHIP_PASS');
 y=await request('GET',p8+'/market/offers',memberToken,200);
 assert.equal(y.items.length,1);assert.equal(y.items[0].seller_kind,'COOPERATIVE');
 y=await request('GET',p8Other+'/market/offers',memberToken,200);
 assert.equal(y.items.length,0);
 console.log('PH10_REAL_HTTP_PH08_MARKET_COOPERATIVE_TENANT_PASS');
 // MKT-AT-006: foreign cooperative seller is not exposed to tenant member.
 const foreignSellerRead=await request('GET',p8Other+'/market/offers',memberToken,200);
 assert.equal(foreignSellerRead.items.some(v=>v.offer_id===p8offer),false);
 console.log('PH10_REAL_HTTP_PH08_MKT_AT006_FOREIGN_SELLER_READ_DENIED_PASS');
 y=await request('GET',p8+'/procurement/tenders',managerToken,200);
 assert.equal(y.items.length,1);assert.equal(y.items[0].tender_id,p8tender);
 assert.ok(!Object.prototype.hasOwnProperty.call(y.items[0],'sealed_content'));
 y=await request('GET',p8+'/procurement/tenders',memberToken,200);
 assert.equal(y.items.length,0);
 console.log('PH10_REAL_HTTP_PH08_MANAGER_TENDER_METADATA_ONLY_PASS');
 // PROC-AT-002: exposed tender metadata cannot include sealed bid payload.
 const tenderManagerView=await request('GET',p8+'/procurement/tenders',managerToken,200);
 assert.equal(tenderManagerView.items.length,1);
 assert.ok(tenderManagerView.items.every(v=>!Object.hasOwn(v,'sealed_content')&&!Object.hasOwn(v,'bid_secret')));
 console.log('PH10_REAL_HTTP_PH08_PROC_AT002_SEALED_BID_METADATA_HIDDEN_PASS');
 y=await request('POST',p8+'/voice/'+p8poll+'/respond',memberToken,201,'{"answer":"support"}');
 assert.equal(y.recorded,true);assert.equal(y.legalVote,false);
 await request('POST',p8+'/voice/'+p8poll+'/respond',memberToken,403,'{"answer":"duplicate"}');
 await request('POST',p8+'/voice/'+p8poll+'/respond',managerToken,403,'{"answer":"not audience"}');
 await request('POST',p8Other+'/voice/'+p8poll+'/respond',memberToken,403,'{"answer":"cross tenant"}');
 console.log('PH10_REAL_HTTP_PH08_POLL_DUPLICATE_AND_AUDIENCE_PASS');
 // VOICE-AT-001: recorded consultation is never a binding statutory resolution.
 assert.equal(y.legalVote,false);
 console.log('PH10_REAL_HTTP_PH08_VOICE_AT001_RECORDED_RESPONSE_NONLEGAL_PASS');
 // Frozen VOICE-AT-002: an expired but properly audience-scoped poll cannot accept a late HTTP write.
 const ph08LatePoll='9c300000-0000-4000-8000-000000000099';
 await db.query("INSERT INTO tto.ph08_polls(poll_id,tenant_id,title,deadline,min_aggregate_size) VALUES($1,$2,'Synthetic expired API poll',now()-interval '1 minute',5)",[ph08LatePoll,tenant]);
 await db.query("INSERT INTO tto.ph08_poll_audience(poll_id,user_id) VALUES($1,$2)",[ph08LatePoll,user]);
 await request('POST',p8+'/voice/'+ph08LatePoll+'/respond',memberToken,403,'{"answer":"late reply"}');
 const ph08LateCount=await db.query("SELECT count(*)::int AS n FROM tto.ph08_poll_answers WHERE poll_id=$1",[ph08LatePoll]);
 assert.equal(ph08LateCount.rows[0].n,0,'VOICE-AT-002 expired poll wrote an answer');
 console.log('PH10_REAL_HTTP_PH08_VOICE_AT002_EXPIRED_NO_EFFECT_PASS');
 y=await request('POST',p8+'/learning/events/'+p8event+'/enroll',memberToken,201);
 assert.equal(y.registration,'CONFIRMED');assert.equal(y.courseCompleted,false);
 await request('POST',p8+'/learning/events/'+p8event+'/enroll',memberToken,409);
 await request('POST',p8+'/learning/events/'+p8event+'/enroll',managerToken,403);
 await request('POST',p8Other+'/learning/events/'+p8event+'/enroll',memberToken,403);
 console.log('PH10_REAL_HTTP_PH08_ENROLL_CAPACITY_DUPLICATE_ROLE_PASS');
 y=await request('POST',p8+'/benefits/vouchers/'+p8voucher+'/redeem',memberToken,201);
 assert.equal(y.redeemed,true);assert.equal(y.walletCredit,false);assert.equal(y.cashTransfer,false);
 await request('POST',p8+'/benefits/vouchers/'+p8voucher+'/redeem',memberToken,403);
 await request('POST',p8+'/benefits/vouchers/'+p8voucher+'/redeem',managerToken,403);
 await request('POST',p8Other+'/benefits/vouchers/'+p8voucher+'/redeem',memberToken,403);
 console.log('PH10_REAL_HTTP_PH08_VOUCHER_SINGLE_USE_AND_NO_CASH_PASS');
 // BEN-AT-004: expired voucher with valid owner must reject, with zero redemption.
 const expiredBenefit='9c600000-0000-4000-8000-000000000098';
 const expiredEntitlement='9c700000-0000-4000-8000-000000000098';
 const expiredVoucher='9c800000-0000-4000-8000-000000000098';
 await db.query("INSERT INTO tto.ph08_benefits(benefit_id,tenant_id,title,limited,status) VALUES($1,$2,'Expired synthetic reward',false,'ACTIVE')",[expiredBenefit,tenant]);
 await db.query("INSERT INTO tto.ph08_benefit_entitlements(entitlement_id,benefit_id,tenant_id,holder_id,noncash_units) VALUES($1,$2,$3,$4,1)",[expiredEntitlement,expiredBenefit,tenant,user]);
 await db.query("INSERT INTO tto.ph08_benefit_vouchers(voucher_id,entitlement_id,expires_at) VALUES($1,$2,now()-interval '1 minute')",[expiredVoucher,expiredEntitlement]);
 await request('POST',p8+'/benefits/vouchers/'+expiredVoucher+'/redeem',memberToken,403);
 const expiredUnchanged=await db.query("SELECT redeemed_at IS NULL AS untouched FROM tto.ph08_benefit_vouchers WHERE voucher_id=$1",[expiredVoucher]);
 assert.equal(expiredUnchanged.rows[0].untouched,true);
 console.log('PH10_REAL_HTTP_PH08_BEN_AT004_EXPIRED_VOUCHER_NO_WRITE_PASS');
 // BEN-AT-006 partial: no dividend, cash wallet or transferable-value claim.
 assert.equal(y.walletCredit,false);
 assert.equal(y.cashTransfer,false);
 console.log('PH10_REAL_HTTP_PH08_BEN_AT006_NONCASH_NOT_DIVIDEND_READ_PASS');

 // The following FOUR controls prove only that unimplemented write routes stay
 // unreachable; they do not certify their unimplemented PH08 source workflows.
 const projectBefore=await db.query("SELECT status FROM tto.ph08_projects WHERE project_id=$1",[p8project]);
 await request('POST',p8+'/projects/'+p8project+'/activate',managerToken,404,'{"permitId":null}');
 const projectAfter=await db.query("SELECT status FROM tto.ph08_projects WHERE project_id=$1",[p8project]);
 assert.equal(projectAfter.rows[0].status,projectBefore.rows[0].status);
 console.log('PH10_REAL_HTTP_PH08_PROJ_AT001_ABSENT_ACTIVATION_ROUTE_GUARD_PASS');
 await request('POST',p8+'/learning/events/'+p8event+'/issue-certificate',memberToken,404);
 console.log('PH10_REAL_HTTP_PH08_LEARN_AT004_ABSENT_CERTIFICATE_ROUTE_GUARD_PASS');
 await request('POST',p8+'/market/sensitive-targeting',managerToken,404,'{"protectedAttribute":"synthetic"}');
 console.log('PH10_REAL_HTTP_PH08_MKT_AT005_ABSENT_TARGETING_ROUTE_GUARD_PASS');
 await request('POST',p8+'/procurement/group-payment-pools',managerToken,404,'{"syntheticAmount":1}');
 console.log('PH10_REAL_HTTP_PH08_PROC_AT004_ABSENT_PAYMENT_POOL_ROUTE_GUARD_PASS');
 // PH08 VOICE-AT-005: only a MEMBER can see even a redacted aggregate;
 // 1 < min_aggregate_size=5, so zero cohort values leave no numeric leak.
 const smallAggregate=await request('GET',p8+'/voice/'+p8poll+'/aggregate',memberToken,200);
 assert.equal(smallAggregate.count,null);
 assert.equal(smallAggregate.suppressed,true);
 assert.equal(smallAggregate.legalResolution,false);
 await request('GET',p8+'/voice/'+p8poll+'/aggregate',managerToken,403);
 await request('GET',p8Other+'/voice/'+p8poll+'/aggregate',memberToken,403);
 console.log('PH10_REAL_HTTP_PH08_VOICE_AT005_SMALL_COHORT_MEMBER_ONLY_SUPPRESSION_PASS');
 // PH08 PROJ-AT-003: manager source-evidence completion creates exactly
 // one immutable milestone event; member, duplicate and foreign denied.
 const ph08Milestone='9cb00000-0000-4000-8000-000000000041';
 await db.query("INSERT INTO tto.ph08_milestones(milestone_id,project_id,label) VALUES($1,$2,'Synthetic audit milestone')",[ph08Milestone,p8project]);
 const milestoneUrl=p8+'/projects/milestones/'+ph08Milestone+'/complete';
 const evidenceJson=JSON.stringify({evidenceId:evidence});
 await request('POST',milestoneUrl,memberToken,403,evidenceJson);
 await request('POST',p8Other+'/projects/milestones/'+ph08Milestone+'/complete',managerToken,403,evidenceJson);
 const milestoneDone=await request('POST',milestoneUrl,managerToken,201,evidenceJson);
 assert.equal(milestoneDone.completed,true);assert.equal(milestoneDone.legalApproval,false);
 await request('POST',milestoneUrl,managerToken,403,evidenceJson);
 const eventEvidence=await db.query("SELECT count(*)::integer AS n FROM tto.ph08_project_events WHERE milestone_id=$1 AND kind='MILESTONE_COMPLETED'",[ph08Milestone]);
 assert.equal(eventEvidence.rows[0].n,1);
 console.log('PH10_REAL_HTTP_PH08_PROJ_AT003_MANAGER_MILESTONE_SINGLE_AUDIT_EVENT_PASS');
 // PH08 PROJ-AT-006: two same-version HTTP writes must serialize 1 success,
 // 1 conflict. Only the version counter changes; it is not project approval.
 const casUrl=p8+'/projects/'+p8project+'/versions/cas';
 const versionBody=JSON.stringify({expectedVersion:1});
 await request('POST',casUrl,memberToken,403,versionBody);
 await request('POST',p8Other+'/projects/'+p8project+'/versions/cas',managerToken,403,versionBody);
 await request('POST',casUrl,managerToken,400,JSON.stringify({expectedVersion:0}));
 const versionRace=await Promise.all([0,1].map(()=>fetch(root+casUrl,{method:'POST',
  headers:{authorization:'Bearer '+managerToken,'content-type':'application/json'},body:versionBody})));
 assert.deepEqual(versionRace.map(v=>v.status).sort((a,b)=>a-b),[201,409]);
 const currentVersion=await db.query("SELECT version,status FROM tto.ph08_projects WHERE project_id=$1",[p8project]);
 assert.equal(Number(currentVersion.rows[0].version),2);
 assert.equal(currentVersion.rows[0].status,'DRAFT');
 checks+=2;
 console.log('PH10_REAL_HTTP_PH08_PROJ_AT006_VERSION_ONLY_CONCURRENT_CAS_PASS');
 await testCooperativeBff(memberToken,managerToken);
 await testShareholderBff(memberToken,managerToken);
 await testNationalJitBff(foreignToken,managerToken);
 // Independent browser-only artificial event, distinct from API/BFF tests.
 await db.query("INSERT INTO tto.ph08_courses(course_id,tenant_id,title,status) VALUES($1,$2,'PH10 Browser Enrollment Course','ACTIVE')",
  ['9c400000-0000-4000-8000-000000000003',tenant]);
 await db.query("INSERT INTO tto.ph08_training_events(event_id,course_id,tenant_id,capacity,refund_policy_version) VALUES($1,$2,$3,5,'PH10_REFUND_V1')",
  ['9c500000-0000-4000-8000-000000000003','9c400000-0000-4000-8000-000000000003',tenant]);
 await testActualAuthenticatedBrowser(memberToken,managerToken);
 // LEARN-AT-002 partial: two concurrent enrollments from the same actor are atomic,
 // but this is NOT a two-different-member capacity stress test.
 const oneSeatEvent='9c500000-0000-4000-8000-000000000098';
 await db.query("INSERT INTO tto.ph08_training_events(event_id,course_id,tenant_id,capacity,refund_policy_version) VALUES($1,$2,$3,1,'PH10_REFUND_V1')",[oneSeatEvent,p8course,tenant]);
 const oneSeatPath=p8+'/learning/events/'+oneSeatEvent+'/enroll';
 const raceEnroll=()=>fetch(root+oneSeatPath,{method:'POST',headers:{authorization:'Bearer '+memberToken}});
 const bothEnroll=await Promise.all([raceEnroll(),raceEnroll()]);
 assert.deepEqual(bothEnroll.map(v=>v.status).sort((a,b)=>a-b),[201,409]);
 const seatCount=await db.query("SELECT count(*)::integer AS n FROM tto.ph08_event_registrations WHERE event_id=$1 AND state='CONFIRMED'",[oneSeatEvent]);
 assert.equal(seatCount.rows[0].n,1);
 console.log('PH10_REAL_HTTP_PH08_LEARN_AT002_SINGLE_ACTOR_CONCURRENT_CAPACITY_BOUNDARY_PASS');

 // LEARN-AT-003: a manager may promote one waitlisted enrollee only
 // after a real seat becomes free. No certificate or completion is issued.
 const promoEvent='9c500000-0000-4000-8000-000000000097';
 await db.query("INSERT INTO tto.ph08_training_events(event_id,course_id,tenant_id,capacity,refund_policy_version) VALUES($1,$2,$3,1,'PH10_REFUND_V1')",[promoEvent,p8course,tenant]);
 await db.query("INSERT INTO tto.ph08_event_registrations(registration_id,event_id,registered_by,state) VALUES($1,$2,$3,'CONFIRMED'),($4,$2,$5,'WAITLIST')",
  [randomUUID(),promoEvent,manager,randomUUID(),user]);
 const promoteUri=p8+'/learning/events/'+promoEvent+'/waitlist/promote';
 await request('POST',promoteUri,memberToken,403);
 await request('POST',p8Other+'/learning/events/'+promoEvent+'/waitlist/promote',managerToken,403);
 await request('POST',promoteUri,managerToken,403);
 await db.query("UPDATE tto.ph08_event_registrations SET state='CANCELLED' WHERE event_id=$1 AND registered_by=$2",[promoEvent,manager]);
 const promotion=await request('POST',promoteUri,managerToken,201);
 assert.equal(promotion.promoted,true);
 assert.equal(promotion.certificateIssued,false);
 await request('POST',promoteUri,managerToken,403);
 const promotedUser=await db.query("SELECT state FROM tto.ph08_event_registrations WHERE event_id=$1 AND registered_by=$2",[promoEvent,user]);
 assert.equal(promotedUser.rows[0].state,'CONFIRMED');
 console.log('PH10_REAL_HTTP_PH08_LEARN_AT003_REAL_VACANCY_PROMOTION_PASS');
 // PROC-AT-005: after a synthetically opened deadline, a manager with an
 // unresolved evaluator conflict must be marked ineligible; closing it
 // changes read-only eligibility, never grants legal authority or bid access.
 const conflictTender='9ca00000-0000-4000-8000-000000000097';
 await db.query("INSERT INTO tto.ph08_sourcing_tenders(tender_id,tenant_id,deadline,opened_at,criteria_version,source_policy) VALUES($1,$2,now()-interval '2 hours',now()-interval '1 hour',1,$3)",
  [conflictTender,tenant,evidence]);
 await db.query("INSERT INTO tto.ph08_evaluator_conflicts(tender_id,evaluator_id,status) VALUES($1,$2,'OPEN')",[conflictTender,manager]);
 const eligibilityUri=p8+'/procurement/tenders/'+conflictTender+'/evaluator-eligibility';
 await request('GET',eligibilityUri,memberToken,403);
 await request('GET',p8Other+'/procurement/tenders/'+conflictTender+'/evaluator-eligibility',managerToken,403);
 let eligibility=await request('GET',eligibilityUri,managerToken,200);
 assert.equal(eligibility.eligible,false);
 assert.equal(eligibility.mayReadSealedBid,false);
 await db.query("UPDATE tto.ph08_evaluator_conflicts SET status='RESOLVED' WHERE tender_id=$1 AND evaluator_id=$2",[conflictTender,manager]);
 eligibility=await request('GET',eligibilityUri,managerToken,200);
 assert.equal(eligibility.eligible,true);
 assert.equal(eligibility.legalApproval,false);
 console.log('PH10_REAL_HTTP_PH08_PROC_AT005_CONFLICT_OF_INTEREST_ELIGIBILITY_GUARD_PASS');

 // LEARN-AT-005: history remains accessible only to its registered
 // member after retirement; it does not issue a new certificate.
 const retiredCourse='9c400000-0000-4000-8000-000000000096';
 const retiredEvent='9c500000-0000-4000-8000-000000000096';
 await db.query("INSERT INTO tto.ph08_courses(course_id,tenant_id,title,status) VALUES($1,$2,'Synthetic retired learning','RETIRED')",[retiredCourse,tenant]);
 await db.query("INSERT INTO tto.ph08_training_events(event_id,course_id,tenant_id,capacity,refund_policy_version) VALUES($1,$2,$3,2,'PH10_REFUND_V1')",[retiredEvent,retiredCourse,tenant]);
 await db.query("INSERT INTO tto.ph08_event_registrations(registration_id,event_id,registered_by,state) VALUES($1,$2,$3,'CANCELLED')",[randomUUID(),retiredEvent,user]);
 const retiredHistory=await request('GET',p8+'/learning/retired-history',memberToken,200);
 assert.equal(retiredHistory.items.some(v=>v.event_id===retiredEvent&&v.course_title==='Synthetic retired learning'),true);
 await request('GET',p8+'/learning/retired-history',managerToken,403);
 await request('GET',p8Other+'/learning/retired-history',memberToken,403);
 console.log('PH10_REAL_HTTP_PH08_LEARN_AT005_RETIRED_COURSE_MEMBER_HISTORY_PASS');
 // MKT-AT-004: sponsored creatives always carry sponsored=true,
 // official_notice=false and are tenant/member scoped.
 const adLocal='9cc00000-0000-4000-8000-000000000096';
 const adForeign='9cc00000-0000-4000-8000-000000000095';
 await db.query("INSERT INTO tto.ph08_ad_creatives(creative_id,tenant_id,caption) VALUES($1,$2,'Synthetic sponsored test creative'),($3,$4,'Foreign synthetic creative')",
  [adLocal,tenant,adForeign,foreign]);
 const sponsored=await request('GET',p8+'/market/sponsored-creatives',memberToken,200);
 assert.equal(sponsored.items.length,1);
 assert.equal(sponsored.items[0].creative_id,adLocal);
 assert.equal(sponsored.items[0].sponsored,true);
 assert.equal(sponsored.items[0].official_notice,false);
 await request('GET',p8+'/market/sponsored-creatives',managerToken,403);
 await request('GET',p8Other+'/market/sponsored-creatives',memberToken,403);
 console.log('PH10_REAL_HTTP_PH08_MKT_AT004_SPONSORED_LABEL_TENANT_PRIVACY_PASS');

 // MKT-AT-001: a member can propose a private supplier inquiry, but it
 // cannot mint a public cooperative seller offer or transfer funds/shares.
 const inquiryPath=p8+'/market/supplier-proposals';
 const inquiryBody=JSON.stringify({description:'Synthetic nonpublic member supplier inquiry; no offering'});
 const offerBefore=(await db.query("SELECT count(*)::integer AS n FROM tto.ph08_market_offers WHERE seller_tenant_id=$1",[tenant])).rows[0].n;
 await request('POST',inquiryPath,managerToken,403,inquiryBody);
 await request('POST',p8Other+'/market/supplier-proposals',memberToken,403,inquiryBody);
 const inquiry=await request('POST',inquiryPath,memberToken,201,inquiryBody);
 assert.equal(inquiry.submitted,true);
 assert.equal(inquiry.publicOfferCreated,false);
 assert.equal(inquiry.legalApproval,false);
 const savedInquiry=await db.query("SELECT status,proposed_by FROM tto.ph08_supplier_proposals WHERE proposal_id=$1",[inquiry.proposalId]);
 assert.equal(savedInquiry.rows[0].status,'SUBMITTED');
 assert.equal(savedInquiry.rows[0].proposed_by,user);
 const offerAfter=(await db.query("SELECT count(*)::integer AS n FROM tto.ph08_market_offers WHERE seller_tenant_id=$1",[tenant])).rows[0].n;
 assert.equal(offerAfter,offerBefore);
 console.log('PH10_REAL_HTTP_PH08_MKT_AT001_SUPPLIER_INQUIRY_NEVER_PUBLIC_OFFER_PASS');

 // PROJ-AT-002: an out-of-county branch may exist as a draft but never
 // acquires independent-business authority on read or by virtue of creation.
 const branchId='9cd00000-0000-4000-8000-000000000095';
 const localCounty=(await db.query("SELECT county_code FROM tto.ph08_projects WHERE project_id=$1",[p8project])).rows[0].county_code;
 await db.query("INSERT INTO tto.ph08_branches(branch_id,project_id,county_code) VALUES($1,$2,$3)",
  [branchId,p8project,localCounty+'_OUTSIDE']);
 const branchPath=p8+'/projects/branches/'+branchId+'/authority-state';
 await request('GET',branchPath,memberToken,403);
 await request('GET',p8Other+'/projects/branches/'+branchId+'/authority-state',managerToken,403);
 const branchStatus=await request('GET',branchPath,managerToken,200);
 assert.equal(branchStatus.outsideCounty,true);
 assert.equal(branchStatus.independentActivityApproved,false);
 assert.equal(branchStatus.authorityEvidencePresent,false);
 assert.equal(branchStatus.automaticApproval,false);
 const branchUnchanged=await db.query("SELECT independent_activity_approved,authority_evidence IS NULL AS missing FROM tto.ph08_branches WHERE branch_id=$1",[branchId]);
 assert.equal(branchUnchanged.rows[0].independent_activity_approved,false);
 assert.equal(branchUnchanged.rows[0].missing,true);
 console.log('PH10_REAL_HTTP_PH08_PROJ_AT002_FOREIGN_COUNTY_NO_AUTO_AUTHORITY_PASS');
 // VOICE-AT-006: proposal acceptance and explicitly evidence-bound handoff
 // are distinct from lawful project creation (which must not occur here).
 const proposalId='9ce00000-0000-4000-8000-000000000095';
 const handoffId='9cf00000-0000-4000-8000-000000000095';
 const projectCountBefore=(await db.query("SELECT count(*)::integer AS n FROM tto.ph08_projects WHERE tenant_id=$1",[tenant])).rows[0].n;
 await db.query("INSERT INTO tto.ph08_proposals(proposal_id,tenant_id,title,status) VALUES($1,$2,'Synthetic nonbinding proposal','ACCEPTED')",[proposalId,tenant]);
 const handoffPath=p8+'/voice/proposals/'+proposalId+'/handoff-state';
 await request('GET',handoffPath,memberToken,403);
 await request('GET',p8Other+'/voice/proposals/'+proposalId+'/handoff-state',managerToken,403);
 const beforeHandoff=await request('GET',handoffPath,managerToken,200);
 assert.equal(beforeHandoff.proposalStatus,'ACCEPTED');
 assert.equal(beforeHandoff.explicitHandoff,false);
 assert.equal(beforeHandoff.automaticProjectCreated,false);
 await db.query("INSERT INTO tto.ph08_proposal_handoffs(handoff_id,proposal_id,target_domain,approved_evidence) VALUES($1,$2,'PROJECTS',$3)",
  [handoffId,proposalId,evidence]);
 const afterHandoff=await request('GET',handoffPath,managerToken,200);
 assert.equal(afterHandoff.explicitHandoff,true);
 assert.equal(afterHandoff.targetDomain,'PROJECTS');
 assert.equal(afterHandoff.legalResolution,false);
 const projectCountAfter=(await db.query("SELECT count(*)::integer AS n FROM tto.ph08_projects WHERE tenant_id=$1",[tenant])).rows[0].n;
 assert.equal(projectCountAfter,projectCountBefore);
 console.log('PH10_REAL_HTTP_PH08_VOICE_AT006_EXPLICIT_HANDOFF_NO_AUTO_PROJECT_PASS');
 // BEN-AT-001: a limited benefit with NO allocation policy remains DRAFT.
 const policylessBenefit='9cb00000-0000-4000-8000-000000000095';
 await db.query("INSERT INTO tto.ph08_benefits(benefit_id,tenant_id,title,limited,status) VALUES($1,$2,'Limited synthetic benefit',true,'DRAFT')",
  [policylessBenefit,tenant]);
 const prereqPath=p8+'/benefits/'+policylessBenefit+'/activation-prerequisites';
 await request('GET',prereqPath,memberToken,403);
 await request('GET',p8Other+'/benefits/'+policylessBenefit+'/activation-prerequisites',managerToken,403);
 const prereq=await request('GET',prereqPath,managerToken,200);
 assert.equal(prereq.limited,true);
 assert.equal(prereq.allocationPolicyPresent,false);
 assert.equal(prereq.prerequisitesMet,false);
 assert.equal(prereq.activated,false);
 let invalidActivationRejected=false;
 try {await db.query("UPDATE tto.ph08_benefits SET status='ACTIVE' WHERE benefit_id=$1",[policylessBenefit]);}
 catch(e){invalidActivationRejected=e.code==='23514';}
 assert.equal(invalidActivationRejected,true);
 const benefitState=(await db.query("SELECT status FROM tto.ph08_benefits WHERE benefit_id=$1",[policylessBenefit])).rows[0].status;
 assert.equal(benefitState,'DRAFT');
 console.log('PH10_REAL_HTTP_PH08_BEN_AT001_POLICYLESS_LIMITED_BENEFIT_REJECTED_PASS');

 // MKT-AT-002 checkout SOURCE preflight only: cooperative seller, no order or cash.
 const checkoutUri=p8+'/market/offers/'+p8offer+'/checkout-preflight';
 const orderCountBefore=(await db.query("SELECT count(*)::integer AS n FROM tto.ph08_market_orders WHERE offer_id=$1",[p8offer])).rows[0].n;
 await request('GET',checkoutUri,null,401);
 await request('GET',checkoutUri,managerToken,403);
 await request('GET',p8Other+'/market/offers/'+p8offer+'/checkout-preflight',memberToken,403);
 const checkout=await request('GET',checkoutUri,memberToken,200);
 assert.equal(checkout.sellerKind,'COOPERATIVE');
 assert.equal(Number(checkout.priceSnapshot),100);
 assert.equal(checkout.published,true);
 assert.equal(checkout.paymentEnabled,false);
 assert.equal(checkout.orderCreated,false);
 assert.equal(checkout.transactionAuthorized,false);
 assert.equal((await db.query("SELECT count(*)::integer AS n FROM tto.ph08_market_orders WHERE offer_id=$1",[p8offer])).rows[0].n,orderCountBefore);
 console.log('PH10_REAL_HTTP_PH08_MKT_AT002_COOPERATIVE_SELLER_PREFLIGHT_ONLY_PASS');
 // MKT-AT-003: synthetic order/refund record is a TEST FIXTURE, never a
 // payment; immutable refund policy snapshot read cannot mutate status.
 const syntheticOrder='9c920000-0000-4000-8000-000000000094';
 const syntheticRefund='9c930000-0000-4000-8000-000000000094';
 await db.query("INSERT INTO tto.ph08_market_orders(order_id,offer_id,buyer_tenant_id,seller_tenant_id,price_snapshot,status) VALUES($1,$2,$3,$3,100,'CREATED')",[syntheticOrder,p8offer,tenant]);
 await db.query("INSERT INTO tto.ph08_market_refunds(refund_id,order_id,policy_version) VALUES($1,$2,'PH08_REFUND_POLICY_V1')",[syntheticRefund,syntheticOrder]);
 const refundUri=p8+'/market/orders/'+syntheticOrder+'/refund-policy-preflight';
 await request('GET',refundUri,managerToken,403);
 await request('GET',p8Other+'/market/orders/'+syntheticOrder+'/refund-policy-preflight',memberToken,403);
 const preRefund=await request('GET',refundUri,memberToken,200);
 assert.equal(preRefund.policyVersion,'PH08_REFUND_POLICY_V1');
 assert.equal(preRefund.orderStatus,'CREATED');
 assert.equal(preRefund.refundExecuted,false);
 assert.equal(preRefund.paymentEnabled,false);
 const checkRefund=await db.query("SELECT r.policy_version,o.status FROM tto.ph08_market_refunds r JOIN tto.ph08_market_orders o USING(order_id) WHERE r.refund_id=$1",[syntheticRefund]);
 assert.equal(checkRefund.rows[0].policy_version,'PH08_REFUND_POLICY_V1');
 assert.equal(checkRefund.rows[0].status,'CREATED');
 console.log('PH10_REAL_HTTP_PH08_MKT_AT003_VERSIONED_REFUND_PREFLIGHT_ONLY_PASS');
 // PROC-AT-001: the original trigger prevents post-deadline bid writes,
 // while this GET cannot submit/inspect a sealed bid.
 const lateTender='9ca00000-0000-4000-8000-000000000094';
 await db.query("INSERT INTO tto.ph08_sourcing_tenders(tender_id,tenant_id,deadline,source_policy) VALUES($1,$2,now()-interval '1 minute',$3)",[lateTender,tenant,evidence]);
 const deadlineUri=p8+'/procurement/tenders/'+lateTender+'/bid-deadline-preflight';
 await request('GET',deadlineUri,memberToken,403);
 await request('GET',p8Other+'/procurement/tenders/'+lateTender+'/bid-deadline-preflight',managerToken,403);
 const lateState=await request('GET',deadlineUri,managerToken,200);
 assert.equal(lateState.deadlinePassed,true);
 assert.equal(lateState.bidSubmissionEnabled,false);
 assert.equal(lateState.sealedBidCreated,false);
 assert.equal((await db.query("SELECT count(*)::integer AS n FROM tto.ph08_sourcing_bids WHERE tender_id=$1",[lateTender])).rows[0].n,0);
 console.log('PH10_REAL_HTTP_PH08_PROC_AT001_DEADLINE_PREFLIGHT_NO_BID_PASS');
 // PROC-AT-003: opened criteria version stays frozen; no amendment event.
 const openedTender='9ca00000-0000-4000-8000-000000000093';
 await db.query("INSERT INTO tto.ph08_sourcing_tenders(tender_id,tenant_id,deadline,opened_at,criteria_version,source_policy) VALUES($1,$2,now()-interval '2 hours',now()-interval '1 hour',3,$3)",[openedTender,tenant,evidence]);
 const lockUri=p8+'/procurement/tenders/'+openedTender+'/criteria-lock-preflight';
 await request('GET',lockUri,memberToken,403);
 await request('GET',p8Other+'/procurement/tenders/'+openedTender+'/criteria-lock-preflight',managerToken,403);
 const lockState=await request('GET',lockUri,managerToken,200);
 assert.equal(lockState.opened,true);assert.equal(lockState.criteriaFrozen,true);
 assert.equal(lockState.criteriaEditEnabled,false);assert.equal(lockState.newLegalEventCreated,false);
 assert.equal(lockState.criteriaVersion,3);
 let frozenGuard=false;
 try {await db.query("UPDATE tto.ph08_sourcing_tenders SET criteria_version=4 WHERE tender_id=$1",[openedTender]);}
 catch(err){frozenGuard=String(err.message).includes('PH08_CRITERIA_FROZEN');}
 assert.equal(frozenGuard,true);
 assert.equal(Number((await db.query("SELECT criteria_version FROM tto.ph08_sourcing_tenders WHERE tender_id=$1",[openedTender])).rows[0].criteria_version),3);
 console.log('PH10_REAL_HTTP_PH08_PROC_AT003_FROZEN_CRITERIA_PREFLIGHT_NO_EDIT_PASS');
 // PROC-AT-006: two evidence-backed immutable threshold versions are visible,
 // but an API policy change or legal approval is NEVER enabled by this read.
 const policy1='9ca20000-0000-4000-8000-000000000094';
 const policy2='9ca20000-0000-4000-8000-000000000095';
 await db.query("INSERT INTO tto.ph08_threshold_versions(policy_id,tenant_id,policy_code,version,source_ref,value) VALUES($1,$3,'AUDIT_RFQ_THRESHOLD',1,$4,100),($2,$3,'AUDIT_RFQ_THRESHOLD',2,$4,200)",[policy1,policy2,tenant,evidence]);
 const thresholdUri=p8+'/procurement/threshold-policies/AUDIT_RFQ_THRESHOLD/version-preflight';
 await request('GET',thresholdUri,memberToken,403);
 await request('GET',p8Other+'/procurement/threshold-policies/AUDIT_RFQ_THRESHOLD/version-preflight',managerToken,403);
 await request('GET',p8+'/procurement/threshold-policies/bad-policy/version-preflight',managerToken,400);
 const threshold=await request('GET',thresholdUri,managerToken,200);
 assert.equal(threshold.versions.length,2);assert.equal(threshold.latestVersion,2);
 assert.equal(threshold.versions[0].version,1);
 assert.equal(threshold.versions[1].version,2);
 assert.equal(threshold.policyMutationEnabled,false);
 assert.equal(threshold.policyAuthorityIssued,false);
 assert.equal((await db.query("SELECT count(*)::integer AS n FROM tto.ph08_threshold_versions WHERE tenant_id=$1 AND policy_code='AUDIT_RFQ_THRESHOLD'",[tenant])).rows[0].n,2);
 console.log('PH10_REAL_HTTP_PH08_PROC_AT006_VERSIONED_THRESHOLD_PREFLIGHT_ONLY_PASS');

 // Negative execution-boundary guard: contracts expose read-only preflights.
 // There must be NO live payment, refund, bid, criteria amendment or threshold-write endpoint.
 const orderCountBeforeAttempt=(await db.query("SELECT count(*)::integer AS n FROM tto.ph08_market_orders WHERE offer_id=$1",[p8offer])).rows[0].n;
 const bidCountBeforeAttempt=(await db.query("SELECT count(*)::integer AS n FROM tto.ph08_sourcing_bids WHERE tender_id=$1",[lateTender])).rows[0].n;
 await request('POST',p8+'/market/offers/'+p8offer+'/checkout-pay',memberToken,404,JSON.stringify({amount:100}));
 await request('POST',p8+'/market/orders/'+syntheticOrder+'/refund',memberToken,404,JSON.stringify({refundAmount:100}));
 await request('POST',p8+'/procurement/tenders/'+lateTender+'/bids',managerToken,404,JSON.stringify({sealedContent:'synthetic'}));
 await request('POST',p8+'/procurement/tenders/'+openedTender+'/criteria-amendments',managerToken,404,JSON.stringify({criteriaVersion:4}));
 await request('POST',p8+'/procurement/threshold-policies/AUDIT_RFQ_THRESHOLD/activate',managerToken,404,JSON.stringify({version:3}));
 assert.equal((await db.query("SELECT count(*)::integer AS n FROM tto.ph08_market_orders WHERE offer_id=$1",[p8offer])).rows[0].n,orderCountBeforeAttempt);
 assert.equal((await db.query("SELECT count(*)::integer AS n FROM tto.ph08_sourcing_bids WHERE tender_id=$1",[lateTender])).rows[0].n,bidCountBeforeAttempt);
 assert.equal((await db.query("SELECT policy_version FROM tto.ph08_market_refunds WHERE refund_id=$1",[syntheticRefund])).rows[0].policy_version,'PH08_REFUND_POLICY_V1');
 assert.equal((await db.query("SELECT criteria_version FROM tto.ph08_sourcing_tenders WHERE tender_id=$1",[openedTender])).rows[0].criteria_version,3);
 console.log('PH10_PH08_FIVE_OPERATIONS_DENIED_NO_FINANCIAL_LEGAL_MUTATION_PASS');
 await testFivePreflightBffs(memberToken,managerToken,syntheticOrder,lateTender,openedTender);






 console.log('PH10_REAL_HTTP_TOTAL_PHASE09_PLUS_PHASE08_REQUESTS='+checks);
 console.log('PH09_REAL_NEST_HTTP_REQUESTS_PASS='+checks);
}
main().catch(e=>{console.error('PH09_REAL_NEST_HTTP_FAIL',String(e?.message).slice(0,1500));process.exitCode=1;})
.finally(async()=>{if(nationalNextServer&&nationalNextServer.exitCode===null)nationalNextServer.kill('SIGTERM');if(shareNextServer&&shareNextServer.exitCode===null)shareNextServer.kill('SIGTERM');if(nextServer&&nextServer.exitCode===null)nextServer.kill('SIGTERM');if(server&&server.exitCode===null)server.kill('SIGTERM');await db.end().catch(()=>{})});
