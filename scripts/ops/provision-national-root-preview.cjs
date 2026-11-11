"use strict";
/**
 * ONE-TIME NATIONAL ROOT PROVISIONING — ISOLATED PREVIEW ONLY.
 *
 * Input: private JSON on stdin, never CLI args/commits/logs:
 * { "userId": UUID, "approvedBy": UUID, "approvalEvidenceRef": "<independent reference>",
 *   "nationalId": "<10 digits>", "mobile": "<09 + 9 digits>" }
 *
 * Requires pre-existing ACTIVE user and OTP-verified mobile already bound to
 * that user. This tool does NOT fabricate mobile verification or users,
 * does not run migrations, and never overwrites an existing national root.
 * A human operator must independently validate the approver/evidence outside
 * this script. Absence of that review means DO NOT RUN --apply.
 */
const {createRequire}=require("node:module");
const {resolve}=require("node:path");
const {createNationalRootInitialScrypt}=require("./national-root-owner-credentials.cjs");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function readPrivateInput(){
 let source="";
 for await(const chunk of process.stdin){
  source+=String(chunk);
  if(source.length>1800)throw Error("INPUT_TOO_LARGE");
 }
 if(!source)throw Error("PRIVATE_STDIN_REQUIRED");
 const value=JSON.parse(source);
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("INVALID_INPUT");
 if(!UUID.test(value.userId)||!UUID.test(value.approvedBy)||
    value.userId===value.approvedBy||
    typeof value.approvalEvidenceRef!=="string"||
    !/^[a-zA-Z0-9._:-]{12,128}$/.test(value.approvalEvidenceRef))
   throw Error("INDEPENDENT_APPROVAL_REFERENCE_REQUIRED");
 return value;
}
async function main(){
 if(process.argv.length!==3||process.argv[2]!=="--apply"||
    process.env.TTO_ISOLATED_DEMO_DB!=="true"||
    process.env.TTO_PREVIEW_OWNER_BOOTSTRAP!=="explicitly-approved"||
    process.env.TTO_ENVIRONMENT!=="preview"||
    process.env.NODE_ENV==="production"||
    process.env.VERCEL||
    process.env.CI)
   throw Error("OWNER_BOOTSTRAP_PREVIEW_APPROVAL_GATE_CLOSED");
 const url=process.env.TTO_PREVIEW_DATABASE_URL;
 if(!url||!/^postgres(?:ql)?:\/\//.test(url))throw Error("PRIVATE_PREVIEW_DATABASE_CONNECTION_REQUIRED");
 const input=await readPrivateInput();
 // Validate and hash entirely in memory; never print the identifiers.
 const credential=createNationalRootInitialScrypt(input);
 const {Client}=createRequire(resolve(__dirname,"../../services/api/package.json"))("pg");
 const db=new Client({connectionString:url,ssl:process.env.TTO_PREVIEW_DB_SSL==="required"?{rejectUnauthorized:true}:undefined});
 try{
  await db.connect();
  await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  const owner=await db.query("SELECT user_id FROM tto.user_accounts WHERE user_id=$1 AND status='ACTIVE' FOR UPDATE",[input.userId]);
  const approver=await db.query("SELECT user_id FROM tto.user_accounts WHERE user_id=$1 AND status='ACTIVE'",[input.approvedBy]);
  const verified=await db.query("SELECT user_id FROM tto.verified_mobile_identifiers WHERE user_id=$1 AND mobile=$2 AND verified_at IS NOT NULL",[input.userId,input.mobile]);
  if(owner.rowCount!==1||approver.rowCount!==1||verified.rowCount!==1)
   throw Error("OWNER_IDENTITY_OR_INDEPENDENT_APPROVER_NOT_VERIFIED_IN_DATABASE");
  const root=await db.query("SELECT singleton FROM tto.national_root_accounts WHERE singleton=true FOR UPDATE");
  if(root.rowCount!==0)throw Error("NATIONAL_ROOT_ALREADY_EXISTS_NEVER_OVERWRITE");
  await db.query("INSERT INTO tto.national_root_accounts (singleton,user_id,username,password_scrypt,must_change_credentials,credentials_changed_at,credentials_version) VALUES(true,$1,$2,$3,false,clock_timestamp(),1)",
   [input.userId,credential.username,credential.passwordScrypt]);
  await db.query("COMMIT");
  process.stdout.write("TTO_NATIONAL_ROOT_PREVIEW_OWNER_CREDENTIALS_PROVISIONED_NO_VALUES_LOGGED\n");
 }catch(e){
  try{await db.query("ROLLBACK")}catch{}
  throw e;
 }finally{await db.end().catch(()=>{});}
}
if(require.main===module)main().catch(error=>{
 process.stderr.write("OWNER_BOOTSTRAP_FAILED "+(String(error.message||error).replace(/[0-9]{10,11}/g,"[redacted]"))+"\n");
 process.exitCode=1;
});
module.exports={readPrivateInput};
