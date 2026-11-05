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
 // The initial self-report cannot change the existing verified manager's
 // legal authority, tenant count, signer status or formal permissions.
 const truth=await db.query(
 "SELECT (SELECT count(*)::int FROM tto.cooperative_manual_official_governance_claims WHERE tenant_id=$1) claims,"+
 " (SELECT count(*)::int FROM tto.role_assignments WHERE tenant_id=$1) roles,"+
 " (SELECT count(*)::int FROM tto.legal_authorities WHERE tenant_id=$1) authorities,"+
 " (SELECT verification_status FROM tto.cooperative_manual_official_governance_claims WHERE claim_id=$2) status",
 [tenant,first.claimId]);
 assert.deepEqual(truth.rows[0],{
  claims:1,roles:1,authorities:1,status:"SELF_REPORTED_PENDING_REVIEW"});
 checks++;
 const page=await fetch(web+"/official-records",{cache:"no-store"});
 assert.equal(page.status,200);
 const html=await page.text();
 assert.ok(html.includes("شماره روزنامه رسمی")&&html.includes("شماره آگهی"));
 assert.ok(html.includes("بررسی حقوقی مستقل الزامی است"));checks++;
 console.log("PH10_MANUAL_GAZETTE_BFF_NEST_PG17_NO_ROLE_ELEVATION_PASS_CHECKS="+checks);
}
main().catch(e=>{console.error("PH10_MANUAL_GAZETTE_E2E_FAIL",
 String(e?.stack??e).slice(0,2200));process.exitCode=1;})
.finally(async()=>{for(const p of children)if(p.exitCode===null)p.kill("SIGTERM");await db.end().catch(()=>{});});
