"use strict";
/** Phase4F actual disposable PG17 SQL policy shadow. No operational tto table writes. */
const assert=require("node:assert/strict");
const {createHash,randomUUID}=require("node:crypto");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {createRequire}=require("node:module");
const {Client}=createRequire(resolve(__dirname,"../services/api/package.json"))("pg");
const URL="postgresql://postgres@127.0.0.1:5432/tto";
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||
process.env.TEST_ADMIN_DATABASE_URL!==URL||process.env.APIIR_TOKEN!==""||
process.env.TTO_PHASE4F_ALLOW_REAL_SOURCE!==undefined)
throw Error("PHASE4F_DISPOSABLE_ONLY");
const old=JSON.parse(readFileSync(resolve(__dirname,"../docs/contracts/shareholder-source-readiness-phase4d-v1.json"),"utf8"));
const policy=JSON.parse(readFileSync(resolve(__dirname,"../docs/contracts/shareholder-legal-source-chain-phase4f-v1.json"),"utf8"));
assert.deepEqual(old.sourceDomains.map(x=>x.evidence.length),[9,10]);
assert.equal(policy.canActivateSource,false);
assert.equal(policy.artifactGrantsRights,false);
assert.equal(policy.externalAuthorityValidated,false);
const db=new Client({connectionString:URL,connectionTimeoutMillis:8000});
let connected=false,txn=false,cases=0,checks=0;
const hash=x=>createHash("sha256").update("PHASE4F_SIMULATED_NOT_A_SIGNATURE:"+x).digest("hex");
async function q(sql,params=[]){return db.query(sql,params);}
function eq(actual,expected,msg){assert.deepEqual(actual,expected,msg);checks++;}
async function scenario(name,fn){await fn();cases++;console.log("PASS Phase4F SQL "+String(cases).padStart(2,"0")+" "+name);}
const blocked="DENIED_PENDING_EXTERNAL_LEGAL_AUTHORITY";
const eligible="SYNTHETIC_CHAIN_REVIEW_ELIGIBLE_ONLY";
async function decide(c,tenant,domain,ref,at="2026-10-26T12:00:00Z"){
 const s=`SELECT CASE WHEN EXISTS (
 SELECT 1 FROM pg_temp.phase4f_case c
 JOIN pg_temp.phase4f_mandate m ON m.id=c.mandate_id
 AND m.tenant_id=c.tenant_id AND m.domain=c.domain AND m.source_ref=c.source_ref AND m.owner_id=c.owner_id
 JOIN pg_temp.phase4f_actor o ON o.id=c.owner_id AND o.tenant_id=c.tenant_id
 AND o.role='AUTHORIZED_SOURCE_CUSTODIAN' AND o.independent_trust AND o.active
 JOIN pg_temp.phase4f_actor r ON r.id=c.reviewer_id AND r.tenant_id=c.tenant_id
 AND r.role='INDEPENDENT_LEGAL_REVIEWER' AND r.independent_trust AND r.active
 JOIN pg_temp.phase4f_actor u ON u.id=c.submitter_id AND u.tenant_id=c.tenant_id
 AND u.role='SOURCE_SUBMITTER' AND u.active
 WHERE c.id=$1 AND c.tenant_id=$2 AND c.domain=$3 AND c.source_ref=$4
 AND c.state='INDEPENDENT_REVIEWED' AND c.withdrawn_at IS NULL
 AND c.owner_id<>c.submitter_id AND c.owner_id<>c.reviewer_id AND c.submitter_id<>c.reviewer_id
 AND c.reviewed_at<= $5::timestamptz
 AND c.approval_until> $5::timestamptz AND c.approval_until<=m.valid_until
 AND c.approval_until<=c.reviewed_at+interval '90 days'
 AND m.valid_from<=c.reviewed_at AND m.valid_from<= $5::timestamptz
 AND m.valid_until> $5::timestamptz AND m.revoked_at IS NULL
 AND m.external_trust AND m.digest ~ '^[0-9a-f]{64}$'
 AND o.valid_until> $5::timestamptz AND r.valid_until> $5::timestamptz
 AND u.valid_until> $5::timestamptz
 AND (SELECT count(*) FROM pg_temp.phase4f_control k WHERE k.domain=c.domain)>0
 AND NOT EXISTS (
 SELECT 1 FROM pg_temp.phase4f_control k
 LEFT JOIN pg_temp.phase4f_evidence e ON e.case_id=c.id AND e.control_id=k.control_id
 WHERE k.domain=c.domain AND (
 e.control_id IS NULL OR e.tenant_id<>c.tenant_id OR e.domain<>c.domain
 OR e.source_ref<>c.source_ref OR e.reviewer_id<>c.reviewer_id
 OR NOT e.external_trust OR e.digest !~ '^[0-9a-f]{64}$'
 OR e.verified_at>c.reviewed_at OR e.verified_at<m.valid_from
 OR e.valid_until<= $5::timestamptz
 ))
 AND NOT EXISTS (
 SELECT 1 FROM pg_temp.phase4f_evidence e LEFT JOIN pg_temp.phase4f_control k
 ON k.domain=c.domain AND k.control_id=e.control_id
 WHERE e.case_id=c.id AND k.control_id IS NULL
 )
 ) THEN 'SYNTHETIC_CHAIN_REVIEW_ELIGIBLE_ONLY'
 ELSE 'DENIED_PENDING_EXTERNAL_LEGAL_AUTHORITY' END AS result`;
 const r=await q(s,[c,tenant,domain,ref,at]);
 eq(r.rowCount,1,"single SQL result");
 return r.rows[0].result;
}
async function mutate(name,sql,values,f){
 await q("SAVEPOINT phase4f_probe");
 try{await q(sql,values);await scenario(name,f);}
 finally{await q("ROLLBACK TO SAVEPOINT phase4f_probe");await q("RELEASE SAVEPOINT phase4f_probe");}
}
async function run(){
 await db.connect();connected=true;
 const v=await q("SELECT current_database() db,current_user actor,current_setting('server_version_num')::int v");
 eq(v.rows[0].db,"tto","disposable db");eq(v.rows[0].actor,"postgres","test-only owner");
 assert(v.rows[0].v>=170000&&v.rows[0].v<180000);
 const baseline=await q(`SELECT
 (SELECT count(*)::int FROM tto.source_contract_approvals) approvals,
 (SELECT count(*)::int FROM tto.member_source_snapshots) members,
 (SELECT count(*)::int FROM tto.shareholding_source_snapshots) holdings,
 (SELECT count(*)::int FROM tto.source_import_claims) claims`);
 await q("BEGIN");txn=true;
 try{
 await q(`CREATE TEMP TABLE phase4f_actor(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,role text NOT NULL,
 active boolean NOT NULL, independent_trust boolean NOT NULL,valid_until timestamptz NOT NULL
 ) ON COMMIT DROP`);
 await q(`CREATE TEMP TABLE phase4f_mandate(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,domain text NOT NULL,source_ref text NOT NULL,
 owner_id uuid NOT NULL REFERENCES phase4f_actor(id),
 valid_from timestamptz NOT NULL,valid_until timestamptz NOT NULL,
 revoked_at timestamptz,external_trust boolean NOT NULL,digest text NOT NULL
 ) ON COMMIT DROP`);
 await q(`CREATE TEMP TABLE phase4f_case(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,domain text NOT NULL,source_ref text NOT NULL,
 mandate_id uuid NOT NULL REFERENCES phase4f_mandate(id),
 submitter_id uuid NOT NULL REFERENCES phase4f_actor(id),
 owner_id uuid NOT NULL REFERENCES phase4f_actor(id),
 reviewer_id uuid NOT NULL REFERENCES phase4f_actor(id),
 state text NOT NULL,reviewed_at timestamptz NOT NULL,
 approval_until timestamptz NOT NULL,withdrawn_at timestamptz
 ) ON COMMIT DROP`);
 await q("CREATE TEMP TABLE phase4f_control(domain text NOT NULL,control_id text NOT NULL,PRIMARY KEY(domain,control_id)) ON COMMIT DROP");
 await q(`CREATE TEMP TABLE phase4f_evidence(
 case_id uuid NOT NULL REFERENCES phase4f_case(id),control_id text NOT NULL,
 tenant_id uuid NOT NULL,domain text NOT NULL,source_ref text NOT NULL,
 reviewer_id uuid NOT NULL REFERENCES phase4f_actor(id),
 external_trust boolean NOT NULL,digest text NOT NULL,
 verified_at timestamptz NOT NULL,valid_until timestamptz NOT NULL,
 PRIMARY KEY(case_id,control_id)
 ) ON COMMIT DROP`);
 const tenant=randomUUID(),foreign=randomUUID(),fx=[];
 for(const d of old.sourceDomains){
  const a={id:randomUUID(),mandate:randomUUID(),tenant,domain:d.domain,
           ref:"PHASE4F-SYNTHETIC-"+d.domain,submitter:randomUUID(),
           owner:randomUUID(),reviewer:randomUUID()};
  fx.push(a);
  for(const [id,role,trusted] of [[a.submitter,"SOURCE_SUBMITTER",false],
  [a.owner,"AUTHORIZED_SOURCE_CUSTODIAN",true],[a.reviewer,"INDEPENDENT_LEGAL_REVIEWER",true]])
   await q("INSERT INTO phase4f_actor VALUES($1,$2,$3,true,$4,$5)",
    [id,tenant,role,trusted,"2027-02-01T00:00:00Z"]);
  await q("INSERT INTO phase4f_mandate VALUES($1,$2,$3,$4,$5,$6,$7,NULL,true,$8)",
   [a.mandate,tenant,a.domain,a.ref,a.owner,"2026-10-01T00:00:00Z","2027-01-01T00:00:00Z",hash(a.domain)]);
  await q("INSERT INTO phase4f_case VALUES($1,$2,$3,$4,$5,$6,$7,$8,'INDEPENDENT_REVIEWED',$9,$10,NULL)",
   [a.id,tenant,a.domain,a.ref,a.mandate,a.submitter,a.owner,a.reviewer,"2026-10-25T00:00:00Z","2026-11-25T00:00:00Z"]);
  for(const control of d.evidence){
   await q("INSERT INTO phase4f_control VALUES($1,$2)",[a.domain,control.controlId]);
   await q("INSERT INTO phase4f_evidence VALUES($1,$2,$3,$4,$5,$6,true,$7,$8,$9)",
    [a.id,control.controlId,tenant,a.domain,a.ref,a.reviewer,hash(a.domain+control.controlId),
    "2026-10-24T00:00:00Z","2026-11-30T00:00:00Z"]);
  }
 }
 const [a,b]=fx,check=x=>decide(x.id,x.tenant,x.domain,x.ref);
 async function deny(x,msg){eq(await x(),blocked,msg);}
 await scenario("01-separate-child06-chain",async()=>eq(await check(a),eligible,"metadata review only"));
 await scenario("02-separate-child07-chain",async()=>eq(await check(b),eligible,"metadata review only"));
 await scenario("03-cross-tenant",()=>deny(()=>decide(a.id,foreign,a.domain,a.ref),"tenant"));
 await scenario("04-domain-swap",()=>deny(()=>decide(a.id,tenant,b.domain,a.ref),"domain"));
 await scenario("05-ref-swap",()=>deny(()=>decide(a.id,tenant,a.domain,b.ref),"source"));
 await scenario("06-unknown-case",()=>deny(()=>decide(randomUUID(),tenant,a.domain,a.ref),"case"));
 await scenario("07-expired-evaluation-time",()=>deny(()=>decide(a.id,tenant,a.domain,a.ref,"2026-12-01T00:00:00Z"),"expiry"));
 const attacks=[
 ["08-pending-review","UPDATE phase4f_case SET state='PENDING' WHERE id=$1",[a.id]],
 ["09-withdrawn-case","UPDATE phase4f_case SET withdrawn_at=now() WHERE id=$1",[a.id]],
 ["10-revoked-mandate","UPDATE phase4f_mandate SET revoked_at=now() WHERE id=$1",[a.mandate]],
 ["11-expired-mandate","UPDATE phase4f_mandate SET valid_until='2026-10-20' WHERE id=$1",[a.mandate]],
 ["12-source-custodian-swap","UPDATE phase4f_case SET owner_id=$2 WHERE id=$1",[a.id,b.owner]],
 ["13-requester-self-review","UPDATE phase4f_case SET reviewer_id=submitter_id WHERE id=$1",[a.id]],
 ["14-owner-self-review","UPDATE phase4f_case SET reviewer_id=owner_id WHERE id=$1",[a.id]],
 ["15-custodian-unverified","UPDATE phase4f_actor SET independent_trust=false WHERE id=$1",[a.owner]],
 ["16-reviewer-unverified","UPDATE phase4f_actor SET independent_trust=false WHERE id=$1",[a.reviewer]],
 ["17-reviewer-revoked","UPDATE phase4f_actor SET active=false WHERE id=$1",[a.reviewer]],
 ["18-reviewer-wrong-role","UPDATE phase4f_actor SET role='SOURCE_SUBMITTER' WHERE id=$1",[a.reviewer]],
 ["19-control-missing","DELETE FROM phase4f_evidence WHERE case_id=$1 AND control_id=$2",[a.id,old.sourceDomains[0].evidence[0].controlId]],
 ["20-evidence-cross-tenant","UPDATE phase4f_evidence SET tenant_id=$2 WHERE case_id=$1",[a.id,foreign]],
 ["21-evidence-domain-swap","UPDATE phase4f_evidence SET domain=$2 WHERE case_id=$1",[a.id,b.domain]],
 ["22-evidence-self-verified","UPDATE phase4f_evidence SET reviewer_id=$2 WHERE case_id=$1",[a.id,a.submitter]],
 ["23-malformed-digest","UPDATE phase4f_evidence SET digest='FAKE' WHERE case_id=$1",[a.id]],
 ["24-expired-evidence","UPDATE phase4f_evidence SET valid_until='2026-10-20' WHERE case_id=$1",[a.id]],
 ["25-late-evidence-review","UPDATE phase4f_evidence SET verified_at='2026-10-26' WHERE case_id=$1",[a.id]],
 ["26-approval-outlives-mandate","UPDATE phase4f_case SET approval_until='2027-02-01' WHERE id=$1",[a.id]],
 ["27-mandate-cross-domain","UPDATE phase4f_mandate SET domain=$2 WHERE id=$1",[a.mandate,b.domain]],
 ["28-mandate-false-trust","UPDATE phase4f_mandate SET external_trust=false WHERE id=$1",[a.mandate]],
 ["29-mandate-invalid-digest","UPDATE phase4f_mandate SET digest='FAKE' WHERE id=$1",[a.mandate]],
 ["30-owner-expired","UPDATE phase4f_actor SET valid_until='2026-10-20' WHERE id=$1",[a.owner]],
 ["31-reviewer-expired","UPDATE phase4f_actor SET valid_until='2026-10-20' WHERE id=$1",[a.reviewer]]
 ];
 for(const [name,statement,args] of attacks)
  await mutate(name,statement,args,()=>deny(()=>check(a),name));
 await scenario("32-no-cross-source-chain-side-effects",async()=>{
  eq(await check(a),eligible,"member independently valid");
  eq(await check(b),eligible,"ledger independently valid");
 });
 const live=await q(`SELECT
 (SELECT count(*)::int FROM tto.source_contract_approvals) approvals,
 (SELECT count(*)::int FROM tto.member_source_snapshots) members,
 (SELECT count(*)::int FROM tto.shareholding_source_snapshots) holdings,
 (SELECT count(*)::int FROM tto.source_import_claims) claims`);
 eq(live.rows[0],baseline.rows[0],"no tto source tables changed");
 }finally{await q("ROLLBACK");txn=false;}
 const gone=await q("SELECT to_regclass('pg_temp.phase4f_case') AS c");
 eq(gone.rows[0].c,null,"temporary legal model destroyed");
 eq(cases,32,"all adversarial PG17 cases");
 console.log("TTO_PHASE4F_REAL_PG17_AUTHORITY_CASES=32/32");
 console.log("TTO_PHASE4F_REAL_PG17_CHECKS="+checks);
 console.log("TTO_PHASE4F_SOURCE_CHAIN_ROLLBACK_PASS");
 console.log("TTO_PHASE4F_REAL_LEGAL_APPROVAL=BLOCKED");
 console.log("TTO_PHASE4F_REAL_PG17_SHADOW_PASS");
}
run().catch(e=>{console.error("TTO_PHASE4F_SHADOW_FAILED",e.stack||String(e));process.exitCode=1;})
.finally(async()=>{if(txn)await q("ROLLBACK").catch(()=>{});if(connected)await db.end().catch(()=>{});});
