"use strict";
/**
 * W2.6 disposable local cryptographic PDP subprocess transport.
 *
 * The PDP's Ed25519 private key is generated only inside the child.
 * Parent independently verifies its signature and pins the public key
 * obtained from that exact subprocess's first startup message.
 *
 * IMPORTANT: Pinning a key from a trusted local child launch is NOT
 * externally authenticated identity / CA / production remote-PDP attestation.
 * No secrets are inherited by child; no shell, Docker, DB, network or deploy.
 */
const {spawn}=require("node:child_process");
const {resolve}=require("node:path");
const {randomUUID}=require("node:crypto");
const {labOnly,keyId,contextDigest,verifyDecision}=require("./w26-signed-policy-protocol.cjs");
const ROOT=resolve(__dirname,"../..");
const CHILD=resolve(__dirname,"w26-independent-pdp-child.cjs");
const MAX_OUTPUT=12*1024,MAX_INPUT=8192;
const counters={started:0,closed:0,aborted:0,rejected:0};
const active=new Set();
function stats(){return Object.freeze({...counters,active:active.size});}
function exact(obj,fields){
 return !!obj&&typeof obj==="object"&&!Array.isArray(obj)&&
  JSON.stringify(Object.keys(obj).sort())===JSON.stringify(fields.sort());
}
function runSignedPdp({
 requestId,context,manifest,publisherPublicPem,signal,evaluatedAtMs,
 delayMs=0,timeoutMs=1200,
 tamperResponse=null,tamperManifest=null,expectedSignerKeyId=null
}={}){
 if(!labOnly()||!(signal instanceof AbortSignal)||
    signal.aborted||typeof requestId!=="string")
  return Promise.reject(Error("W26_PDP_INPUT_DENIED"));
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>2000||
    !Number.isSafeInteger(delayMs)||delayMs<0||delayMs>500)
  return Promise.reject(Error("W26_TIME_INVALID"));
 const nonce=randomUUID();
 let contextHash;
 try{contextHash=contextDigest(context)}catch{
  return Promise.reject(Error("W26_CONTEXT_INVALID"));
 }
 // Non-production adversarial transformations may only run under the lab gate.
 const selectedManifest=typeof tamperManifest==="function"?
  tamperManifest(manifest):manifest;
 const input={
  type:"DECIDE",requestId,nonce,context,
  manifest:selectedManifest,evaluatedAtMs,delayMs
 };
 if(Buffer.byteLength(JSON.stringify(input),"utf8")>MAX_INPUT)
  return Promise.reject(Error("W26_INPUT_TOO_LARGE"));
 const env={
  PATH:process.env.PATH||"/usr/bin:/bin",
  CI:"true",NODE_ENV:"test",TTO_LOOPBACK_E2E:"1",
  TTO_W2_OFFLINE_LAB:"1",TTO_W26_SIGNED_LAB:"1",
  TTO_W26_CHILD:"1",
  // Public test trust root, fixed before any untrusted request is processed.
  TTO_W26_PUBLISHER_PUBLIC_B64:Buffer.from(
    typeof publisherPublicPem==="string"?publisherPublicPem:"","utf8"
  ).toString("base64")
 };
 return new Promise((resolveResult,rejectResult)=>{
  let child,done=false,ready=false,verifiedKey=null,buffer="",bytes=0;
  let deadline;
  function finish(err,value){
   if(done)return;
   done=true;
   clearTimeout(deadline);
   signal.removeEventListener("abort",onAbort);
   if(err){
    counters.rejected++;
    if(child&&!child.killed)child.kill("SIGKILL");
    rejectResult(err);
   }else{
    resolveResult(value);
   }
  }
  function onAbort(){
   counters.aborted++;
   finish(Error("W26_PDP_ABORTED"));
  }
  function receive(line){
   let m;
   try{m=JSON.parse(line)}catch{return finish(Error("W26_PDP_JSON_INVALID"))}
   if(!ready){
    if(!exact(m,["type","publicPem","signerKeyId","protocol"])||
       m.type!=="READY"||
       m.protocol!=="W26_CHILD_SIGNED_DECISION_V0_1"||
       typeof m.publicPem!=="string"||
       typeof m.signerKeyId!=="string")
     return finish(Error("W26_CHILD_BOOTSTRAP_INVALID"));
    try{
     if(m.signerKeyId!==keyId(m.publicPem)||
        (expectedSignerKeyId!==null&&expectedSignerKeyId!==m.signerKeyId))
      throw Error("WRONG_SIGNER");
    }catch{return finish(Error("W26_SIGNER_NOT_PINNED"))}
    // This is a local, per-child ephemeral pinned public key, NOT production
    // externally authenticated public-key distribution.
    verifiedKey={pem:m.publicPem,keyId:m.signerKeyId};
    ready=true;
    try{child.stdin.end(JSON.stringify(input)+"\n");}
    catch{return finish(Error("W26_PDP_INPUT_UNAVAILABLE"))}
    return;
   }
   if(m?.type==="ERROR"&&typeof m.code==="string")
    return finish(Error("W26_CHILD_"+m.code));
   if(!exact(m,["type","signed"])||m.type!=="DECISION")
    return finish(Error("W26_CHILD_REPLY_INVALID"));
   let signed=m.signed;
   if(typeof tamperResponse==="function"){
    try{signed=tamperResponse(signed)}catch{return finish(Error("W26_TAMPER_FIXTURE_INVALID"))}
   }
   const expected={
    requestId,nonce,contextDigest:contextHash,
    policyId:manifest.policyId,revision:manifest.revision,
    digest:manifest.digest,epoch:manifest.epoch,evaluatedAtMs,
    signerKeyId:verifiedKey.keyId
   };
   if(!verifyDecision(signed,verifiedKey.pem,expected))
    return finish(Error("W26_SIGNATURE_OR_BINDING_INVALID"));
   finish(null,Object.freeze({
    signed:Object.freeze({...signed}),signerKeyId:verifiedKey.keyId,
    publicPem:verifiedKey.pem,nonce
   }));
  }
  try{
   child=spawn(process.execPath,[CHILD],{
    cwd:ROOT,env,stdio:["pipe","pipe","pipe"],shell:false,windowsHide:true
   });
  }catch{return finish(Error("W26_CHILD_UNAVAILABLE"))}
  counters.started++;active.add(child);
  child.stdout.on("data",chunk=>{
   if(done)return;
   bytes+=chunk.length;
   if(bytes>MAX_OUTPUT)return finish(Error("W26_CHILD_OUTPUT_TOO_LARGE"));
   buffer+=chunk.toString("utf8");
   let at;
   while(!done&&(at=buffer.indexOf("\n"))!==-1){
    const line=buffer.slice(0,at);
    buffer=buffer.slice(at+1);
    if(line.length>0)receive(line);
   }
  });
  // Sensitive data is never sent to process stdout/stderr logs.
  child.stderr.on("data",()=>{});
  child.stdin.on("error",()=>{});
  child.on("error",()=>finish(Error("W26_CHILD_UNAVAILABLE")));
  child.on("close",code=>{
   active.delete(child);counters.closed++;
   if(!done)finish(Error(code===0?"W26_CHILD_NO_DECISION":"W26_CHILD_EXIT"));
  });
  signal.addEventListener("abort",onAbort,{once:true});
  if(signal.aborted){onAbort();return}
  deadline=setTimeout(()=>finish(Error("W26_PDP_TIMEOUT")),timeoutMs);
 });
}
module.exports={runSignedPdp,stats};
