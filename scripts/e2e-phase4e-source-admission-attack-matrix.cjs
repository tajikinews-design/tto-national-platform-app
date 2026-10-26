"use strict";
/**
 * Phase4E: REAL PostgreSQL17 source-admission abuse probes over CI-only fixtures.
 * Assumes the existing CF02 isolated E2E already populated synthetic sources.
 * No mock SQL responses and no live/hosted source access.
 * Every temporary privileged change is wrapped in ROLLBACK.
 */
const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
const {resolve}=require("node:path");
const {createRequire}=require("node:module");
const {Client}=createRequire(resolve(__dirname,"../services/api/package.json"))("pg");
const URL="postgresql://postgres@127.0.0.1:5432/tto";
if(process.env.TTO_LOOPBACK_E2E!=="1" ||
 process.env.TEST_ADMIN_DATABASE_URL!==URL ||
 (process.env.APIIR_TOKEN??"")!=="" ||
 process.env.CI!=="true")throw Error("PHASE4E_DISPOSABLE_SYNTHETIC_PG_ONLY");
const main=new Client({connectionString:URL,connectionTimeoutMillis:8000});
const app=new Client({connectionString:"postgresql://tto_app@127.0.0.1:5432/tto",connectionTimeoutMillis:8000});
let mainConnected=false,appConnected=false,inTransaction=false;
let cases=0,checks=0;
function ok(value,label){assert.ok(value,label);checks++;}
function eq(actual,wanted,label){assert.deepEqual(actual,wanted,label);checks++;}
async function one(sql,values=[]){const r=await main.query(sql,values);eq(r.rowCount,1,"exact synthetic fixture row");return r.rows[0];}
async function test(name,fn){await fn();cases++;console.log("PASS Phase4E "+name);}
async function denied(sql,values=[]){
 await assert.rejects(()=>app.query(sql,values),e=>e.code==="42501");
 checks++;
}
async function valid(tenant,domain,ref){
 const r=await main.query("SELECT tto.valid_read_source($1,$2,$3) AS valid",[tenant,domain,ref]);
 eq(r.rowCount,1,"valid_read_source one verdict");
 return r.rows[0].valid;
}
async function counts(){
 const r=await main.query(`
 SELECT
 (SELECT count(*)::int FROM tto.member_source_snapshots) AS member_count,
 (SELECT count(*)::int FROM tto.shareholding_source_snapshots) AS shares_count,
 (SELECT count(*)::int FROM tto.source_import_batches) AS batches_count,
 (SELECT count(*)::int FROM tto.source_import_claims) AS claims_count,
 (SELECT count(*)::int FROM tto.relationship_projections) AS projection_count`);
 return r.rows[0];
}
async function run(){
 await main.connect();mainConnected=true;
 // Refuse even to start if this is not the disposable PG17 container fixture.
 const env=await one("SELECT current_database() AS db,current_user AS actor,current_setting('server_version_num')::int AS version,inet_server_addr()::text AS host");
 eq(env.db,"tto","test db only");
 eq(env.actor,"postgres","synthetic migration-owner only");
 ok(env.version>=170000&&env.version<180000,"must be PostgreSQL17");
 const refs=await main.query(`
 SELECT tenant_id,domain,source_ref,evidence_id,approved_at,valid_until,enabled
 FROM tto.source_contract_approvals
 WHERE (domain='CHILD06_MEMBERSHIP' AND source_ref='CI-APPROVED-CHILD06-V1')
    OR (domain='CHILD07_HOLDINGS' AND source_ref='CI-APPROVED-CHILD07-V1')
 ORDER BY domain`);
 eq(refs.rowCount,2,"exactly two prior synthetic source approvals");
 const member=refs.rows.find(x=>x.domain==="CHILD06_MEMBERSHIP");
 const ledger=refs.rows.find(x=>x.domain==="CHILD07_HOLDINGS");
 eq(member.tenant_id,ledger.tenant_id,"paired fixture is one cooperative");
 eq(member.enabled,false,"membership approval deliberately disabled by older E2E");
 const A=member.tenant_id,M=member.source_ref,L=ledger.source_ref;
 const other=await main.query("SELECT tenant_id FROM tto.tenants WHERE tenant_id<>$1 LIMIT 1",[A]);
 eq(other.rowCount,1,"synthetic alternate tenant exists");
 const B=other.rows[0].tenant_id;
 const baseline=await counts();
 await main.query("BEGIN");inTransaction=true;
 try{
  await test("01-disabled-source-denied",async()=>eq(await valid(A,"CHILD06_MEMBERSHIP",M),false,"disabled source cannot read"));
  await test("02-expired-source-denied",async()=>{
   await main.query("UPDATE tto.source_contract_approvals SET enabled=true WHERE tenant_id=$1 AND domain='CHILD07_HOLDINGS'",[A]);
   eq(await valid(A,"CHILD07_HOLDINGS",L),false,"expired source denied even if enabled");
  });
  await test("03-independent-membership-authority",async()=>{
   await main.query("UPDATE tto.source_contract_approvals SET enabled=true WHERE tenant_id=$1 AND domain='CHILD06_MEMBERSHIP'",[A]);
   eq(await valid(A,"CHILD06_MEMBERSHIP",M),true,"existing CI evidence admits member source only");
   eq(await valid(A,"CHILD07_HOLDINGS",L),false,"membership approval never admits expired holdings");
  });
  await test("04-tenant-cross-scope-denied",async()=>{
   eq(await valid(B,"CHILD06_MEMBERSHIP",M),false,"other cooperative member source denied");
   eq(await valid(B,"CHILD07_HOLDINGS",L),false,"other cooperative ledger denied");
  });
  await test("05-source-domain-swapping-denied",async()=>{
   eq(await valid(A,"CHILD07_HOLDINGS",M),false,"member ref cannot stand in for ledger");
   eq(await valid(A,"CHILD06_MEMBERSHIP",L),false,"ledger ref cannot stand in for membership");
  });
  await test("06-unknown-reference-and-domain-denied",async()=>{
   eq(await valid(A,"CHILD06_MEMBERSHIP","CI-FAKE-UNKNOWN-REF"),false,"forged reference denied");
   eq(await valid(A,"CHILD09_NOTICES",M),false,"unapproved notice domain denied");
  });
  await test("07-expired-membership-source-denied",async()=>{
   await main.query("UPDATE tto.source_contract_approvals SET approved_at=now()-interval '4 hours',valid_until=now()-interval '2 hours' WHERE tenant_id=$1 AND domain='CHILD06_MEMBERSHIP'",[A]);
   eq(await valid(A,"CHILD06_MEMBERSHIP",M),false,"membership approval expired");
  });
  await test("08-time-bounded-independent-reenable-only-in-rollback",async()=>{
   await main.query("UPDATE tto.source_contract_approvals SET approved_at=now()-interval '10 minutes',valid_until=now()+interval '1 hour' WHERE tenant_id=$1 AND domain='CHILD06_MEMBERSHIP'",[A]);
   eq(await valid(A,"CHILD06_MEMBERSHIP",M),true,"bounded synthetic member approval");
   eq(await valid(A,"CHILD07_HOLDINGS",L),false,"holdings still expired");
  });
  await test("09-foreign-tenant-evidence-denied",async()=>{
   const doc=randomUUID(),evidence=randomUUID();
   await main.query("INSERT INTO tto.documents(document_id,tenant_id,title,classification,status) VALUES($1,$2,'Synthetic foreign authority decoy','RESTRICTED','PUBLISHED')",[doc,B]);
   await main.query("INSERT INTO tto.evidence_references(evidence_id,tenant_id,document_id,source_entity_type,source_entity_id) VALUES($1,$2,$3,'CI_PHASE4E', $4)",[evidence,B,doc,randomUUID()]);
   await main.query("UPDATE tto.source_contract_approvals SET evidence_id=$1 WHERE tenant_id=$2 AND domain='CHILD06_MEMBERSHIP'",[evidence,A]);
   eq(await valid(A,"CHILD06_MEMBERSHIP",M),false,"valid evidence in B never licenses A");
   await main.query("UPDATE tto.source_contract_approvals SET evidence_id=$1 WHERE tenant_id=$2 AND domain='CHILD06_MEMBERSHIP'",[member.evidence_id,A]);
   eq(await valid(A,"CHILD06_MEMBERSHIP",M),true,"recover only with A's test evidence");
  });
  await test("10-revoked-ledger-and-parent-gates-stay-independent",async()=>{
   await main.query("UPDATE tto.source_contract_approvals SET approved_at=now()-interval '10 minutes',valid_until=now()+interval '1 hour' WHERE tenant_id=$1 AND domain='CHILD07_HOLDINGS'",[A]);
   eq(await valid(A,"CHILD07_HOLDINGS",L),true,"synthetic Child07 review gate can be checked");
   await main.query("UPDATE tto.source_contract_approvals SET enabled=false WHERE tenant_id=$1 AND domain='CHILD07_HOLDINGS'",[A]);
   eq(await valid(A,"CHILD07_HOLDINGS",L),false,"revocation denies ledger");
   eq(await valid(A,"CHILD06_MEMBERSHIP",M),true,"member approval independent");
  });
  await test("11-read-only-admission-is-not-promotion",async()=>{
   const r=await main.query(`
    SELECT c.claim_id,tto.assess_source_import_claim(c.claim_id) AS verdict
    FROM tto.source_import_claims c
    JOIN tto.source_import_batches b ON b.batch_id=c.batch_id
    WHERE b.tenant_id=$1 AND b.domain='CHILD07_HOLDINGS'
    ORDER BY c.claim_id LIMIT 1`,[A]);
   ok(r.rowCount>0,"prior synthetic claim exists");
   ok(typeof r.rows[0].verdict==="string","assessment returns verdict only");
   const again=await main.query("SELECT tto.assess_source_import_claim($1) AS verdict",[r.rows[0].claim_id]);
   eq(again.rows[0].verdict,r.rows[0].verdict,"assessment repeat deterministic within same state");
   eq(await counts(),baseline,"assessment and authority toggles create zero ledger changes");
  });
  await test("12-unknown-claim-does-not-create-account",async()=>{
   const r=await main.query("SELECT tto.assess_source_import_claim($1) AS verdict",[randomUUID()]);
   eq(r.rows[0].verdict,"UNKNOWN_CLAIM","unknown claim never admitted");
   eq(await counts(),baseline,"unknown claim cannot mutate source ledger");
  });
  await app.connect();appConnected=true;
  await test("13-app-cannot-read-source-approvals",async()=>denied("SELECT * FROM tto.source_contract_approvals LIMIT 1"));
  await test("14-app-cannot-write-source-approvals",async()=>denied("UPDATE tto.source_contract_approvals SET enabled=true WHERE tenant_id=$1",[A]));
  await test("15-app-cannot-read-import-batches",async()=>denied("SELECT * FROM tto.source_import_batches LIMIT 1"));
  await test("16-app-cannot-write-import-claims",async()=>denied("DELETE FROM tto.source_import_claims WHERE tenant_id=$1",[A]));
  await test("17-app-cannot-call-internal-assessment",async()=>denied("SELECT tto.assess_source_import_claim($1)",[randomUUID()]));
  await test("18-app-cannot-call-approval-gate-directly",async()=>denied("SELECT tto.valid_read_source($1,$2,$3)",[A,"CHILD06_MEMBERSHIP",M]));
  await test("19-unauthenticated-context-denies-membership",async()=>{
   const r=await app.query("SELECT tto.my_member_profile_from_source($1) AS record",[A]);
   eq(r.rows[0].record,null,"no actor context => no membership");
  });
  await test("20-unauthenticated-context-denies-shares",async()=>{
   const r=await app.query("SELECT tto.my_shareholding_from_source($1) AS record",[A]);
   eq(r.rows[0].record,null,"no actor context => no holdings");
  });
  await test("21-snapshot-mutation-protected",async()=>{
   await assert.rejects(()=>main.query("DELETE FROM tto.shareholding_source_snapshots WHERE tenant_id=$1",[A]),e=>String(e?.message??"").includes("immutable")||e.code==="P0001"||e.code==="23503");
   checks++;
  });
  await test("22-quarantine-claims-immutable",async()=>{
   await assert.rejects(()=>main.query("DELETE FROM tto.source_import_claims WHERE tenant_id=$1",[A]),e=>String(e?.message??"").includes("immutable")||e.code==="P0001"||e.code==="23503");
   checks++;
  });
 }finally{
  // A failed SQL operation aborts the tx; ROLLBACK is unconditional and safe.
  await main.query("ROLLBACK");inTransaction=false;
 }
 eq(await counts(),baseline,"whole source-admission review rolled back with zero mutation");
 eq(await valid(A,"CHILD06_MEMBERSHIP",M),false,"member gate remained disabled after rollback");
 eq(await valid(A,"CHILD07_HOLDINGS",L),false,"ledger gate remained expired after rollback");
 console.log("TTO_PHASE4E_PG17_ATTACK_CASES="+cases+"/22");
 console.log("TTO_PHASE4E_PG17_ATTACK_CHECKS="+checks);
 console.log("TTO_PHASE4E_PG17_MUTATIONS_ROLLED_BACK=true");
 console.log("TTO_PHASE4E_NO_REAL_SOURCE_OR_LEGAL_APPROVAL");
 if(cases!==22)throw Error("PHASE4E_CASE_COUNT_MISMATCH");
 console.log("TTO_PHASE4E_REAL_PG17_ATTACK_MATRIX_PASS");
}
run().catch(err=>{console.error("TTO_PHASE4E_ATTACK_MATRIX_FAIL",err?.stack??String(err));process.exitCode=1;})
.finally(async()=>{
 if(inTransaction)await main.query("ROLLBACK").catch(()=>{});
 if(appConnected)await app.end().catch(()=>{});
 if(mainConnected)await main.end().catch(()=>{});
});
