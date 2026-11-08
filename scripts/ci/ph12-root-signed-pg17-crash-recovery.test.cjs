"use strict";
/*
 * Real PostgreSQL17 crash+restore lab using two distinct Docker containers.
 * CI-only synthetic trust. No real issuer keys, production DB or live accounts.
 * Primary: bootstrap -> root-signed rotation -> backup -> revocation -> crash.
 * Recovery: restore older backup -> DENY with independent signed witness ->
 * replay issuer-signed revocation -> remain HOLD.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const {generateKeyPairSync,randomUUID,verify}=require("node:crypto");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {signedEnvelope,canonical}=require("./ph12-mock-official-issuer.cjs");
const {signedRecord,validateRotation,validateRecoveryWitness,sha256}=
 require("./ph12-synthetic-root-trust-protocol.cjs");
if(process.env.TTO_PH12_MOCK_ISSUER_LAB!=="1"||process.env.CI!=="true"||
   process.env.DATABASE_URL||process.env.TEST_ADMIN_DATABASE_URL||
   process.env.VERCEL)throw Error("PH12_TEST_ONLY_NO_HOSTED_DATABASE");
const TENANT=randomUUID(),ENTITY="SYNTHETIC_RECOVERY_ENTITY";
const base="tto-ph12-recovery-"+process.pid;
const primary=base+"-primary",recovered=base+"-recovered";
const schemaFile=path.resolve(__dirname,"../../tests/sql/ph12-mock-issuer-bridge-ci-schema.sql");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ph12-root-recovery-"));
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
function docker(args,{input,encoding="utf8"}={}){
 return execFileSync("docker",args,{input,encoding,maxBuffer:30*1024*1024,timeout:120000});
}
function sql(container,statement){
 return docker(["exec","-i",container,"psql","-X","-v","ON_ERROR_STOP=1",
  "-U","postgres","-d","tto","-A","-t"],{input:statement}).trim();
}
function start(name){
 docker(["run","-d","--rm","--name",name,
   "-e","POSTGRES_HOST_AUTH_METHOD=trust","-e","POSTGRES_DB=tto",
   "postgres:17-alpine"]);
 let last;
 for(let i=0;i<80;i++){
  try{sql(name,"SELECT 1;");return;}catch(e){last=e;execFileSync("sleep",["0.25"]);}
 }
 throw last||Error("PG17_NOT_READY");
}
function stop(name){try{docker(["rm","-f",name]);}catch{}}
function state(container){
 const r=sql(container,`SELECT t.trust_epoch, t.key_id,
 encode(sha256(convert_to(t.public_key_pem,'UTF8')),'hex'),
 c.source_version,c.record_hash,c.revoked,
 (SELECT count(*) FROM tto.ph12_mock_lab_trust_history h
  WHERE h.tenant_id=t.tenant_id)
 FROM tto.ph12_mock_lab_trust t
 JOIN tto.ph12_mock_lab_checkpoints c ON c.tenant_id=t.tenant_id
 WHERE t.tenant_id=${q(TENANT)}::uuid AND c.entity_id=${q(ENTITY)};`);
 const a=r.split("|");
 assert.equal(a.length,7,"TRUST_AND_CHECKPOINT_PRESENT");
 return {tenantId:TENANT,entityId:ENTITY,trustEpoch:Number(a[0]),
  keyId:a[1],keyFingerprint:a[2],sourceVersion:Number(a[3]),
  recordHash:a[4],revoked:a[5]==="t",historyCount:Number(a[6])};
}
test("PH12 actual PG17 forced crash, backup restore and root-signed trust fencing",async t=>{
 let p=false,r=false;
 try{
  start(primary);p=true;
  sql(primary,"CREATE ROLE tto_app NOLOGIN; CREATE SCHEMA tto; CREATE TABLE tto.tenants(tenant_id uuid PRIMARY KEY);");
  sql(primary,fs.readFileSync(schemaFile,"utf8"));
  sql(primary,`INSERT INTO tto.tenants(tenant_id) VALUES (${q(TENANT)}::uuid)`);
  const root=generateKeyPairSync("ed25519");
  const old=generateKeyPairSync("ed25519"),next=generateKeyPairSync("ed25519");
  const pem=k=>k.export({type:"spki",format:"pem"});
  const firstKey=pem(old.publicKey),nextKey=pem(next.publicKey);
  const issuer="PH12_SYNTHETIC_ISSUER_NOT_OFFICIAL";
  const v1hash="1".repeat(64),v2hash="2".repeat(64),v3hash="3".repeat(64);
  const oldUrl="http://127.0.0.1:31801",nextUrl="http://127.0.0.1:31802";
  sql(primary,`INSERT INTO tto.ph12_mock_lab_trust
  (tenant_id,issuer_id,key_id,trust_epoch,issuer_url,public_key_pem)
  VALUES(${q(TENANT)}::uuid,${q(issuer)},
  'PH12_TEST_ED25519_KEY_01',1,${q(oldUrl)},${q(firstKey)})`);
  sql(primary,`INSERT INTO tto.ph12_mock_lab_checkpoints
  (tenant_id,entity_id,source_version,record_hash,revoked,trust_epoch)
  VALUES(${q(TENANT)}::uuid,${q(ENTITY)},1,${q(v1hash)},false,1)`);
  assert.deepEqual([state(primary).trustEpoch,state(primary).historyCount],[1,1]);
  const now=Date.now();
  const requestId=randomUUID();
  const mandate={
   kind:"PH12_SYNTHETIC_ROTATION",tenantId:TENANT,issuerId:issuer,
   keyId:"PH12_TEST_ED25519_KEY_02",trustEpoch:2,issuerUrl:nextUrl,
   publicKeyPem:nextKey,previousKeyFingerprint:sha256(firstKey),
   notBefore:new Date(now-10000).toISOString(),
   expiresAt:new Date(now+220000).toISOString(),requestId
  };
  const prior={tenantId:TENANT,issuerId:issuer,keyId:"PH12_TEST_ED25519_KEY_01",
   trustEpoch:1,publicKeyPem:firstKey,usedKeyIds:["PH12_TEST_ED25519_KEY_01"],
   usedRequestIds:[]};
  const approved=signedRecord(mandate,root.privateKey);
  const evaluate=(env,previous=prior)=>validateRotation(env,root.publicKey,previous,Date.now());
  assert.equal(evaluate(approved),"MOCK_ROOT_MANDATE_VALID_FOR_LAB_ONLY");
  const attacker=generateKeyPairSync("ed25519");
  assert.equal(evaluate(signedRecord(mandate,attacker.privateKey)),"HOLD_BAD_ROOT_SIGNATURE");
  assert.equal(evaluate({...approved,record:{...mandate,trustEpoch:99}}),"HOLD_BAD_ROOT_SIGNATURE");
  assert.equal(evaluate(signedRecord({...mandate,tenantId:randomUUID()},root.privateKey)),
    "HOLD_ROOT_MANDATE_SUBJECT");
  assert.equal(evaluate(signedRecord({...mandate,previousKeyFingerprint:"f".repeat(64)},root.privateKey)),
    "HOLD_ROOT_MANDATE_REPLAY_OR_ROLLBACK");
  assert.equal(evaluate(signedRecord({...mandate,expiresAt:new Date(now-1).toISOString()},root.privateKey)),
    "HOLD_ROOT_MANDATE_EXPIRED");
  assert.equal(evaluate(approved,{...prior,usedRequestIds:[requestId]}),
    "HOLD_ROOT_MANDATE_REPLAY_OR_ROLLBACK");
  assert.equal(evaluate(approved,{...prior,trustEpoch:2}),
    "HOLD_ROOT_MANDATE_REPLAY_OR_ROLLBACK");
  // Only after the pinned offline root verified the exact mandate do we
  // mutate the disposable database. The CI superuser is a trusted test admin.
  sql(primary,`UPDATE tto.ph12_mock_lab_trust SET
   key_id='PH12_TEST_ED25519_KEY_02',trust_epoch=2,
   issuer_url=${q(nextUrl)},public_key_pem=${q(nextKey)}
   WHERE tenant_id=${q(TENANT)}::uuid`);
  sql(primary,`UPDATE tto.ph12_mock_lab_checkpoints SET
   source_version=2,record_hash=${q(v2hash)},trust_epoch=2
   WHERE tenant_id=${q(TENANT)}::uuid AND entity_id=${q(ENTITY)}`);
  assert.deepEqual([state(primary).trustEpoch,state(primary).sourceVersion,
    state(primary).historyCount],[2,2,2]);
  // Negative direct SQL control: trigger forbids old key and epoch rollback.
  assert.throws(()=>sql(primary,`UPDATE tto.ph12_mock_lab_trust
   SET key_id='PH12_TEST_ED25519_KEY_01',trust_epoch=3,public_key_pem=${q(firstKey)}
   WHERE tenant_id=${q(TENANT)}::uuid`));
  assert.throws(()=>sql(primary,`UPDATE tto.ph12_mock_lab_trust
   SET trust_epoch=1 WHERE tenant_id=${q(TENANT)}::uuid`));
  // A genuine custom-format backup of the full tto lab schema (includes PG
  // table contents and immutable trust audit) is taken before the revocation.
  const snapshot=docker(["exec",primary,"pg_dump","-U","postgres",
    "-d","tto","-n","tto","-Fc"],{encoding:null});
  assert.ok(Buffer.isBuffer(snapshot)&&snapshot.length>1000);
  fs.writeFileSync(path.join(dir,"trust-before-revocation.dump"),snapshot,{mode:0o600});
  // The newest signed issuer revocation occurs AFTER backup.
  const revokePayload={issuerId:issuer,tenantId:TENANT,entityId:ENTITY,
   nonce:randomUUID(),version:3,recordHash:v3hash,status:"REVOKED",
   observedAt:new Date(now-1000).toISOString(),
   expiresAt:new Date(now+220000).toISOString()};
  const signedRevoke=signedEnvelope(revokePayload,next.privateKey,
     "PH12_TEST_ED25519_KEY_02");
  function verifyRevocation(msg){
   assert.equal(msg.protectedHeader.kid,"PH12_TEST_ED25519_KEY_02");
   assert.equal(msg.payload.status,"REVOKED");
   assert.equal(msg.payload.tenantId,TENANT);
   assert.equal(msg.payload.entityId,ENTITY);
   return verify(null,Buffer.from(canonical({
    protectedHeader:msg.protectedHeader,payload:msg.payload})),next.publicKey,
    Buffer.from(msg.signature,"base64url"));
  }
  assert.equal(verifyRevocation(signedRevoke),true);
  sql(primary,`UPDATE tto.ph12_mock_lab_checkpoints SET
    source_version=3,record_hash=${q(v3hash)},revoked=true
    WHERE tenant_id=${q(TENANT)}::uuid AND entity_id=${q(ENTITY)}`);
  assert.equal(state(primary).revoked,true);
  // Signed high-watermark outside PostgreSQL: DB backup can be older than
  // this independent witness. It is never stored inside the DB being restored.
  const witnessRecord={kind:"PH12_SYNTHETIC_WITNESS",tenantId:TENANT,entityId:ENTITY,
   trustEpoch:2,keyFingerprint:sha256(nextKey),sourceVersion:3,
   recordHash:v3hash,revoked:true,
   issuedAt:new Date(now-1000).toISOString(),
   expiresAt:new Date(now+220000).toISOString()};
  const witness=signedRecord(witnessRecord,root.privateKey,"anchor");
  const witnessFile=path.join(dir,"independent-root-signed-witness.json");
  fs.writeFileSync(witnessFile,JSON.stringify(witness),{mode:0o600});
  // Forcefully terminate primary PG17; create a different fresh PG17 instance.
  stop(primary);p=false;start(recovered);r=true;
  const dump=fs.readFileSync(path.join(dir,"trust-before-revocation.dump"));
  docker(["exec","-i",recovered,"pg_restore","--no-owner","--no-acl",
    "-U","postgres","-d","tto"],{input:dump});
  let restored=state(recovered);
  assert.deepEqual([restored.trustEpoch,restored.sourceVersion,restored.revoked,
    restored.historyCount],[2,2,false,2]);
  const outOfDb=JSON.parse(fs.readFileSync(witnessFile,"utf8"));
  assert.equal(validateRecoveryWitness(outOfDb,root.publicKey,restored),
   "HOLD_RESTORE_BEHIND_SIGNED_WITNESS");
  assert.equal(validateRecoveryWitness({...outOfDb,record:{...witnessRecord,
    revoked:false}},root.publicKey,restored),"HOLD_WITNESS_SIGNATURE");
  assert.equal(validateRecoveryWitness(outOfDb,attacker.publicKey,restored),
    "HOLD_WITNESS_SIGNATURE");
  // Recover from separately verified signed revocation. "Current" cannot
  // clear this revocation and no tariff gains approval.
  assert.equal(verifyRevocation(signedRevoke),true);
  sql(recovered,`UPDATE tto.ph12_mock_lab_checkpoints SET source_version=3,
   record_hash=${q(v3hash)},revoked=true WHERE
   tenant_id=${q(TENANT)}::uuid AND entity_id=${q(ENTITY)}`);
  restored=state(recovered);
  assert.equal(validateRecoveryWitness(outOfDb,root.publicKey,restored),
    "MOCK_HOLD_REVOKED");
  assert.equal(restored.historyCount,2);
  assert.throws(()=>sql(recovered,`DELETE FROM tto.ph12_mock_lab_trust_history
    WHERE tenant_id=${q(TENANT)}::uuid`));
  console.log("PH12_ROOT_SIGNED_ROTATION_PG17_CRASH_RESTORE_WITNESS_HOLD_PASS");
 }finally{
  if(p)stop(primary);if(r)stop(recovered);
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
