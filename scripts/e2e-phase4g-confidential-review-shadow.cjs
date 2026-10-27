
"use strict";
// Phase4G: disposable PostgreSQL17 TEMP-only synthetic confidential review tests.
const assert=require("node:assert/strict");
const {randomUUID,createHash}=require("node:crypto");
const {createRequire}=require("node:module"),{resolve}=require("node:path");
const {Client}=createRequire(resolve(__dirname,"../services/api/package.json"))("pg");
const DB="postgresql://postgres@127.0.0.1:5432/tto";
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||
  process.env.TEST_ADMIN_DATABASE_URL!==DB||process.env.APIIR_TOKEN!=="")
 throw Error("PHASE4G_DISPOSABLE_ONLY");
const spec=require("../docs/contracts/shareholder-confidential-intake-phase4g-v1.json");
assert.equal(spec.realEvidenceIngressEnabled,false);
assert.equal(spec.realSourceConnectionEnabled,false);
assert.equal(spec.realApprovalMutationEnabled,false);
const db=new Client({connectionString:DB,connectionTimeoutMillis:9000});
let connected=false,txn=false,cases=0,checks=0;
const equal=(a,b,why)=>{assert.deepEqual(a,b,why);checks++;};
const q=(sql,args=[])=>db.query(sql,args);
async function one(name,fn){await fn();cases++;console.log("PASS Phase4G PG17 "+String(cases).padStart(2,"0")+" "+name);}
const yes="TECHNICAL_REVIEW_PACKET_READY_NOT_LEGAL_APPROVAL";
const no="BLOCKED_NO_REAL_SOURCE_AUTHORITY";
async function verdict(id,tenant,domain,ref){
 const r=await q(`SELECT CASE WHEN EXISTS(
 SELECT 1 FROM pg_temp.phase4g_case c JOIN pg_temp.phase4g_authority a
 ON a.tenant_id=c.tenant_id AND a.domain=c.domain AND a.source_ref=c.source_ref
 WHERE c.id=$1 AND c.tenant_id=$2 AND c.domain=$3 AND c.source_ref=$4
 AND c.status='EXTERNAL_SIGNOFF_REQUIRED' AND NOT c.external_approval AND NOT c.withdrawn
 AND c.valid_until>'2026-10-27T12:00:00Z'::timestamptz
 AND c.reviewed_at<='2026-10-27T12:00:00Z'::timestamptz
 AND c.valid_until<=c.reviewed_at+interval '90 days'
 AND a.active AND NOT a.revoked AND a.reviewer_verified
 AND a.expires_at>'2026-10-27T12:00:00Z'::timestamptz
 AND a.custodian_id<>a.reviewer_id AND c.reviewer_id=a.reviewer_id
 AND (SELECT count(*) FROM pg_temp.phase4g_evidence e WHERE e.case_id=c.id)=7
 AND (SELECT count(DISTINCT evidence_class) FROM pg_temp.phase4g_evidence e WHERE e.case_id=c.id)=7
 AND NOT EXISTS(SELECT 1 FROM pg_temp.phase4g_evidence e WHERE e.case_id=c.id
 AND (e.tenant_id<>c.tenant_id OR e.domain<>c.domain OR e.source_ref<>c.source_ref
 OR e.mimetype<>'application/pdf' OR e.bytes<=0 OR e.bytes>10485760
 OR e.scan_state<>'CLEAN_SYNTHETIC' OR e.authenticity_state<>'MOCK_REVIEWED'
 OR e.digest !~ '^[a-f0-9]{64}$' OR e.classification<>'RESTRICTED'))
 ) THEN 'TECHNICAL_REVIEW_PACKET_READY_NOT_LEGAL_APPROVAL'
 ELSE 'BLOCKED_NO_REAL_SOURCE_AUTHORITY' END AS outcome`,[id,tenant,domain,ref]);
 equal(r.rowCount,1,"single verdict");
 return r.rows[0].outcome;
}
async function mutate(name,stmt,args,fixture){
 await q("SAVEPOINT phase4g_probe");
 try{await q(stmt,args);
 await one(name,async()=>equal(await verdict(fixture.id,fixture.tenant,fixture.domain,fixture.ref),no,name));
 }finally{await q("ROLLBACK TO SAVEPOINT phase4g_probe");await q("RELEASE SAVEPOINT phase4g_probe");}
}
async function main(){
 await db.connect();connected=true;
 const env=await q("SELECT current_database() db,current_user actor,current_setting('server_version_num')::int version");
 equal(env.rows[0].db,"tto","temporary database");equal(env.rows[0].actor,"postgres","test fixture role");
 assert(env.rows[0].version>=170000&&env.rows[0].version<180000);
 const baseline=await q(`SELECT
 (SELECT count(*)::int FROM tto.source_contract_approvals) approvals,
 (SELECT count(*)::int FROM tto.member_source_snapshots) members,
 (SELECT count(*)::int FROM tto.shareholding_source_snapshots) holdings`);
 await q("BEGIN");txn=true;
 try{
 await q(`CREATE TEMP TABLE phase4g_authority(
 tenant_id uuid,domain text,source_ref text,custodian_id uuid,reviewer_id uuid,
 active boolean,revoked boolean,reviewer_verified boolean,expires_at timestamptz
 ) ON COMMIT DROP`);
 await q(`CREATE TEMP TABLE phase4g_case(
 id uuid PRIMARY KEY,tenant_id uuid,domain text,source_ref text,reviewer_id uuid,
 status text,reviewed_at timestamptz,valid_until timestamptz,
 external_approval boolean,withdrawn boolean
 ) ON COMMIT DROP`);
 await q(`CREATE TEMP TABLE phase4g_evidence(
 case_id uuid,tenant_id uuid,domain text,source_ref text,evidence_class text,digest text,
 mimetype text,bytes integer,scan_state text,authenticity_state text,classification text
 ) ON COMMIT DROP`);
 const tenant=randomUUID(),foreign=randomUUID(),fixtures=[];
 for(const d of spec.domains){
  const f={id:randomUUID(),tenant,domain:d.sourceDomain,ref:"PHASE4G-SYN-"+d.sourceDomain,
    owner:randomUUID(),reviewer:randomUUID()};
  fixtures.push(f);
  await q("INSERT INTO phase4g_authority VALUES($1,$2,$3,$4,$5,true,false,true,$6)",
   [tenant,f.domain,f.ref,f.owner,f.reviewer,"2026-12-01T00:00:00Z"]);
  await q("INSERT INTO phase4g_case VALUES($1,$2,$3,$4,$5,'EXTERNAL_SIGNOFF_REQUIRED',$6,$7,false,false)",
   [f.id,tenant,f.domain,f.ref,f.reviewer,"2026-10-25T00:00:00Z","2026-11-25T00:00:00Z"]);
  for(const kind of d.evidenceClasses){
   const hash=createHash("sha256").update(f.domain+kind).digest("hex");
   await q("INSERT INTO phase4g_evidence VALUES($1,$2,$3,$4,$5,$6,'application/pdf',1024,'CLEAN_SYNTHETIC','MOCK_REVIEWED','RESTRICTED')",
    [f.id,tenant,f.domain,f.ref,kind,hash]);
  }
 }
 const [m,l]=fixtures;
 await one("01-member-review",async()=>equal(await verdict(m.id,tenant,m.domain,m.ref),yes,"member"));
 await one("02-holdings-review",async()=>equal(await verdict(l.id,tenant,l.domain,l.ref),yes,"holdings"));
 await one("03-foreign-tenant",async()=>equal(await verdict(m.id,foreign,m.domain,m.ref),no,"tenant"));
 await one("04-cross-domain",async()=>equal(await verdict(m.id,tenant,l.domain,m.ref),no,"domain"));
 await one("05-cross-source",async()=>equal(await verdict(m.id,tenant,m.domain,l.ref),no,"ref"));
 await one("06-unknown-case",async()=>equal(await verdict(randomUUID(),tenant,m.domain,m.ref),no,"case"));
 const attacks=[
 ["07-pending","UPDATE phase4g_case SET status='PENDING' WHERE id=$1",[m.id]],
 ["08-withdrawn","UPDATE phase4g_case SET withdrawn=true WHERE id=$1",[m.id]],
 ["09-expired","UPDATE phase4g_case SET valid_until='2026-10-26' WHERE id=$1",[m.id]],
 ["10-no-self-grant","UPDATE phase4g_case SET external_approval=true WHERE id=$1",[m.id]],
 ["11-custodian-revoked","UPDATE phase4g_authority SET revoked=true WHERE tenant_id=$1 AND domain=$2",[tenant,m.domain]],
 ["12-reviewer-inactive","UPDATE phase4g_authority SET active=false WHERE tenant_id=$1 AND domain=$2",[tenant,m.domain]],
 ["13-reviewer-untrusted","UPDATE phase4g_authority SET reviewer_verified=false WHERE tenant_id=$1 AND domain=$2",[tenant,m.domain]],
 ["14-self-review","UPDATE phase4g_authority SET reviewer_id=custodian_id WHERE tenant_id=$1 AND domain=$2",[tenant,m.domain]],
 ["15-evidence-foreign","UPDATE phase4g_evidence SET tenant_id=$2 WHERE case_id=$1",[m.id,foreign]],
 ["16-evidence-cross-domain","UPDATE phase4g_evidence SET domain=$2 WHERE case_id=$1",[m.id,l.domain]],
 ["17-evidence-type","UPDATE phase4g_evidence SET mimetype='application/octet-stream' WHERE case_id=$1",[m.id]],
 ["18-unchecked-file","UPDATE phase4g_evidence SET scan_state='PENDING' WHERE case_id=$1",[m.id]],
 ["19-forged-hash","UPDATE phase4g_evidence SET digest='INVALID' WHERE case_id=$1",[m.id]],
 ["20-evidence-missing","DELETE FROM phase4g_evidence WHERE case_id=$1 AND evidence_class=$2",[m.id,spec.domains[0].evidenceClasses[0]]]
 ];
 for(const [name,stmt,args] of attacks)await mutate(name,stmt,args,m);
 const after=await q(`SELECT
 (SELECT count(*)::int FROM tto.source_contract_approvals) approvals,
 (SELECT count(*)::int FROM tto.member_source_snapshots) members,
 (SELECT count(*)::int FROM tto.shareholding_source_snapshots) holdings`);
 equal(after.rows[0],baseline.rows[0],"no operational source changes");
 }finally{await q("ROLLBACK");txn=false;}
 const gone=await q("SELECT to_regclass('pg_temp.phase4g_case') AS tbl");
 equal(gone.rows[0].tbl,null,"temp case removed");
 equal(cases,20,"case count");
 console.log("TTO_PHASE4G_REAL_PG17_INTAKE_CASES=20/20");
 console.log("TTO_PHASE4G_REAL_PG17_INTAKE_CHECKS="+checks);
 console.log("TTO_PHASE4G_CONFIDENTIAL_SHADOW_ROLLBACK_PASS");
 console.log("TTO_PHASE4G_REAL_DOCUMENT_UPLOAD=DISABLED");
 console.log("TTO_PHASE4G_REAL_SOURCE_APPROVAL=BLOCKED");
 console.log("TTO_PHASE4G_REAL_PG17_REVIEW_PASS");
}
main().catch(e=>{console.error("PHASE4G_PG17_REVIEW_FAILED",e.stack||String(e));process.exitCode=1;})
.finally(async()=>{if(txn)await q("ROLLBACK").catch(()=>{});if(connected)await db.end().catch(()=>{});});
