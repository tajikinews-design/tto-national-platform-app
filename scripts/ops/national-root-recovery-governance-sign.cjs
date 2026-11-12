"use strict";
/**
 * OFFLINE authorization of an OTP issuer/reviewer public-key certificate.
 * Must be run on each separate governance authority device, never in CI.
 * Emits ONLY a public signature (not the authority's private key).
 */
const fs=require("node:fs/promises");
const readline=require("node:readline/promises");
const {createPrivateKey,createPublicKey,sign}=require("node:crypto");
const {safePrivatePath,privateWrite}=require("./national-root-recovery-trust-register.cjs");
const {KIND,PROJECT,sameKey,authorityApprovalBytes}=require("./national-root-recovery-trust-ceremony.cjs");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{12}$/i;
function buildAuthorityApproval(cert,role,userId,privateKeyPem,pinnedPublicKeyPem){
 if(!cert||cert.kind!==KIND||cert.projectRef!==PROJECT||cert.environment!=="preview"||
    !["AUTHORITY_ONE","AUTHORITY_TWO"].includes(role)||!UUID.test(userId))
  throw Error("GOVERNANCE_CERT_OR_AUTHORITY_ID_INVALID");
 const key=createPrivateKey(privateKeyPem||"");
 const pk=createPublicKey(key).export({type:"spki",format:"pem"});
 if(key.asymmetricKeyType!=="ed25519"||!sameKey(pk,pinnedPublicKeyPem))
  throw Error("GOVERNANCE_KEY_NOT_PREPINNED");
 return {role,authorityUserId:userId,
  signature:sign(null,authorityApprovalBytes(cert,role,userId),key).toString("base64")};
}
async function main(){
 try{
  if(process.argv.length!==3||!["--authority-one","--authority-two"].includes(process.argv[2])||
     process.env.CI||process.env.VERCEL||process.env.NODE_ENV==="production"||
     process.env.TTO_ENVIRONMENT!=="preview"||
     !process.stdin.isTTY||!process.stdout.isTTY)
   throw Error("INDEPENDENT_OFFLINE_GOVERNANCE_DEVICE_REQUIRED");
  const role=process.argv[2]==="--authority-one"?"AUTHORITY_ONE":"AUTHORITY_TWO";
  const input=safePrivatePath(process.env.TTO_RECOVERY_TRUST_CANDIDATE_PATH);
  const output=safePrivatePath(process.env.TTO_RECOVERY_AUTHORITY_APPROVAL_OUTPUT);
  const raw=await fs.readFile(input,"utf8");
  if(Buffer.byteLength(raw)>14000)throw Error("GOVERNANCE_CANDIDATE_TOO_LARGE");
  const cert=JSON.parse(raw);
  if(cert.kind!==KIND||cert.projectRef!==PROJECT||cert.approvals?.length!==0)
   throw Error("GOVERNANCE_CANDIDATE_NOT_PENDING");
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  let response;
  try{response=await rl.question("پس از احراز مستقل اختیار ثبت کلیدهای این پرونده، عبارت APPROVE-KEYS را وارد کنید: ")}
  finally{rl.close()}
  if(response!=="APPROVE-KEYS")throw Error("GOVERNANCE_REVIEW_NOT_CONFIRMED");
  const pinned=role==="AUTHORITY_ONE"?
   process.env.TTO_RECOVERY_AUTHORITY_ONE_PUBLIC_KEY_PEM:
   process.env.TTO_RECOVERY_AUTHORITY_TWO_PUBLIC_KEY_PEM;
  const approval=buildAuthorityApproval(cert,role,
   process.env.TTO_RECOVERY_GOVERNANCE_AUTHORITY_USER_ID,
   process.env.TTO_RECOVERY_GOVERNANCE_SIGNING_KEY_PEM,pinned);
  await privateWrite(output,approval);
  process.stdout.write("INDEPENDENT_GOVERNANCE_KEY_APPROVAL_FILE_READY\n");
 }catch{
  process.stderr.write("GOVERNANCE_KEY_APPROVAL_HOLD_OR_FAILED\n");process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={buildAuthorityApproval};
