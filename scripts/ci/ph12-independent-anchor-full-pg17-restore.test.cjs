"use strict";
/* PH12 synthetic: independent durable PG17 anchor; full 75-migration DB backup
 * is restored to a new PG17 instance. Absolutely no hosted DB or real keys.
 */
const test=require("node:test"),assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const {generateKeyPairSync,randomUUID}=require("node:crypto");
const fs=require("node:fs"),path=require("node:path");
const {signedRecord,validateRecoveryWitness,sha256}=
 require("./ph12-synthetic-root-trust-protocol.cjs");
const LAB=process.env.CI==="true"&&process.env.TTO_PH12_MOCK_ISSUER_LAB==="1"&&
 !process.env.DATABASE_URL&&!process.env.TEST_ADMIN_DATABASE_URL&&!process.env.VERCEL;
if(!LAB)throw Error("PH12_INDEPENDENT_ANCHOR_DISPOSABLE_CI_ONLY");
const base="tto-ph12-ind-"+process.ppid+"-"+process.pid;
const main="tto-ph12-legal",restore=base+"-restore",anchor=base+"-anchor",volume=base+"-volume";
const tenant=process.env.PH12_RECOVERY_TENANT||randomUUID();
const entity="SYNTHETIC_INDEPENDENT_RECOVERY";
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const docker=(args,opts={})=>execFileSync("docker",args,
 {encoding:opts.encoding??"utf8",input:opts.input,maxBuffer:30*1024*1024,timeout:90000});
const sql=(name,cmd)=>docker(["exec","-i",name,"psql","-X","-q","-A","-t",
 "-U","postgres","-d","tto","-v","ON_ERROR_STOP=1"],{input:cmd}).trim();
