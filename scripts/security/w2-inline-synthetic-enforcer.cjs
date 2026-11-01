"use strict";
/**
 * W2 TEST-ONLY inline policy gate. This file lives under scripts/security,
 * is never imported by an application route, never uses a database or network.
 * It makes a policy decision BEFORE any synthetic source.read() is possible.
 *
 * In contrast to W1 shadow tests, the decision here is INLINE in a disposable
 * LAB Nest controller, not an actual production Nest AppModule authorization.
 * SIMULATED_ALLOW NEVER confers legal, operational or live-read permission.
 */
const {randomUUID}=require("node:crypto");
const CONTRACT="W1_BFF_NEST_SEAM_V0_1";
const CANDIDATE_KEYS=["contractVersion","environment","operation","ownerKey","tenantKey"].sort();
const DECISION_KEYS=["auditCount","canGrantPermission","decision","fixtureTouches",
  "hasActualRecord","legalOperationalEffect","reasonCode","requestId"].sort();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKENS=/^[A-Z][A-Z0-9_]{1,59}$/;
const TEST_TENANT=/^coop-test-[A-Z]$/;
const TEST_OWNER=/^fixture-owner-[A-Z]$/;
function labOnly(){
 return process.env.CI==="true"&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  process.env.TTO_W2_OFFLINE_LAB==="1"&&
  process.env.NODE_ENV==="test"&&
  !process.env.VERCEL&&!process.env.DATABASE_URL&&
  !process.env.TTO_API_BASE_URL&&!process.env.APIIR_TOKEN&&
  !process.env.TTO_DB_POOLER_HOST&&!process.env.TTO_DB_APP_PASSWORD&&
  !process.env.TEST_ADMIN_DATABASE_URL;
}
function isRecord(v){return v!==null&&typeof v==="object"&&!Array.isArray(v);}
function sameKeys(v,allowed){
 return JSON.stringify(Object.keys(v).sort())===JSON.stringify(allowed);
}
function validDecision(v){
 if(!isRecord(v)||!sameKeys(v,DECISION_KEYS))return false;
 if(v.decision!=="DENY"&&v.decision!=="SIMULATED_ALLOW")return false;
 if(typeof v.reasonCode!=="string"||!TOKENS.test(v.reasonCode)||
    typeof v.requestId!=="string"||!UUID.test(v.requestId))return false;
 if(v.legalOperationalEffect!=="NONE"||v.canGrantPermission!==false||
    v.hasActualRecord!==false||v.auditCount!==1||
    typeof v.fixtureTouches!=="number"||!Number.isSafeInteger(v.fixtureTouches))return false;
 return v.decision==="DENY"?v.fixtureTouches===0:v.fixtureTouches===1;
}
const DENIED_REASON="DECISION_INVALID";
function derivedContext(proof){
 return {
  environment:"SIMULATION",session:"ACTIVE",tenantMatch:true,partyBound:true,
  membershipSourceApproved:proof.membershipSourceApproved===true,
  featureEnabled:proof.featureEnabled===true,
  permission:proof.readPermission===true,
  sourceApproved:proof.sourceApproved===true,
  sourceStatus:proof.sourceApproved===true?"APPROVED":"REVOKED",
  sourceFresh:proof.sourceFresh===true,sourceVersion:proof.sourceVersion,
  selfResource:true,classificationAllowed:proof.classificationAllowed===true,
  downloadPermission:false,exportPermission:false,writePermission:false,
  reauth:false,csrf:false,idempotency:null,versionMatched:false,
  ruleSnapshot:null,paymentState:"NONE",ownershipFinalizationApproved:false
 };
}
function reply(decision,reasonCode,id,sourceTouches=0){
 return {decision,reasonCode,requestId:id,sourceTouches,
  hasActualRecord:false,canGrantPermission:false,legalOperationalEffect:"NONE",
  data:null};
}
/**
 * @param {object} cfg
 * @param {unknown} cfg.candidate Five-field allowlisted BFF candidate, NOT proof.
 * @param {object} cfg.proof Trusted server-only in-memory session fixture.
 * @param {(op:string, ctx:object)=>Promise<unknown>} cfg.policy Python W1 PDP/PEP bridge.
 * @param {{record:(e:object)=>void}} cfg.audit In-memory allowlisted synthetic audit.
 * @param {{read:(key:object)=>object}} cfg.source In-memory synthetic resource counter.
 * @param {number} cfg.deadlineMs Strict timeout for the policy provider.
 */
