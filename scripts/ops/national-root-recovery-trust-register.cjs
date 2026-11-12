"use strict";
/**
 * Prepare/activate a PRIVATE public-key trust registry on an operator host.
 * Keys cannot be activated with an operator click or self-assertion:
 * two pre-pinned, independent governance authorities must sign the exact
 * canonical certificate bytes on their own devices.
 */
const fs=require("node:fs/promises");
const path=require("node:path");
const {KIND,PROJECT,publicTrustPayload,verifyTrustCertificate}=require("./national-root-recovery-trust-ceremony.cjs");
const MAX=18000;
async function readInput(stream){
 let s="";
 for await(const chunk of stream){
  s+=String(chunk);
  if(Buffer.byteLength(s)>MAX)throw Error("TRUST_CERT_INPUT_EXCEEDS_LIMIT");
 }
 if(!s)throw Error("PRIVATE_TRUST_INPUT_REQUIRED");
 return JSON.parse(s);
}
function safePrivatePath(filename,cwd=process.cwd()){
 if(typeof filename!=="string"||!path.isAbsolute(filename))throw Error("ABSOLUTE_PRIVATE_OUTPUT_PATH_REQUIRED");
 const out=path.resolve(filename),root=path.resolve(cwd);
 if(out===root||out.startsWith(root+path.sep))throw Error("NO_REPOSITORY_TRUST_FILES");
 return out;
}
async function privateWrite(filename,data){
 const target=safePrivatePath(filename);
 const parent=await fs.realpath(path.dirname(target));
 if(parent===path.resolve(process.cwd())||
    parent.startsWith(path.resolve(process.cwd())+path.sep))
  throw Error("TRUST_OUTPUT_PARENT_IS_REPOSITORY");
 const file=await fs.open(target,"wx",0o600);
 try{await file.writeFile(JSON.stringify(data,null,2)+"\n","utf8");await file.sync();}
 finally{await file.close();}
}
function pinsFromEnv(env){
 if(!env.TTO_RECOVERY_AUTHORITY_ONE_PUBLIC_KEY_PEM||
    !env.TTO_RECOVERY_AUTHORITY_TWO_PUBLIC_KEY_PEM)
  throw Error("PREPINNED_GOVERNANCE_AUTHORITY_KEYS_MISSING");
 return {
  authorityOnePublicKeyPem:env.TTO_RECOVERY_AUTHORITY_ONE_PUBLIC_KEY_PEM,
  authorityTwoPublicKeyPem:env.TTO_RECOVERY_AUTHORITY_TWO_PUBLIC_KEY_PEM
 };
}
async function loadValidatedTrustCertificate(filename,env,now=Date.now()){
 const target=safePrivatePath(filename);
 const raw=await fs.readFile(target,"utf8");
 if(Buffer.byteLength(raw)>MAX)throw Error("TRUST_CERT_FILE_TOO_LARGE");
 const cert=JSON.parse(raw);
 const result=verifyTrustCertificate(cert,pinsFromEnv(env),now);
 if(result.state!=="VALIDATED_TRUST_CEREMONY_PREVIEW_ONLY")
  throw Error("TRUST_CERT_UNAPPROVED_OR_EXPIRED");
 return {cert,result};
}
async function main(){
 try{
  if(process.env.CI||process.env.VERCEL||process.env.NODE_ENV==="production"||
     process.env.TTO_ENVIRONMENT!=="preview"||
     process.env.TTO_ISOLATED_DEMO_DB!=="true")
   throw Error("TRUST_CEREMONY_PREVIEW_OPERATOR_ONLY");
  const action=process.argv[2],out=process.env.TTO_RECOVERY_PRIVATE_TRUST_PATH;
  if(!out||!["--prepare","--activate","--status"].includes(action)||process.argv.length!==3)
   throw Error("TRUST_CEREMONY_ACTION_OR_OUTPUT_MISSING");
  if(action==="--prepare"){
   const c=await readInput(process.stdin);
   if(c.kind!==KIND||c.projectRef!==PROJECT||c.environment!=="preview"||
      c.approvals?.length)
    throw Error("TRUST_CANDIDATE_MUST_BE_UNSIGNED");
   // Validate canonical format, not validity or authority; explicit pending.
   publicTrustPayload(c);
   await privateWrite(out,{...c,approvals:[],state:"PENDING_TWO_INDEPENDENT_SIGNATURES"});
   process.stdout.write("TRUST_CANDIDATE_PENDING_OFFLINE_APPROVAL\n");
  }else if(action==="--activate"){
   const c=await readInput(process.stdin);
   const result=verifyTrustCertificate(c,pinsFromEnv(process.env));
   if(result.state!=="VALIDATED_TRUST_CEREMONY_PREVIEW_ONLY")
    throw Error("TWO_EXTERNAL_GOVERNANCE_APPROVALS_NOT_VERIFIED");
   // The receipt of a properly signed key certificate does NOT establish
   // the legal authority of its signers; that is verified out of band.
   await privateWrite(out,{...c,state:"VALIDATED_TRUST_CEREMONY_PREVIEW_ONLY"});
   process.stdout.write("TRUST_PUBLIC_KEYS_REGISTERED_IN_PRIVATE_PREVIEW_FILE\n");
  }else{
   const {result}=await loadValidatedTrustCertificate(out,process.env);
   process.stdout.write("TRUST_CERTIFICATE_VALIDATED_PREVIEW_ONLY "+
    result.otpKeyFingerprint.slice(0,12)+" "+
    result.reviewerKeyFingerprint.slice(0,12)+"\n");
  }
 }catch{
  process.stderr.write("TRUST_CEREMONY_HOLD_OR_INVALID\n");
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={readInput,safePrivatePath,privateWrite,pinsFromEnv,loadValidatedTrustCertificate};
