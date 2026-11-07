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
const running=[];let checks=0;
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
 const tariffGate=cm.origin+"/api/tenants/"+A+"/share-market/tariff-draft-readiness";
 const managerCookie={Cookie:"tto_session="+tokenMap.get(MANAGER)};
 await status(await fetch(tariffGate,{headers:{Authorization:"Bearer "+tokenMap.get(MANAGER)}}),
   401,"tariff BFF denies forged bearer without session");
 await status(await fetch(tariffGate,{headers:managerCookie}),403,
   "tariff BFF does not treat generic tenant context as managerial authority");
 await status(await fetch(cm.origin+"/api/tenants/"+B+"/share-market/tariff-draft-readiness",
   {headers:managerCookie}),403,"tariff BFF denies cross-tenant URL");
 const auth=randomUUID();
 await db.query("INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until) VALUES($1,$2,$3,'ROLE_MANAGEMENT',$4,$5,now(),now()+interval '1 hour')",
 [auth,MANAGER,A,DEC,APPROVER]);
 assert.deepEqual(await options(cm,MANAGER),[{tenantId:A,displayName:"Test Cooperative A",evidenceStatus:"ROLE_AUTHORITY_EVIDENCE"}]);checks++;
 const prepared=await status(await fetch(tariffGate,{headers:managerCookie,cache:"no-store"}),
   200,"verified cooperative tariff draft readiness");
 ok(prepared.tenantContextVerified===true&&prepared.tenantId===A&&
    prepared.draftPreparationAllowed===true&&
    prepared.liveTariffWrites===false&&
    prepared.serverSideTariffDraftPersistence===false&&
    prepared.officialTariffActivation===false&&
    prepared.officialFeePaid===false&&
    prepared.ownershipTransferEnabled===false,
    "real portal readiness must NOT authorize business operations");
 const tariffWriteDenied=await fetch(tariffGate,{method:"POST",headers:managerCookie,body:"{}"});
 ok(tariffWriteDenied.status===405,"tariff BFF has no server-side write endpoint");
 await db.query("UPDATE tto.legal_authorities SET revoked_at=now() WHERE authority_id=$1",[auth]);
 assert.deepEqual(await options(cm,MANAGER),[{tenantId:A,displayName:"Test Cooperative A",evidenceStatus:"EVIDENCE_PENDING"}]);checks++;
 await status(await fetch(tariffGate,{headers:managerCookie,cache:"no-store"}),403,
   "revoked management authority cannot prepare tariff drafts");
 await db.query("UPDATE tto.role_assignments SET revoked_at=now() WHERE user_id=$1 AND tenant_id=$2",[MANAGER,A]);
 assert.deepEqual(await options(cm,MANAGER),[]);checks++;
 await status(await fetch(tariffGate,{headers:managerCookie,cache:"no-store"}),403,
   "revoked manager role cannot prepare tariff drafts");
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
   if(expectedShares==="37")await page.getByText("تعداد سهام ثبت‌شده: 37").waitFor();
   if(expectedShares==="0")await page.getByText("تعداد سهام ثبت‌شده: 0").waitFor();
   assert.equal(await page.locator("body").evaluate(e=>e.scrollWidth>e.clientWidth+3),false,name+" horizontal scroll "+width);
   assert.equal(await page.locator("html").getAttribute("dir"),"rtl");
   assert.equal(errors.length,0,name+" JS errors "+JSON.stringify(errors));
   console.log("TTO_PCS014_BROWSER_"+name+"_"+width+"=PASS");
   await context.close();
  }
 }
 const memberPath="/v1/tenants/"+A+"/me/member-record";
 const sharePath="/v1/tenants/"+A+"/me/shareholding";
 const memberBff=sh.origin+"/api/tenants/"+A+"/me/member-record";
 const shareBff=sh.origin+"/api/tenants/"+A+"/me/shareholding";
 const cookie={Cookie:"tto_session="+myToken};
 await status(await get(memberPath,myToken),403,"member source unapproved");
 await status(await get(sharePath,myToken),403,"share source unapproved");
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
 const absentShares=await status(await fetch(shareBff,{headers:cookie,cache:"no-store"}),403,"BFF unknown holdings not zero");
 assert.deepEqual(absentShares,{available:false,code:"SOURCE_OR_PERMISSION_NOT_APPROVED"});checks++;
 await db.query("INSERT INTO tto.shareholding_source_snapshots(snapshot_id,tenant_id,shareholder_account_id,source_ref,ledger_entry_ref,ledger_version,share_quantity,ledger_as_of) VALUES($1,$2,$3,$4,$5,1,37,now())",
 [randomUUID(),A,account,holdingRef,randomUUID()]);
 const verifiedShare=await status(await get(sharePath,myToken),200,"approved Child07 holding read");
 assert.equal(verifiedShare.record.shareQuantity,"37");checks++;
 assert.equal(verifiedShare.record.ledgerVersion,1);checks++;
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
 await status(await get(memberPath,myToken),200,"independent member source unaffected");
 await db.query("UPDATE tto.source_contract_approvals SET enabled=true WHERE tenant_id=$1 AND domain='CHILD07_HOLDINGS'",[A]);
 await db.query("UPDATE tto.source_contract_approvals SET approved_at=now()-interval '3 hours',valid_until=now()-interval '1 hour' WHERE tenant_id=$1 AND domain='CHILD07_HOLDINGS'",[A]);
 await status(await get(sharePath,myToken),403,"expired holdings source approval blocked");
 await db.query("UPDATE tto.source_contract_approvals SET enabled=false WHERE tenant_id=$1 AND domain='CHILD06_MEMBERSHIP'",[A]);
 await status(await get(memberPath,myToken),403,"membership source revocation immediate");
 await status(await get(sharePath,myToken),403,"holdings depend on active Child06 source");

 const app=new Client({connectionString:"postgresql://tto_app@127.0.0.1:5432/tto"});await app.connect();
 try{
  await assert.rejects(()=>app.query("SELECT * FROM tto.identity_link_cases"),e=>e.code==="42501");checks++;
  await assert.rejects(()=>app.query("SELECT * FROM tto.identity_review_authorizations"),e=>e.code==="42501");checks++;
  for(const tbl of ["source_contract_approvals","member_source_snapshots","shareholder_source_accounts","shareholding_source_snapshots","source_import_batches","source_import_claims"]){
   await assert.rejects(()=>app.query("SELECT * FROM tto."+tbl),e=>e.code==="42501");checks++;
  }
  await assert.rejects(()=>app.query("SELECT tto.assess_source_import_claim($1)",[claimReady]),e=>e.code==="42501");checks++;
 }finally{await app.end();}
 // Session revocation must invalidate both Nest and shareholder BFF owner reads instantly.
 await db.query("UPDATE tto.user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",[USER]);
 await status(await get(memberPath,myToken),401,"revoked member session blocked");
 await status(await get(sharePath,myToken),401,"revoked holdings session blocked");
 await status(await fetch(memberBff,{headers:cookie}),401,"revoked BFF member session blocked");
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
.finally(async()=>{for(const proc of running)if(proc.exitCode===null)proc.kill("SIGTERM");await db.end().catch(()=>{});});
