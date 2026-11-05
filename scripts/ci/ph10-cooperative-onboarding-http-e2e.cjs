"use strict";
/**
 * PH10 tenantless cooperative onboarding: REAL Next BFF -> Nest HTTP -> PostgreSQL17.
 * GitHub-hosted disposable PostgreSQL ONLY. All identities and legal claims synthetic.
 * This cannot prove actual corporate authority, authentic documents, scanner, or release.
 */
const assert=require("node:assert/strict");
const {randomUUID,randomBytes,createHash,createDecipheriv}=require("node:crypto");
const {spawn}=require("node:child_process");
const {resolve}=require("node:path");
const {createRequire}=require("node:module");
const ROOT=resolve(__dirname,"../..");
const {Client}=createRequire(resolve(ROOT,"services/api/package.json"))("pg");
if(process.env.CI!=="true"||process.env.VERCEL||process.env.APIIR_TOKEN||
   process.env.TTO_ENABLE_REAL_SMSOTP_DELIVERY==="true"||
   process.env.TTO_ISOLATED_DEMO_DB!=="true"||
   process.env.TEST_ADMIN_DATABASE_URL!=="postgresql://postgres@127.0.0.1:5432/tto"||
   !/^[0-9a-f]{64}$/.test(process.env.TTO_COOP_QUARANTINE_KEY_HEX??""))
 throw Error("PH10_ISOLATED_AUTHENTICATED_HTTP_ONLY");
const db=new Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL});
const apiPort=32871,webPort=32872,api="http://127.0.0.1:"+apiPort,web="http://127.0.0.1:"+webPort;
const rootId=randomUUID(),strangerId=randomUUID(),workspaceId=randomUUID(),otherWorkspaceId=randomUUID();
const slug="ci-dossier-"+randomUUID().slice(0,8),otherSlug="ci-dossier-"+randomUUID().slice(0,8);
const processes=[];let checks=0,rootToken,nonrootToken;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function start(args,cwd,env){const p=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:"ignore"});processes.push(p);p.on("error",()=>{});return p;}
async function ready(url,p){for(let n=0;n<100;n++){
 if(p.exitCode!==null)throw Error("SERVER_EXITED_"+url);
 try{let r=await fetch(url,{signal:AbortSignal.timeout(900)});if(r.status<500)return;}catch{}
 await pause(240);
}throw Error("SERVER_NOT_READY_"+url);}
async function req(path,{method="GET",token=rootToken,body,origin=true}={}){
 const headers={...(token?{Cookie:"tto_session="+token}:{}),
 ...(method!=="GET"&&origin?{Origin:web}:{}),
 ...(body!==undefined?{"Content-Type":"application/json"}:{})};
 const r=await fetch(web+path,{method,headers,
 ...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:"no-store",redirect:"manual",
 signal:AbortSignal.timeout(12000)});
 const data=await r.json().catch(()=>null);return {status:r.status,data,headers:r.headers};
}
function expect(x,code,label){assert.equal(x.status,code,label+" status "+x.status+
 " response "+JSON.stringify(x.data).slice(0,140));checks++;return x.data;}
