"use strict";
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {randomUUID,randomBytes,createHash}=require("node:crypto");
const {resolve}=require("node:path");
const {createRequire}=require("node:module");
const ROOT=resolve(__dirname,"..");
const {Client}=createRequire(resolve(ROOT,"services/api/package.json"))("pg");
const url=process.env.TEST_ADMIN_DATABASE_URL;
if(!url||process.env.APIIR_TOKEN)throw Error("DISPOSABLE_POSTGRES_ONLY_NO_SMS");
const db=new Client({connectionString:url});
const A=randomUUID(),B=randomUUID(),PARTY=randomUUID(),PARTY2=randomUUID();
const USER=randomUUID(),MANAGER=randomUUID(),NATIONAL=randomUUID(),REVIEWER=randomUUID(),APPROVER=randomUUID();
const REQ=randomUUID(),DEC=randomUUID();
const API="http://127.0.0.1:31997";
const running=[];let checks=0;let startedBrowser=null;
const tokenMap=new Map();
function ok(value,label){assert.ok(value,label);checks++;}
async function status(response,expected,label){
 assert.equal(response.status,expected,label+" actual="+response.status);checks++;
 return response.status===204?null:response.json();
}
async function post(path,token,body){
 return fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
 body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(9500)});
}
async function get(path,token){
 return fetch(API+path,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(9500)});
}
async function launch(label,args,cwd,env,probe){
 const proc=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:"ignore"});
 running.push(proc);proc.on("error",()=>{});
 for(let i=0;i<150;i++){
  if(proc.exitCode!==null)throw Error(label+" exited");
  try{const res=await fetch(probe,{signal:AbortSignal.timeout(1200)});if(res.ok)return;}
  catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 throw Error(label+" readiness failed");
}
async function issueSession(user){
 const token=randomBytes(48).toString("base64url");
 await db.query("INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at) VALUES($1,$2,$3,0,now()+interval '1 hour')",
 [randomUUID(),user,createHash("sha256").update(token).digest()]);
 tokenMap.set(user,token);return token;
}
async function fixture(){
 await db.connect();await db.query("ALTER ROLE tto_app LOGIN");
 for(const id of [USER,MANAGER,NATIONAL,REVIEWER,APPROVER])
  await db.query("INSERT INTO tto.user_accounts(user_id) VALUES($1)",[id]);
 await db.query("INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES($1,'ci-legal-a','Test Cooperative A','ACTIVE'),($2,'ci-legal-b','Test Cooperative B','ACTIVE')",[A,B]);
 await db.query("INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES($1,'PERSON','CI Person'),($2,'ORGANIZATION','CI Organization')",[PARTY,PARTY2]);
 await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'MEMBER'),($4,$5,$3,'COOPERATIVE_MANAGER')",
  [randomUUID(),USER,A,randomUUID(),MANAGER]);
 await db.query("INSERT INTO tto.relationship_projections(tenant_id,party_id,membership_status,source_event_id,source_version) VALUES($1,$2,'ACTIVE',$3,1)",[A,PARTY,randomUUID()]);
 const doc=randomUUID();
 await db.query("INSERT INTO tto.documents(document_id,tenant_id,title,classification,status) VALUES($1,$2,'Synthetic reviewed legal identity evidence','RESTRICTED','PUBLISHED')",[doc,A]);
 for(const evid of [REQ,DEC]){
  await db.query("INSERT INTO tto.evidence_references(evidence_id,tenant_id,document_id,source_entity_type,source_entity_id) VALUES($1,$2,$3,'CI_IDENTITY', $4)",
   [evid,A,doc,randomUUID()]);
 }
 await db.query("INSERT INTO tto.platform_operator_authorizations(user_id,approved_by,evidence_id,expires_at) VALUES($1,$3,$4,now()+interval '2 hours'),($2,$3,$4,now()+interval '2 hours')",
  [NATIONAL,REVIEWER,APPROVER,DEC]);
 await db.query("INSERT INTO tto.identity_review_authorizations(user_id,tenant_id,approved_by,evidence_id,valid_until) VALUES($1,$2,$3,$4,now()+interval '2 hours')",
 [REVIEWER,A,APPROVER,DEC]);
 for(const uid of [USER,MANAGER,NATIONAL,REVIEWER,APPROVER])await issueSession(uid);
 const apiEnv={DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto",PORT:"31997",
   NODE_ENV:"test",APIIR_TOKEN:"",TTO_MOCK_SMSOTP_PROVIDER:"true",AUTH_CHALLENGE_HMAC_SECRET:"ci-testing-secret-32chars-aaaaaaaaaaaaaa"};
 await launch("Nest",["dist/main.js"],resolve(ROOT,"services/api"),apiEnv,API+"/ready");
}
async function portal(slug,port){
 const cwd=resolve(ROOT,"apps",slug);
 const origin="http://127.0.0.1:"+port;
 await launch(slug,[resolve(cwd,"node_modules/next/dist/bin/next"),"start","-p",String(port)],cwd,
 {NODE_ENV:"test",CI:"true",TTO_LOOPBACK_E2E:"1",TTO_API_BASE_URL:API,PORT:String(port),NEXT_TELEMETRY_DISABLED:"1",APIIR_TOKEN:""},
 origin+"/");
 return {origin,slug};
}
async function options(portal,user){
 const res=await fetch(portal.origin+"/api/me/tenant-options",{headers:{Cookie:"tto_session="+tokenMap.get(user)},cache:"no-store"});
 const payload=await status(res,200,portal.slug+" options");
 ok(/no-store/.test(res.headers.get("cache-control")??""),"scope no-store");
 ok(!JSON.stringify(payload).includes(tokenMap.get(user)),"no bearer in response");
 return payload.items;
}
async function main(){
 await fixture();
 const [sh,cm,na]=await Promise.all([
  portal("shareholder",32721),portal("cooperative-management",32722),portal("national-admin",32723)]);
 const unauth=await fetch(cm.origin+"/api/me/tenant-options",{headers:{Authorization:"Bearer "+tokenMap.get(MANAGER)}});
 await status(unauth,401,"forged client bearer cannot discover");
 // Prior to independent identity approval, even a projected active relationship is not verified.
 const memberBefore=await options(sh,USER);
 assert.deepEqual(memberBefore,[{tenantId:A,displayName:"Test Cooperative A",evidenceStatus:"EVIDENCE_PENDING"}]);checks++;
 assert.deepEqual(await options(cm,USER),[]);checks++;
 assert.deepEqual(await options(na,USER),[]);checks++;
 const myToken=tokenMap.get(USER), reviewerToken=tokenMap.get(REVIEWER);
 const base="/v1/tenants/"+A+"/identity-links";
 const request=await status(await post(base,myToken,{partyId:PARTY,evidenceId:REQ}),201,"request case");
 ok(request.status==="PENDING"&&typeof request.caseId==="string","pending returns case reference");
 const casePath=base+"/"+request.caseId;
 await status(await post(base,myToken,{partyId:PARTY,evidenceId:REQ}),403,"duplicate pending");
 await status(await post("/v1/tenants/"+B+"/identity-links",myToken,{partyId:PARTY,evidenceId:REQ}),403,"cross-tenant evidence blocked");
 await status(await get(casePath,reviewerToken),403,"reviewer cannot read applicant-only status");
 await status(await post(casePath+"/decision",myToken,{approve:true,expectedVersion:1,decisionEvidenceId:DEC}),403,"self-decision blocked");
 await status(await post(casePath+"/decision",reviewerToken,{approve:true,expectedVersion:1,decisionEvidenceId:DEC}),403,"missing legal-policy gate");
 const noLink=await db.query("SELECT verified_at FROM tto.user_party_links WHERE user_id=$1 AND party_id=$2",[USER,PARTY]);
 ok(noLink.rowCount===0,"no identity link before legal approval");
 // CI fixture impersonates explicit privileged legal-policy activation, not approval for hosted TTO.
 await db.query("INSERT INTO tto.identity_link_policies(tenant_id,rule_evidence_id,approved_by,expires_at,enabled) VALUES($1,$2,$3,now()+interval '1 hour',true)",
 [A,DEC,APPROVER]);
 await status(await post(casePath+"/decision",reviewerToken,{approve:true,expectedVersion:1,decisionEvidenceId:REQ}),403,"cannot reuse applicant evidence");
 await status(await post(casePath+"/decision",reviewerToken,{approve:true,expectedVersion:2,decisionEvidenceId:DEC}),403,"stale version blocked");
 const approved=await status(await post(casePath+"/decision",reviewerToken,{approve:true,expectedVersion:1,decisionEvidenceId:DEC}),201,"separate reviewer approves");
 assert.deepEqual(approved,{recorded:true});checks++;
 await status(await post(casePath+"/decision",reviewerToken,{approve:true,expectedVersion:1,decisionEvidenceId:DEC}),403,"review replay blocked");
 const applicant=await status(await get(casePath,myToken),200,"applicant can see status");
 assert.deepEqual(applicant,{status:"APPROVED"});checks++;
 const verified=await db.query("SELECT verified_at FROM tto.user_party_links WHERE user_id=$1 AND party_id=$2",[USER,PARTY]);
 ok(verified.rowCount===1&&verified.rows[0].verified_at!==null,"verified User-Party link committed");
 assert.deepEqual(await options(sh,USER),[{tenantId:A,displayName:"Test Cooperative A",evidenceStatus:"MEMBERSHIP_EVIDENCE"}]);checks++;
 const unchanged=await db.query("SELECT count(*)::integer AS n FROM tto.relationship_projections WHERE tenant_id=$1",[A]);
 ok(unchanged.rows[0].n===1,"no fabricated membership event");
 // A rejection is a terminal independent decision and must never create another verified Party link.
 const rejectReq=await status(await post(base,myToken,{partyId:PARTY2,evidenceId:REQ}),201,"additional pending case");
 await status(await post(base+"/"+rejectReq.caseId+"/decision",reviewerToken,{approve:false,expectedVersion:1,decisionEvidenceId:DEC}),201,"independent reject");
 const deniedParty=await db.query("SELECT count(*)::integer AS n FROM tto.user_party_links WHERE user_id=$1 AND party_id=$2",[USER,PARTY2]);
 ok(deniedParty.rows[0].n===0,"rejected Party never linked");
 // Manager: role alone offers a candidate but not authority evidence.
 assert.deepEqual(await options(cm,MANAGER),[{tenantId:A,displayName:"Test Cooperative A",evidenceStatus:"EVIDENCE_PENDING"}]);checks++;
 const auth=randomUUID();
 await db.query("INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until) VALUES($1,$2,$3,'ROLE_MANAGEMENT',$4,$5,now(),now()+interval '1 hour')",
 [auth,MANAGER,A,DEC,APPROVER]);
 assert.deepEqual(await options(cm,MANAGER),[{tenantId:A,displayName:"Test Cooperative A",evidenceStatus:"ROLE_AUTHORITY_EVIDENCE"}]);checks++;
 await db.query("UPDATE tto.legal_authorities SET revoked_at=now() WHERE authority_id=$1",[auth]);
 assert.deepEqual(await options(cm,MANAGER),[{tenantId:A,displayName:"Test Cooperative A",evidenceStatus:"EVIDENCE_PENDING"}]);checks++;
 await db.query("UPDATE tto.role_assignments SET revoked_at=now() WHERE user_id=$1 AND tenant_id=$2",[MANAGER,A]);
 assert.deepEqual(await options(cm,MANAGER),[]);checks++;
 // National operator without independently approved, tenant-specific JIT has no tenant scope.
 assert.deepEqual(await options(na,NATIONAL),[]);checks++;
 const grant=randomUUID();
 await db.query("INSERT INTO tto.jit_access_grants(grant_id,tenant_id,requester_id,approver_id,purpose,scope,status,expires_at,decided_at) VALUES($1,$2,$3,$4,'CI independent scope review','DOCUMENT_REVIEW','APPROVED',now()+interval '10 minutes',now())",
 [grant,A,NATIONAL,APPROVER]);
 assert.deepEqual(await options(na,NATIONAL),[{tenantId:A,displayName:"Test Cooperative A",evidenceStatus:"JIT_DOCUMENT_REVIEW_ONLY"}]);checks++;
 const natContext=await status(await get("/v1/tenants/"+A+"/context",tokenMap.get(NATIONAL)),200,"national approved JIT context");
 ok(natContext.tenant_id===A,"national context cannot cross tenant");
 await status(await get("/v1/tenants/"+B+"/context",tokenMap.get(NATIONAL)),403,"national cannot inspect unrelated tenant");
 await db.query("UPDATE tto.jit_access_grants SET status='REVOKED' WHERE grant_id=$1",[grant]);
 assert.deepEqual(await options(na,NATIONAL),[]);checks++;
 await status(await get("/v1/tenants/"+A+"/context",tokenMap.get(NATIONAL)),403,"revoked national JIT fails closed");
 const expiredGrant=randomUUID();
 await db.query("INSERT INTO tto.jit_access_grants(grant_id,tenant_id,requester_id,approver_id,purpose,scope,status,requested_at,expires_at,decided_at) VALUES($1,$2,$3,$4,'CI expired independent review','DOCUMENT_REVIEW','APPROVED',now()-interval '2 hours',now()-interval '1 hour',now()-interval '90 minutes')",
  [expiredGrant,A,NATIONAL,APPROVER]);
 assert.deepEqual(await options(na,NATIONAL),[]);checks++;
 await status(await get("/v1/tenants/"+A+"/context",tokenMap.get(NATIONAL)),403,"expired national JIT fails closed");
 // Child06/07: never infer membership or share balance from successful login/Party link.
 const browserEnabled=process.env.TTO_PCS014_BROWSER==="1";
 const browser=browserEnabled?await require("/tmp/tto-pcs014-browser/node_modules/playwright").chromium.launch({headless:true}):null;
 startedBrowser=browser;
 async function inspectOwnScreen(name, expectedMember, expectedShares) {
  if(!browser)return;
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:width===390?844:900},locale:"fa-IR",serviceWorkers:"block"});
   await context.addCookies([{name:"tto_session",value:myToken,url:sh.origin,httpOnly:true,sameSite:"Lax"}]);
   const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(sh.origin+"/tenants/"+A+"/my-records",{waitUntil:"domcontentloaded",timeout:20000});
   await page.getByRole("heading",{name:"پرونده اختصاصی عضویت و سهام"}).waitFor();
   await page.getByRole("button",{name:"بررسی مجدد اطلاعات"}).waitFor();
   if(expectedMember==="unavailable")await page.getByText("اطلاعات رسمی تأییدشده در دسترس نیست").first().waitFor();
   if(expectedMember==="active")await page.getByText("عضویت: فعال").waitFor();
   if(expectedShares==="unavailable")await page.getByText("اطلاعات رسمی تأییدشده در دسترس نیست").last().waitFor();
   await page.getByRole("heading",{name:"سوابق نسخه‌های تأییدشده موجودی"}).waitFor();
   if(expectedShares==="37"){
    await page.getByText("تعداد سهام ثبت‌شده: 37").waitFor();
    await page.getByText(/نسخه 1: 37 سهم/).waitFor();
   }
   if(expectedShares==="0"){
    await page.getByText("تعداد سهام ثبت‌شده: 0").waitFor();
    await page.getByText(/نسخه 2: 0 سهم/).waitFor();
    await page.getByText(/نسخه 1: 37 سهم/).waitFor();
   }
   if(expectedShares==="unavailable")
    assert.equal(await page.locator('section[aria-labelledby="share-snapshots-heading"] li').count(),0);
   assert.equal(await page.locator("body").evaluate(e=>e.scrollWidth>e.clientWidth+3),false,name+" horizontal scroll "+width);
   assert.equal(await page.locator("html").getAttribute("dir"),"rtl");
   assert.equal(errors.length,0,name+" JS errors "+JSON.stringify(errors));
   console.log("TTO_PCS014_BROWSER_"+name+"_"+width+"=PASS");
   await context.close();
  }
 }
 const memberPath="/v1/tenants/"+A+"/me/member-record";
 const sharePath="/v1/tenants/"+A+"/me/shareholding";
 const historyPath="/v1/tenants/"+A+"/me/shareholding-history";
 const memberBff=sh.origin+"/api/tenants/"+A+"/me/member-record";
 const shareBff=sh.origin+"/api/tenants/"+A+"/me/shareholding";
 const historyBff=sh.origin+"/api/tenants/"+A+"/me/shareholding-history";
 const cookie={Cookie:"tto_session="+myToken};
 await status(await get(memberPath,myToken),403,"member source unapproved");
 await status(await get(sharePath,myToken),403,"share source unapproved");
 await status(await get(historyPath,myToken),403,"history source unapproved");
 await status(await fetch(historyBff,{headers:{Authorization:"Bearer "+myToken,"X-Tenant-Id":A}}),401,
  "forged browser bearer cannot authorize snapshot history");
 const guest=await fetch(memberBff,{headers:{Authorization:"Bearer "+myToken,"X-Party":PARTY}});
 await status(guest,401,"forged browser bearer cannot read membership");
 const unapprovedResponse=await fetch(memberBff,{headers:cookie});
 const unapprovedBody=await status(unapprovedResponse,403,"BFF member is initially blocked");
 assert.deepEqual(unapprovedBody,{available:false,code:"SOURCE_OR_PERMISSION_NOT_APPROVED"});checks++;
 await inspectOwnScreen("BLOCKED_BOTH","unavailable","unavailable");
 // Only synthetic CI migration-owner fixture represents a future approved source adapter.
 const projection=(await db.query("SELECT source_event_id,source_version FROM tto.relationship_projections WHERE tenant_id=$1 AND party_id=$2",[A,PARTY])).rows[0];
 const memberRef="CI-APPROVED-CHILD06-V1",holdingRef="CI-APPROVED-CHILD07-V1";
 await db.query("INSERT INTO tto.member_source_snapshots(tenant_id,party_id,source_ref,source_event_id,source_version,membership_status,source_as_of) VALUES($1,$2,$3,$4,$5,'ACTIVE',now())",
  [A,PARTY,memberRef,projection.source_event_id,projection.source_version]);
 const account=randomUUID();
 await db.query("INSERT INTO tto.shareholder_source_accounts(tenant_id,party_id,shareholder_account_id,source_ref,source_version,account_status) VALUES($1,$2,$3,$4,1,'ACTIVE')",
  [A,PARTY,account,memberRef]);
 await db.query("INSERT INTO tto.source_contract_approvals(tenant_id,domain,source_ref,rule_snapshot_ref,evidence_id,approved_by,valid_until,enabled) VALUES($1,'CHILD06_MEMBERSHIP',$2,$3,$4,$5,now()+interval '1 hour',false),($1,'CHILD07_HOLDINGS',$6,$7,$4,$5,now()+interval '1 hour',false)",
  [A,memberRef,randomUUID(),DEC,APPROVER,holdingRef,randomUUID()]);
 await status(await get(memberPath,myToken),403,"approval disabled even with member row");
 await db.query("UPDATE tto.source_contract_approvals SET enabled=true WHERE tenant_id=$1 AND domain='CHILD06_MEMBERSHIP'",[A]);
 const verifiedMember=await status(await get(memberPath,myToken),200,"approved Child06 membership read");
 assert.equal(verifiedMember.record.membershipStatus,"ACTIVE");checks++;
 assert.equal(verifiedMember.record.partyKind,"PERSON");checks++;
 assert.equal(verifiedMember.record.sourceVersion,1);checks++;
 const memberPrivate=await status(await fetch(memberBff,{headers:cookie,cache:"no-store"}),200,"shareholder BFF approved member");
 assert.equal(memberPrivate.available,true);checks++;
 assert.equal(memberPrivate.record.membershipStatus,"ACTIVE");checks++;
 await inspectOwnScreen("CHILD06_ONLY","active","unavailable");
 await status(await get(sharePath,myToken),403,"Child07 independent approval still required");
 await db.query("UPDATE tto.source_contract_approvals SET enabled=true WHERE tenant_id=$1 AND domain='CHILD07_HOLDINGS'",[A]);
 await status(await get(sharePath,myToken),403,"absent ledger entry must not be zero shares");
 await status(await get(historyPath,myToken),403,"absent history cannot be empty success");
 const absentShares=await status(await fetch(shareBff,{headers:cookie,cache:"no-store"}),403,"BFF unknown holdings not zero");
 assert.deepEqual(absentShares,{available:false,code:"SOURCE_OR_PERMISSION_NOT_APPROVED"});checks++;
 await db.query("INSERT INTO tto.shareholding_source_snapshots(snapshot_id,tenant_id,shareholder_account_id,source_ref,ledger_entry_ref,ledger_version,share_quantity,ledger_as_of) VALUES($1,$2,$3,$4,$5,1,37,now())",
 [randomUUID(),A,account,holdingRef,randomUUID()]);
 const verifiedShare=await status(await get(sharePath,myToken),200,"approved Child07 holding read");
 assert.equal(verifiedShare.record.shareQuantity,"37");checks++;
 assert.equal(verifiedShare.record.ledgerVersion,1);checks++;
 const firstHistory=await status(await get(historyPath,myToken),200,"first signed source snapshot history");
 assert.deepEqual(firstHistory.record.items.map(x=>x.shareQuantity),["37"]);checks++;
 const firstBffHistory=await status(await fetch(historyBff,{headers:cookie}),200,"BFF approved snapshot history");
 assert.deepEqual(firstBffHistory.record.items.map(x=>x.shareQuantity),["37"]);checks++;
 ok(/no-store/.test((await fetch(historyBff,{headers:cookie})).headers.get("cache-control")??""),
  "history BFF cache disabled");
 const privateShare=await fetch(shareBff,{headers:cookie,cache:"no-store"});
 const privateBody=await status(privateShare,200,"BFF exact sourced holdings");
 assert.equal(privateBody.record.shareQuantity,"37");checks++;
 await inspectOwnScreen("BOTH_APPROVED","active","37");
 // Phase-2B: even a REAL valid CI session, approved Child06 membership,
 // approved Child07 holdings and tenant context do NOT authorize Child07
 // trade-request history or Child09 publication. These independent legal
 // sources have not been reviewed or activated. No synthetic real notices.
 for(const domain of ["trade-requests","notices"]){
  const backendPath="/v1/tenants/"+A+"/me/"+domain;
  const browserPath=sh.origin+"/api/tenants/"+A+"/me/"+domain;
  await status(await get(backendPath,myToken),403,
   "approved identity/holdings cannot bypass "+domain+" Nest source gate");
  await status(await get("/v1/tenants/"+B+"/me/"+domain,myToken),403,
   "wrong-tenant "+domain+" cannot be enumerated");
  await status(await fetch(sh.origin+"/api/tenants/"+B+"/me/"+domain,
   {headers:cookie}),403,"cross-tenant BFF "+domain+" denied");

  const bff=await fetch(browserPath,{headers:cookie,cache:"no-store"});
  const payload=await status(bff,403,"valid actor "+domain+" BFF still denied");
  assert.deepEqual(payload,{available:false,code:"SOURCE_OR_PERMISSION_NOT_APPROVED"});checks++;
  ok(/no-store/.test(bff.headers.get("cache-control")??""),
    domain+" no-store on denied valid-session read");
  await status(await fetch(browserPath,{headers:{
   Authorization:"Bearer "+myToken,"X-Role":"COOPERATIVE_MANAGER",
   "X-Party-Id":PARTY,"X-Tenant-Id":A
  }}),401,"browser forged headers cannot bypass "+domain);
  // Framework-generated HTTP 405 responses may have an empty body.
  // Verify the status directly; never demand a JSON error payload.
  const rejectedWrite=await fetch(browserPath,{method:"POST",headers:cookie});
  assert.equal(rejectedWrite.status,405,
   domain+" is explicitly read-only actual="+rejectedWrite.status);checks++;
  await rejectedWrite.arrayBuffer();
 }
 ok(/no-store/.test(privateShare.headers.get("cache-control")??""),"shareholding no-cache");
 ok(!JSON.stringify(privateBody).includes(myToken),"opaque session never exposed");
 await db.query("INSERT INTO tto.shareholding_source_snapshots(snapshot_id,tenant_id,shareholder_account_id,source_ref,ledger_entry_ref,ledger_version,share_quantity,ledger_as_of) VALUES($1,$2,$3,$4,$5,2,0,now())",
  [randomUUID(),A,account,holdingRef,randomUUID()]);
 const zeroSource=await status(await get(sharePath,myToken),200,"explicit sourced zero remains zero");
 assert.equal(zeroSource.record.shareQuantity,"0");checks++;
 assert.equal(zeroSource.record.ledgerVersion,2);checks++;
 const secondHistory=await status(await get(historyPath,myToken),200,"signed 0 before 37 history");
 assert.deepEqual(secondHistory.record.items.map(x=>[x.ledgerVersion,x.shareQuantity]),[[2,"0"],[1,"37"]]);checks++;
 const bffHistory2=await status(await fetch(historyBff,{headers:cookie}),200,"BFF 2-version history");
 assert.deepEqual(bffHistory2.record.items.map(x=>x.shareQuantity),["0","37"]);checks++;
 await status(await get("/v1/tenants/"+B+"/me/shareholding-history",myToken),403,
   "cross cooperative source history denied");
 await status(await fetch(sh.origin+"/api/tenants/"+B+"/me/shareholding-history",{headers:cookie}),403,
   "cross cooperative history BFF denied");
 await inspectOwnScreen("EXPLICIT_ZERO","active","0");
 await status(await get("/v1/tenants/"+B+"/me/member-record",myToken),403,"cross cooperative member read denied");
 await status(await get("/v1/tenants/"+B+"/me/shareholding",myToken),403,"cross cooperative holdings read denied");
 await status(await get(memberPath,tokenMap.get(MANAGER)),403,"manager cannot read other private member");
 await status(await get(sharePath,tokenMap.get(NATIONAL)),403,"national JIT cannot inspect private shares");
 // Source adapter staging: independent CI fixture metadata only; NO promotion of raw claims.
 const sha=()=>createHash("sha256").update(randomUUID()).digest();
 const batchInsert=async(domain,sourceRef,tenant=A,attestor=APPROVER,artifactEvidence=DEC,submitter=REVIEWER)=>{
  const id=randomUUID();
  await db.query("INSERT INTO tto.source_import_batches(batch_id,tenant_id,domain,source_ref,external_batch_ref,submitted_by,artifact_sha256,attested_by,attested_at,attestation_evidence_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $8::uuid IS NULL THEN NULL ELSE now() END,$9)",
   [id,tenant,domain,sourceRef,"CI-batch-"+randomUUID(),submitter,sha(),attestor,artifactEvidence]);
  return id;
 };
 const claimInsert=async(batch,domain,fields={})=>{
  const id=randomUUID();
  await db.query("INSERT INTO tto.source_import_claims(claim_id,batch_id,tenant_id,domain,party_id,source_event_id,source_version,membership_status,shareholder_account_id,ledger_entry_ref,ledger_version,share_quantity,effective_at,claim_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",[
   id,batch,fields.tenant??A,domain,fields.party??PARTY,
   domain==="CHILD06_MEMBERSHIP"?(fields.event??projection.source_event_id):null,
   domain==="CHILD06_MEMBERSHIP"?(fields.version??1):null,
   domain==="CHILD06_MEMBERSHIP"?(fields.memberStatus??"ACTIVE"):null,
   domain==="CHILD07_HOLDINGS"?(fields.account??account):null,
   domain==="CHILD07_HOLDINGS"?(fields.entry??randomUUID()):null,
   domain==="CHILD07_HOLDINGS"?(fields.version??3):null,
   domain==="CHILD07_HOLDINGS"?(fields.qty??19):null,
   fields.asOf??new Date(),sha()
  ]);
  return id;
 };
 const assess=async(claim)=> {
  const r=await db.query("SELECT tto.assess_source_import_claim($1) AS verdict",[claim]);
  return r.rows[0].verdict;
 };
 const memberBatch=await batchInsert("CHILD06_MEMBERSHIP",memberRef);
 const sameMemberClaim=await claimInsert(memberBatch,"CHILD06_MEMBERSHIP");
 assert.equal(await assess(sameMemberClaim),"REPLAY_IDENTICAL_REFERENCE");checks++;
 const badMembershipClaim=await claimInsert(memberBatch,"CHILD06_MEMBERSHIP",{event:randomUUID()});
 assert.equal(await assess(badMembershipClaim),"MEMBER_MASTER_PROJECTION_MISMATCH");checks++;
 const unattestedBatch=await batchInsert("CHILD07_HOLDINGS",holdingRef,A,null,null);
 assert.equal(await assess(await claimInsert(unattestedBatch,"CHILD07_HOLDINGS")),"QUARANTINED_NO_INDEPENDENT_ATTESTATION");checks++;
 const selfAttested=await batchInsert("CHILD07_HOLDINGS",holdingRef,A,REVIEWER,DEC,REVIEWER);
 assert.equal(await assess(await claimInsert(selfAttested,"CHILD07_HOLDINGS")),"QUARANTINED_SOD_VIOLATION");checks++;
 const delayedBatch=randomUUID();
 await db.query("INSERT INTO tto.source_import_batches(batch_id,tenant_id,domain,source_ref,external_batch_ref,submitted_by,artifact_sha256,received_at,attested_by,attested_at,attestation_evidence_id) VALUES($1,$2,'CHILD07_HOLDINGS',$3,$4,$5,$6,now()-interval '2 days',$7,now(),$8)",
 [delayedBatch,A,holdingRef,"CI-delayed-"+randomUUID(),REVIEWER,sha(),APPROVER,DEC]);
 assert.equal(await assess(await claimInsert(delayedBatch,"CHILD07_HOLDINGS")),"READY_FOR_INDEPENDENT_REVIEW");checks++;
 const invalidEvidence=await batchInsert("CHILD07_HOLDINGS",holdingRef,A,APPROVER,REQ);
 // Both REQ/DEC are published same-tenant evidence in synthetic test, so this is a valid independent record.
 assert.equal(await assess(await claimInsert(invalidEvidence,"CHILD07_HOLDINGS")),"READY_FOR_INDEPENDENT_REVIEW");checks++;
 const foreignBatch=await batchInsert("CHILD07_HOLDINGS",holdingRef,B);
 assert.equal(await assess(await claimInsert(foreignBatch,"CHILD07_HOLDINGS")),"CROSS_TENANT_OR_DOMAIN_MISMATCH");checks++;
 const unapprovedBatch=await batchInsert("CHILD07_HOLDINGS","NO-APPROVAL-SOURCE");
 assert.equal(await assess(await claimInsert(unapprovedBatch,"CHILD07_HOLDINGS")),"SOURCE_CONTRACT_NOT_APPROVED");checks++;
 const holdBatch=await batchInsert("CHILD07_HOLDINGS",holdingRef);
 const claimReady=await claimInsert(holdBatch,"CHILD07_HOLDINGS",{version:3,qty:19});
 assert.equal(await assess(claimReady),"READY_FOR_INDEPENDENT_REVIEW");checks++;
 assert.equal(await assess(await claimInsert(holdBatch,"CHILD07_HOLDINGS",{version:5})),"VERSION_GAP");checks++;
 assert.equal(await assess(await claimInsert(holdBatch,"CHILD07_HOLDINGS",{version:1})),"STALE_SOURCE_VERSION");checks++;
 const existingLedger=(await db.query("SELECT ledger_entry_ref FROM tto.shareholding_source_snapshots WHERE tenant_id=$1 AND shareholder_account_id=$2 AND ledger_version=2",[A,account])).rows[0].ledger_entry_ref;
 assert.equal(await assess(await claimInsert(holdBatch,"CHILD07_HOLDINGS",{version:2,entry:existingLedger,qty:0})),"REPLAY_IDENTICAL_REFERENCE");checks++;
 assert.equal(await assess(await claimInsert(holdBatch,"CHILD07_HOLDINGS",{version:2,qty:99})),"CONFLICT_SAME_VERSION");checks++;
 const reusedRefBatch=await batchInsert("CHILD07_HOLDINGS",holdingRef);
 assert.equal(await assess(await claimInsert(reusedRefBatch,"CHILD07_HOLDINGS",{version:3,entry:existingLedger})),"REUSED_LEDGER_ENTRY_REF");checks++;
 assert.equal(await assess(await claimInsert(holdBatch,"CHILD07_HOLDINGS",{version:3,asOf:new Date("2020-01-01T00:00:00Z")})),"EFFECTIVE_TIME_REGRESSION");checks++;
 assert.equal(await assess(await claimInsert(holdBatch,"CHILD07_HOLDINGS",{version:3,asOf:new Date("2099-01-01T00:00:00Z")})),"FUTURE_EFFECTIVE_DATE");checks++;
 const wrongDomain=await claimInsert(holdBatch,"CHILD06_MEMBERSHIP");
 assert.equal(await assess(wrongDomain),"CROSS_TENANT_OR_DOMAIN_MISMATCH");checks++;
 const unknown=await assess(randomUUID());
 assert.equal(unknown,"UNKNOWN_CLAIM");checks++;
 await assert.rejects(()=>db.query("UPDATE tto.source_import_claims SET source_version=77 WHERE claim_id=$1",[sameMemberClaim]));checks++;
 await assert.rejects(()=>db.query("DELETE FROM tto.source_import_batches WHERE batch_id=$1",[holdBatch]));checks++;
 // The stage is inert: no new share snapshot or relationship was written by assessment.
 const unchangedLedger=await db.query("SELECT count(*)::integer AS n FROM tto.shareholding_source_snapshots WHERE tenant_id=$1 AND shareholder_account_id=$2",[A,account]);
 assert.equal(unchangedLedger.rows[0].n,2);checks++;

 await db.query("UPDATE tto.source_contract_approvals SET enabled=false WHERE tenant_id=$1 AND domain='CHILD07_HOLDINGS'",[A]);
 await status(await get(sharePath,myToken),403,"source revocation hides shares immediately");
 await status(await get(historyPath,myToken),403,"source revocation hides snapshot history immediately");
 await status(await fetch(historyBff,{headers:cookie}),403,"BFF revocation hides snapshot history");
 await status(await get(memberPath,myToken),200,"independent member source unaffected");
 await db.query("UPDATE tto.source_contract_approvals SET enabled=true WHERE tenant_id=$1 AND domain='CHILD07_HOLDINGS'",[A]);
 await db.query("UPDATE tto.source_contract_approvals SET approved_at=now()-interval '3 hours',valid_until=now()-interval '1 hour' WHERE tenant_id=$1 AND domain='CHILD07_HOLDINGS'",[A]);
 await status(await get(sharePath,myToken),403,"expired holdings source approval blocked");
 await status(await get(historyPath,myToken),403,"expired approval blocks history");
 await db.query("UPDATE tto.source_contract_approvals SET enabled=false WHERE tenant_id=$1 AND domain='CHILD06_MEMBERSHIP'",[A]);
 await status(await get(memberPath,myToken),403,"membership source revocation immediate");
 await status(await get(sharePath,myToken),403,"holdings depend on active Child06 source");
 await status(await get(historyPath,myToken),403,"history depends on active Child06 source");


 // Child06 first practical slice: only PENDING -> reviewed; no activation of relationship or shares.
 const PENDING_PARTY=randomUUID(),CANDIDATE_REJECT=randomUUID();
 for(const party of [PENDING_PARTY,CANDIDATE_REJECT]){
  await db.query("INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES($1,'PERSON','Synthetic applicant only')",[party]);
  await db.query("INSERT INTO tto.user_party_links(user_id,party_id,verified_at) VALUES($1,$2,now())",[USER,party]);
  await db.query("INSERT INTO tto.identity_link_cases(case_id,tenant_id,user_id,party_id,request_evidence_id,requested_by,status,decided_at,decided_by,decision_evidence_id,version) VALUES($1,$2,$3,$4,$5,$3,'APPROVED',now(),$6,$7,2)",
  [randomUUID(),A,USER,party,REQ,REVIEWER,DEC]);
 }
 const membershipPath="/v1/tenants/"+A+"/membership-applications",memberManager=tokenMap.get(MANAGER);
 const ownBff=sh.origin+"/api/tenants/"+A+"/me/membership-applications";
 const manageBff=cm.origin+"/api/tenants/"+A+"/membership-applications";
 const ownerCookie={Cookie:"tto_session="+myToken,Origin:sh.origin,"Content-Type":"application/json"};
 const managerCookie={Cookie:"tto_session="+memberManager,Origin:cm.origin,"Content-Type":"application/json"};
 await status(await post(membershipPath,myToken,{partyId:PARTY,evidenceId:REQ}),403,
  "already active membership relation may not be re-applied");
 await status(await post(membershipPath,myToken,{partyId:PENDING_PARTY,evidenceId:randomUUID()}),403,
  "unpublished source evidence cannot submit membership");
 await status(await post("/v1/tenants/"+B+"/membership-applications",myToken,
  {partyId:PENDING_PARTY,evidenceId:REQ}),403,"cross-tenant membership request denied");
 await status(await fetch(ownBff,{method:"POST",headers:{Origin:sh.origin,"Content-Type":"application/json",Authorization:"Bearer "+myToken},
  body:JSON.stringify({partyId:PENDING_PARTY,evidenceId:REQ})}),401,"browser bearer forgery denied");
 await status(await fetch(ownBff,{method:"POST",headers:{...ownerCookie,Origin:"https://invalid.example"},
  body:JSON.stringify({partyId:PENDING_PARTY,evidenceId:REQ})}),403,"member CSRF denied");
 const attempted=await fetch(ownBff,{method:"POST",headers:ownerCookie,
  body:JSON.stringify({partyId:PENDING_PARTY,evidenceId:REQ})});
 if(attempted.status!==201)console.error("TTO_CHILD06_DENIAL_DIAG",attempted.status,await attempted.clone().text());
 const submitted=await status(attempted,201,"submitted member workflow through shareholder BFF");
 ok(submitted.status==="PENDING"&&submitted.version===1,"new versioned application pending");
 const applicationPath=membershipPath+"/"+submitted.applicationId;
 const ownApplicationBff=ownBff+"/"+submitted.applicationId;
 await status(await post(membershipPath,myToken,{partyId:PENDING_PARTY,evidenceId:REQ}),403,
  "duplicate pending membership denied");
 const ownPending=await status(await fetch(ownApplicationBff,{headers:ownerCookie}),200,
  "applicant sees own application status");
 ok(ownPending.record.status==="PENDING"&&ownPending.record.version===1,"own pending status version");
 await status(await get("/v1/tenants/"+A+"/me/membership-applications/"+submitted.applicationId,memberManager),403,
  "manager cannot use applicant owner-only query");
 await status(await post(applicationPath+"/decision",myToken,
  {approve:true,expectedVersion:1,decisionEvidenceId:DEC}),403,"self decision forbidden");
 await db.query("UPDATE tto.role_assignments SET revoked_at=NULL WHERE user_id=$1 AND tenant_id=$2 AND role_code='COOPERATIVE_MANAGER'",[MANAGER,A]);
 await status(await get(membershipPath+"/pending",memberManager),403,"role alone never authorizes manager review");
 await db.query("INSERT INTO tto.membership_review_authorizations(tenant_id,reviewer_id,approved_by,evidence_id,valid_until) VALUES($1,$2,$3,$4,now()+interval '1 hour')",[A,MANAGER,APPROVER,DEC]);
 await db.query("INSERT INTO tto.membership_review_rule_gates(tenant_id,rule_snapshot_ref,evidence_id,approved_by,valid_until,enabled) VALUES($1,$2,$3,$4,now()+interval '1 hour',false)",[A,randomUUID(),DEC,APPROVER]);
 await status(await get(membershipPath+"/pending",memberManager),403,"disabled rule gate keeps manager out");
 await db.query("UPDATE tto.membership_review_rule_gates SET enabled=true WHERE tenant_id=$1",[A]);
 const pending=await status(await fetch(manageBff+"/pending",{headers:managerCookie}),200,"manager BFF review tray");
 ok(pending.items.some(x=>x.applicationId===submitted.applicationId),"manager sees one pending case");
 await status(await post(applicationPath+"/decision",memberManager,
  {approve:true,expectedVersion:2,decisionEvidenceId:DEC}),409,"stale version fails closed");
 await status(await post(applicationPath+"/decision",memberManager,
  {approve:true,expectedVersion:1,decisionEvidenceId:REQ}),403,"same applicant evidence fails SoD");
 await status(await fetch(manageBff+"/"+submitted.applicationId+"/decision",{method:"POST",
  headers:{...managerCookie,Origin:"https://invalid.example"},body:JSON.stringify({approve:true,expectedVersion:1,decisionEvidenceId:DEC})}),403,"manager review CSRF denied");
 const accepted=await status(await fetch(manageBff+"/"+submitted.applicationId+"/decision",{
  method:"POST",headers:managerCookie,body:JSON.stringify({approve:true,expectedVersion:1,decisionEvidenceId:DEC})}),201,
  "manager BFF records source-evidenced decision");
 assert.deepEqual(accepted,{recorded:true,status:"APPROVED",alreadyApplied:false});checks++;
 const repeat=await status(await post(applicationPath+"/decision",memberManager,
  {approve:true,expectedVersion:1,decisionEvidenceId:DEC}),201,"same decision retry idempotent");
 assert.deepEqual(repeat,{recorded:true,status:"APPROVED",alreadyApplied:true});checks++;
 await status(await post(applicationPath+"/decision",memberManager,
  {approve:false,expectedVersion:1,decisionEvidenceId:DEC}),409,"conflicting decision blocked");
 const finalRecord=await status(await fetch(ownApplicationBff,{headers:ownerCookie}),200,"applicant sees reviewed version");
 ok(finalRecord.record.version===2&&finalRecord.record.status==="APPROVED","applicant sees reviewed decision");
 const events=await db.query("SELECT count(*)::int AS n FROM tto.membership_application_outbox WHERE application_id=$1",[submitted.applicationId]);
 ok(events.rows[0].n===2,"one submitted and one reviewed transactional outbox row");
 const notActivated=await db.query("SELECT (SELECT count(*)::int FROM tto.relationship_projections WHERE tenant_id=$1 AND party_id=$2) AS relations,(SELECT count(*)::int FROM tto.shareholder_source_accounts WHERE tenant_id=$1 AND party_id=$2) AS accounts",[A,PENDING_PARTY]);
 ok(notActivated.rows[0].relations===0&&notActivated.rows[0].accounts===0,
  "decision never creates relationship/Party role/ownership account");
 const second=await status(await post(membershipPath,myToken,{partyId:CANDIDATE_REJECT,evidenceId:REQ}),201,"second candidate pending");
 const rejected=await status(await post(membershipPath+"/"+second.applicationId+"/decision",memberManager,
  {approve:false,expectedVersion:1,decisionEvidenceId:DEC}),201,"member review rejection");
 ok(rejected.status==="REJECTED"&&!rejected.alreadyApplied,"reject branch is terminal");

 // Child06 independent ActivateRelationship command. The prior APPROVED decision
 // must NOT have materialized a relationship; only the third-party activation may.
 const activationPath=membershipPath+"/"+submitted.applicationId+"/activate";
 const activationBff=manageBff+"/"+submitted.applicationId+"/activate";
 const activationEvidence=randomUUID();
 await db.query("INSERT INTO tto.evidence_references(evidence_id,tenant_id,document_id,source_entity_type,source_entity_id) SELECT $1,tenant_id,document_id,'CI_CHILD06_ACTIVATION',$3 FROM tto.evidence_references WHERE evidence_id=$2",
  [activationEvidence,DEC,randomUUID()]);
 const activatedBefore=await db.query("SELECT count(*)::int AS n FROM tto.cooperative_relationships WHERE tenant_id=$1 AND party_id=$2",[A,PENDING_PARTY]);
 ok(activatedBefore.rows[0].n===0,"reviewed application must not activate relationship");
 await status(await post(activationPath,myToken,{activationEvidenceId:activationEvidence,expectedVersion:2}),
  403,"applicant cannot activate relationship");
 await status(await post(activationPath,memberManager,{activationEvidenceId:activationEvidence,expectedVersion:2}),
  403,"decision reviewer must not activate own decision");
 await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'COOPERATIVE_MANAGER')",
  [randomUUID(),REVIEWER,A]);
 const activatorToken=tokenMap.get(REVIEWER);
 const activatorCookie={Cookie:"tto_session="+activatorToken,Origin:cm.origin,"Content-Type":"application/json"};
 await status(await post(activationPath,activatorToken,{activationEvidenceId:activationEvidence,expectedVersion:2}),
  403,"manager role alone lacks activation authority");
 await db.query("INSERT INTO tto.membership_activation_authorizations(tenant_id,activator_id,approved_by,evidence_id,valid_until) VALUES($1,$2,$3,$4,now()+interval '1 hour')",
  [A,REVIEWER,APPROVER,DEC]);
 await db.query("INSERT INTO tto.membership_activation_rule_gates(tenant_id,rule_snapshot_ref,evidence_id,approved_by,valid_until,enabled) VALUES($1,$2,$3,$4,now()+interval '1 hour',false)",
  [A,randomUUID(),DEC,APPROVER]);
 await status(await post(activationPath,activatorToken,{activationEvidenceId:activationEvidence,expectedVersion:2}),
  403,"separately authorized activator still requires active rule snapshot gate");
 await db.query("UPDATE tto.membership_activation_rule_gates SET enabled=true WHERE tenant_id=$1",[A]);
 await status(await post(activationPath,activatorToken,{activationEvidenceId:DEC,expectedVersion:2}),
  403,"activation must not reuse approval-decision evidence");
 await status(await post(activationPath,activatorToken,{activationEvidenceId:activationEvidence,expectedVersion:1}),
  409,"activation rejects stale version");
 await status(await post("/v1/tenants/"+B+"/membership-applications/"+submitted.applicationId+"/activate",
  activatorToken,{activationEvidenceId:activationEvidence,expectedVersion:2}),
  403,"activation strictly tenant-bound");
 await status(await fetch(activationBff,{method:"POST",headers:{
  Authorization:"Bearer "+activatorToken,Origin:cm.origin,"Content-Type":"application/json"},
  body:JSON.stringify({activationEvidenceId:activationEvidence,expectedVersion:2})}),401,
  "forged browser bearer cannot activate relationship");
 await status(await fetch(activationBff,{method:"POST",
  headers:{...activatorCookie,Origin:"https://evil.example"},
  body:JSON.stringify({activationEvidenceId:activationEvidence,expectedVersion:2})}),403,
  "activation BFF must enforce CSRF protection");
 const activation=await status(await fetch(activationBff,{method:"POST",headers:activatorCookie,
  body:JSON.stringify({activationEvidenceId:activationEvidence,expectedVersion:2})}),201,
  "third-party actor activates only the approved Child06 relationship");
 assert.deepEqual(activation,{recorded:true,status:"ACTIVATED",alreadyActivated:false});checks++;
 const activationReplay=await status(await post(activationPath,activatorToken,
  {activationEvidenceId:activationEvidence,expectedVersion:2}),201,
  "identical activation is idempotent");
 assert.deepEqual(activationReplay,{recorded:true,status:"ACTIVATED",alreadyActivated:true});checks++;
 const storedRelationship=await db.query("SELECT relationship_status,source_version,activated_by FROM tto.cooperative_relationships WHERE tenant_id=$1 AND party_id=$2",
  [A,PENDING_PARTY]);
 ok(storedRelationship.rowCount===1&&storedRelationship.rows[0].relationship_status==="ACTIVE"&&
  Number(storedRelationship.rows[0].source_version)===1&&storedRelationship.rows[0].activated_by===REVIEWER,
  "Child06 source-owned relationship committed at monotonic v1");
 const sourceEvents=await db.query("SELECT count(*)::int AS n FROM tto.cooperative_relationship_outbox WHERE tenant_id=$1 AND party_id=$2 AND event_name='MEMBERSHIP_APPROVED'",
  [A,PENDING_PARTY]);
 ok(sourceEvents.rows[0].n===1,"activation replays do not duplicate monotonic outbox event");
 const projected=await db.query("SELECT count(*)::int AS n FROM tto.relationship_projections WHERE tenant_id=$1 AND party_id=$2",[A,PENDING_PARTY]);
 ok(projected.rows[0].n===0,"CF02 projection not rewritten without separate projector");
 const noAccount=await db.query("SELECT count(*)::int AS n FROM tto.shareholder_source_accounts WHERE tenant_id=$1 AND party_id=$2",[A,PENDING_PARTY]);
 ok(noAccount.rows[0].n===0,"activation never manufactures shareholder account or shares");
 const ownRelation=await status(await get("/v1/tenants/"+A+"/me/membership-applications/"+submitted.applicationId+"/relationship",myToken),
  200,"member applicant can read own activated source-relationship reference");
 ok(ownRelation.record.status==="ACTIVE"&&Number(ownRelation.record.sourceVersion)===1,
  "private relationship status is source-versioned");
 await status(await get("/v1/tenants/"+A+"/me/membership-applications/"+submitted.applicationId+"/relationship",memberManager),
  403,"reviewer cannot inspect another applicant's relationship");
 await db.query("UPDATE tto.membership_activation_rule_gates SET enabled=false WHERE tenant_id=$1",[A]);
 await status(await post(activationPath,activatorToken,
  {activationEvidenceId:activationEvidence,expectedVersion:2}),403,
  "revoked activation rule blocks replay despite past success");

 // Issue #154 CF02 projector. NO tto_app EXECUTE / event publisher in this slice.
 const projectorPrivilege=await db.query("SELECT has_function_privilege('tto_app','tto.cf02_project_child06_relationship_event(uuid,uuid)','EXECUTE') AS has_execute");
 ok(projectorPrivilege.rows[0].has_execute===false,
  "app runtime has NO direct projector execute permission");
 const evForProjection=await db.query("SELECT event_id FROM tto.cooperative_relationship_outbox WHERE tenant_id=$1 AND party_id=$2 AND event_name='MEMBERSHIP_APPROVED'",
  [A,PENDING_PARTY]);
 ok(evForProjection.rowCount===1,"one immutable source event available for CF02");
 const projectionEventId=evForProjection.rows[0].event_id;
 async function projectAs(projector,tenant,eventId){
  await db.query("BEGIN");
  try{
   await db.query("SELECT set_config('tto.actor_id',$1,true)",[projector]);
   await db.query("SELECT set_config('tto.tenant_id',$1,true)",[tenant]);
   const out=await db.query("SELECT tto.cf02_project_child06_relationship_event($1,$2) AS result",
    [tenant,eventId]);
   await db.query("COMMIT");return out.rows[0].result;
  }catch(e){await db.query("ROLLBACK");throw e;}
 }
 const beforeProjection=await db.query("SELECT count(*)::int AS n FROM tto.relationship_projections WHERE tenant_id=$1 AND party_id=$2",[A,PENDING_PARTY]);
 ok(beforeProjection.rows[0].n===0,"Child06 event does not auto-project into CF02");
 ok(await projectAs(USER,A,projectionEventId)==="DENIED","ordinary applicant cannot run projector");
 await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'DOCUMENT_REVIEWER')",
  [randomUUID(),NATIONAL,A]);
 ok(await projectAs(NATIONAL,A,projectionEventId)==="DENIED","projector role alone never suffices");
 await db.query("INSERT INTO tto.cf02_relationship_projection_authorizations(tenant_id,projector_id,approved_by,approval_evidence_id,valid_until) VALUES($1,$2,$3,$4,now()+interval '1 hour')",
  [A,NATIONAL,APPROVER,DEC]);
 await db.query("INSERT INTO tto.cf02_relationship_projection_rule_gates(tenant_id,rule_snapshot_ref,evidence_id,approved_by,valid_until,enabled) VALUES($1,$2,$3,$4,now()+interval '1 hour',false)",
  [A,randomUUID(),DEC,APPROVER]);
 ok(await projectAs(NATIONAL,A,projectionEventId)==="DENIED","disabled rule blocks projected membership");
 await db.query("UPDATE tto.cf02_relationship_projection_rule_gates SET enabled=true WHERE tenant_id=$1",[A]);
 ok(await projectAs(NATIONAL,B,projectionEventId)==="DENIED","cross-tenant projector fails closed");
 ok(await projectAs(NATIONAL,A,randomUUID())==="UNKNOWN_SOURCE_EVENT","unrecognized event never creates a projection");
 await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'DOCUMENT_REVIEWER')",
  [randomUUID(),REVIEWER,A]);
 await db.query("INSERT INTO tto.cf02_relationship_projection_authorizations(tenant_id,projector_id,approved_by,approval_evidence_id,valid_until) VALUES($1,$2,$3,$4,now()+interval '1 hour')",
  [A,REVIEWER,APPROVER,DEC]);
 ok(await projectAs(REVIEWER,A,projectionEventId)==="SOURCE_RELATIONSHIP_INVALID",
  "original membership activator cannot independently project own event");
 ok(await projectAs(NATIONAL,A,projectionEventId)==="PROJECTED",
  "independent evidence-gated CF02 projector materializes source-versioned reference");
 // Issue #154: PostgreSQL-backed adapter integration on the existing isolated fixture.
 // This validates durable replay receipt; no actual broker or operational service principal.
 const {consumeOne:consumeCf02Event}=require("../services/workers/src/cf02-child06-consumer.cjs");
 const adapterSource=(await db.query("SELECT event_id,tenant_id,party_id,relationship_id,source_version,event_name FROM tto.cooperative_relationship_outbox WHERE event_id=$1",[projectionEventId])).rows[0];
 adapterSource.source_version=Number(adapterSource.source_version);
 let ackCount=0;
 const adapterPorts={
  readSource:async(id,tenant)=>{const q=await db.query("SELECT event_id,tenant_id,party_id,relationship_id,source_version,event_name FROM tto.cooperative_relationship_outbox WHERE event_id=$1 AND tenant_id=$2",[id,tenant]);return q.rowCount?{...q.rows[0],source_version:Number(q.rows[0].source_version)}:null;},
  project:async(tenant,id)=>projectAs(NATIONAL,tenant,id),
  ack:async()=>{ackCount++;},
  quarantine:async()=>{throw Error("UNEXPECTED_QUARANTINE");},
  retry:async()=>{throw Error("UNEXPECTED_RETRY");}
 };
 const adapterReplay=await consumeCf02Event(adapterSource,{enabled:true,authorized:true,ports:adapterPorts});
 ok(adapterReplay.status==="ACKED_REPLAY"&&ackCount===1,
  "real PG17 CF02 outbox adapter replay acks committed immutable receipt only");
 const adapterNoAccess=await consumeCf02Event(adapterSource,{enabled:true,authorized:false,ports:adapterPorts});
 ok(adapterNoAccess.status==="DISABLED"&&ackCount===1,
  "disabled consumer authority never acknowledges or projects");
 // Multi-connection PG17 contention and crash-before-ack simulation, disposable only.
 const contenders=await Promise.all(Array.from({length:3},async()=>{
  const client=new Client({connectionString:url});await client.connect();
  try{
   await client.query("BEGIN");
   await client.query("SELECT set_config('tto.actor_id',$1,true)",[NATIONAL]);
   await client.query("SELECT set_config('tto.tenant_id',$1,true)",[A]);
   const result=await client.query("SELECT tto.cf02_project_child06_relationship_event($1,$2) AS result",[A,projectionEventId]);
   await client.query("COMMIT");
   return result.rows[0].result;
  }catch(err){await client.query("ROLLBACK");throw err}
  finally{await client.end()}
 }));
 ok(contenders.every(v=>v==="ALREADY_PROJECTED"),
  "three independent PG17 connections safely replay same immutable receipt");
 const receiptAfterContention=await db.query("SELECT count(*)::int AS n FROM tto.cf02_relationship_projection_receipts WHERE source_event_id=$1",[projectionEventId]);
 ok(receiptAfterContention.rows[0].n===1,"PG17 concurrent replay keeps exactly one immutable receipt");
 const noAckPorts={...adapterPorts,ack:async()=>{throw Error("SIMULATED_ACK_LOSS")}};
 await assert.rejects(()=>consumeCf02Event(adapterSource,{enabled:true,authorized:true,ports:noAckPorts}),/SIMULATED_ACK_LOSS/);
 const recovered=await consumeCf02Event(adapterSource,{enabled:true,authorized:true,ports:adapterPorts});
 ok(recovered.status==="ACKED_REPLAY"&&ackCount===2,
  "simulated lost ack redelivery safely reuses the durable PG17 receipt");


 const projectedOnce=await db.query("SELECT membership_status,source_event_id,source_version FROM tto.relationship_projections WHERE tenant_id=$1 AND party_id=$2",
  [A,PENDING_PARTY]);
 ok(projectedOnce.rowCount===1&&projectedOnce.rows[0].membership_status==="ACTIVE"&&
   projectedOnce.rows[0].source_event_id===projectionEventId&&Number(projectedOnce.rows[0].source_version)===1,
   "CF02 holds only verified Child06 event reference and exact version");
 ok(await projectAs(NATIONAL,A,projectionEventId)==="ALREADY_PROJECTED",
  "duplicate projection idempotent under exact source event");
 const receipts=await db.query("SELECT count(*)::int AS n FROM tto.cf02_relationship_projection_receipts WHERE source_event_id=$1",
   [projectionEventId]);
 ok(receipts.rows[0].n===1,"replay did not duplicate immutable CF02 projection receipt");
 const memberNoSource=await db.query("SELECT count(*)::int AS n FROM tto.member_source_snapshots WHERE tenant_id=$1 AND party_id=$2",
   [A,PENDING_PARTY]);
 ok(memberNoSource.rows[0].n===0,"projection does not fabricate official member source snapshot");
 const memberNoRole=await db.query("SELECT count(*)::int AS n FROM tto.role_assignments WHERE user_id=$1 AND tenant_id=$2 AND role_code='MEMBER' AND revoked_at IS NULL",
  [USER,A]);
 ok(memberNoRole.rows[0].n===1,"projection did not add a second MEMBER-role assignment");
 const projectedNoShares=await db.query("SELECT count(*)::int AS n FROM tto.shareholder_source_accounts WHERE tenant_id=$1 AND party_id=$2",
  [A,PENDING_PARTY]);
 ok(projectedNoShares.rows[0].n===0,"projection cannot create shareholder accounts or holdings");
 await db.query("UPDATE tto.cf02_relationship_projection_rule_gates SET enabled=false WHERE tenant_id=$1",[A]);
 ok(await projectAs(NATIONAL,A,projectionEventId)==="DENIED","revoked projector rule immediately fails closed");



 // Optional ACTUAL Chromium browser smoke of the two existing portal forms.
 // These are synthetic records, with no operation against real member/ledger sources.
 if(browser){
  const formParty=randomUUID();
  await db.query("INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES($1,'PERSON','CI form-only applicant')",[formParty]);
  await db.query("INSERT INTO tto.user_party_links(user_id,party_id,verified_at) VALUES($1,$2,now())",[USER,formParty]);
  await db.query("INSERT INTO tto.identity_link_cases(case_id,tenant_id,user_id,party_id,request_evidence_id,requested_by,status,decided_at,decided_by,decision_evidence_id,version) VALUES($1,$2,$3,$4,$5,$3,'APPROVED',now(),$6,$7,2)",[randomUUID(),A,USER,formParty,REQ,REVIEWER,DEC]);
  for(const width of [390,1440]){
   const userCtx=await browser.newContext({viewport:{width,height:900},locale:"fa-IR",serviceWorkers:"block"});
   await userCtx.addCookies([{name:"tto_session",value:myToken,url:sh.origin,httpOnly:true,sameSite:"Lax"}]);
   const userPage=await userCtx.newPage();const errors=[];
   userPage.on("pageerror",e=>errors.push(e.message));
   await userPage.goto(sh.origin+"/tenants/"+A+"/membership-application",{waitUntil:"domcontentloaded",timeout:20000});
   await userPage.getByRole("heading",{name:"درخواست عضویت در تعاونی"}).waitFor();
   if(width===390){
    await userPage.getByLabel("شناسه مرجع هویت تأییدشده (Party)").fill(formParty);
    await userPage.getByLabel("شناسه سند و شاهد معتبر").fill(REQ);
    await userPage.getByRole("button",{name:"ثبت درخواست برای بررسی"}).click();
    await userPage.getByText("درخواست ثبت شد؛ در صف بررسی مدیر تعاونی است. هنوز هیچ عضویت یا سهمی فعال نشده است.").waitFor();
    await userPage.getByRole("heading",{name:"پیگیری درخواست"}).waitFor();
   }
   const managerCtx=await browser.newContext({viewport:{width,height:900},locale:"fa-IR",serviceWorkers:"block"});
   await managerCtx.addCookies([{name:"tto_session",value:memberManager,url:cm.origin,httpOnly:true,sameSite:"Lax"}]);
   const managerPage=await managerCtx.newPage();
   managerPage.on("pageerror",e=>errors.push(e.message));
   await managerPage.goto(cm.origin+"/tenants/"+A+"/membership-applications",{waitUntil:"domcontentloaded",timeout:20000});
   await managerPage.getByRole("heading",{name:"بررسی درخواست‌های عضویت"}).waitFor();
   if(width===390){
    const item=managerPage.locator("li").filter({hasText:formParty});
    await item.waitFor();
    await item.getByLabel("شناسه سند مستقل تصمیم مدیر").fill(DEC);
    managerPage.once("dialog",dialog=>void dialog.accept());
    await item.getByRole("button",{name:"تأیید درخواست"}).click();
    await managerPage.getByText("درخواست مجازِ در انتظار بررسی وجود ندارد.").waitFor();
    const review=await db.query("SELECT status,version,application_id FROM tto.membership_applications WHERE tenant_id=$1 AND party_id=$2",[A,formParty]);
    ok(review.rowCount===1&&review.rows[0].status==="APPROVED"&&Number(review.rows[0].version)===2,
     "browser manager approval persisted once and advanced version");
    await userPage.getByRole("button",{name:"استعلام وضعیت جدید"}).click();
    await userPage.getByText("وضعیت: درخواست تأیید شده؛ عضویت هنوز فعال نشده است").waitFor();
   }else{
    // The same case must not reappear on a second viewport; UI is stable at desktop widths.
    await managerPage.getByText("درخواست مجازِ در انتظار بررسی وجود ندارد.").waitFor();
   }
   ok(!errors.length,"no client page errors on membership forms "+width);
   ok(await userPage.locator("html").getAttribute("dir")==="rtl","shareholder form RTL "+width);
   ok(await managerPage.locator("html").getAttribute("dir")==="rtl","cooperative review form RTL "+width);
   for(const page of [userPage,managerPage])
    ok(await page.locator("body").evaluate(e=>e.scrollWidth<=e.clientWidth+3),"no horizontal overflow "+width);
   console.log("TTO_CHILD06_REAL_BROWSER_FORMS_"+width+"=PASS");
   await userCtx.close();await managerCtx.close();
  }
 }

 await db.query("UPDATE tto.membership_review_rule_gates SET enabled=false WHERE tenant_id=$1",[A]);
 await status(await get(membershipPath+"/pending",memberManager),403,"revoked policy fails closed");
 await db.query("UPDATE tto.role_assignments SET revoked_at=now() WHERE user_id=$1 AND tenant_id=$2 AND role_code='COOPERATIVE_MANAGER'",[MANAGER,A]);
 const app=new Client({connectionString:"postgresql://tto_app@127.0.0.1:5432/tto"});await app.connect();
 try{
  await assert.rejects(()=>app.query("SELECT * FROM tto.identity_link_cases"),e=>e.code==="42501");checks++;
  await assert.rejects(()=>app.query("SELECT * FROM tto.identity_review_authorizations"),e=>e.code==="42501");checks++;
  for(const tbl of ["source_contract_approvals","member_source_snapshots","shareholder_source_accounts","shareholding_source_snapshots","source_import_batches","source_import_claims","membership_applications","membership_review_authorizations","membership_review_rule_gates","membership_application_outbox","cooperative_relationships","membership_activation_authorizations","membership_activation_rule_gates","cooperative_relationship_outbox"]){
   await assert.rejects(()=>app.query("SELECT * FROM tto."+tbl),e=>e.code==="42501");checks++;
  }
  await assert.rejects(()=>app.query("SELECT tto.assess_source_import_claim($1)",[claimReady]),e=>e.code==="42501");checks++;
 }finally{await app.end();}
 // Session revocation must invalidate both Nest and shareholder BFF owner reads instantly.
 await db.query("UPDATE tto.user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",[USER]);
 await status(await get(memberPath,myToken),401,"revoked member session blocked");
 await status(await get(sharePath,myToken),401,"revoked holdings session blocked");
 await status(await fetch(memberBff,{headers:cookie}),401,"revoked BFF member session blocked");
 await status(await fetch(ownApplicationBff,{headers:ownerCookie}),401,"revoked application owner view blocked");
 await status(await fetch(shareBff,{headers:cookie}),401,"revoked BFF holdings session blocked");
 for(const domain of ["trade-requests","notices"]){
  await status(await get("/v1/tenants/"+A+"/me/"+domain,myToken),401,
   "revoked session denies "+domain+" on Nest");
  // Live Nest tenant-context check now detects revoked sessions even in the
  // source-disabled BFF. No Child07 or Child09 record becomes readable.
  await status(await fetch(sh.origin+"/api/tenants/"+A+"/me/"+domain,{headers:cookie}),401,
   "revoked session denies "+domain+" on BFF");
 }
 const audit=await db.query("SELECT count(*)::integer AS n FROM tto.audit_events WHERE event_name LIKE 'IDENTITY_LINK_%'");
 ok(audit.rows[0].n===4,"identity case audit events recorded transactionally");
 if(browser)await browser.close();
 console.log("TTO_CF02_IDENTITY_MANAGER_NATIONAL_E2E_PASS_CHECKS="+checks);
 console.log("TTO_CF02_NO_REAL_IDENTITIES_NO_SHARE_LEDGER_NO_HOSTED_MIGRATION");
}
main().catch(e=>{console.error("TTO_CF02_E2E_FAIL",e?.stack??String(e));process.exitCode=1})
.finally(async()=>{await startedBrowser?.close().catch(()=>{});for(const proc of running)if(proc.exitCode===null)proc.kill("SIGTERM");await db.end().catch(()=>{});});
