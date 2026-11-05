"use strict";
/* PH10.7 disposable-only real Next cooperative BFF → Nest HTTP → PostgreSQL17.
 * Registered people, managerial rights and tenants are synthetic fixtures only.
 * No Rasmio, official registry, real notices, live legal approvals, share operations.
 */
const assert=require("node:assert/strict");
const {randomUUID,randomBytes,createHash}=require("node:crypto");
const {createRequire}=require("node:module");
const {resolve}=require("node:path");
const {spawn}=require("node:child_process");
const ROOT=resolve(__dirname,"../..");
const {Client}=createRequire(resolve(ROOT,"services/api/package.json"))("pg");
if(process.env.CI!=="true"||process.env.TTO_ISOLATED_DEMO_DB!=="true"||
 process.env.TEST_ADMIN_DATABASE_URL!=="postgresql://postgres@127.0.0.1:5432/tto"||
 process.env.VERCEL||process.env.APIIR_TOKEN)
 throw Error("PH10_MANUAL_GAZETTE_DISPOSABLE_ONLY");
const db=new Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL});
const tenant=randomUUID(),foreignTenant=randomUUID(),manager=randomUUID(),outsider=randomUUID(),verifier=randomUUID(),
 authority=randomUUID(),role=randomUUID();
const apiPort=32891,webPort=32892;
const api="http://127.0.0.1:"+apiPort,web="http://127.0.0.1:"+webPort,origin="http://localhost:"+webPort;
let managerToken="",outsiderToken="",checks=0;
const children=[];
async function session(user){
 const token=randomBytes(48).toString("base64url");
 await db.query("INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at) VALUES"+
  "($1,$2,$3,0,now()+interval '30 minutes')",
  [randomUUID(),user,createHash("sha256").update(token).digest()]);
 return token;
}
function spawnNode(args,cwd,env){
 const p=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:"ignore"});
 children.push(p);return p;
}
async function online(url,child){
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error("SERVER_TERMINATED_"+url);
  try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});
   if(r.status<500)return;}catch{}
  await new Promise(r=>setTimeout(r,220));
 }
 throw Error("SERVER_NOT_READY_"+url);
}
async function post(path,payload,{token=managerToken,originHeader=true}={}){
 const headers={Host:"localhost:"+webPort,
  ...(token?{Cookie:"tto_session="+token}:{}),
  ...(originHeader?{Origin:origin}:{}),
  "Content-Type":"application/json"};
 const result=await fetch(web+path,{method:"POST",headers,
  body:JSON.stringify(payload),cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(12000)});
 const value=await result.json().catch(()=>null);
 return {status:result.status,value};
}
async function get(path,{token=managerToken}={}){
 const result=await fetch(web+path,{
  method:"GET",headers:{Host:"localhost:"+webPort,...(token?{Cookie:"tto_session="+token}:{})},
  cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(12000)});
 return {status:result.status,value:await result.json().catch(()=>null)};
}
function expect(res,status,label){assert.equal(res.status,status,label+" "+JSON.stringify(res.value).slice(0,160));checks++;return res.value;}
async function main(){
 await db.connect();
 await db.query("ALTER ROLE tto_app LOGIN");
 await db.query("INSERT INTO tto.user_accounts(user_id) VALUES ($1),($2),($3)",
  [manager,outsider,verifier]);
 await db.query("INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES "+
  "($1,$2,$3,'ACTIVE'),($4,$5,$6,'ACTIVE')",
  [tenant,"ci-gazette-"+randomUUID().slice(0,8),"Synthetic Gazette Cooperative",
   foreignTenant,"ci-foreign-"+randomUUID().slice(0,8),"Synthetic Foreign Cooperative"]);
 await db.query("INSERT INTO tto.legal_authorities("+
  "authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until)"+
  " VALUES ($1,$2,$3,'ROLE_MANAGEMENT',$4,$5,now(),now()+interval '5 days')",
  [authority,manager,tenant,randomUUID(),verifier]);
 await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code,"+
  "legal_authority_id) VALUES($1,$2,$3,'COOPERATIVE_MANAGER',$4)",
  [role,manager,tenant,authority]);
 managerToken=await session(manager);outsiderToken=await session(outsider);
 const nest=spawnNode(["dist/main.js"],resolve(ROOT,"services/api"),{
  DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto",PORT:String(apiPort),NODE_ENV:"test",
  CI:"true",TTO_ISOLATED_DEMO_DB:"true",APIIR_TOKEN:""});
 await online(api+"/ready",nest);
 const cwd=resolve(ROOT,"apps/cooperative-management");
 const next=spawnNode([resolve(cwd,"node_modules/next/dist/bin/next"),
  "start","-p",String(webPort),"-H","127.0.0.1"],cwd,{
    NODE_ENV:"test",CI:"true",TTO_ISOLATED_DEMO_DB:"true",
    TTO_LOOPBACK_E2E:"1",TTO_API_BASE_URL:api,NEXT_TELEMETRY_DISABLED:"1",APIIR_TOKEN:""});
 await online(web+"/",next);
 const path="/api/tenants/"+tenant+"/official-notices";
 const payload={requestKey:randomUUID(),
  personFullName:"Synthetic Board Chair",
  officeType:"BOARD_CHAIR",signingMode:"JOINT",
  authorityScope:"Requires joint signature and an independently verified board resolution",
  gazetteIssueNumber:"22345",gazettePublicationDate:"2026-10-20",
  gazetteAnnouncementNumber:"140512345678",effectiveFrom:"2026-10-20",
  effectiveUntil:"2027-10-20",officialReferenceUrl:null,supersedesClaimId:null};
 expect(await get(path,{token:""}),401,"anonymous history denied");
 expect(await get(path,{token:outsiderToken}),403,"unappointed reader denied");
 expect(await get("/api/tenants/"+foreignTenant+"/official-notices"),403,"foreign tenant history denied");
 const emptyHistory=expect(await get(path),200,"authorized manager history first read");
 assert.deepEqual(emptyHistory.items,[]);
 assert.equal(emptyHistory.officiallyVerified,false);
 assert.equal(emptyHistory.legalApproval,false);
 expect(await post(path,payload,{token:""}),401,"anonymous denied");
 expect(await post(path,payload,{token:outsiderToken}),403,"unappointed outsider denied");
 expect(await post(path,payload,{originHeader:false}),403,"CSRF missing Origin denied");
 expect(await post(path,{...payload,gazetteIssueNumber:""}),400,"official gazette issue required");
 expect(await post(path,{...payload,gazetteAnnouncementNumber:""}),400,"official notice ID required");
 expect(await post(path,{...payload,gazettePublicationDate:""}),400,"publication date required");
 const first=expect(await post(path,payload),201,"valid manager manual Gazette self-report");
 assert.equal(first.status,"SELF_REPORTED_PENDING_REVIEW");
 assert.equal(first.officiallyVerified,false);
 assert.equal(first.legalApproval,false);
 assert.equal(first.roleGranted,false);
 const repeat=expect(await post(path,payload),201,"same request idempotent replay");
 assert.equal(repeat.claimId,first.claimId);assert.equal(repeat.replayed,true);
 expect(await post(path,{...payload,officeType:"CEO"}),409,"request key cannot change role claim");
 expect(await post("/api/tenants/"+foreignTenant+"/official-notices",
  {...payload,requestKey:randomUUID()}),403,"cross-tenant role denied");
 const firstHistory=expect(await get(path),200,"history shows first self report");
 assert.equal(firstHistory.items.length,1);
 assert.equal(firstHistory.items[0].claimId,first.claimId);
 assert.equal(firstHistory.items[0].hasCorrection,false);
 assert.equal(firstHistory.items[0].status,"SELF_REPORTED_PENDING_REVIEW");
 // A new Gazette announcement corrects the original without editing its audit row.
 const correction={...payload,requestKey:randomUUID(),supersedesClaimId:first.claimId,
  gazetteIssueNumber:"22346",gazettePublicationDate:"2026-10-22",
  gazetteAnnouncementNumber:"140512345679",
  authorityScope:"Joint signatures require updated board quorum as asserted by manager"};
 const second=expect(await post(path,correction),201,"create correction linked to original");
 assert.notEqual(second.claimId,first.claimId);
 const secondReplay=expect(await post(path,correction),201,"correction idempotency");
 assert.equal(secondReplay.claimId,second.claimId);assert.equal(secondReplay.replayed,true);
 expect(await post(path,{...correction,requestKey:randomUUID()}),409,
  "cannot create competing corrections to a single Gazette claim");
 const history=expect(await get(path),200,"read complete original plus correction history");
 assert.equal(history.items.length,2);
 assert.equal(history.hasMore,false);
 assert.equal(history.selfReportedOnly,true);
 const old=history.items.find(x=>x.claimId===first.claimId);
 const revised=history.items.find(x=>x.claimId===second.claimId);
 assert.equal(old.gazetteIssueNumber,"22345");
 assert.equal(old.hasCorrection,true);
 assert.equal(revised.gazetteIssueNumber,"22346");
 assert.equal(revised.supersedesClaimId,first.claimId);
 assert.equal(revised.hasCorrection,false);
 assert.equal(revised.status,"SELF_REPORTED_PENDING_REVIEW");
 const originalDb=await db.query(
  "SELECT official_announcement_number FROM tto.cooperative_manual_official_governance_claims "+
  "WHERE claim_id=$1",[first.claimId]);
 assert.equal(originalDb.rows[0].official_announcement_number,"140512345678");
 checks++;

 // The initial self-report cannot change the existing verified manager's
 // legal authority, tenant count, signer status or formal permissions.
 const truth=await db.query(
 "SELECT (SELECT count(*)::int FROM tto.cooperative_manual_official_governance_claims WHERE tenant_id=$1) claims,"+
 " (SELECT count(*)::int FROM tto.role_assignments WHERE tenant_id=$1) roles,"+
 " (SELECT count(*)::int FROM tto.legal_authorities WHERE tenant_id=$1) authorities,"+
 " (SELECT verification_status FROM tto.cooperative_manual_official_governance_claims WHERE claim_id=$2) status",
 [tenant,first.claimId]);
 assert.deepEqual(truth.rows[0],{
  claims:2,roles:1,authorities:1,status:"SELF_REPORTED_PENDING_REVIEW"});
 checks++;
 const page=await fetch(web+"/official-records",{cache:"no-store"});
 assert.equal(page.status,200);
 const html=await page.text();
 assert.ok(html.includes("شماره روزنامه رسمی")&&html.includes("شماره آگهی"));
 assert.ok(html.includes("بررسی حقوقی مستقل الزامی است"));checks++;
 // Browser-level assertion: the authorized manager sees only private
 // self-reported history, can start a correction, and never receives legal approval.
 const {chromium}=require("playwright");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"fa-IR"});
  await context.addCookies([{name:"tto_session",value:managerToken,domain:"localhost",
   path:"/",httpOnly:true,secure:false,sameSite:"Lax"}]);
  const page=await context.newPage();
  const result=await page.goto(origin+"/official-records",
   {waitUntil:"domcontentloaded",timeout:25000});
  assert.equal(result.status(),200);checks++;
  await page.getByRole("heading",{name:"سوابق ثبت‌شده آگهی‌ها و اصلاحات"})
   .waitFor({state:"visible",timeout:17000});
  await page.locator("article").first().waitFor({state:"visible",timeout:17000});
  assert.equal(await page.locator("article").count(),2,
   "manager should see first and amended Official Gazette claims");checks++;
  await page.getByText("برای این سابقه، اصلاحیه جدید ثبت شده است.").waitFor();
  const fresh=page.locator("article").filter({hasText:"22346"});
  await fresh.getByRole("button",{name:"ثبت اصلاحیه جدید با حفظ سابقه"}).click();
  assert.equal(await page.getByPlaceholder("از فهرست سوابق انتخاب کنید").inputValue(),
   second.claimId,"selected correction must point to the newest claim");
  assert.equal(await page.getByLabel("شماره روزنامه رسمی").inputValue(),"",
   "new claim must require a NEW Gazette issue number");checks++;
  const visible=await page.locator("main").innerText();
  assert.ok(visible.includes("در انتظار بررسی حقوقی مستقل"));
  assert.ok(!visible.includes("تأیید قطعی سمت"));checks++;
  await context.close();
  const anonContext=await browser.newContext({viewport:{width:390,height:844}});
  const anon=await anonContext.newPage();
  await anon.goto(origin+"/official-records",{waitUntil:"domcontentloaded",timeout:25000});
  await anon.getByText("دسترسی مجاز مدیریت تعاونی احراز نشد",{exact:false})
   .waitFor({state:"visible",timeout:17000});
  assert.equal(await anon.locator("article").count(),0,
   "anonymous viewer cannot see a private manager claim");checks++;
  await anonContext.close();
  console.log("PH10_MANUAL_GAZETTE_CHROMIUM_HISTORY_AND_CORRECTION_PASS_NO_DISCLOSURE");
 }finally{await browser.close();}
 console.log("PH10_MANUAL_GAZETTE_BFF_NEST_PG17_NO_ROLE_ELEVATION_PASS_CHECKS="+checks);
}
main().catch(e=>{console.error("PH10_MANUAL_GAZETTE_E2E_FAIL",
 String(e?.stack??e).slice(0,2200));process.exitCode=1;})
.finally(async()=>{for(const p of children)if(p.exitCode===null)p.kill("SIGTERM");await db.end().catch(()=>{});});
