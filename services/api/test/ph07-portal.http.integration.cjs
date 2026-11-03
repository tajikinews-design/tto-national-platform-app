'use strict';
/** Real Nest HTTP + disposable PG17, fake users and evidence; NO external providers.
 * The server connects only as tto_app. Every route crosses bearer session,
 * tenant-local transaction and DB SECURITY DEFINER permission scope.
 */
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {spawn}=require('node:child_process');
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const path=require('node:path');
const dbUrl=process.env.TEST_ADMIN_DATABASE_URL;
if(!dbUrl||process.env.CI!=='true'||process.env.VERCEL||process.env.TTO_ENABLE_REAL_SMSOTP_DELIVERY==='true')
 throw Error('PH07_DISPOSABLE_CI_ONLY');
const db=new Client({connectionString:dbUrl});
const a='75000000-0000-4000-8000-000000000001';
const b='75000000-0000-4000-8000-000000000002';
const user='75100000-0000-4000-8000-000000000001';
const manager='75100000-0000-4000-8000-000000000002';
const stranger='75100000-0000-4000-8000-000000000003';
const notice='75200000-0000-4000-8000-000000000001';
const ticket='75300000-0000-4000-8000-000000000001';
const otherTicket='75300000-0000-4000-8000-000000000002';
const ev='75400000-0000-4000-8000-000000000001';
const pub='75500000-0000-4000-8000-000000000001';
const foreignPub='75500000-0000-4000-8000-000000000002';
const report='75600000-0000-4000-8000-000000000001';
const foreignReport='75600000-0000-4000-8000-000000000002';
let child,checks=0,stderr='';
const port=31676,root='http://127.0.0.1:'+port;
async function tokenFor(uid){
 const raw=randomBytes(48).toString('base64url');
 await db.query("INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at) VALUES($1,$2,$3,0,now()+interval '15 minutes')",
 [randomUUID(),uid,createHash('sha256').update(raw).digest()]);
 return raw;
}
async function req(method,route,token,expect,body){
 const r=await fetch(root+route,{method,
 headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},
 body:body?JSON.stringify(body):undefined});
 const response=await r.json().catch(()=>null);
 assert.equal(r.status,expect,method+' '+route+' expected '+expect+' got '+r.status+
 ' code '+String(response?.code??response?.statusCode??'?'));
 checks++;return response;
}
async function seed(){
 await db.query("ALTER ROLE tto_app LOGIN");
 await db.query("INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES($1,'ph07-http-a','Synthetic A','ACTIVE'),($2,'ph07-http-b','Synthetic B','ACTIVE')",[a,b]);
 for(const uid of [user,manager,stranger]){
  await db.query("INSERT INTO tto.user_accounts(user_id) VALUES($1)",[uid]);
 }
 await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'MEMBER'),($4,$5,$6,'COOPERATIVE_MANAGER')",
 [randomUUID(),user,a,randomUUID(),manager,a]);
 await db.query("INSERT INTO tto.evidence_references(evidence_id,tenant_id,source_entity_type,source_entity_id) VALUES($1,$2,'PH07_REAL_HTTP_SYNTHETIC',$3),($4,$5,'PH07_REAL_HTTP_SYNTHETIC',$6)",
 [ev,a,randomUUID(),randomUUID(),b,randomUUID()]);
 const foreignEvidence=(await db.query("SELECT evidence_id FROM tto.evidence_references WHERE tenant_id=$1 LIMIT 1",[b])).rows[0].evidence_id;
 await db.query("INSERT INTO tto.ph07_publications(publication_id,tenant_id,kind,title,version,status,evidence_id,created_by) VALUES($1,$2,'MEMBER_NOTICE','Own PH07 Notice',1,'PUBLISHED',$3,$4),($5,$6,'MEMBER_NOTICE','Foreign PH07 Notice',1,'PUBLISHED',$7,$8)",
 [notice,a,ev,user,foreignPub,b,foreignEvidence,stranger]);
 await db.query("INSERT INTO tto.ph07_notice_recipients(publication_id,tenant_id,user_id,snapshot_version) VALUES($1,$2,$3,1)",[notice,a,user]);
 await db.query("INSERT INTO tto.ph07_notice_delivery(publication_id,user_id,channel,provider_event_ref) VALUES($1,$2,'SMS','PH07_HTTP_PROVIDER_SYNTHETIC')",[notice,user]);
 await db.query("INSERT INTO tto.ph07_support_tickets(ticket_id,tenant_id,requester_id,issue_key) VALUES($1,$2,$3,'PH07_HTTP_OWN'),($4,$5,$6,'PH07_HTTP_OTHER')",
 [ticket,a,user,otherTicket,a,stranger]);
 await db.query("INSERT INTO tto.ph07_support_notes(note_id,ticket_id,author_id,visibility,body) VALUES($1,$2,$3,'REQUESTER','Visible answer'),($4,$5,$6,'INTERNAL','PRIVATE_CASE_NOTE')",
 [randomUUID(),ticket,manager,randomUUID(),ticket,manager]);
 await db.query("INSERT INTO tto.ph07_disclosure_packages(package_id,tenant_id,subject_code,classification) VALUES($1,$2,'PH07_FY1405_A','MEMBER'),($3,$4,'PH07_FY1405_B','MEMBER')",
 [report,a,foreignReport,b]);
 await db.query("INSERT INTO tto.ph07_disclosure_versions(version_id,package_id,version_num,period_start,period_end,source_evidence,report_kind,status,created_by,approved_by) VALUES($1,$2,1,'2026-01-01','2026-06-30',$3,'FINANCIAL_DISCLOSURE','PUBLISHED',$4,$5),($6,$7,1,'2026-01-01','2026-06-30',$8,'FINANCIAL_DISCLOSURE','PUBLISHED',$9,$10)",
 [randomUUID(),report,ev,user,manager,randomUUID(),foreignReport,foreignEvidence,stranger,manager]);
}
async function start(){
 child=spawn(process.execPath,['dist/main.js'],{
 cwd:path.resolve(__dirname,'..'),
 env:{...process.env,NODE_ENV:'test',TTO_MOCK_SMSOTP_PROVIDER:'true',
 DATABASE_URL:'postgresql://tto_app@127.0.0.1:5432/tto',PORT:String(port)},
 stdio:['ignore','pipe','pipe']});
 child.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-5000)});
 for(let k=0;k<90;k++){
  if(child.exitCode!==null)throw Error('PH07_NEST_EXIT_'+child.exitCode+' '+stderr.slice(-450));
  try{let r=await fetch(root+'/health');if(r.status===200)return;}catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 throw Error('PH07_NEST_NOT_READY '+stderr.slice(-450));
}
async function main(){
 await db.connect();await seed();
 const ut=await tokenFor(user),mt=await tokenFor(manager),st=await tokenFor(stranger);
 await start();
 const base='/v1/tenants/'+a+'/ph07',foreign='/v1/tenants/'+b+'/ph07';
 await req('GET',base+'/communications',null,401);
 let got=await req('GET',base+'/communications',ut,200);
 assert.equal(got.items.length,1);assert.equal(got.items[0].title,'Own PH07 Notice');
 got=await req('GET',foreign+'/communications',ut,200);
 assert.equal(got.items.length,0);
 console.log('PH07_REAL_NEST_COMM_MEMBER_TENANT_ISOLATION_PASS');
 got=await req('GET',base+'/notices/'+notice+'/status',ut,200);
 assert.deepEqual(got,{delivered:true,read:false,acknowledged:false});
 await req('GET',base+'/notices/'+notice+'/status',st,403);
 await req('GET',foreign+'/notices/'+notice+'/status',ut,403);
 console.log('PH07_REAL_NEST_NOTICE_DELIVERY_NOT_ACK_AND_SCOPE_PASS');
 got=await req('GET',base+'/support/my-tickets',ut,200);
 assert.equal(got.items.length,1);assert.equal(got.items[0].ticket_id,ticket);
 got=await req('GET',base+'/support/'+ticket+'/notes',ut,200);
 assert.equal(got.items.length,1);assert.equal(got.items[0].body,'Visible answer');
 await req('GET',base+'/support/'+otherTicket+'/notes',ut,403);
 await req('GET',base+'/support/'+ticket+'/notes',st,403);
 console.log('PH07_REAL_NEST_SUPPORT_OWN_TICKET_INTERNAL_NOTE_HIDDEN_PASS');
 await req('GET',base+'/support/'+ticket+'/sensitive-access',mt,403);
 await req('POST',base+'/support/'+ticket+'/resolve',ut,403,{evidenceId:ev});
 got=await req('POST',base+'/support/'+ticket+'/resolve',mt,201,{evidenceId:ev});
 assert.equal(got.resolved,true);
 await req('POST',base+'/support/'+ticket+'/resolve',mt,403,{evidenceId:ev});
 console.log('PH07_REAL_NEST_SUPPORT_MANAGER_RESOLUTION_JIT_DENIED_PASS');
 got=await req('GET',base+'/disclosures',ut,200);
 assert.equal(got.items.length,1);assert.equal(got.accountingEngine,false);
 got=await req('GET',foreign+'/disclosures',ut,200);
 assert.equal(got.items.length,0);
 console.log('PH07_REAL_NEST_SOURCE_BACKED_DISCLOSURE_TENANT_ISOLATION_PASS');
 const audits=await db.query("SELECT count(*)::integer AS n FROM tto.audit_events WHERE tenant_id=$1 AND event_name='SUPPORT_TICKET_RESOLVED'",[a]);
 assert.equal(audits.rows[0].n,1);
 console.log('PH07_REAL_NEST_SUPPORT_RESOLUTION_AUDIT_ONCE_PASS');
 console.log('PH07_REAL_NEST_HTTP_WORKFLOWS_PASS='+checks);
}
main().catch(e=>{console.error('PH07_REAL_NEST_HTTP_FAIL',e?.message?.slice(0,1100));process.exitCode=1;})
.finally(async()=>{if(child&&child.exitCode===null)child.kill('SIGTERM');await db.end().catch(()=>{})});
