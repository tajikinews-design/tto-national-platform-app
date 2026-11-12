"use strict";
/**
 * PH12: ONE-TIME, SIGNED, PRIVATE OWNER RECOVERY on disposable Preview only.
 * This script MUST NOT be invoked until two independent attestations have been
 * verified out of band: (1) trusted SMS OTP success bound to this exact root
 * and mobile, (2) owner authorization signed by independent reviewer.
 *
 * Never logs credentials, OTP codes, mobile, national ID, DB URL or tokens.
 * Does not run migrations. Does not create another national administrator.
 * No execution in Vercel, CI, production or unaudited databases.
 */
const {createHash}=require("node:crypto");
const {createRequire}=require("node:module");
const {resolve}=require("node:path");
const {createNationalRootInitialScrypt}=require("./national-root-owner-credentials.cjs");
const {signingBytes,verifyOwnerRecoveryEvidence}=require("./national-root-signed-recovery-evidence.cjs");
const {secretValid,verifyConsumedOtpRecoveryBinding}=require("./national-root-recovery-db-proof-binding.cjs");
const INPUT_LIMIT=9000;

async function readPrivateInput(stream){
 let content="";
 for await(const piece of stream){
  content+=String(piece);
  if(content.length>INPUT_LIMIT)throw Error("PRIVATE_RECOVERY_PAYLOAD_TOO_LARGE");
 }
 if(!content)throw Error("PRIVATE_RECOVERY_INPUT_REQUIRED");
 const input=JSON.parse(content);
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("PRIVATE_RECOVERY_INPUT_INVALID");
 return input;
}
function assertEnvironment(env,argv){
 if(argv.length!==3||argv[2]!=="--apply"||
   env.TTO_ISOLATED_DEMO_DB!=="true"||
   env.TTO_ENVIRONMENT!=="preview"||
   env.TTO_PREVIEW_NATIONAL_ROOT_RECOVERY!=="operator-approved"||
   env.NODE_ENV==="production"||env.CI||env.VERCEL||
   env.VERCEL_ENV==="production")
  throw Error("PREVIEW_OPERATOR_RECOVERY_GATE_CLOSED");
 const raw=env.TTO_PREVIEW_DATABASE_URL;
 const dbHost=env.TTO_PREVIEW_APPROVED_DB_HOST;
 const ref=env.TTO_PREVIEW_DB_PROJECT_REF;
 if(typeof raw!=="string"||typeof dbHost!=="string"||
    typeof ref!=="string"||!/^[a-z0-9]{20}$/.test(ref)||
    !raw.startsWith("postgresql://"))
  throw Error("APPROVED_PREVIEW_DATABASE_CONFIGURATION_REQUIRED");
 let u;
 try{u=new URL(raw)}catch{throw Error("APPROVED_PREVIEW_DATABASE_CONFIGURATION_REQUIRED")}
 if(u.hostname!==dbHost||!dbHost.endsWith(".supabase.co")||
    dbHost!=="db."+ref+".supabase.co"||
    env.TTO_PREVIEW_DB_SSL!=="required")
  throw Error("PREVIEW_DATABASE_HOST_TLS_OR_PROJECT_MISMATCH");
 if(!secretValid(env.TTO_RECOVERY_IDENTITY_HMAC_SECRET))
  throw Error("OTP_IDENTITY_BINDING_SECRET_MISSING");
 if(!env.TTO_RECOVERY_OTP_VERIFIER_PUBLIC_KEY_PEM||!env.TTO_RECOVERY_REVIEWER_PUBLIC_KEY_PEM)
  throw Error("INDEPENDENT_PINNED_RECOVERY_TRUST_MISSING");
 return {connectionString:raw,identityHmacSecret:env.TTO_RECOVERY_IDENTITY_HMAC_SECRET,trust:{
  otpVerifierPublicKeyPem:env.TTO_RECOVERY_OTP_VERIFIER_PUBLIC_KEY_PEM,
  reviewerPublicKeyPem:env.TTO_RECOVERY_REVIEWER_PUBLIC_KEY_PEM
 }};
}
function digestReceipt(kind,receipt){
 return createHash("sha256").update(signingBytes(kind,receipt)).update(receipt.signature,"utf8").digest();
}
/** Transaction also revokes every previous session (including root sessions).
 * The OTP signed receipt must have been produced by an approved OTP service,
 * never by this CLI or by the requester. Database role is operator-only.
 */
