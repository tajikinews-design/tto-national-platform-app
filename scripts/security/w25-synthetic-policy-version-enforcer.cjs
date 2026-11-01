"use strict";
/**
 * W2.5 OFFLINE policy-version enforcement around W2.2's cancellable PDP.
 * This is a detached lab orchestrator; it is never a production route.
 * Uses independently issued in-memory policy lease, not user-supplied values.
 * A PDP transport adapter's echoed version is NOT a signed PDP attestation.
 */
const {validDecision}=require("./w2-inline-synthetic-enforcer.cjs");
const {runW22CancellablePDP}=require("./w2-2-cancellable-pdp-provider.cjs");
const {enabled,POLICY_ID}=require("./w25-synthetic-policy-registry.cjs");
const {performance}=require("node:perf_hooks");

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESPONSE_KEYS=["policyId","revision","digest","epoch","verdict"].sort();
const TRACE_KEYS=["requestId","policyRevision","policyDigest","policyEpoch","decision","reasonCode"].sort();
const DENIAL="DENY";
const NO_SOURCE={synthetic:true,record:null,persisted:false};
function record(v){return v!==null&&typeof v==="object"&&!Array.isArray(v);}
function exact(v,keys){return record(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify(keys);}
function safeTrace(e){
 return exact(e,TRACE_KEYS)&&typeof e.requestId==="string"&&UUID.test(e.requestId)&&
  (e.policyRevision===null||Number.isSafeInteger(e.policyRevision))&&
  (e.policyDigest===null||/^[a-f0-9]{64}$/.test(e.policyDigest))&&
  (e.policyEpoch===null||Number.isSafeInteger(e.policyEpoch))&&
  (e.decision==="DENY"||e.decision==="SIMULATED_ALLOW")&&
  typeof e.reasonCode==="string"&&/^[A-Z][A-Z0-9_]{1,59}$/.test(e.reasonCode);
}
class SyntheticVersionTrace{
 #rows=[];
 record(event){
  if(!enabled()||!safeTrace(event))throw Error("VERSION_TRACE_INVALID");
  this.#rows.push(Object.freeze({...event}));
 }
 snapshot(){return Object.freeze(this.#rows.map(e=>Object.freeze({...e})));}
}
/**
 * Intentionally *test-only* version-binding adapter over the accepted W1
 * Python simulation executed by W2.2's real cancellable child process.
 * The returned version/digest/epoch are constructed by this server-side lab
 * adapter after PDP returns; they are not cryptographic proof from PDP.
 */
async function bindW25SyntheticPDP({operation,context,lease,signal}){
 if(!enabled()||operation!=="read"||!(signal instanceof AbortSignal))
  throw Error("LAB_DISABLED");
 const verdict=await runW22CancellablePDP(operation,context,{signal});
 return {
  policyId:lease.policyId,revision:lease.revision,
  digest:lease.digest,epoch:lease.epoch,verdict
 };
}
function output(requestId,decision,reasonCode,lease,touches=0){
 return Object.freeze({
  requestId,decision,reasonCode,
  policyRevision:lease?.revision??null,
  policyDigest:lease?.digest??null,
  policyEpoch:lease?.epoch??null,
  sourceTouches:touches,canGrantPermission:false,
  legalOperationalEffect:"NONE",hasActualRecord:false,data:null
 });
}
async function enforceW25Revision(cfg){
 const requestId=cfg?.checked?.requestId;
 if(!enabled())return output(UUID.test(requestId||"")?requestId:null,DENIAL,"LAB_DISABLED",null);
 if(!cfg||cfg.checked?.kind!=="SYNTHETIC_PDP_CANDIDATE"||
    cfg.checked.operation!=="read"||
    !UUID.test(requestId||"")||
    cfg.checked.context?.environment!=="SIMULATION"||
    !(cfg.checked.signal instanceof AbortSignal)||
    typeof cfg.registry?.issue!=="function"||
    typeof cfg.registry?.check!=="function"||
    typeof cfg.provider!=="function"||
    typeof cfg.audit?.record!=="function"||
    typeof cfg.versionTrace?.record!=="function"||
    typeof cfg.source?.read!=="function")
  return output(UUID.test(requestId||"")?requestId:null,DENIAL,"ENFORCEMENT_UNAVAILABLE",null);
 const audit=cfg.audit,trace=cfg.versionTrace,registry=cfg.registry;
 const rootSignal=cfg.checked.signal;
 let lease=null;
 async function commit(decision,reasonCode,touches=0){
  try{
   const evidence={
    requestId,policyRevision:lease?.revision??null,
    policyDigest:lease?.digest??null,policyEpoch:lease?.epoch??null,
    decision,reasonCode
   };
   if(!safeTrace(evidence))throw Error("BAD_TRACE");
   audit.record({requestId,phase:"PDP_DECISION",decision,reasonCode});
   trace.record(evidence);
  }catch{return output(requestId,DENIAL,"AUDIT_UNAVAILABLE",lease,touches);}
  return output(requestId,decision,reasonCode,lease,touches);
 }
 if(rootSignal.aborted)return commit(DENIAL,"REQUEST_ABORTED");
 let issued;
 try{issued=registry.issue()}catch{return commit(DENIAL,"POLICY_REGISTRY_UNAVAILABLE")}
 if(!issued?.ok)return commit(DENIAL,issued?.reasonCode||"POLICY_UNAVAILABLE");
 lease=issued.lease;
 const current=registry.check(lease);
 if(!current?.ok)return commit(DENIAL,current?.reasonCode||"POLICY_UNAVAILABLE");
 const deadline=Number.isSafeInteger(cfg.deadlineMs)&&
  cfg.deadlineMs>=1&&cfg.deadlineMs<=2000?cfg.deadlineMs:350;
 const expiresAt=performance.now()+deadline;
 const ctl=new AbortController();
 let timedOut=false,disconnected=false,timer,onDisconnect;
 const timeoutPromise=new Promise((_,reject)=>{
  timer=setTimeout(()=>{
   timedOut=true;ctl.abort();reject(Error("PDP_TIMEOUT"));
  },deadline);
 });
 const aborted=new Promise((_,reject)=>{
  onDisconnect=()=>{
   disconnected=true;ctl.abort();reject(Error("REQUEST_ABORTED"));
  };
  rootSignal.addEventListener("abort",onDisconnect,{once:true});
 });
 let response;
 try{
  response=await Promise.race([
   Promise.resolve().then(()=>cfg.provider({
    operation:"read",context:cfg.checked.context,lease,signal:ctl.signal
   })),
   timeoutPromise,aborted
  ]);
 }catch{
  ctl.abort();
  if(disconnected||rootSignal.aborted)return commit(DENIAL,"REQUEST_ABORTED");
  if(timedOut||performance.now()>=expiresAt)return commit(DENIAL,"PDP_TIMEOUT");
  return commit(DENIAL,"PDP_UNAVAILABLE");
 }finally{
  clearTimeout(timer);
  rootSignal.removeEventListener("abort",onDisconnect);
 }
 if(rootSignal.aborted||disconnected)return commit(DENIAL,"REQUEST_ABORTED");
 if(timedOut||performance.now()>=expiresAt){ctl.abort();return commit(DENIAL,"PDP_TIMEOUT");}
 // Authoritative registry is checked again AFTER the awaited, potentially
 // stale response, regardless of whether the provider echoed an old token.
 const afterPdp=registry.check(lease);
 if(!afterPdp?.ok)return commit(DENIAL,afterPdp?.reasonCode||"POLICY_UNAVAILABLE");
 if(!exact(response,RESPONSE_KEYS)||response.policyId!==POLICY_ID||
    response.policyId!==lease.policyId||
    response.revision!==lease.revision||
    response.digest!==lease.digest||
    response.epoch!==lease.epoch||
    !validDecision(response.verdict))
  return commit(DENIAL,"POLICY_RESPONSE_MISMATCH");
 if(response.verdict.decision!=="SIMULATED_ALLOW")
  return commit(DENIAL,response.verdict.reasonCode);
 // Audit BEFORE any synthetic source access; the journal is an allowlisted
 // metadata-only in-memory companion to W2.4's unmodified file hash chain.
 const positive=await commit("SIMULATED_ALLOW","SIMULATION_ONLY");
 if(positive.decision!=="SIMULATED_ALLOW")return positive;
 if(rootSignal.aborted)return commit(DENIAL,"REQUEST_ABORTED");
 if(performance.now()>=expiresAt)return commit(DENIAL,"PDP_TIMEOUT");
 // Defend revocation/replacement/expiry during audit callback.
 const afterAudit=registry.check(lease);
 if(!afterAudit?.ok)
  return commit(DENIAL,afterAudit?.reasonCode||"POLICY_UNAVAILABLE");
 let touches=0;
 try{
  // There is deliberately no await between final revision validation and this
  // synchronous synthetic source read. No real data adapter can be injected
  // through this unregistered CI-only module in the supported test environment.
  const synthetic=cfg.source.read({requestId,policyRevision:lease.revision});
  touches=1;
  if(!exact(synthetic,["synthetic","record","persisted"].sort())||
     synthetic.synthetic!==NO_SOURCE.synthetic||
     synthetic.record!==NO_SOURCE.record||
     synthetic.persisted!==NO_SOURCE.persisted)
   return output(requestId,DENIAL,"FIXTURE_INVALID",lease,touches);
 }catch{
  // An attempted access cannot be reported as proven zero.
  return output(requestId,DENIAL,"FIXTURE_UNAVAILABLE",lease,1);
 }
 return output(requestId,"SIMULATED_ALLOW","SIMULATION_ONLY",lease,1);
}
/**
 * Detached BFF output boundary. Even a valid synthetic policy reply is
 * publicly DENIED: no 200, data, legal permission, or source disclosure.
 */
const BFF_KEYS=["requestId","decision","reasonCode","policyRevision",
 "policyDigest","policyEpoch","sourceTouches","canGrantPermission",
 "legalOperationalEffect","hasActualRecord","data"].sort();
function closeW25DormantBffResult(raw,expectedRequestId){
 const invalid=Object.freeze({available:false,status:503,code:"W25_UPSTREAM_INVALID"});
 if(!enabled()||!UUID.test(expectedRequestId||"")||
    !exact(raw,BFF_KEYS)||raw.requestId!==expectedRequestId||
    typeof raw.reasonCode!=="string"||
    !/^[A-Z][A-Z0-9_]{1,59}$/.test(raw.reasonCode)||
    (raw.decision!=="DENY"&&raw.decision!=="SIMULATED_ALLOW")||
    raw.canGrantPermission!==false||raw.hasActualRecord!==false||
    raw.legalOperationalEffect!=="NONE"||raw.data!==null||
    !Number.isSafeInteger(raw.sourceTouches)||raw.sourceTouches<0||
    raw.sourceTouches>1||
    (raw.decision==="SIMULATED_ALLOW"&&
      (raw.reasonCode!=="SIMULATION_ONLY"||raw.sourceTouches!==1))||
    (raw.decision==="DENY"&&raw.reasonCode==="SIMULATION_ONLY")||
    (raw.policyRevision!==null&&
      (!Number.isSafeInteger(raw.policyRevision)||raw.policyRevision<1))||
    (raw.policyDigest!==null&&
      (typeof raw.policyDigest!=="string"||
       !/^[a-f0-9]{64}$/.test(raw.policyDigest)))||
    (raw.policyEpoch!==null&&
      (!Number.isSafeInteger(raw.policyEpoch)||raw.policyEpoch<1))||
    ((raw.policyRevision===null)!==(raw.policyDigest===null))||
    ((raw.policyRevision===null)!==(raw.policyEpoch===null)))
  return invalid;
 if(raw.decision==="DENY"&&raw.sourceTouches!==0)
  return invalid; // Denied-after-source cannot assert untouched source.
 return Object.freeze({
  available:false,status:403,
  code:raw.decision==="SIMULATED_ALLOW"?
   "W25_OPERATIONAL_NOT_APPROVED":"W25_POLICY_DENIED"
 });
}
module.exports={
 SyntheticVersionTrace,bindW25SyntheticPDP,enforceW25Revision,
 closeW25DormantBffResult,safeTrace
};
