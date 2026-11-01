"use strict";
/**
 * W2.6 offline crypto boundary: publisher signs the W2.5 policy, a separate
 * child PDP VERIFIES it, evaluates the actual synthetic rules and signs
 * its own decision. The parent independently verifies a pinned child key.
 *
 * All policy, identity, audit and source operations are disposable synthetic
 * fixtures. No Next production Route or Nest AppModule imports this file.
 */
const {performance}=require("node:perf_hooks");
const {randomUUID}=require("node:crypto");
const {labOnly,makeSignedManifest,verifySignedManifest,
 policyDecision}=require("./w26-signed-policy-protocol.cjs");
const {runSignedPdp}=require("./w26-signed-pdp-gateway.cjs");
const {closeW25DormantBffResult}=require("./w25-synthetic-policy-version-enforcer.cjs");

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function output(requestId,decision,reasonCode,lease=null,touches=0){
 return Object.freeze({
  requestId,decision,reasonCode,policyRevision:lease?.revision??null,
  policyDigest:lease?.digest??null,policyEpoch:lease?.epoch??null,
  sourceTouches:touches,canGrantPermission:false,
  legalOperationalEffect:"NONE",hasActualRecord:false,data:null
 });
}
function bffClose(out){
 // A valid synthetic allow is always a denial to operational callers.
 return closeW25DormantBffResult(out,out?.requestId);
}
async function enforceW26Signed(cfg){
 const id=cfg?.checked?.requestId;
 if(!labOnly())
  return output(UUID.test(id||"")?id:null,"DENY","LAB_DISABLED");
 if(!cfg||cfg.checked?.kind!=="SYNTHETIC_PDP_CANDIDATE"||
    cfg.checked.operation!=="read"||
    !UUID.test(id||"")||
    cfg.checked.context?.environment!=="SIMULATION"||
    !(cfg.checked.signal instanceof AbortSignal)||
    typeof cfg.registry?.issue!=="function"||
    typeof cfg.registry?.check!=="function"||
    typeof cfg.publisher?.privateKey!=="object"||
    typeof cfg.publisher?.publicPem!=="string"||
    typeof cfg.audit?.record!=="function"||
    typeof cfg.versionTrace?.record!=="function"||
    typeof cfg.source?.read!=="function"||
    !cfg.bundle||typeof cfg.bundle!=="object")
  return output(UUID.test(id||"")?id:null,"DENY","ENFORCEMENT_UNAVAILABLE");
 const signal=cfg.checked.signal;
 const registry=cfg.registry;
 const trust=cfg.w27Trust??null;
 if(trust!==null&&(
    process.env.TTO_W27_TRUST_LAB!=="1"||
    typeof trust.checkPublisher!=="function"||
    typeof trust.onSignerReady!=="function"||
    typeof trust.checkSigner!=="function"))
  return output(id,"DENY","TRUST_CONFIG_INVALID");
 let lease=null;
 async function commit(decision,reasonCode,touches=0){
  try{
   cfg.audit.record({requestId:id,phase:"PDP_DECISION",decision,reasonCode});
   cfg.versionTrace.record({
    requestId:id,policyRevision:lease?.revision??null,
    policyDigest:lease?.digest??null,policyEpoch:lease?.epoch??null,
    decision,reasonCode
   });
  }catch{return output(id,"DENY","AUDIT_UNAVAILABLE",lease,touches)}
  return output(id,decision,reasonCode,lease,touches);
 }
 if(signal.aborted)return commit("DENY","REQUEST_ABORTED");
 let issued;
 try{issued=registry.issue()}catch{return commit("DENY","POLICY_REGISTRY_UNAVAILABLE")}
 if(!issued?.ok)return commit("DENY",issued?.reasonCode||"POLICY_UNAVAILABLE");
 lease=issued.lease;
 if(trust!==null&&trust.checkPublisher(cfg.publisher.publicPem)!==true)
  return commit("DENY","PUBLISHER_TRUST_INVALID");
 if(!registry.check(lease)?.ok)return commit("DENY","POLICY_STALE");
 let manifest;
 try{
  manifest=makeSignedManifest(lease,cfg.bundle,
   cfg.publisher.privateKey,cfg.publisher.publicPem);
  if(!verifySignedManifest(manifest,cfg.publisher.publicPem))
   throw Error("WRONG_PUBLISHER_SIGNATURE");
 }catch{return commit("DENY","POLICY_SIGNATURE_INVALID")}
 // The trusted registry is rechecked after the local publisher signature
 // and again on the other side of the child-process await.
 if(!registry.check(lease)?.ok)return commit("DENY","POLICY_STALE");
 const deadlineMs=Number.isSafeInteger(cfg.deadlineMs)&&
  cfg.deadlineMs>=1&&cfg.deadlineMs<=2000?cfg.deadlineMs:1200;
 const deadlineAt=performance.now()+deadlineMs;
 let signed;
 try{
  signed=await runSignedPdp({
   requestId:id,context:cfg.checked.context,manifest,
   publisherPublicPem:cfg.publisher.publicPem,
   evaluatedAtMs:lease.issuedAtMs,signal,
   delayMs:cfg.delayMs??0,timeoutMs:deadlineMs,
   tamperResponse:cfg.tamperResponse??null,
   tamperManifest:cfg.tamperManifest??null,
   expectedSignerKeyId:cfg.expectedSignerKeyId??null,
   onSignerReady:trust?.onSignerReady??null,
   checkSigner:trust?.checkSigner??null
  });
 }catch(error){
  if(signal.aborted)return commit("DENY","REQUEST_ABORTED");
  if(error?.message==="W26_PDP_TIMEOUT"||performance.now()>=deadlineAt)
   return commit("DENY","PDP_TIMEOUT");
  return commit("DENY","PDP_SIGNATURE_OR_TRANSPORT_INVALID");
 }
 if(signal.aborted)return commit("DENY","REQUEST_ABORTED");
 if(performance.now()>=deadlineAt)return commit("DENY","PDP_TIMEOUT");
 const afterPdp=registry.check(lease);
 if(trust!==null&&(
    trust.checkPublisher(cfg.publisher.publicPem)!==true||
    trust.checkSigner({pem:signed.publicPem,keyId:signed.signerKeyId})!==true))
  return commit("DENY","TRUST_REVOKED_OR_EXPIRED");
 if(!afterPdp?.ok)return commit("DENY",afterPdp?.reasonCode||"POLICY_STALE");
 const decision=signed.signed;
 const ownEvaluation=policyDecision(cfg.checked.context,lease.ruleset);
 if(decision.decision!==ownEvaluation.decision||
    decision.reasonCode!==ownEvaluation.reasonCode)
  return commit("DENY","PDP_RULE_EVALUATION_INVALID");
 if(decision.decision!=="SIMULATED_ALLOW")
  return commit("DENY",decision.reasonCode);
 // Both audit sinks must succeed before touching any source fixture.
 const pending=await commit("SIMULATED_ALLOW","SIMULATION_ONLY");
 if(pending.decision!=="SIMULATED_ALLOW")return pending;
 if(signal.aborted)return commit("DENY","REQUEST_ABORTED");
 if(performance.now()>=deadlineAt)return commit("DENY","PDP_TIMEOUT");
 const afterAudit=registry.check(lease);
 if(trust!==null&&(
    trust.checkPublisher(cfg.publisher.publicPem)!==true||
    trust.checkSigner({pem:signed.publicPem,keyId:signed.signerKeyId})!==true))
  return commit("DENY","TRUST_REVOKED_OR_EXPIRED");
 if(!afterAudit?.ok)
  return commit("DENY",afterAudit.reasonCode||"POLICY_STALE");
 let touches=0;
 try{
  // No await between final revision check and isolated fake source counter.
  const fake=cfg.source.read({requestId:id,policyRevision:lease.revision});
  touches++;
  if(!fake||typeof fake!=="object"||Array.isArray(fake)||
     JSON.stringify(Object.keys(fake).sort())!==
      JSON.stringify(["persisted","record","synthetic"])||
     fake.synthetic!==true||fake.record!==null||fake.persisted!==false)
   return output(id,"DENY","FIXTURE_INVALID",lease,touches);
 }catch{
  return output(id,"DENY","FIXTURE_UNAVAILABLE",lease,1);
 }
 return output(id,"SIMULATED_ALLOW","SIMULATION_ONLY",lease,touches);
}
module.exports={enforceW26Signed,bffClose};
