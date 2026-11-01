"use strict";
/**
 * W2.6 real, independently signing Node PDP child.
 *
 * PDP signer key pair is generated ONLY INSIDE this separate OS process.
 * Publisher-signed policy is verified BEFORE child evaluates rules. Parent
 * never sees PDP private key. One-shot process, no database or network.
 * Public-key bootstrap is trusted only within this ephemeral local pipe:
 * no externally authenticated certificate or production key provenance.
 */
const crypto=require("node:crypto");
const readline=require("node:readline");
const {labOnly,keyId,contextDigest,verifySignedManifest,
 policyDecision,signDecision,RESPONSE_SCHEMA}=require("./w26-signed-policy-protocol.cjs");
if(!labOnly()||process.env.TTO_W26_CHILD!=="1"||
  process.env.DATABASE_URL||process.env.APIIR_TOKEN||process.env.VERCEL||
  process.env.TTO_API_BASE_URL||process.env.TEST_ADMIN_DATABASE_URL)
 process.exit(92);
const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519");
const publicPem=publicKey.export({format:"pem",type:"spki"}).toString();
const signerKeyId=keyId(publicPem);
// Publisher's *public* trust root is pinned once at process launch, never
// supplied by the untrusted DECIDE payload.
let trustedPublisherPublicPem;
try{
 const encoded=process.env.TTO_W26_PUBLISHER_PUBLIC_B64;
 if(typeof encoded!=="string"||encoded.length>1024)throw Error("MISSING_TRUST_ROOT");
 trustedPublisherPublicPem=Buffer.from(encoded,"base64").toString("utf8");
 keyId(trustedPublisherPublicPem);
}catch{process.exit(93)}
let state="READY";
function emit(o){process.stdout.write(JSON.stringify(o)+"\n")}
emit({type:"READY",publicPem,signerKeyId,protocol:"W26_CHILD_SIGNED_DECISION_V0_1"});
const reader=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
let size=0;
reader.on("line",async line=>{
 if(state!=="READY"){emit({type:"ERROR",code:"ONE_SHOT_ONLY"});return}
 state="BUSY";
 size+=Buffer.byteLength(line,"utf8");
 if(size>8192){emit({type:"ERROR",code:"PDP_INPUT_TOO_LARGE"});process.exitCode=94;reader.close();return}
 let request;
 try{request=JSON.parse(line)}catch{
  emit({type:"ERROR",code:"REQUEST_INVALID"});reader.close();return
 }
 const keys=["type","requestId","nonce","context","manifest",
  "evaluatedAtMs","delayMs"].sort();
 if(!request||Array.isArray(request)||typeof request!=="object"||
    JSON.stringify(Object.keys(request).sort())!==JSON.stringify(keys)||
    request.type!=="DECIDE"||!Number.isSafeInteger(request.delayMs)||
    request.delayMs<0||request.delayMs>500||
    !Number.isSafeInteger(request.evaluatedAtMs)||
    request.evaluatedAtMs<0){
  emit({type:"ERROR",code:"REQUEST_INVALID"});reader.close();return
 }
 const {requestId,nonce,manifest,evaluatedAtMs}=request;
 if(!verifySignedManifest(manifest,trustedPublisherPublicPem)){
  emit({type:"ERROR",code:"POLICY_SIGNATURE_INVALID"});reader.close();return
 }
 if(evaluatedAtMs<manifest.notBeforeMs||evaluatedAtMs>=manifest.expiresAtMs){
  emit({type:"ERROR",code:"POLICY_TIME_INVALID"});reader.close();return
 }
 let contextHash;
 try{contextHash=contextDigest(request.context)}catch{
  emit({type:"ERROR",code:"POLICY_CONTEXT_INVALID"});reader.close();return
 }
 const evaluation=policyDecision(request.context,manifest.ruleset);
 const reply={
  schemaVersion:RESPONSE_SCHEMA,requestId,nonce,
  contextDigest:contextHash,policyId:manifest.policyId,
  revision:manifest.revision,digest:manifest.digest,epoch:manifest.epoch,
  decision:evaluation.decision,reasonCode:evaluation.reasonCode,
  evaluatedAtMs,signerKeyId
 };
 let signed;
 try{signed=signDecision(reply,privateKey)}catch{
  emit({type:"ERROR",code:"RESPONSE_INVALID"});reader.close();return
 }
 if(request.delayMs>0)
  await new Promise(done=>setTimeout(done,request.delayMs));
 emit({type:"DECISION",signed});
 reader.close();
});
// The parent sends exactly one JSONL line followed by EOF. The readline
// close event is NOT authorization to suppress an asynchronous signed reply;
// an in-flight delay may still be pending after stdin has ended.