async function session(user){const token=randomBytes(48).toString("base64url");
 await db.query("INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)"+
 " VALUES($1,$2,$3,0,now()+interval '15 minutes')",
 [randomUUID(),user,createHash("sha256").update(token).digest()]);
 return token;
}
async function main(){
 await db.connect();
 await db.query("ALTER ROLE tto_app LOGIN");
 await db.query("INSERT INTO tto.user_accounts(user_id) VALUES($1),($2)",[rootId,strangerId]);
 await db.query("INSERT INTO tto.national_root_accounts(singleton,user_id,must_change_credentials) VALUES(true,$1,false)",[rootId]);
 await db.query("INSERT INTO tto.cooperative_workspace_addresses(workspace_id,slug,created_by) VALUES($1,$2,$3),($4,$5,$3)",
 [workspaceId,slug,rootId,otherWorkspaceId,otherSlug]);
 rootToken=await session(rootId);nonrootToken=await session(strangerId);
 const nest=start(["dist/main.js"],resolve(ROOT,"services/api"),{
  DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto",PORT:String(apiPort),NODE_ENV:"test",
  APIIR_TOKEN:"",TTO_ISOLATED_DEMO_DB:"true",
  TTO_COOP_QUARANTINE_KEY_HEX:process.env.TTO_COOP_QUARANTINE_KEY_HEX
 });
 await ready(api+"/ready",nest);
 const cwd=resolve(ROOT,"apps/national-admin");
 const next=start([resolve(cwd,"node_modules/next/dist/bin/next"),"start","-p",String(webPort),"-H","127.0.0.1"],cwd,{
  NODE_ENV:"test",CI:"true",TTO_ISOLATED_DEMO_DB:"true",
  TTO_LOOPBACK_E2E:"1",TTO_API_BASE_URL:api,NEXT_TELEMETRY_DISABLED:"1",APIIR_TOKEN:""
 });
 await ready(web+"/",next);
 const d="/api/cooperatives/onboarding-drafts",e="/api/cooperatives/onboarding-evidence",
 s="/api/cooperatives/onboarding";
 const draft={legalName:"Synthetic Development Cooperative",province:"Test Province",county:"Test County"};
 const anonymous=await req(d,{token:""});
 expect(anonymous,401,"unauthenticated draft read");
 expect(await req(d,{token:nonrootToken}),403,"non-national actor draft read denied");
 expect(await req(s,{token:nonrootToken}),403,"non-national actor dossiers denied");
 expect(await req(d,{method:"POST",token:nonrootToken,body:{slug,payload:draft,expectedVersion:0,requestKey:randomUUID()}}),403,"non-national draft write");
 expect(await req(d,{method:"POST",origin:false,body:{slug,payload:draft,expectedVersion:0,requestKey:randomUUID()}}),403,"draft CSRF origin");
 const firstKey=randomUUID();
 const payload={slug,payload:draft,expectedVersion:0,requestKey:firstKey};
 const saved=expect(await req(d,{method:"POST",body:payload}),200,"create versioned draft");
 assert.equal(saved.version,1);assert.equal(saved.submitted,false);assert.equal(saved.tenantCreated,false);
 const replay=expect(await req(d,{method:"POST",body:payload}),200,"exact draft replay");
 assert.equal(replay.replayed,true);assert.equal(replay.version,1);
 expect(await req(d,{method:"POST",body:{...payload,requestKey:randomUUID()}}),409,"stale draft reject");
 expect(await req(d,{method:"POST",body:{...payload,payload:{roleCode:"NATIONAL_ROOT"},expectedVersion:1,requestKey:randomUUID()}}),400,"forbidden draft field");
 const version2=expect(await req(d,{method:"POST",body:{...payload,expectedVersion:1,requestKey:randomUUID(),
  payload:{...draft,legalName:"Synthetic Updated Cooperative"}}}),200,"draft revision");
 assert.equal(version2.version,2);
 const list=expect(await req(d),200,"read saved draft");
 assert.equal(list.items.some(x=>x.slug===slug&&x.version===2),true);
 const pdf=Buffer.from("%PDF-1.4\n%CI-SYNTHETIC-ONLY\n1 0 obj\n<<>>\nendobj\n");
 const firstUploadKey=randomUUID();
 const upload={slug,uploadKey:firstUploadKey,mimeType:"application/pdf",contentBase64:pdf.toString("base64")};
 expect(await req(e,{method:"POST",origin:false,body:upload}),403,"upload cross-origin denied");
 expect(await req(e,{method:"POST",token:"",body:upload}),401,"upload without cookie denied");
 expect(await req(e,{method:"POST",token:nonrootToken,body:upload}),403,"upload by nonroot denied");
 expect(await req(e,{method:"POST",body:{...upload,mimeType:"image/png"}}),400,"MIME signature mismatch");
 const quarantined=expect(await req(e,{method:"POST",body:upload}),201,"encrypted file staged");
 assert.equal(quarantined.scanStatus,"QUARANTINED");assert.equal(quarantined.authenticity,"NOT_VERIFIED");
 assert.equal(quarantined.managerRoleGranted,false);assert.equal(quarantined.tenantCreated,false);
 const uploadedAgain=expect(await req(e,{method:"POST",body:upload}),201,"exact evidence replay");
 assert.equal(uploadedAgain.evidenceId,quarantined.evidenceId);assert.equal(uploadedAgain.replayed,true);
 expect(await req(e,{method:"POST",body:{...upload,contentBase64:Buffer.from("%PDF-1.4\nchanged").toString("base64")}}),409,"upload key collision");
 const stored=await db.query("SELECT ciphertext,iv,tag,content_sha256,scan_status,authenticity_status FROM "+
 "tto.cooperative_onboarding_evidence_quarantine WHERE evidence_id=$1",[quarantined.evidenceId]);
 assert.equal(stored.rowCount,1);
 assert.notDeepEqual(stored.rows[0].ciphertext,pdf);
 const decipher=createDecipheriv("aes-256-gcm",Buffer.from(process.env.TTO_COOP_QUARANTINE_KEY_HEX,"hex"),stored.rows[0].iv);
 decipher.setAuthTag(stored.rows[0].tag);
 assert.deepEqual(Buffer.concat([decipher.update(stored.rows[0].ciphertext),decipher.final()]),pdf);
 assert.deepEqual(stored.rows[0].content_sha256,createHash("sha256").update(pdf).digest());
 assert.equal(stored.rows[0].scan_status,"QUARANTINED");
 assert.equal(stored.rows[0].authenticity_status,"NOT_VERIFIED");checks++;
 const claims={slug,legalName:"Synthetic Cooperative Case 1",nationalId:"12345678901",registrationNumber:"123456",
  province:"Test Province",county:"Test County",legalAddress:"Synthetic Road No 123",
  representativeName:"Synthetic Representative",candidateManagerName:"Synthetic Manager",
  candidateManagerMobile:"09123456789",evidenceReference:quarantined.evidenceId};
 expect(await req(s,{method:"POST",token:"",body:claims}),401,"unauthorized dossier submission");
 const submitted=expect(await req(s,{method:"POST",body:claims}),201,"tenantless cooperative submission");
 assert.equal(submitted.status,"PENDING_LEGAL_REVIEW");
 assert.equal(submitted.managerRoleGranted,false);assert.equal(submitted.tenantCreated,false);
 expect(await req(s,{method:"POST",body:claims}),409,"duplicate submitted dossier");
 expect(await req(d,{method:"POST",body:{slug,payload:draft,expectedVersion:2,requestKey:randomUUID()}}),409,"post-submit draft locked");
 expect(await req(e,{method:"POST",body:{...upload,uploadKey:randomUUID()}}),400,"post-submit new upload locked");
 expect(await req(e,{method:"POST",body:upload}),201,"post-submit exact upload replay");
 const a="/api/cooperatives/onboarding/"+submitted.dossierId+"/actions";
 expect(await req(a,{method:"POST",token:nonrootToken,body:{action:"START_REVIEW",expectedVersion:1,requestKey:randomUUID()}}),403,"nonroot reviewer forbidden");
 const reviewStart={action:"START_REVIEW",expectedVersion:1,requestKey:randomUUID()};
 const started=expect(await req(a,{method:"POST",body:reviewStart}),200,"review start");
 assert.equal(started.version,2);assert.equal(started.status,"IN_REVIEW");
 const again=expect(await req(a,{method:"POST",body:reviewStart}),200,"review start idempotency");
 assert.equal(again.replayed,true);
 expect(await req(a,{method:"POST",body:{...reviewStart,requestKey:randomUUID()}}),409,"review stale version");
 expect(await req(a,{method:"POST",body:{action:"RECOMMEND_EXTERNAL_APPROVAL",expectedVersion:2,
  requestKey:randomUUID(),reason:"Synthetic recommendation only"}}),403,"self approval recommendation forbidden");
 const needs=expect(await req(a,{method:"POST",body:{action:"REQUEST_CHANGES",expectedVersion:2,
  requestKey:randomUUID(),reason:"Synthetic missing verification document"}}),200,"request corrections");
 assert.equal(needs.status,"CHANGES_REQUESTED");assert.equal(needs.version,3);
 const corrected=expect(await req(e,{method:"POST",body:{...upload,uploadKey:randomUUID()}}),201,"upload correction during change window");
 const resubmitted=expect(await req(a,{method:"POST",body:{action:"RESUBMIT",expectedVersion:3,
  requestKey:randomUUID(),evidenceReference:corrected.evidenceId}}),200,"resubmit corrected dossier");
 assert.equal(resubmitted.status,"PENDING_LEGAL_REVIEW");assert.equal(resubmitted.version,4);
 const restarted=expect(await req(a,{method:"POST",body:{action:"START_REVIEW",expectedVersion:4,requestKey:randomUUID()}}),200,"restart review");
 assert.equal(restarted.version,5);
 const referred=expect(await req(a,{method:"POST",body:{action:"REFER_EXTERNAL_REVIEW",expectedVersion:5,
  requestKey:randomUUID(),reason:"Independent legal review required"}}),200,"refer to independent legal review");
 assert.equal(referred.status,"EXTERNAL_APPROVAL_REQUIRED");assert.equal(referred.version,6);
 assert.equal(referred.tenantCreated,false);assert.equal(referred.managerRoleGranted,false);
 expect(await req(a,{method:"POST",body:{action:"REJECT",expectedVersion:6,
  requestKey:randomUUID(),reason:"Synthetic illegal after referral"}}),400,"terminal referral cannot be reopened");
 const audit=await db.query("SELECT action,resulting_state,resulting_version FROM "+
 "tto.cooperative_onboarding_audit WHERE dossier_id=$1 ORDER BY occurred_at",[submitted.dossierId]);
 assert.equal(audit.rows.length,6,"submission plus five state changes must be auditable");
 assert.deepEqual(audit.rows.map(x=>x.action),
 ["DOSSIER_SUBMITTED","START_REVIEW","REQUEST_CHANGES","RESUBMIT","START_REVIEW","REFER_EXTERNAL_REVIEW"]);
 const invariants=await db.query("SELECT (SELECT count(*)::int FROM tto.tenants) tenants,"+
 "(SELECT count(*)::int FROM tto.role_assignments) roles,"+
 "(SELECT count(*)::int FROM tto.cooperative_onboarding_dossiers) dossiers,"+
 "(SELECT count(*)::int FROM tto.cooperative_onboarding_draft_revisions) revisions,"+
 "(SELECT count(*)::int FROM tto.cooperative_onboarding_evidence_quarantine) evidences");
 assert.deepEqual(invariants.rows[0],{tenants:0,roles:0,dossiers:1,revisions:2,evidences:2});checks++;
 console.log("PH10_COOP_FULL_BFF_NEST_POSTGRES17_PASS_CHECKS="+checks);
 console.log("PH10_COOP_NO_LEGAL_APPROVAL_NO_TENANT_NO_ROLE_NO_REAL_DOCUMENT");
}
main().catch(e=>{console.error("PH10_COOP_E2E_FAIL",String(e?.stack??e).slice(0,2000));process.exitCode=1;})
.finally(async()=>{for(const p of processes)if(p.exitCode===null)p.kill("SIGTERM");await db.end().catch(()=>{});});
