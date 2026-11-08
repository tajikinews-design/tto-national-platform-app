/** CHILD06 disposable PG17 logical backup/restore of encrypted quarantined original.
 * This is NOT an offsite immutable backup or production disaster recovery test.
 */
"use strict";
const assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const {createRequire}=require("node:module");
const {resolve}=require("node:path");
const {Client}=createRequire(resolve(__dirname,"../../services/api/package.json"))("pg");
const {unlockGovernancePdf}=require("../../services/api/dist/governance-pdf-envelope.js");
if(process.env.CI!=="true"||process.env.TTO_PH12_LEGAL_E2E!=="1"||
   process.env.VERCEL||process.env.APIIR_TOKEN||
   process.env.TEST_ADMIN_DATABASE_URL!=="postgresql://postgres@127.0.0.1:5432/tto")
 throw Error("CHILD06_RECOVERY_DISPOSABLE_CI_ONLY");
function docker(args,input){
 const r=spawnSync("docker",args,{input,maxBuffer:64*1024*1024,encoding:null});
 if(r.error||r.status!==0)throw Error("CHILD06_PG_RESTORE_FAILED_"+String(r.status));
 return r.stdout;
}
async function main(){
 const backup=docker(["exec","tto-adaptive-postgres","pg_dump","-U","postgres",
  "-d","tto","-Fc","--no-owner","--no-acl"]);
 assert.ok(backup.length>1000,"nonempty logical backup");
 const name="tto_child06_recovery";
 const original=new Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL});
 let restored;
 try{
  docker(["exec","tto-adaptive-postgres","psql","-U","postgres","-d","postgres",
    "-v","ON_ERROR_STOP=1","-c","CREATE DATABASE "+name]);
  docker(["exec","-i","tto-adaptive-postgres","pg_restore","-U","postgres",
    "-d",name,"--no-owner","--no-acl","--exit-on-error"],backup);
  restored=new Client({connectionString:"postgresql://postgres@127.0.0.1:5432/"+name});
  await Promise.all([original.connect(),restored.connect()]);
  const sourceSQL="SELECT file_id,evidence_id,issuer_candidate_id,file_size,plaintext_sha256,"+
    "aes_gcm_iv,aes_gcm_tag,encrypted_body,encryption_version,source_state "+
    "FROM tto.cooperative_governance_source_files ORDER BY submitted_at LIMIT 1";
  const a=(await original.query(sourceSQL)).rows[0];
  const b=(await restored.query(sourceSQL)).rows[0];
  assert.ok(a&&b&&a.file_id===b.file_id,"restored encrypted original preserved");
  assert.equal(a.encryption_version,"child06-lab-v2","v2 persisted");
  assert.ok(a.encrypted_body.equals(b.encrypted_body)&&
    a.plaintext_sha256.equals(b.plaintext_sha256),"ciphertext unchanged on restore");
  const tenantSQL="SELECT tenant_id FROM tto.cooperative_governance_source_files WHERE file_id=$1";
  const tid=(await restored.query(tenantSQL,[b.file_id])).rows[0].tenant_id;
  process.env.TTO_CHILD06_PDF_ESCROW_KEY_V2_HEX="34".repeat(32);
  let plain=unlockGovernancePdf(b,tid);
  assert.ok(plain.subarray(0,5).equals(Buffer.from("%PDF-")));
  plain.fill(0);
  delete process.env.TTO_CHILD06_PDF_ESCROW_KEY_V2_HEX;
  assert.throws(()=>unlockGovernancePdf(b,tid),
    "wrong or missing key must fail closed after successful restore");
  const scanSQL="SELECT file_id,verdict,scan_id FROM tto.cooperative_governance_pdf_scan_events ORDER BY scanned_at";
  const [oldScan,newScan]=await Promise.all([original.query(scanSQL),restored.query(scanSQL)]);
  assert.deepEqual(newScan.rows,oldScan.rows,"append-only scan receipts survive restore");
  const holdSQL="SELECT file_id,outcome,observation_id FROM tto.cooperative_governance_pdf_source_observations ORDER BY observed_at";
  const [oldHold,newHold]=await Promise.all([original.query(holdSQL),restored.query(holdSQL)]);
  assert.deepEqual(newHold.rows,oldHold.rows,"negative issuer observations survive restore");
  const denied=(await restored.query("SELECT count(*)::integer AS n FROM "+
    "tto.cooperative_governance_pdf_source_observations WHERE official_authenticated=true "+
    "OR signatory_authorized=true OR tariff_activated=true")).rows[0].n;
  assert.equal(denied,0);
  console.log("CHILD06_PDF_LOGICAL_PG17_BACKUP_RESTORE_KEYLOSS_HOLD_PASS");
 }finally{
  backup.fill(0);
  if(restored)await restored.end().catch(()=>{});
  await original.end().catch(()=>{});
  docker(["exec","tto-adaptive-postgres","psql","-U","postgres","-d","postgres",
    "-c","DROP DATABASE IF EXISTS "+name+" WITH (FORCE)"]);
 }
}
main().catch(e=>{console.error("CHILD06_PDF_RESTORE_CHECK_FAILED",e.message);process.exitCode=1;});
