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
let server,stderr='',checks=0;
const port=31677,root='http://127.0.0.1:'+port;
async function token(uid){
 const raw=randomBytes(48).toString('base64url');
 await db.query("INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at) VALUES($1,$2,$3,0,now()+interval '15 minutes')",
 [randomUUID(),uid,createHash('sha256').update(raw).digest()]);
 return raw;
}
async function request(method,route,bearer,status){
 const resp=await fetch(root+route,{method,headers:bearer?{authorization:'Bearer '+bearer}:{}});
 const body=await resp.json().catch(()=>null);
 assert.equal(resp.status,status,method+' '+route+' expected '+status+' got '+resp.status+
 ' '+JSON.stringify(body).slice(0,220));
 checks++;return body;
}
async function seed(){
 await db.query("ALTER ROLE tto_app LOGIN");
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
 assert.equal(x.items.length,2);
 await request('POST',me+'/data-governance/records/'+held+'/dispose',managerToken,403);
 await request('POST',me+'/data-governance/records/'+eligible+'/dispose',memberToken,403);
 x=await request('POST',me+'/data-governance/records/'+eligible+'/dispose',managerToken,201);
 assert.equal(x.disposed,true);
 await request('POST',me+'/data-governance/records/'+eligible+'/dispose',managerToken,403);
 console.log('PH09_REAL_NEST_DG_HOLD_PRIVILEGE_ATOMIC_DISPOSE_HTTP_PASS');
 console.log('PH09_REAL_NEST_HTTP_REQUESTS_PASS='+checks);
}
main().catch(e=>{console.error('PH09_REAL_NEST_HTTP_FAIL',String(e?.message).slice(0,1500));process.exitCode=1;})
.finally(async()=>{if(server&&server.exitCode===null)server.kill('SIGTERM');await db.end().catch(()=>{})});