function start(name,vol=null){
 const args=["run","--rm","-d","--name",name,
  "-e","POSTGRES_HOST_AUTH_METHOD=trust","-e","POSTGRES_DB=tto"];
 if(vol)args.push("--mount","type=volume,src="+vol+",dst=/var/lib/postgresql/data");
 args.push("postgres:17-alpine");docker(args);
 for(let i=0;i<75;i++){
  try{if(sql(name,"SELECT 1;")==="1")return;}catch{}
  execFileSync("sleep",["0.2"]);
 }
 throw Error("PH12_PG17_CONTAINER_START_FAILED_"+name);
}
function kill(name){try{docker(["rm","-f",name]);}catch{}}
function anchorRead(name){
 const raw=sql(name,`SELECT witness::text FROM ph12_anchor.signed_highwater
  WHERE tenant_id=${q(tenant)}::uuid AND entity_id=${q(entity)}
  ORDER BY anchor_seq DESC LIMIT 1;`);
 if(!raw)return null;
 return JSON.parse(raw);
}
function primaryState(name){
 const raw=sql(name,`SELECT t.trust_epoch,
 encode(sha256(convert_to(t.public_key_pem,'UTF8')),'hex'),
 c.source_version,c.record_hash,c.revoked
 FROM tto.ph12_mock_lab_trust t JOIN tto.ph12_mock_lab_checkpoints c
  ON t.tenant_id=c.tenant_id
 WHERE t.tenant_id=${q(tenant)}::uuid AND c.entity_id=${q(entity)};`);
 const v=raw.split("|");
 if(v.length!==5)throw Error("PH12_RESTORED_STATE_MISSING");
 return {tenantId:tenant,entityId:entity,trustEpoch:Number(v[0]),
  keyFingerprint:v[1],sourceVersion:Number(v[2]),
  recordHash:v[3],revoked:v[4]==="t"};
}
function independentCheck(restoredName,anchorName,rootPem){
 try{
  const witness=anchorRead(anchorName);
  if(!witness)return "HOLD_NO_DURABLE_ANCHOR";
  const state=primaryState(restoredName);
  const root=require("node:crypto").createPublicKey(rootPem);
  return validateRecoveryWitness(witness,root,state);
 }catch{return "HOLD_INDEPENDENT_ANCHOR_OR_RESTORED_DB_UNAVAILABLE";}
}
if(process.argv[2]==="--independent-verifier"){
 const answer=independentCheck(process.argv[3],process.argv[4],
  Buffer.from(process.env.PH12_ROOT_PEM_B64||"","base64").toString());
 console.log(answer);
 process.exit(answer.startsWith("MOCK_")||answer.startsWith("HOLD_")?0:2);
}
test("PH12 full-schema PG17 restore fenced by an independently persistent signed witness",()=>{
 let restoreStarted=false,anchorStarted=false,volumeCreated=false;
 let originalKilled=false;
 try{
  // Dedicated workflow already installed every real project migration (75)
  // and CI-only lab schema into this disposable instance.
  const migrated=sql(main,`SELECT count(*) FROM pg_tables
   WHERE schemaname='tto' AND tablename LIKE 'ph12_%';`);
  assert.ok(Number(migrated)>=7,"REAL_PH12_TABLES_EXIST_AFTER_ALL_MIGRATIONS");
  docker(["volume","create",volume]);volumeCreated=true;
  start(anchor,volume);anchorStarted=true;
  sql(anchor,fs.readFileSync(
   path.resolve(__dirname,"../../tests/sql/ph12-independent-pg17-anchor-ci.sql"),"utf8"));
  const root=generateKeyPairSync("ed25519");
  const issuerKey=generateKeyPairSync("ed25519");
  const pem=issuerKey.publicKey.export({type:"spki",format:"pem"});
  const keyFingerprint=sha256(pem),oldHash="2".repeat(64),newHash="3".repeat(64);
  const reviewer=randomUUID(),docId=randomUUID(),request=randomUUID();
  // Add synthetic rows to REAL project PH12 issuer candidate and document
  // tables, not only to the lightweight mock bridge tables.
  sql(main,`INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
   VALUES(${q(tenant)}::uuid,${q("ci-ph12-dr-"+process.pid)},
    'CI Synthetic Recovery Cooperative','ACTIVE');
   INSERT INTO tto.user_accounts(user_id) VALUES(${q(reviewer)}::uuid);
   INSERT INTO tto.documents(document_id,tenant_id,title,classification,status)
    VALUES(${q(docId)}::uuid,${q(tenant)}::uuid,
     'CI synthetic PH12 restoration document','RESTRICTED','PUBLISHED');
   INSERT INTO tto.ph12_cooperative_source_issuer_candidates
    (tenant_id,source_purpose,issuer_kind,issuer_label,public_reference,
     legal_basis_reference,proposed_by,request_key)
    VALUES(${q(tenant)}::uuid,'LEGAL_ENTITY_IDENTITY','LEGAL_ENTITY_REGISTRY',
     'CI Synthetic Issuer Candidate','https://example.invalid/ci-ph12',
     'SYNTHETIC-ONLY-CI-NO-LEGAL-AUTHORITY',${q(reviewer)}::uuid,${q(request)}::uuid);
   INSERT INTO tto.ph12_mock_lab_trust
    (tenant_id,issuer_id,key_id,trust_epoch,issuer_url,public_key_pem)
    VALUES(${q(tenant)}::uuid,'PH12_SYNTHETIC_ISSUER_NOT_OFFICIAL',
     'PH12_TEST_ED25519_KEY_01',1,'http://127.0.0.1:31801',${q(pem)});
   INSERT INTO tto.ph12_mock_lab_checkpoints
    (tenant_id,entity_id,source_version,record_hash,revoked,trust_epoch)
    VALUES(${q(tenant)}::uuid,${q(entity)},2,${q(oldHash)},false,1);`);
  const now=Date.now();
  const signed=(version,hash,revoked)=>signedRecord({
   kind:"PH12_SYNTHETIC_WITNESS",tenantId:tenant,entityId:entity,
   trustEpoch:1,keyFingerprint,sourceVersion:version,recordHash:hash,
   revoked,issuedAt:new Date(now-1000).toISOString(),
   expiresAt:new Date(now+280000).toISOString()
  },root.privateKey,"anchor");
  function append(seq,wit){
   // Verify pinned root before submitting; anchor append guard checks
   // monotonic sequence, version and sticky revocation.
   assert.equal(validateRecoveryWitness(wit,root.publicKey,primaryState(main)),
    seq===1?"MOCK_WITNESS_MATCH_LAB_ONLY":"MOCK_HOLD_REVOKED");
   sql(anchor,`INSERT INTO ph12_anchor.signed_highwater
     (tenant_id,entity_id,anchor_seq,trust_epoch,source_version,revoked,witness)
    VALUES(${q(tenant)}::uuid,${q(entity)},${seq},1,
      ${wit.record.sourceVersion},${wit.record.revoked},${q(JSON.stringify(wit))}::jsonb);`);
  }
  const first=signed(2,oldHash,false);append(1,first);
  // A true binary backup of all main-db schemas, roles except ACL ownership;
  // no witness is stored in the main DB or in a local witness file.
  const backup=docker(["exec",main,"pg_dump","-U","postgres","-d","tto","-Fc"],
   {encoding:null});
  assert.ok(Buffer.isBuffer(backup)&&backup.length>10000,"FULL_DB_BINARY_DUMP_CREATED");
  // Revoke AFTER backup. Witness is durably committed to DIFFERENT PG17.
  sql(main,`UPDATE tto.ph12_mock_lab_checkpoints
     SET source_version=3,record_hash=${q(newHash)},revoked=true
     WHERE tenant_id=${q(tenant)}::uuid AND entity_id=${q(entity)};`);
  const revoked=signed(3,newHash,true);append(2,revoked);
  assert.equal(anchorRead(anchor).record.sourceVersion,3);
  assert.throws(()=>sql(anchor,`DELETE FROM ph12_anchor.signed_highwater
    WHERE tenant_id=${q(tenant)}::uuid;`));
  assert.throws(()=>sql(anchor,`INSERT INTO ph12_anchor.signed_highwater
    (tenant_id,entity_id,anchor_seq,trust_epoch,source_version,revoked,witness)
    VALUES(${q(tenant)}::uuid,${q(entity)},3,1,2,false,
      ${q(JSON.stringify(first))}::jsonb);`));
  // Kill both DB processes. Main is NOT restored from its live memory.
  kill(main);originalKilled=true;
  kill(anchor);anchorStarted=false;
  // Anchor has a Docker-managed PERSISTENT VOLUME (not a temp witness file).
  start(anchor,volume);anchorStarted=true;
  assert.equal(anchorRead(anchor).record.sourceVersion,3,
    "ANCHOR_HIGHWATER_SURVIVES_INDEPENDENT_POSTGRES_RESTART");
  start(restore);restoreStarted=true;
  sql(restore,"CREATE ROLE tto_app NOLOGIN;");
  docker(["exec","-i",restore,"pg_restore","--exit-on-error",
    "--no-owner","--no-acl","-U","postgres","-d","tto"],{input:backup});
  const restored=primaryState(restore);
  assert.deepEqual([restored.sourceVersion,restored.revoked],[2,false],
    "FULL_DATABASE_BACKUP_PRECEDES_SIGNED_REVOCATION");
  const full=sql(restore,`SELECT
   (SELECT count(*) FROM tto.ph12_cooperative_source_issuer_candidates
      WHERE tenant_id=${q(tenant)}::uuid),
   (SELECT count(*) FROM tto.documents WHERE tenant_id=${q(tenant)}::uuid),
   (SELECT count(*) FROM tto.ph12_mock_lab_trust_history
      WHERE tenant_id=${q(tenant)}::uuid),
   (SELECT count(*) FROM pg_tables WHERE schemaname='tto'
      AND tablename LIKE 'ph12_%');`);
  const parts=full.split("|").map(Number);
  assert.deepEqual(parts.slice(0,3),[1,1,1]);
  assert.ok(parts[3]>=7,"ALL_REAL_PH12_SCHEMAS_RESTORED");
  // TWO INDEPENDENT OS consumers. Neither trusts local cache or restored DB
  // alone; they read current independent PostgreSQL and verify pinned root.
  const rootPem=root.publicKey.export({type:"spki",format:"pem"});
  const child=()=>execFileSync(process.execPath,
   [__filename,"--independent-verifier",restore,anchor],
   {env:{...process.env,PH12_ROOT_PEM_B64:Buffer.from(rootPem).toString("base64")},
    encoding:"utf8",timeout:20000}).trim();
  assert.equal(child(),"HOLD_RESTORE_BEHIND_SIGNED_WITNESS");
  assert.equal(child(),"HOLD_RESTORE_BEHIND_SIGNED_WITNESS");
  // An unavailable independent authority is HOLD, never fallback to backup.
  kill(anchor);anchorStarted=false;
  assert.equal(child(),"HOLD_INDEPENDENT_ANCHOR_OR_RESTORED_DB_UNAVAILABLE");
  start(anchor,volume);anchorStarted=true;
  assert.equal(child(),"HOLD_RESTORE_BEHIND_SIGNED_WITNESS");
  // Reconcile from separately root-authenticated high-watermark; recovery
  // cannot clear revocation or change any original tariff approval state.
  assert.equal(validateRecoveryWitness(anchorRead(anchor),root.publicKey,restored),
    "HOLD_RESTORE_BEHIND_SIGNED_WITNESS");
  sql(restore,`UPDATE tto.ph12_mock_lab_checkpoints SET
    source_version=3,record_hash=${q(newHash)},revoked=true
    WHERE tenant_id=${q(tenant)}::uuid AND entity_id=${q(entity)};`);
  assert.equal(child(),"MOCK_HOLD_REVOKED");
  assert.equal(child(),"MOCK_HOLD_REVOKED");
  // No public registry, tariff ACTIVE, board/legal approval, or stock ledger.
  assert.equal(sql(restore,`SELECT candidate_state FROM
    tto.ph12_cooperative_source_issuer_candidates WHERE
    tenant_id=${q(tenant)}::uuid;`),"PENDING_ISSUER_AUTHENTICATION");
  console.log("PH12_INDEPENDENT_DURABLE_ANCHOR_FULL_PG17_RESTORE_TWO_CONSUMERS_HOLD_PASS");
 }finally{
  if(restoreStarted)kill(restore);
  if(anchorStarted)kill(anchor);
  if(volumeCreated)try{docker(["volume","rm","-f",volume]);}catch{}
  if(originalKilled)console.log("PH12_DISPOSABLE_PRIMARY_CRASHED_NO_PRODUCTION");
 }
});
