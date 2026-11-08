/** Real Vault Transit engine in a disposable local container.
 * Tests real transit/rotate calls and fail closed; NO production KMS/HA signoff.
 */
"use strict";
const assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
if(process.env.CI!=="true"||process.env.TTO_CHILD06_VAULT_LAB!=="true"||
   process.env.TTO_CHILD06_VAULT_ADDR!=="http://127.0.0.1:8200")
 throw Error("CHILD06_VAULT_LAB_CONTEXT_REQUIRED");
const {encryptKmsGovernancePdf,unlockAnyGovernancePdf}=
 require("../../services/api/dist/governance-pdf-envelope.js");
function vault(args){
 const r=spawnSync("docker",["exec","-e","VAULT_ADDR=http://127.0.0.1:8200",
  "-e","VAULT_TOKEN="+process.env.TTO_CHILD06_VAULT_TOKEN,
  "tto-child06-transit", "vault",...args],{encoding:"utf8",timeout:15000});
 if(r.status!==0)throw Error("CHILD06_VAULT_TEST_ADMIN_FAILED_"+String(r.stderr).slice(0,60));
 return r.stdout;
}
async function main(){
 const tenant="00000000-0000-4000-8000-000000000111";
 const evidence="00000000-0000-4000-8000-000000000222";
 const orig=Buffer.from("%PDF-1.7\nVault transit independent data key\n%%EOF\n");
 const a=await encryptKmsGovernancePdf(orig,tenant,evidence);
 const packet={
  evidence_id:evidence,issuer_candidate_id:"00000000-0000-4000-8000-000000000333",
  file_size:orig.length,plaintext_sha256:a.digest,
  aes_gcm_iv:a.iv,aes_gcm_tag:a.tag,encrypted_body:a.encrypted,
  encryption_version:a.version,source_state:"ENCRYPTED_QUARANTINED_UNAUTHENTICATED",
  wrapped_data_key:a.wrapped
 };
 assert.ok(a.wrapped.startsWith("vault:v1:"),"actual Vault transit ciphertext v1");
 assert.ok(!a.encrypted.equals(orig),"storage contains encrypted PDF");
 let restored=await unlockAnyGovernancePdf(packet,tenant);
 assert.ok(restored.equals(orig),"actual vault decrypt v1");
 restored.fill(0);
 vault(["write","-f","transit/keys/child06-pdf/rotate"]);
 const b=await encryptKmsGovernancePdf(orig,tenant,evidence);
 assert.ok(b.wrapped.startsWith("vault:v2:"),"new PDFs use rotated Vault v2 key");
 restored=await unlockAnyGovernancePdf(packet,tenant);
 assert.ok(restored.equals(orig),"old PDFs survive KMS key rotation");
 restored.fill(0);
 const newer={...packet,encrypted_body:b.encrypted,plaintext_sha256:b.digest,
  aes_gcm_iv:b.iv,aes_gcm_tag:b.tag,wrapped_data_key:b.wrapped};
 restored=await unlockAnyGovernancePdf(newer,tenant);
 assert.ok(restored.equals(orig),"new PDF unwraps after rotation");
 restored.fill(0);
 await assert.rejects(()=>unlockAnyGovernancePdf(packet,
  "00000000-0000-4000-8000-000000000444"),"tenant AAD prevents cross-tenant replay");
 await assert.rejects(()=>unlockAnyGovernancePdf({...packet,
  wrapped_data_key:"vault:v2:invalid=="},tenant),"invalid wrapped DEK denied");
 vault(["write","transit/keys/child06-pdf/config","min_decryption_version=2"]);
 await assert.rejects(()=>unlockAnyGovernancePdf(packet,tenant),
   "retired root-key version fails closed (data loss risk; no legal key destruction)");
 restored=await unlockAnyGovernancePdf(newer,tenant);
 restored.fill(0);
 console.log("CHILD06_REAL_VAULT_TRANSIT_ROTATION_REVOKED_VERSION_FAIL_CLOSED_PASS");
}
main().catch(e=>{console.error("CHILD06_VAULT_KMS_GATE_FAILED",e.message);process.exitCode=1;});