async function enforceW2SyntheticInline(cfg){
 const id=randomUUID();
 const audit=cfg?.audit;
 async function deny(code){
  try{
   if(!audit||typeof audit.record!=="function")throw Error("NO_AUDIT");
   audit.record({requestId:id,operation:"read",decision:"DENY",reasonCode:code});
  }catch{return reply("DENY","AUDIT_UNAVAILABLE",id);}
  return reply("DENY",code,id);
 }
 if(!labOnly())return reply("DENY","LAB_DISABLED",id);
 if(!cfg||!isRecord(cfg.candidate)||!sameKeys(cfg.candidate,CANDIDATE_KEYS)||
    cfg.candidate.contractVersion!==CONTRACT||
    cfg.candidate.environment!=="SIMULATION"||
    cfg.candidate.operation!=="read"||
    typeof cfg.candidate.tenantKey!=="string"||
    typeof cfg.candidate.ownerKey!=="string"||
    !TEST_TENANT.test(cfg.candidate.tenantKey)||
    !TEST_OWNER.test(cfg.candidate.ownerKey))return deny("CANDIDATE_INVALID");
 const p=cfg.proof;
 if(!isRecord(p)||p.sessionActive!==true)return deny("SESSION_INVALID");
 if(p.tenantKey!==cfg.candidate.tenantKey)return deny("TENANT_MISMATCH");
 if(p.ownerKey!==cfg.candidate.ownerKey)return deny("RESOURCE_OWNERSHIP_DENIED");
 if(p.partyBound!==true)return deny("PARTY_BINDING_INVALID");
 if(p.membershipSourceApproved!==true||p.sourceApproved!==true)
  return deny("LEGAL_SOURCE_NOT_APPROVED");
 if(p.sourceFresh!==true||typeof p.sourceVersion!=="string"||
    !/^SYNTHETIC-V[1-9][0-9]*$/.test(p.sourceVersion))
  return deny("SOURCE_VERSION_INVALID");
 if(p.featureEnabled!==true||p.readPermission!==true||
    p.classificationAllowed!==true)return deny("PERMISSION_MISSING");
 if(typeof cfg.policy!=="function"||!cfg.source||
    typeof cfg.source.read!=="function")return deny("ENFORCEMENT_UNAVAILABLE");
 const timeout=Number.isSafeInteger(cfg.deadlineMs)&&
    cfg.deadlineMs>=1&&cfg.deadlineMs<=2000?cfg.deadlineMs:150;
 let timer;
 let raw;
 try{
  raw=await Promise.race([
   Promise.resolve().then(()=>cfg.policy("read",derivedContext(p))),
   new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error("POLICY_TIMEOUT")),timeout);
   })
  ]);
 }catch{return deny("PDP_UNAVAILABLE")}
 finally{clearTimeout(timer)}
 if(!validDecision(raw))return deny(DENIED_REASON);
 if(raw.decision==="DENY")return deny(raw.reasonCode);
 // The synthetic policy result is the only positive path. An audit is required
 // BEFORE the fixture touch. A failed audit can never allow an unaudited read.
 try{
  if(!audit||typeof audit.record!=="function")throw Error("NO_AUDIT");
  audit.record({requestId:id,operation:"read",
   decision:"SIMULATED_ALLOW",reasonCode:"SIMULATION_ONLY"});
 }catch{return reply("DENY","AUDIT_UNAVAILABLE",id)}
 try{
  // This returns no record, only an integer counter; the fixture itself is
  // injected in the isolated Node lab and cannot call a real source connector.
  const result=cfg.source.read({
   tenantKey:cfg.candidate.tenantKey,ownerKey:cfg.candidate.ownerKey
  });
  if(!isRecord(result)||result.synthetic!==true||
     result.record!==null||result.persisted!==false)
    return reply("DENY","FIXTURE_INVALID",id,1);
 }catch{return reply("DENY","FIXTURE_UNAVAILABLE",id,1)}
 return reply("SIMULATED_ALLOW","SIMULATION_ONLY",id,1);
}
module.exports={enforceW2SyntheticInline,labOnly,validDecision};