async function executeAtomicRecovery(db,input,trust,now=Date.now(),identityHmacSecret){
 const review=verifyOwnerRecoveryEvidence(input,trust,now);
 if(review.status!=="SIGNED_EVIDENCE_CHECKED_PREVIEW_ONLY")
  throw Error("RECOVERY_SIGNED_EVIDENCE_REJECTED");
 const o=input.otp,a=input.approval;
 const credential=createNationalRootInitialScrypt({nationalId:o.nationalId,mobile:o.mobile});
 let begun=false;
 try{
  await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  begun=true;
  const roots=await db.query(
   "SELECT r.user_id,r.credentials_version,a.status FROM tto.national_root_accounts r JOIN tto.user_accounts a ON a.user_id=r.user_id WHERE r.singleton=true AND r.revoked_at IS NULL FOR UPDATE OF r,a");
  if(roots.rowCount!==1||roots.rows[0]?.status!=="ACTIVE"||
     roots.rows[0]?.user_id!==o.rootUserId||
     String(roots.rows[0]?.credentials_version)!==String(o.expectedVersion))
   throw Error("ROOT_ID_VERSION_OR_STATUS_CONFLICT");
  // Verify the SAME consumed, delivered OTP proof against the authoritative
  // Preview database while holding the root row lock. No external signed
  // receipt may override a missing, stale, replayed or unrelated challenge.
  await verifyConsumedOtpRecoveryBinding(db,o,identityHmacSecret);
  const reviewer=await db.query(
   "SELECT user_id FROM tto.user_accounts WHERE user_id=$1::uuid AND status='ACTIVE' FOR SHARE",
   [a.reviewerUserId]);
  if(reviewer.rowCount!==1||a.reviewerUserId===o.rootUserId)
   throw Error("APPROVER_NOT_AN_INDEPENDENT_ACTIVE_USER");
  const claimed=await db.query(
   "SELECT user_id,revoked_at FROM tto.verified_mobile_identifiers WHERE mobile=$1 FOR UPDATE",[o.mobile]);
  if(claimed.rowCount>0&&
     (claimed.rowCount!==1||claimed.rows[0].user_id!==o.rootUserId||claimed.rows[0].revoked_at!==null))
   throw Error("MOBILE_IS_LINKED_TO_ANOTHER_OR_REVOKED_USER");
  if(claimed.rowCount===0){
   // OTP success is attested by independent pinned signer, never self-asserted.
   await db.query(
    "INSERT INTO tto.verified_mobile_identifiers(mobile,user_id,verified_at) VALUES($1,$2::uuid,$3::timestamptz)",
    [o.mobile,o.rootUserId,o.verifiedAt]);
  }
  const changed=await db.query(
   "UPDATE tto.national_root_accounts SET username=$1,password_scrypt=$2,must_change_credentials=false,credentials_changed_at=clock_timestamp(),credentials_version=credentials_version+1 WHERE singleton=true AND user_id=$3::uuid AND credentials_version=$4::bigint AND revoked_at IS NULL RETURNING credentials_version",
   [credential.username,credential.passwordScrypt,o.rootUserId,o.expectedVersion]);
  if(changed.rowCount!==1||
     String(changed.rows[0].credentials_version)!==String(BigInt(o.expectedVersion)+1n))
   throw Error("ROOT_RECOVERY_COMPARE_AND_SWAP_FAILED");
  const epoch=await db.query(
   "UPDATE tto.user_accounts SET security_epoch=security_epoch+1 WHERE user_id=$1::uuid AND status='ACTIVE' RETURNING security_epoch",
   [o.rootUserId]);
  if(epoch.rowCount!==1)throw Error("ROOT_SECURITY_EPOCH_INCREMENT_FAILED");
  await db.query(
   "UPDATE tto.user_sessions SET revoked_at=clock_timestamp() WHERE user_id=$1::uuid AND revoked_at IS NULL",
   [o.rootUserId]);
  const audit=await db.query(
   "INSERT INTO tto.national_root_recovery_receipts(recovery_nonce,challenge_id,root_user_id,reviewer_user_id,from_credentials_version,to_credentials_version,mandate_ref,otp_receipt_sha256,approval_receipt_sha256) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::bigint,$6::bigint,$7,$8,$9) RETURNING recovery_nonce",
   [o.nonce,o.challengeId,o.rootUserId,a.reviewerUserId,o.expectedVersion,
    String(BigInt(o.expectedVersion)+1n),a.mandateRef,
    digestReceipt("otp",o),digestReceipt("approval",a)]);
  if(audit.rowCount!==1)throw Error("RECOVERY_AUDIT_WRITE_FAILED");
  await db.query("COMMIT");
  begun=false;
  return {status:"ROOT_RECOVERED_PREVIEW_ONLY",sessionsRevoked:true,rootUserIdPreserved:true};
 }catch(error){
  if(begun)try{await db.query("ROLLBACK")}catch{}
  throw error;
 }
}
async function main(){
 let db;
 try{
  const config=assertEnvironment(process.env,process.argv);
  const input=await readPrivateInput(process.stdin);
  const {Client}=createRequire(resolve(__dirname,"../../services/api/package.json"))("pg");
  db=new Client({connectionString:config.connectionString,ssl:{rejectUnauthorized:true}});
  await db.connect();
  const result=await executeAtomicRecovery(db,input,config.trust,Date.now(),config.identityHmacSecret);
  process.stdout.write(result.status+"\n");
 }catch{
  // Deliberately no DB errors, passwords, receipt details or stack traces.
  process.stderr.write("TTO_PREVIEW_ROOT_RECOVERY_HOLD_OR_FAILED\n");
  process.exitCode=1;
 }finally{if(db)await db.end().catch(()=>{});}
}
if(require.main===module)main();
module.exports={readPrivateInput,assertEnvironment,executeAtomicRecovery};
