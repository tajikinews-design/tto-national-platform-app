"use strict";
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {randomUUID,randomBytes,createHash}=require("node:crypto");
const {resolve}=require("node:path");
const {createRequire}=require("node:module");
const ROOT=resolve(__dirname,"..");
const {Client}=createRequire(resolve(ROOT,"services/api/package.json"))("pg");
const {makeMockIssuer,newRecord,signedEnvelope}=require("./ci/ph12-mock-official-issuer.cjs");
const mockIssuers=[];let labApiEnv,firstMockIssuerUrl;
const url=process.env.TEST_ADMIN_DATABASE_URL;
if(!url||process.env.APIIR_TOKEN)throw Error("DISPOSABLE_POSTGRES_ONLY_NO_SMS");
const db=new Client({connectionString:url});
const A=randomUUID(),B=randomUUID(),PARTY=randomUUID(),PARTY2=randomUUID();
const USER=randomUUID(),MANAGER=randomUUID(),NATIONAL=randomUUID(),REVIEWER=randomUUID(),APPROVER=randomUUID(),LEGAL=randomUUID();
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
 for(const id of [USER,MANAGER,NATIONAL,REVIEWER,APPROVER,LEGAL])
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
 for(const uid of [USER,MANAGER,NATIONAL,REVIEWER,APPROVER,LEGAL])await issueSession(uid);
 if(process.env.TTO_PH12_LEGAL_E2E==="1"){
  process.env.TTO_PH12_MOCK_ISSUER_LAB="1";
  const issuer=makeMockIssuer();mockIssuers.push(issuer);
  const url=await issuer.start();firstMockIssuerUrl=url;
  issuer.setRecord(A,"SYNTHETIC_ENTITY_A",newRecord());
  await db.query("INSERT INTO tto.ph12_mock_lab_trust(tenant_id,issuer_id,key_id,trust_epoch,issuer_url,public_key_pem) VALUES($1,'PH12_SYNTHETIC_ISSUER_NOT_OFFICIAL',$2,1,$3,$4)",[
   A,issuer.keyId,url,issuer.publicKey.export({type:"spki",format:"pem"})]);
 }
  const apiEnv={DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto",PORT:"31997",
   NODE_ENV:"test",TTO_PH12_TARIFF_DRAFT_INTAKE_ENABLED:"true",
   TTO_PH12_LEGAL_SOURCE_INTAKE_ENABLED:process.env.TTO_PH12_LEGAL_E2E==="1"?"true":"false",
   TTO_CHILD06_GOVERNANCE_NOTICE_INTAKE_ENABLED:"true",
   TTO_CHILD06_GOVERNANCE_HISTORY_ENABLED:"true",
   TTO_PH12_MOCK_ISSUER_LAB:process.env.TTO_PH12_LEGAL_E2E==="1"?"1":"0",
   TTO_LOOPBACK_E2E:"1",APIIR_TOKEN:"",TTO_MOCK_SMSOTP_PROVIDER:"true",AUTH_CHALLENGE_HMAC_SECRET:"ci-testing-secret-32chars-aaaaaaaaaaaaaa"};
 labApiEnv=apiEnv;
 await launch("Nest",["dist/main.js"],resolve(ROOT,"services/api"),apiEnv,API+"/ready");
}
async function portal(slug,port){
 const cwd=resolve(ROOT,"apps",slug);
 const origin="http://127.0.0.1:"+port;
 await launch(slug,[resolve(cwd,"node_modules/next/dist/bin/next"),"start","-p",String(port)],cwd,
 {NODE_ENV:"test",CI:"true",TTO_PH12_TARIFF_DRAFT_INTAKE_ENABLED:"true",TTO_PH12_PUBLIC_ORIGIN:origin,TTO_LOOPBACK_E2E:"1",TTO_API_BASE_URL:API,PORT:String(port),NEXT_TELEMETRY_DISABLED:"1",APIIR_TOKEN:""},
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
    prepared.serverSideTariffDraftPersistence===true&&
    prepared.officialTariffActivation===false&&
    prepared.officialFeePaid===false&&
    prepared.ownershipTransferEnabled===false,
    "real portal readiness must NOT authorize business operations");
 const tariffWriteDenied=await fetch(tariffGate,{method:"POST",headers:managerCookie,body:"{}"});
 ok(tariffWriteDenied.status===405,"tariff BFF has no server-side write endpoint");
 // Persistent DRAFT is separate from tariff activation and official approval.
 const draftBff=cm.origin+"/api/tenants/"+A+"/share-market/tariff-drafts";
 const draftOther=cm.origin+"/api/tenants/"+B+"/share-market/tariff-drafts";
 const tariff={feeId:"TRANSFER_ADMIN_FEE",title:"Unverified cooperative transfer fee draft",
  version:"1",feeType:"COOP_APPROVED_FEE",calculationMode:"FIXED",
  fixedAmount:"250",percentBps:"0",payerMode:"BUYER",
  buyerPercent:"100",sellerPercent:"0",percentageBasis:"TRADE_GROSS_VALUE",
  validFrom:"2026-11-07",validUntil:"2027-11-07",
  legalBasisReference:"TEST-BOARD-BASIS-REF-001",
  boardResolutionReference:"TEST-BOARD-UNSIGNED-001",
  boardEvidenceReference:"TEST-DOC-UNVERIFIED-001"};
 const key=randomUUID(),origin=cm.origin;
 const postDraft=(url,payload,headers=managerCookie)=>
   fetch(url,{method:"POST",headers:{Origin:origin,...headers,
    "Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});
 await status(await fetch(draftBff),401,"unsigned tariff drafts refuse anonymous read");
 await status(await fetch(draftOther,{headers:managerCookie}),403,
   "cross-tenant tariff drafts inaccessible");
 const firstRead=await fetch(draftBff,{headers:managerCookie});
 if(firstRead.status!==200){
   const diagnostic=await firstRead.json().catch(()=>({code:"NON_JSON"}));
   console.error("PH12_TARIFF_DRAFT_GET_DIAGNOSTIC",firstRead.status,diagnostic.code??"UNKNOWN");
   // Synthetic lab only: probe the authenticated upstream status to isolate
   // BFF transport failure from Nest/PostgreSQL rejection; never log tokens or bodies.
   try{
     const upstream=await get("/v1/tenants/"+A+"/ph12/share-market/tariff-drafts",tokenMap.get(MANAGER));
     const detail=await upstream.json().catch(()=>({}));
     console.error("PH12_TARIFF_DRAFT_UPSTREAM_DIAGNOSTIC",upstream.status,
       typeof detail?.code==="string"?detail.code:"UNCLASSIFIED");
     // SQLSTATE only, inside a disposable DB: no PII or DB exception messages.
     try {
       await db.query("BEGIN");
       await db.query("SET LOCAL ROLE tto_app");
       await db.query("SELECT set_config('tto.actor_id',$1,true),set_config('tto.tenant_id',$2,true)",[MANAGER,A]);
       await db.query("SELECT * FROM tto.ph12_list_tariff_drafts()");
       console.error("PH12_TARIFF_DRAFT_SQLSTATE_DIAGNOSTIC","SQL_OK");
     } catch (sqlError) {
       console.error("PH12_TARIFF_DRAFT_SQLSTATE_DIAGNOSTIC",
         /^[0-9A-Z]{5}$/.test(sqlError?.code??"")?sqlError.code:"UNCLASSIFIED");
     } finally { await db.query("ROLLBACK"); }
   }catch{console.error("PH12_TARIFF_DRAFT_UPSTREAM_DIAGNOSTIC","NETWORK_ERROR");}
 }
 const initialDrafts=await status(firstRead,200,"read empty durable tariff drafts");
 ok(initialDrafts.items.length===0&&initialDrafts.draftOnly===true,
    "no fabricated registered tariff");
 await status(await postDraft(draftBff,{requestKey:key,tariff},
   {Authorization:"Bearer "+tokenMap.get(MANAGER)}),401,
   "client cannot replace manager session with forged bearer");
 await status(await postDraft(draftBff,{requestKey:key,tariff},
   {...managerCookie,Origin:"https://attacker.invalid"}),403,"cross-site tariff draft denied");
 const saveResponse=await postDraft(draftBff,{requestKey:key,tariff});
 if(saveResponse.status!==201){
  const diagnostic=await saveResponse.json().catch(()=>({code:"NON_JSON"}));
  console.error("PH12_TARIFF_DRAFT_POST_DIAGNOSTIC",saveResponse.status,diagnostic.code??"UNKNOWN");
 }
 const saved=await status(saveResponse,201,
   "persistent manager draft created under real role+authority");
 ok(saved.tenantId===A&&saved.status==="DRAFT_UNVERIFIED"&&
    saved.feeActivated===false&&saved.boardVerified===false&&
    saved.realPaymentConfirmed===false&&saved.legalShareTransfer===false,
    "draft creation never approves a tariff or finance event");
 const replay=await status(await postDraft(draftBff,{requestKey:key,tariff}),201,
   "same client request idempotent");
 ok(replay.draftId===saved.draftId&&replay.replayed===true,
    "idempotent draft replay must reuse immutable record");
 await status(await postDraft(draftBff,{requestKey:key,tariff:{...tariff,fixedAmount:"300"}}),
   409,"idempotency replay with mismatched tariff rejected");
 await status(await postDraft(draftBff,{requestKey:randomUUID(),tariff}),
   409,"same fee version may not overwrite original");
 const persisted=await status(await fetch(draftBff,{headers:managerCookie,cache:"no-store"}),
    200,"after reload draft remains available");
 ok(persisted.items.length===1&&persisted.items[0].draftId===saved.draftId&&
    persisted.items[0].status==="DRAFT_UNVERIFIED"&&
    persisted.items[0].tariff.fixedAmount==="250",
    "database-backed version immutable across HTTP reload");
 const second=await status(await postDraft(draftBff,{requestKey:randomUUID(),
    tariff:{...tariff,version:"2",fixedAmount:"350"}}),201,
    "version increment creates separate new draft");
 ok(second.draftId!==saved.draftId&&second.version===2,
    "versioned changes never mutate old draft");
 const old=await db.query(
  "SELECT status,payload->>'fixedAmount' AS amount FROM tto.ph12_tariff_drafts WHERE draft_id=$1",
  [saved.draftId]);
 ok(old.rows[0].status==="DRAFT_UNVERIFIED"&&old.rows[0].amount==="250",
   "no prior draft update and no legal activation");
 await status(await postDraft(draftOther,{requestKey:randomUUID(),tariff}),
   403,"cross-cooperative draft creation denied");
 console.log("PH12_REAL_SESSION_TARIFF_DRAFT_PG17_PERSISTENCE_AND_FAILCLOSED_PASS");
 // A board resolution's file is a known clean, tenant-scoped CF03 version.
 // The record and claimed signers are still NOT authentic board authority.
 const signedDoc=randomUUID(),fileId=randomUUID();
 const boardHash=createHash("sha256").update("synthetic-unsigned-board-tariff-2026").digest();
 await db.query("INSERT INTO tto.documents(document_id,tenant_id,title,classification,status) VALUES($1,$2,'Synthetic tariff board resolution','RESTRICTED','PUBLISHED')",
    [signedDoc,A]);
 await db.query("INSERT INTO tto.file_objects(file_object_id,tenant_id,storage_key,sha256,classification,scan_status) VALUES($1,$2,$3,$4,'RESTRICTED','CLEAN')",
    [fileId,A,"ci-board-test-immutable-v1",boardHash]);
 await db.query("INSERT INTO tto.document_versions(document_id,version_num,file_object_id,tenant_id) VALUES($1,1,$2,$3)",
    [signedDoc,fileId,A]);
 const boardPath=cm.origin+"/api/tenants/"+A+"/share-market/tariff-board-cases";
 const foreignBoardPath=cm.origin+"/api/tenants/"+B+"/share-market/tariff-board-cases";
 const reviewerCookie={Cookie:"tto_session="+tokenMap.get(REVIEWER)};
 const boardSubmission={
    requestKey:randomUUID(),draftId:saved.draftId,documentId:signedDoc,
    documentVersion:1,resolutionNumber:"TEST-BOARD-UNSIGNED-001",
    resolutionDate:"2026-11-01",effectiveFrom:"2026-11-07",
    effectiveUntil:"2027-11-07",
    signerClaims:[{signerId:APPROVER,claimedRole:"BOARD_CHAIR"}]
 };
 const boardPost=(url,body,headers=managerCookie)=>
   fetch(url,{method:"POST",headers:{Origin:origin,...headers,
     "Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
 await status(await fetch(boardPath),401,"anonymous cannot list board cases");
 await status(await fetch(foreignBoardPath,{headers:managerCookie}),403,"cross-tenant board cases denied");
 await status(await boardPost(boardPath,boardSubmission,{Authorization:"Bearer "+tokenMap.get(MANAGER)}),401,
   "session cookie required for board evidence intake");
 await status(await boardPost(boardPath,boardSubmission,{...managerCookie,Origin:"https://cross-site.invalid"}),403,
   "untrusted Cross-Origin board dossier POST denied");
 await status(await boardPost(boardPath,
   {...boardSubmission,documentId:randomUUID()}),403,"untrusted board source document denied");
 await status(await boardPost(boardPath,
   {...boardSubmission,resolutionNumber:"TEST-MISMATCH-NO-LEGAL-1"}),400,
   "board resolution reference must match stored draft");
 const submit=await status(await boardPost(boardPath,boardSubmission),201,
   "manager recorded source-bound document version hash");
 ok(submit.status==="DOCUMENT_INTAKE_AUTHORITY_UNVERIFIED"&&
    submit.documentMetadataSourceBound===true&&
    submit.signerIdentityAuthenticated===false&&
    submit.signerAuthorityAuthenticated===false&&
    submit.boardLegallyApproved===false&&submit.tariffActivated===false,
    "document receipt must never be construed as valid board signature");
 const duplicate=await status(await boardPost(boardPath,boardSubmission),201,
   "board evidence submission replays safely");
 ok(duplicate.caseId===submit.caseId&&duplicate.replayed===true,
    "same evidence input yields original immutable case id");
 await status(await boardPost(boardPath,
   {...boardSubmission,requestKey:randomUUID()}),409,
   "one board evidence case per tariff draft");
 const boardList=await status(await fetch(boardPath,{headers:managerCookie}),200,
   "manager reads metadata of tenant-scoped documents");
 ok(boardList.items.length===1&&boardList.items[0].documentSha256===boardHash.toString("hex")&&
    boardList.items[0].signerClaims[0].signerId===APPROVER&&
    boardList.signerAuthorityAuthenticated===false,
    "file digest+version stored but signer authority remains unverified");
 const reviewPath=boardPath+"/"+submit.caseId+"/review";
 const reviewerDecision={requestKey:randomUUID(),decision:"METADATA_CHECKED_SIGNER_AUTHORITY_UNVERIFIED",
   findingReference:"TEST-INDEPENDENT-METADATA-REVIEW-001"};
 await status(await boardPost(reviewPath,reviewerDecision),403,
    "draft author cannot self-review board evidence");
 await status(await boardPost(reviewPath,reviewerDecision,reviewerCookie),403,
    "review without tenant DOCUMENT_REVIEWER role denied");
 await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'DOCUMENT_REVIEWER')",
    [randomUUID(),REVIEWER,A]);
 // Negative: even a legitimate document reviewer cannot approve a tampered source.
 await db.query("UPDATE tto.file_objects SET scan_status='BLOCKED' WHERE file_object_id=$1",[fileId]);
 await status(await boardPost(reviewPath,reviewerDecision,reviewerCookie),403,
   "blocked scanner status must fail review");
 await db.query("UPDATE tto.file_objects SET scan_status='CLEAN' WHERE file_object_id=$1",[fileId]);
 const reviewed=await status(await boardPost(reviewPath,reviewerDecision,reviewerCookie),201,
   "independent reviewer checked source metadata");
 ok(reviewed.decision==="METADATA_CHECKED_SIGNER_AUTHORITY_UNVERIFIED"&&
    reviewed.documentMetadataReviewed===true&&
    reviewed.signerAuthorityAuthenticated===false&&
    reviewed.boardLegallyApproved===false&&reviewed.tariffActivated===false,
    "technical document check cannot create legal board approval");
 const reviewReplay=await status(await boardPost(reviewPath,reviewerDecision,reviewerCookie),201,
    "review key replay idempotent");
 ok(reviewReplay.reviewId===reviewed.reviewId&&reviewReplay.replayed===true,
   "immutable reviewer decision persists");
 await status(await boardPost(reviewPath,
   {...reviewerDecision,decision:"DOCUMENT_REJECTED"},reviewerCookie),409,
   "same request key cannot mutate earlier review outcome");
 await status(await boardPost(reviewPath,
   {...reviewerDecision,requestKey:randomUUID()},reviewerCookie),409,
   "second decision cannot overwrite immutable review");
 const stillDraft=await db.query(
   "SELECT status FROM tto.ph12_tariff_drafts WHERE draft_id=$1",[saved.draftId]);
 ok(stillDraft.rows[0].status==="DRAFT_UNVERIFIED",
   "even independently checked metadata cannot promote tariff to ACTIVE");
 await assert.rejects(async()=>db.query(
  "UPDATE tto.ph12_tariff_board_review_events SET decision=decision WHERE review_id=$1",
  [reviewed.reviewId]),/PH12_BOARD_EVIDENCE_APPEND_ONLY/);
 console.log("PH12_BOARD_DOCUMENT_SOURCE_HASH_ROLE_REVIEW_NO_LEGAL_AUTHORITY_PASS");

 // Only the new PH12 draft branch installs migrations 0049/0050 in adaptive CI.
 // Use the SAME ephemeral Postgres + real Nest session actors for the new gate.
 if(process.env.TTO_PH12_LEGAL_E2E==="1"){
   const legalPath="/v1/tenants/"+A+"/ph12/share-market/tariff-board-cases/"+
     submit.caseId+"/legal-source-checks";
   const legalPayload={
     requestKey:randomUUID(),sourceCategory:"BOARD_ROSTER",
     sourceReference:"CI-REGISTRY-BOARD-ROSTER-001",
     sourceVersion:"synthetic-v1",sha256:boardHash.toString("hex"),
     observedAt:new Date(Date.now()-60000).toISOString(),
     expiresAt:new Date(Date.now()+3600000).toISOString(),
     result:"PENDING_OFFICIAL_VERIFICATION"
   };
   const legalPost=(path,who,payload)=>post(path,who,payload);
   await status(await legalPost(legalPath,"",legalPayload),401,
     "PH12 legal source rejects unauthenticated request");
   await status(await legalPost(legalPath,tokenMap.get(MANAGER),legalPayload),403,
     "PH12 manager cannot pose as independent legal source reviewer");
   await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'DOCUMENT_REVIEWER')",
     [randomUUID(),MANAGER,A]);
   await status(await legalPost(legalPath,tokenMap.get(MANAGER),legalPayload),403,
     "PH12 same actor author and reviewer forbidden even with role");
   await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'DOCUMENT_REVIEWER')",
     [randomUUID(),REVIEWER,B]);
   await status(await legalPost("/v1/tenants/"+B+"/ph12/share-market/tariff-board-cases/"+
       submit.caseId+"/legal-source-checks",tokenMap.get(REVIEWER),legalPayload),403,
     "PH12 reviewer in other tenant cannot access foreign case");
   const legalStored=await status(await legalPost(legalPath,tokenMap.get(REVIEWER),legalPayload),201,
     "PH12 independent reviewer records pending-only source observation");
   ok(legalStored.state==="PENDING_OFFICIAL_VERIFICATION"&&
      legalStored.boardLegallyApproved===false&&legalStored.tariffActivated===false,
      "PH12 official-source intake never grants signature authority");
   const legalReplay=await status(await legalPost(legalPath,tokenMap.get(REVIEWER),legalPayload),201,
     "PH12 identical request idempotent");
   ok(legalReplay.checkId===legalStored.checkId&&legalReplay.replayed===true,
     "PH12 same request key reuses original check");
   await status(await legalPost(legalPath,tokenMap.get(REVIEWER),
     {...legalPayload,sourceVersion:"synthetic-v2"}),409,
     "PH12 replay changes rejected");
   await status(await legalPost(legalPath,tokenMap.get(REVIEWER),
     {...legalPayload,requestKey:randomUUID(),result:"VERIFIED"}),400,
     "PH12 API cannot accept verified or active source claim");
   await assert.rejects(()=>db.query(
     "UPDATE tto.ph12_tariff_drafts SET status='ACTIVE' WHERE draft_id=$1",[saved.draftId]));
   checks++;
   const after=await db.query("SELECT status FROM tto.ph12_tariff_drafts WHERE draft_id=$1",[saved.draftId]);
   ok(after.rows[0].status==="DRAFT_UNVERIFIED",
      "PH12 direct DB update cannot activate tariff");
   console.log("PH12_LEGAL_SOURCE_REAL_NEST_PG17_NEGATIVE_HTTP_PASS_HOLD_ONLY");
   // Separate governance role, independent actor, and signed-independent finding.
   // Source records are still PENDING, so the only permitted disposition is HOLD or REJECT.
   const reviewEndpoint="/v1/tenants/"+A+"/ph12/share-market/tariff-board-cases/"+
     submit.caseId+"/legal-dispositions";
   const reviewPayload={
     requestKey:randomUUID(),documentReviewId:reviewed.reviewId,
     sourceCheckIds:[legalStored.checkId],decision:"LEGAL_HOLD_SOURCE_UNVERIFIED",
     findingReference:"CI-LEGAL-HOLD-OFFICIAL-SOURCE-UNVERIFIED-001"
   };
   await status(await legalPost(reviewEndpoint,"",reviewPayload),401,
     "PH12 legal disposition needs an authenticated session");
   await status(await legalPost(reviewEndpoint,tokenMap.get(REVIEWER),reviewPayload),403,
     "PH12 document reviewer has no legal reviewer role");
   await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'LEGAL_REVIEWER')",
      [randomUUID(),MANAGER,A]);
   await status(await legalPost(reviewEndpoint,tokenMap.get(MANAGER),reviewPayload),403,
     "PH12 draft submitter cannot file legal disposition even with LEGAL_REVIEWER role");
   await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'LEGAL_REVIEWER')",
      [randomUUID(),REVIEWER,A]);
   await status(await legalPost(reviewEndpoint,tokenMap.get(REVIEWER),reviewPayload),403,
     "PH12 document reviewer and source checker cannot self-certify legal disposition");
   await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'LEGAL_REVIEWER')",
      [randomUUID(),APPROVER,A]);
   await status(await legalPost(reviewEndpoint,tokenMap.get(APPROVER),reviewPayload),403,
     "PH12 claimed board signatory cannot file legal disposition");
   await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'LEGAL_REVIEWER'),($4,$2,$5,'LEGAL_REVIEWER')",
      [randomUUID(),LEGAL,A,randomUUID(),B]);
   await status(await legalPost("/v1/tenants/"+B+"/ph12/share-market/tariff-board-cases/"+
     submit.caseId+"/legal-dispositions",tokenMap.get(LEGAL),reviewPayload),403,
     "PH12 independent legal role cannot cross cooperative case");
   await status(await legalPost(reviewEndpoint,tokenMap.get(LEGAL),
     {...reviewPayload,sourceCheckIds:[randomUUID()]}),403,
     "PH12 source-check IDs must belong to the same case and tenant");
   await status(await legalPost(reviewEndpoint,tokenMap.get(LEGAL),
     {...reviewPayload,sourceCheckIds:[legalStored.checkId,legalStored.checkId]}),403,
     "PH12 repeated check ID cannot satisfy evidence set");
   await status(await legalPost(reviewEndpoint,tokenMap.get(LEGAL),
     {...reviewPayload,sourceCheckIds:[]}),400,
     "PH12 legal disposition requires referenced source evidence");
   await status(await legalPost(reviewEndpoint,tokenMap.get(LEGAL),
     {...reviewPayload,decision:"LEGAL_APPROVED"}),400,
     "PH12 official approval is never accepted from client");
   const held=await status(await legalPost(reviewEndpoint,tokenMap.get(LEGAL),reviewPayload),201,
     "PH12 independent legal reviewer records HOLD tied to source and file review");
   ok(held.legalDecision==="LEGAL_HOLD_SOURCE_UNVERIFIED"&&
      held.signerAuthorityAuthenticated===false&&
      held.boardLegallyApproved===false&&held.tariffActivated===false,
     "PH12 separate legal disposition never authenticates board signatures");
   const heldReplay=await status(await legalPost(reviewEndpoint,tokenMap.get(LEGAL),reviewPayload),201,
     "PH12 same legal decision request idempotent");
   ok(heldReplay.dispositionId===held.dispositionId&&heldReplay.replayed===true,
     "PH12 immutable legal disposition same-key replay");
   await status(await legalPost(reviewEndpoint,tokenMap.get(LEGAL),
     {...reviewPayload,decision:"LEGAL_REJECTED"}),409,
     "PH12 altered legal decision replay is rejected");
   await status(await legalPost(reviewEndpoint,tokenMap.get(LEGAL),
     {...reviewPayload,requestKey:randomUUID()}),409,
     "PH12 second decision cannot overwrite immutable disposition");
   await assert.rejects(()=>db.query(
     "UPDATE tto.ph12_tariff_board_legal_dispositions SET decision='LEGAL_REJECTED' WHERE disposition_id=$1",
     [held.dispositionId]));
   checks++;
   const finalDraft=await db.query("SELECT status FROM tto.ph12_tariff_drafts WHERE draft_id=$1",[saved.draftId]);
   ok(finalDraft.rows[0].status==="DRAFT_UNVERIFIED",
     "PH12 legal hold does not mutate tariff status");
   console.log("PH12_INDEPENDENT_LEGAL_DISPOSITION_REAL_PG17_HTTP_NEGATIVE_PASS_HOLD_ONLY");

   const recheckEndpoint="/v1/tenants/"+A+"/ph12/share-market/tariff-board-cases/"+
     submit.caseId+"/source-recheck";
   const invalidationEndpoint="/v1/tenants/"+A+"/ph12/share-market/tariff-board-cases/"+
     submit.caseId+"/legal-source-checks/"+legalStored.checkId+"/invalidate";
   const invalidationPayload={
     requestKey:randomUUID(),reason:"SOURCE_WITHDRAWN",
     evidenceReference:"CI-SOURCE-WITHDRAWAL-NOT-OFFICIAL-001"
   };
   await status(await get(recheckEndpoint,""),401,
     "PH12 recheck needs authenticated session");

   const pre=await status(await get(recheckEndpoint,tokenMap.get(LEGAL)),200,
     "PH12 independent reviewer can compute source state");
   ok(pre.assessment==="HOLD_OFFICIAL_SOURCE_UNVERIFIED"&&
      pre.sourceChecks===1&&pre.invalidatedChecks===0&&
      pre.officialSourceAuthenticated===false&&pre.tariffActivated===false,
      "PH12 source presence without owner verification always HOLD");
   const staleInput={
     ...legalPayload,requestKey:randomUUID(),sourceCategory:"BYLAWS",
     sourceReference:"CI-OUTDATED-BYLAWS-SOURCE-001",sourceVersion:"stale-fixture-v1",
     observedAt:new Date(Date.now()-7200000).toISOString(),
     expiresAt:new Date(Date.now()-3600000).toISOString()
   };
   const staleRecord=await status(await legalPost(legalPath,tokenMap.get(REVIEWER),staleInput),201,
     "PH12 snapshot records expired claimed source without authenticating it");
   ok(staleRecord.state==="PENDING_OFFICIAL_VERIFICATION",
     "PH12 stale intake cannot be official verification");
   const stale=await status(await get(recheckEndpoint,tokenMap.get(LEGAL)),200,
     "PH12 recheck marks an expired source as HOLD");
   ok(stale.assessment==="HOLD_SOURCE_EXPIRED"&&stale.staleChecks===1&&
      stale.officialSourceAuthenticated===false,
      "PH12 expired evidence cannot be current trusted authority");
   await status(await legalPost(invalidationEndpoint,"",invalidationPayload),401,
     "PH12 source invalidation requires session");
   await status(await legalPost(invalidationEndpoint,tokenMap.get(REVIEWER),invalidationPayload),403,
     "PH12 source checker cannot invalidate own check even with legal reviewer role");
   await status(await legalPost(invalidationEndpoint,tokenMap.get(MANAGER),invalidationPayload),403,
     "PH12 draft author cannot invalidate even with legal reviewer role");
   await status(await legalPost(invalidationEndpoint,tokenMap.get(APPROVER),invalidationPayload),403,
     "PH12 claimed signatory cannot invalidate a source");
   await status(await legalPost(invalidationEndpoint,tokenMap.get(LEGAL),
     {...invalidationPayload,reason:"SOURCE_VERIFIED"}),400,
     "PH12 invalidation cannot mint verified authority");
   await status(await legalPost("/v1/tenants/"+B+
     "/ph12/share-market/tariff-board-cases/"+submit.caseId+
     "/legal-source-checks/"+legalStored.checkId+"/invalidate",
     tokenMap.get(LEGAL),invalidationPayload),403,
     "PH12 source invalidation refuses cross cooperative request");
   await status(await legalPost("/v1/tenants/"+A+
     "/ph12/share-market/tariff-board-cases/"+randomUUID()+
     "/legal-source-checks/"+legalStored.checkId+"/invalidate",
     tokenMap.get(LEGAL),invalidationPayload),403,
     "PH12 invalidation requires matching case identity within same cooperative");
   const withdrawn=await status(await legalPost(invalidationEndpoint,
     tokenMap.get(LEGAL),invalidationPayload),201,
     "PH12 independent legal role records immutable source withdrawal");
   ok(withdrawn.state==="SOURCE_INVALIDATED"&&withdrawn.tariffActivated===false,
     "PH12 withdrawal cannot activate tariff");
   const replayWithdrawal=await status(await legalPost(invalidationEndpoint,
     tokenMap.get(LEGAL),invalidationPayload),201,
     "PH12 withdrawal identical replay");
   ok(replayWithdrawal.invalidationId===withdrawn.invalidationId&&replayWithdrawal.replayed===true,
     "PH12 same withdrawal request does not duplicate history");
   await status(await legalPost(invalidationEndpoint,tokenMap.get(LEGAL),
     {...invalidationPayload,reason:"SOURCE_UNREACHABLE"}),409,
     "PH12 same key cannot alter withdrawal reason");
   await status(await legalPost(invalidationEndpoint,tokenMap.get(LEGAL),
     {...invalidationPayload,requestKey:randomUUID()}),409,
     "PH12 invalidation cannot be overwritten by another request");
   const postRecheck=await status(await get(recheckEndpoint,tokenMap.get(LEGAL)),200,
     "PH12 re-evaluation after revocation report");
   ok(postRecheck.assessment==="HOLD_SOURCE_INVALIDATED"&&
      postRecheck.invalidatedChecks===1&&postRecheck.sourceChecks===2&&
      postRecheck.legalReviewRecorded===true&&
      postRecheck.legalAuthorityVerified===false&&postRecheck.tariffActivated===false,
     "PH12 later withdrawal changes current HOLD while preserving legal history");
   await assert.rejects(()=>db.query(
     "UPDATE tto.ph12_tariff_board_source_invalidations SET reason='SOURCE_UNREACHABLE' WHERE invalidation_id=$1",
     [withdrawn.invalidationId]));
   checks++;
   const preserved=await db.query(
      "SELECT decision FROM tto.ph12_tariff_board_legal_dispositions WHERE disposition_id=$1",
      [held.dispositionId]);
   ok(preserved.rows[0].decision==="LEGAL_HOLD_SOURCE_UNVERIFIED",
     "PH12 immutable historical legal disposition preserved after invalidation");
   const afterWithdrawal=await db.query(
      "SELECT status FROM tto.ph12_tariff_drafts WHERE draft_id=$1",[saved.draftId]);
   ok(afterWithdrawal.rows[0].status==="DRAFT_UNVERIFIED",
     "PH12 source invalidation never moves the draft toward ACTIVE");
   console.log("PH12_SOURCE_INVALIDATION_RECHECK_REAL_HTTP_POSTGRES17_HOLD_PASS");

   // Official-source issuer candidates are *nominations*, never verified registry truth.
   const issuerPath="/v1/tenants/"+A+"/ph12/share-market/official-source-issuer-candidates";
   const issuerBody={
     requestKey:randomUUID(),sourcePurpose:"LEGAL_ENTITY_IDENTITY",
     issuerKind:"LEGAL_ENTITY_REGISTRY",issuerLabel:"CI National Legal Entity Registry Candidate",
     publicReference:"https://ilenc.ssaa.ir/",
     legalBasisReference:"Cooperative-Law-Article-52-Source-Candidate"
   };
   await status(await get(issuerPath,""),401,"PH12 anonymous issuer candidate list denied");
   await status(await legalPost(issuerPath,"",issuerBody),401,
     "PH12 anonymous issuer candidate creation denied");
   await status(await legalPost(issuerPath,tokenMap.get(USER),issuerBody),403,
     "PH12 shareholder cannot nominate issuer");
   await status(await get(issuerPath,tokenMap.get(USER)),403,
     "PH12 shareholder cannot enumerate issuer candidates");
   const initialCandidates=await status(await get(issuerPath,tokenMap.get(LEGAL)),200,
     "PH12 legal reviewer sees scoped issuer candidate list");
   ok(initialCandidates.items.length===0&&initialCandidates.officialIssuerAuthenticated===false,
     "PH12 no sources authenticated by existence of an empty catalog");
   const nominated=await status(await legalPost(issuerPath,tokenMap.get(LEGAL),issuerBody),201,
     "PH12 legal reviewer nominates source owner with no trust promotion");
   ok(nominated.state==="PENDING_ISSUER_AUTHENTICATION"&&
      nominated.officialIssuerAuthenticated===false&&nominated.tariffActivated===false,
     "PH12 issuer nomination is not attestation");
   const nomineeReplay=await status(await legalPost(issuerPath,tokenMap.get(LEGAL),issuerBody),201,
     "PH12 issuer idempotent replay");
   ok(nomineeReplay.candidateId===nominated.candidateId&&nomineeReplay.replayed===true,
     "PH12 issuer replay reuses previous immutable candidate");
   await status(await legalPost(issuerPath,tokenMap.get(LEGAL),
     {...issuerBody,issuerLabel:"Different candidate identity"}),409,
     "PH12 changed issuer proposal cannot replay same request key");
   await status(await legalPost(issuerPath,tokenMap.get(LEGAL),
     {...issuerBody,candidateState:"VERIFIED"}),400,
     "PH12 client cannot introduce trusted issuer status");
   const scoped=await status(await get(issuerPath,tokenMap.get(LEGAL)),200,
     "PH12 candidate readable only to scoped legal reviewer");
   ok(scoped.items.length===1&&scoped.items[0].candidateId===nominated.candidateId&&
      scoped.items[0].state==="PENDING_ISSUER_AUTHENTICATION",
     "PH12 catalog is a pending-only candidate view");
   const crossList=await status(await get("/v1/tenants/"+B+
     "/ph12/share-market/official-source-issuer-candidates",tokenMap.get(LEGAL)),200,
     "PH12 tenant B legal reviewer sees only its own candidates");
   ok(crossList.items.length===0,
     "PH12 tenant B cannot enumerate candidate owner for tenant A");
   await assert.rejects(()=>db.query(
     "UPDATE tto.ph12_cooperative_source_issuer_candidates SET candidate_state='PENDING_ISSUER_AUTHENTICATION' WHERE candidate_id=$1",
     [nominated.candidateId]));
   checks++;
   const fixedStatus=await db.query(
     "SELECT candidate_state FROM tto.ph12_cooperative_source_issuer_candidates WHERE candidate_id=$1",
     [nominated.candidateId]);
   ok(fixedStatus.rows[0].candidate_state==="PENDING_ISSUER_AUTHENTICATION",
     "PH12 immutable candidate cannot be verified with DB status edit");
   console.log("PH12_OFFICIAL_ISSUER_CANDIDATE_REAL_NEST_PG17_HOLD_PASS");

   {
   // CHILD-06: REAL company identifier and names from user-supplied published
   // notice text, but NO personal national IDs and NO claim of issuer validation.
   // Tenant A and all authentication identities are isolated CI fixtures.
   const legalPath="/v1/tenants/"+A+"/child06/legal-notices";
   const boardPeople=[
    ["عباس قنبری طرقدری","BOARD_CHAIR"],
    ["سید جواد شاکری","BOARD_VICE_CHAIR"],
    ["مجتبی گلپری","BOARD_SECRETARY"],
    ["ثورج سلطانی","BOARD_MEMBER"],
    ["مرتضی افخمی","BOARD_MEMBER"],
    ["محمد معمرزاده طرقبه","BOARD_MEMBER"],
    ["مرتضی کابلیان شاندیز","BOARD_MEMBER"],
    ["مرتضی کابلیان شاندیز","CEO"]
   ];
   const dated="1404/08/06",until="1406/12/20";
   const board=boardPeople.map(([personName,office])=>({
    personName,office,eventType:"APPOINTED",eventOn:dated,termEnd:until
   }));
   board.push({personName:"مجتبی گلپری",office:"CEO",
    eventType:"RESIGNED",eventOn:dated,termEnd:dated});
   const signing=[
    {authorityKind:"BINDING_FINANCIAL",
     requiredSigner:"مرتضی کابلیان شاندیز",
     alternateSigners:["عباس قنبری طرقدری","سید جواد شاکری"],
     requiresSeal:true,effectiveFrom:dated,statedEnd:until,
     description:"اسناد تعهدآور بانکی با امضای ثابت مدیرعامل و یکی از رئیس یا نایب‌رئیس هیئت‌مدیره همراه مهر تعاونی"},
    {authorityKind:"ORDINARY_LETTERS",
     requiredSigner:"مرتضی کابلیان شاندیز",alternateSigners:[],
     requiresSeal:true,effectiveFrom:dated,statedEnd:until,
     description:"تمامی اوراق و نامه‌های عادی با امضای مدیرعامل و مهر شرکت مطابق متن آگهی اظهارشده"}
   ];
   const torghabeh={
    requestKey:randomUUID(),cooperativeLegalNationalId:"14007823781",
    registrationNumber:"65549",sourceType:"COMPANY_REGISTRY",
    noticeKind:"BOARD_CHANGE",sourceNoticeNumber:null,gazetteIssue:null,
    publishedOn:null,resolutionOn:dated,authorityLetter:"1293",
    authorityLetterOn:"1404/11/05",sourceUrl:null,
    summary:"طبق متن آگهی ارائه‌شده، مدیرعامل جدید برای باقی‌مانده دوره هیئت‌مدیره انتخاب گردیده و ترکیب هیئت‌مدیره و امضاکنندگان مجاز اعلام شده‌اند. شماره و تصویر اصل آگهی هنوز مستقل تصدیق نشده است.",
    board,signing
   };
   await status(await post(legalPath,"",torghabeh),401,
     "Child06 archive requires bearer session");
   await status(await post(legalPath,tokenMap.get(USER),torghabeh),403,
     "Child06 shareholder cannot alter legal archive");
   await status(await post(legalPath,tokenMap.get(MANAGER),
     {...torghabeh,summary:torghabeh.summary+" کد ملی 0932358977"}),400,
     "Child06 public archive rejects individual national ID");
   await status(await post(legalPath,tokenMap.get(MANAGER),{
     ...torghabeh,signing:[{...signing[0],alternateSigners:["9".repeat(10)]}]
   }),400,"Child06 archive rejects unredacted numeric person references in signing alternatives");
   const notice=await status(await post(legalPath,tokenMap.get(MANAGER),torghabeh),
     201,"Child06 manager appends source-declared Torghabeh-Shandiz notice");
   ok(notice.state==="USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED"&&
      notice.officialSourceAuthenticated===false&&notice.tariffActivated===false,
      "Child06 archived real company claim cannot become legal authority");
   const replay=await status(await post(legalPath,tokenMap.get(MANAGER),torghabeh),
     201,"Child06 replay is idempotent");
   ok(replay.noticeId===notice.noticeId&&replay.replayed===true,
      "Child06 notice replay uses same immutable ID");
   await status(await post(legalPath,tokenMap.get(MANAGER),
     {...torghabeh,summary:torghabeh.summary+" تغییر غیرمجاز"}),409,
     "Child06 archive rejects conflicting same-key replay");
   const shadowNotice={...torghabeh,requestKey:randomUUID(),sourceType:"OFFICIAL_GAZETTE",
     sourceNoticeNumber:"CI-SYNTHETIC-GAZETTE-002",gazetteIssue:"CI-TEST",
     noticeKind:"OTHER",resolutionOn:"1404/09/01",
     summary:"آگهی کاملاً ساختگی فقط برای آزمون چندمنبعی و حفظ سوابق بدون بازنویسی آگهی اصلی. هیچ ادعای انتشار واقعی در روزنامه رسمی وجود ندارد.",
     board:[],signing:[]};
   const n2=await status(await post(legalPath,tokenMap.get(MANAGER),shadowNotice),
     201,"Child06 additional fictional Gazette entry is appended");
   ok(n2.noticeId!==notice.noticeId,
     "Child06 additional notice coexists without modifying the first");
   const memberHistory=await status(await get(
     "/v1/tenants/"+A+"/child06/governance-history",tokenMap.get(USER)),
     200,"Child06 shareholder reads full notice and board chronology");
   ok(memberHistory.tenantId===A&&memberHistory.publishedVerified===false&&
     memberHistory.confersSigningPower===false&&memberHistory.confersVotingRights===false&&
     memberHistory.notices.length===2&&memberHistory.boardHistory.length===9&&
     memberHistory.signingHistory.length===2,
     "Child06 history returns both sources, board events and two signing rules");
   ok(memberHistory.boardHistory.some(x=>x.personName==="مجتبی گلپری"&&
       x.office==="CEO"&&x.eventType==="RESIGNED")&&
      memberHistory.boardHistory.some(x=>x.personName==="مرتضی کابلیان شاندیز"&&
       x.office==="CEO"&&x.termEnd==="1406/12/20"),
      "Child06 preserves resignation and current CEO appointment separately");
   ok(!JSON.stringify(memberHistory).includes("0932358977"),
      "Child06 response never discloses personal national identifiers");
   const governanceBff=sh.origin+"/api/tenants/"+A+"/governance-history";
   await status(await fetch(governanceBff),401,
     "Shareholder BFF denies anonymous governance history");
   const bff=await status(await fetch(governanceBff,{
    headers:{Cookie:"tto_session="+tokenMap.get(USER)},cache:"no-store"}),
     200,"Shareholder Next BFF serves redacted historical records under session");
   ok(bff.available===true&&bff.verified===false&&bff.notices.length===2&&
      bff.boardHistory.length===9&&bff.signingHistory.length===2,
      "Shareholder BFF only exposes archival claims, not legal verification");
   await status(await get("/v1/tenants/"+B+"/child06/governance-history",
      tokenMap.get(USER)),403,"Child06 tenant B cannot read tenant A claims");
   await assert.rejects(()=>db.query(
     "DELETE FROM tto.cooperative_legal_notice_archive WHERE notice_id=$1",
     [notice.noticeId]));checks++;
   const immutable=(await db.query(
     "SELECT provenance_status FROM tto.cooperative_legal_notice_archive WHERE notice_id=$1",
     [notice.noticeId])).rows[0];
   ok(immutable.provenance_status==="USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED",
     "Child06 even a CI admin cannot silently promote source by editing immutable notice");
   console.log("CHILD06_TORGHABEH_REAL_NAMED_SOURCE_DECLARED_HISTORY_NEST_PG17_BFF_PASS");
   }


   // PH12: Real Nest HTTP -> signed loopback issuer -> PostgreSQL trust
   // checkpoint, two independent Nest processes, no legal/ACTIVE promotion.
   const labPath="/v1/tenants/"+A+"/ph12/lab/signed-issuer-recheck";
   const labSubject={entityId:"SYNTHETIC_ENTITY_A"};
   const labA=mockIssuers[0];
   const holder=(value,state)=>{
    ok(value.state===state&&value.officialSourceAuthenticated===false&&
       value.boardLegallyApproved===false&&value.tariffActivated===false&&
       value.syntheticOnly===true,
       "PH12 mock bridge never becomes a legal or tariff approval: "+state);
   };
   await status(await post(labPath,"",labSubject),401,"PH12 mock bridge anonymous denied");
   await status(await post(labPath,tokenMap.get(USER),labSubject),403,
    "PH12 mock bridge member denied");
   await status(await post(labPath,tokenMap.get(MANAGER),labSubject),403,
    "PH12 mock bridge manager cannot gain legal reviewer ability");
   await status(await post(labPath,tokenMap.get(LEGAL),{entityId:"not-synthetic"}),400,
    "PH12 mock bridge only accepts synthetic identifiers");
   const first=await status(await post(labPath,tokenMap.get(LEGAL),labSubject),200,
    "PH12 Nest verifies signed issuer response and persists monotonic synthetic checkpoint");
   holder(first,"MOCK_ELIGIBLE_IN_LAB_ONLY");
   const initial=await db.query("SELECT source_version,revoked,trust_epoch FROM tto.ph12_mock_lab_checkpoints WHERE tenant_id=$1 AND entity_id=$2",[A,labSubject.entityId]);
   ok(initial.rows.length===1&&Number(initial.rows[0].source_version)===1&&
      initial.rows[0].revoked===false&&Number(initial.rows[0].trust_epoch)===1,
     "PH12 signed result binds synthetic tenant in actual PG17 checkpoint");
   const cross=await status(await post(
      "/v1/tenants/"+B+"/ph12/lab/signed-issuer-recheck",tokenMap.get(LEGAL),labSubject),
      200,"PH12 different tenant with no lab trust fails closed");
   holder(cross,"MOCK_HOLD_NO_PINNED_TRUST");
   labA.setTransform(e=>{e.payload.version=5;return e;});
   holder(await status(await post(labPath,tokenMap.get(LEGAL),labSubject),200,
      "PH12 tampering invalidates real Nest signature check"),"MOCK_HOLD_SIGNATURE_INVALID");
   labA.setTransform(null);
   labA.setOffline(true);
   holder(await status(await post(labPath,tokenMap.get(LEGAL),labSubject),200,
      "PH12 outage must not inherit cached approval"),"MOCK_HOLD_ISSUER_UNAVAILABLE");
   labA.setOffline(false);
   labA.setRecord(A,labSubject.entityId,newRecord({version:2,recordHash:"2".repeat(64)}));
   holder(await status(await post(labPath,tokenMap.get(LEGAL),labSubject),200,
      "PH12 recovered issuer makes signed v2 monotonic advance"),"MOCK_ELIGIBLE_IN_LAB_ONLY");
   labA.setRecord(A,labSubject.entityId,newRecord({version:1}));
   holder(await status(await post(labPath,tokenMap.get(LEGAL),labSubject),200,
      "PH12 rollback blocked after recovery"),"MOCK_HOLD_VERSION_ROLLBACK");
   labA.setRecord(A,labSubject.entityId,newRecord({version:2,recordHash:"2".repeat(64)}));
   // Independent Nest process uses the same PostgreSQL trust and checkpoint,
   // not a local in-memory cache. PG row locks serialize concurrent replies.
   const api2="http://127.0.0.1:31998";
   await launch("Nest second PG trust consumer",["dist/main.js"],
      resolve(ROOT,"services/api"),{...labApiEnv,PORT:"31998"},api2+"/ready");
   const labPost2=()=>fetch(api2+labPath,{
      method:"POST",headers:{"Content-Type":"application/json",
        Authorization:"Bearer "+tokenMap.get(LEGAL)},
      body:JSON.stringify(labSubject),signal:AbortSignal.timeout(12000)});
   const both=await Promise.all([post(labPath,tokenMap.get(LEGAL),labSubject),labPost2()]);
   for(const response of both)holder(await status(response,200,
      "PH12 concurrent separate Nest processes agree on PG trust"),"MOCK_ELIGIBLE_IN_LAB_ONLY");
   const beforeRotation=await db.query(
      "SELECT source_version,trust_epoch FROM tto.ph12_mock_lab_checkpoints WHERE tenant_id=$1",
      [A]);
   ok(beforeRotation.rows.length===1&&Number(beforeRotation.rows[0].source_version)===2,
      "PH12 concurrent processes share one monotonic record");
   const labB=makeMockIssuer({keyId:"PH12_TEST_ED25519_KEY_02"});
   mockIssuers.push(labB);
   const issuer2Url=await labB.start();
   labB.setRecord(A,labSubject.entityId,newRecord({version:3,recordHash:"3".repeat(64)}));
   // CI administrator supplies a new synthetic key; DB trigger enforces
   // monotonic epochs, rejects old-key resurrection and appends immutable audit.
   await assert.rejects(()=>db.query(
     "UPDATE tto.ph12_mock_lab_trust SET trust_epoch=0 WHERE tenant_id=$1",[A]));
   checks++;
   await db.query("UPDATE tto.ph12_mock_lab_trust SET trust_epoch=2,key_id=$2,issuer_url=$3,public_key_pem=$4,modified_at=clock_timestamp() WHERE tenant_id=$1",[
     A,labB.keyId,issuer2Url,labB.publicKey.export({type:"spki",format:"pem"})]);
   holder(await status(await labPost2(),200,
      "PH12 new issuer key and epoch accepted on independent Nest instance"),
      "MOCK_ELIGIBLE_IN_LAB_ONLY");
   await assert.rejects(()=>db.query(
     "UPDATE tto.ph12_mock_lab_trust SET trust_epoch=1 WHERE tenant_id=$1",[A]));
   checks++;
   await assert.rejects(()=>db.query(
     "UPDATE tto.ph12_mock_lab_trust SET trust_epoch=3,key_id=$2,issuer_url=$3,public_key_pem=$4 WHERE tenant_id=$1",[
     A,labA.keyId,firstMockIssuerUrl,labA.publicKey.export({type:"spki",format:"pem"})]));
   checks++;
   labB.setTransform(e=>signedEnvelope(e.payload,labA.privateKey,labA.keyId));
   holder(await status(await post(labPath,tokenMap.get(LEGAL),labSubject),200,
      "PH12 issuer response signed by retired key rejected"),"MOCK_HOLD_BAD_ENVELOPE_OR_KEY");
   labB.setTransform(null);
   const audit=await db.query(
      "SELECT trust_epoch,key_id,transition FROM tto.ph12_mock_lab_trust_history WHERE tenant_id=$1 ORDER BY trust_epoch",[A]);
   ok(audit.rows.length===2&&Number(audit.rows[0].trust_epoch)===1&&
      Number(audit.rows[1].trust_epoch)===2&&audit.rows[0].transition==="BOOTSTRAP"&&
      audit.rows[1].transition==="ROTATION"&&audit.rows[1].key_id===labB.keyId,
      "PH12 trust transition history is monotonic and contains both rotation witnesses");
   await assert.rejects(()=>db.query(
     "DELETE FROM tto.ph12_mock_lab_trust_history WHERE tenant_id=$1",[A]));
   checks++;
   labB.setRecord(A,labSubject.entityId,newRecord({
     version:4,recordHash:"4".repeat(64),status:"REVOKED"}));
   holder(await status(await post(labPath,tokenMap.get(LEGAL),labSubject),200,
      "PH12 revocation persisted through first Nest instance"),"MOCK_HOLD_REVOKED");
   labB.setRecord(A,labSubject.entityId,newRecord({
      version:5,recordHash:"5".repeat(64),status:"CURRENT"}));
   holder(await status(await labPost2(),200,
      "PH12 second Nest sees durable revocation even after signed CURRENT"),
      "MOCK_HOLD_REVOKED");
   // Restarting a second Nest instance does not clear the shared revocation.
   const secondProc=running.find(proc=>proc.exitCode===null&&proc.pid!==undefined&&
      proc!==running[0]&&proc===running[running.length-1]);
   if(secondProc){secondProc.kill("SIGTERM");await new Promise(r=>setTimeout(r,250));}
   await launch("Nest restarted PG trust consumer",["dist/main.js"],
       resolve(ROOT,"services/api"),{...labApiEnv,PORT:"31998"},api2+"/ready");
   holder(await status(await labPost2(),200,
      "PH12 fresh Nest process recovers persisted revoked state"),"MOCK_HOLD_REVOKED");
      const finalLab=await db.query("SELECT source_version,revoked,trust_epoch FROM tto.ph12_mock_lab_checkpoints WHERE tenant_id=$1",[A]);
   ok(finalLab.rows.length===1&&finalLab.rows[0].revoked===true&&
      Number(finalLab.rows[0].trust_epoch)===2,
      "PH12 revocation remains sticky in PostgreSQL after mock key rotation");
   const unchangedLab=await db.query("SELECT status FROM tto.ph12_tariff_drafts WHERE draft_id=$1",[saved.draftId]);
   ok(unchangedLab.rows[0].status==="DRAFT_UNVERIFIED",
      "PH12 signed mock API cannot modify real tariff state");
   console.log("PH12_NEST_PG17_TWO_INSTANCE_SIGNED_ISSUER_ROTATION_REVOCATION_PASS");




 }

 await db.query("UPDATE tto.legal_authorities SET revoked_at=now() WHERE authority_id=$1",[auth]);
 await status(await fetch(draftBff,{headers:managerCookie}),403,
   "revoked manager authority cannot read persisted tariff drafts");
 await status(await postDraft(draftBff,{requestKey:randomUUID(),tariff:{...tariff,version:"3"}}),403,
   "revoked manager authority cannot add tariff drafts");
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
.finally(async()=>{for(const proc of running)if(proc.exitCode===null)proc.kill("SIGTERM");for(const issuer of mockIssuers)await issuer.stop().catch(()=>{});await db.end().catch(()=>{});});
