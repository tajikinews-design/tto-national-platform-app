"use strict";
/**
 * Collect two externally signed key approvals on the operator's private host.
 * No 'trust me' flag, no self-issued authority, no public repository output.
 */
const fs=require("node:fs/promises");
const {safePrivatePath,privateWrite,pinsFromEnv}=require("./national-root-recovery-trust-register.cjs");
const {verifyTrustCertificate}=require("./national-root-recovery-trust-ceremony.cjs");
async function assembleApprovedTrustRegistry(candidate,approvalOne,approvalTwo,anchors,now=Date.now()){
 if(!candidate||candidate.approvals?.length!==0||
    approvalOne?.role!=="AUTHORITY_ONE"||approvalTwo?.role!=="AUTHORITY_TWO")
  throw Error("TWO_DISTINCT_OFFLINE_SIGNED_APPROVALS_REQUIRED");
 const result={...candidate,approvals:[approvalOne,approvalTwo]};
 delete result.state;
 const verified=verifyTrustCertificate(result,anchors,now);
 if(verified.state!=="VALIDATED_TRUST_CEREMONY_PREVIEW_ONLY")
  throw Error("TRUST_REGISTRATION_NOT_INDEPENDENTLY_VERIFIED");
 return {cert:{...result,state:"VALIDATED_TRUST_CEREMONY_PREVIEW_ONLY"},fingerprints:verified};
}
async function main(){
 try{
  if(process.argv.length!==3||process.argv[2]!=="--assemble"||
     process.env.CI||process.env.VERCEL||process.env.NODE_ENV==="production"||
     process.env.TTO_ENVIRONMENT!=="preview"||
     process.env.TTO_ISOLATED_DEMO_DB!=="true")
   throw Error("TRUST_REGISTRY_PRIVATE_OPERATOR_REQUIRED");
  const read=async key=>{
   const source=safePrivatePath(process.env[key]);
   const s=await fs.readFile(source,"utf8");
   if(Buffer.byteLength(s)>14000)throw Error("TRUST_REGISTRATION_INPUT_TOO_LARGE");
   return JSON.parse(s);
  };
  const [candidate,a,b]=await Promise.all([
   read("TTO_RECOVERY_TRUST_CANDIDATE_PATH"),
   read("TTO_RECOVERY_AUTHORITY_ONE_APPROVAL_PATH"),
   read("TTO_RECOVERY_AUTHORITY_TWO_APPROVAL_PATH")
  ]);
  const result=await assembleApprovedTrustRegistry(candidate,a,b,pinsFromEnv(process.env));
  await privateWrite(process.env.TTO_RECOVERY_PRIVATE_TRUST_PATH,result.cert);
  process.stdout.write("INDEPENDENTLY_SIGNED_PUBLIC_TRUST_KEYS_REGISTERED_PREVIEW_ONLY "+
   result.fingerprints.otpKeyFingerprint.slice(0,12)+" "+
   result.fingerprints.reviewerKeyFingerprint.slice(0,12)+"\n");
 }catch{process.stderr.write("TRUST_REGISTRY_STILL_HOLD\n");process.exitCode=1;}
}
if(require.main===module)main();
module.exports={assembleApprovedTrustRegistry};
