"use strict";
/**
 * W2.6 signed policy and independently child-signed PDP transcript contract.
 * No production import. Asymmetric Ed25519 signing, SHA256 domain separation.
 * Ephemeral keys and trusted local pipe bootstrap: NOT operational PKI.
 */
const crypto=require("node:crypto");
const POLICY_SCHEMA="W26_SIGNED_SYNTHETIC_POLICY_V0_1";
const RESPONSE_SCHEMA="W26_CHILD_SIGNED_DECISION_V0_1";
const POLICY_KEYS=["schemaVersion","policyId","revision","ruleset","digest",
  "epoch","notBeforeMs","expiresAtMs","publisherKeyId"].sort();
const SIGNED_POLICY_KEYS=[...POLICY_KEYS,"signature"].sort();
const DECISION_KEYS=["schemaVersion","requestId","nonce","contextDigest",
  "policyId","revision","digest","epoch","decision","reasonCode",
  "evaluatedAtMs","signerKeyId"].sort();
const SIGNED_DECISION_KEYS=[...DECISION_KEYS,"signature"].sort();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/;
const B64=/^[A-Za-z0-9+/]+={0,2}$/;
const POLICY_ID="SYNTHETIC_SELF_READ_ONLY";
const RULES=new Set(["SELF_READ_SYNTHETIC_V1","SELF_READ_SYNTHETIC_V2"]);
const CONTEXT_KEYS=["environment","session","tenantMatch","partyBound",
 "membershipSourceApproved","featureEnabled","permission","sourceApproved",
 "sourceStatus","sourceFresh","sourceVersion","selfResource",
 "classificationAllowed","downloadPermission","exportPermission",
 "writePermission","reauth","csrf","idempotency","versionMatched",
 "ruleSnapshot","paymentState","ownershipFinalizationApproved"].sort();
function labOnly(){
 return process.env.CI==="true"&&process.env.NODE_ENV==="test"&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  process.env.TTO_W2_OFFLINE_LAB==="1"&&
  process.env.TTO_W26_SIGNED_LAB==="1"&&
  !process.env.VERCEL&&!process.env.DATABASE_URL&&
  !process.env.TTO_API_BASE_URL&&!process.env.APIIR_TOKEN&&
  !process.env.TEST_ADMIN_DATABASE_URL&&!process.env.TTO_DB_POOLER_HOST&&
  !process.env.TTO_DB_APP_PASSWORD;
}
function rec(x){return x!==null&&typeof x==="object"&&!Array.isArray(x);}
function exact(x,keys){return rec(x)&&JSON.stringify(Object.keys(x).sort())===JSON.stringify(keys);}
function sha(x){return crypto.createHash("sha256").update(x).digest("hex");}
function canonical(values,keys,tag){return Buffer.from(JSON.stringify([tag,...keys.map(k=>values[k])]),"utf8");}
function publicDer(pem){
 const key=crypto.createPublicKey(pem);
 if(key.asymmetricKeyType!=="ed25519")throw Error("NOT_ED25519_PUBLIC_KEY");
 return key.export({type:"spki",format:"der"});
}
function keyId(pem){return sha(publicDer(pem));}
function verifiedSignature(payload,signature,pem){
 if(typeof signature!=="string"||signature.length>128||!B64.test(signature))return false;
 try{
  const raw=Buffer.from(signature,"base64");
  if(raw.length!==64||raw.toString("base64")!==signature)return false;
  return crypto.verify(null,payload,crypto.createPublicKey(pem),raw);
 }catch{return false;}
}
function contextValid(c){
 return exact(c,CONTEXT_KEYS)&&c.environment==="SIMULATION"&&c.session==="ACTIVE"&&
  typeof c.sourceVersion==="string"&&/^SYNTHETIC-V[1-9][0-9]*$/.test(c.sourceVersion)&&
  c.sourceStatus==="APPROVED"&&c.paymentState==="NONE"&&
  c.idempotency===null&&c.ruleSnapshot===null&&
  ["tenantMatch","partyBound","membershipSourceApproved","featureEnabled",
   "permission","sourceApproved","sourceFresh","selfResource",
   "classificationAllowed","downloadPermission","exportPermission",
   "writePermission","reauth","csrf","versionMatched",
   "ownershipFinalizationApproved"].every(k=>typeof c[k]==="boolean");
}
function contextDigest(c){
 if(!contextValid(c))throw Error("POLICY_CONTEXT_INVALID");
 return sha(canonical(c,CONTEXT_KEYS,"W26_CONTEXT_V1"));
}
function bundleDigest(p){
 return sha(Buffer.from(JSON.stringify([
  "W2_5_LAB_POLICY_REGISTRY_V0_1",p.policyId,p.revision,p.ruleset,
  p.notBeforeMs,p.expiresAtMs
 ])));
}
function manifestValid(p){
 return exact(p,POLICY_KEYS)&&p.schemaVersion===POLICY_SCHEMA&&
  p.policyId===POLICY_ID&&Number.isSafeInteger(p.revision)&&p.revision>0&&
  Number.isSafeInteger(p.epoch)&&p.epoch>0&&RULES.has(p.ruleset)&&
  Number.isSafeInteger(p.notBeforeMs)&&p.notBeforeMs>=0&&
  Number.isSafeInteger(p.expiresAtMs)&&p.expiresAtMs>p.notBeforeMs&&
  typeof p.digest==="string"&&HASH.test(p.digest)&&
  p.digest===bundleDigest(p)&&
  typeof p.publisherKeyId==="string"&&HASH.test(p.publisherKeyId);
}
function makeSignedManifest(lease,sourceBundle,publisherPrivateKey,publisherPublicPem){
 if(!labOnly()||!lease||!sourceBundle)throw Error("W26_LAB_DISABLED");
 const p={
  schemaVersion:POLICY_SCHEMA,policyId:lease.policyId,
  revision:lease.revision,ruleset:lease.ruleset,digest:lease.digest,
  epoch:lease.epoch,notBeforeMs:sourceBundle.notBeforeMs,
  expiresAtMs:lease.expiresAtMs,publisherKeyId:keyId(publisherPublicPem)
 };
 if(!manifestValid(p)||p.notBeforeMs>lease.issuedAtMs)
  throw Error("POLICY_MANIFEST_INVALID");
 const signature=crypto.sign(null,canonical(p,POLICY_KEYS,"W26_PUBLISHER_SIGN_V1"),
  publisherPrivateKey).toString("base64");
 return Object.freeze({...p,signature});
}
function verifySignedManifest(signed,publisherPublicPem){
 if(!labOnly()||!exact(signed,SIGNED_POLICY_KEYS))return false;
 const {signature,...policy}=signed;
 return manifestValid(policy)&&policy.publisherKeyId===keyId(publisherPublicPem)&&
  verifiedSignature(canonical(policy,POLICY_KEYS,"W26_PUBLISHER_SIGN_V1"),
    signature,publisherPublicPem);
}
function policyDecision(c,ruleset){
 // Actual distinct child-process rule evaluation. No operational permission.
 if(!contextValid(c))return {decision:"DENY",reasonCode:"POLICY_CONTEXT_INVALID"};
 const allow=["tenantMatch","partyBound","membershipSourceApproved",
  "featureEnabled","permission","sourceApproved","sourceFresh","selfResource",
  "classificationAllowed"].every(k=>c[k]===true);
 const deny=["downloadPermission","exportPermission","writePermission",
  "reauth","csrf","versionMatched","ownershipFinalizationApproved"]
  .every(k=>c[k]===false);
 const specific=ruleset==="SELF_READ_SYNTHETIC_V1"||
   ruleset==="SELF_READ_SYNTHETIC_V2";
 return allow&&deny&&specific?
  {decision:"SIMULATED_ALLOW",reasonCode:"SIMULATION_ONLY"}:
  {decision:"DENY",reasonCode:"POLICY_CONTEXT_DENIED"};
}
function decisionValid(d){
 return exact(d,DECISION_KEYS)&&d.schemaVersion===RESPONSE_SCHEMA&&
  typeof d.requestId==="string"&&UUID.test(d.requestId)&&
  typeof d.nonce==="string"&&UUID.test(d.nonce)&&
  typeof d.contextDigest==="string"&&HASH.test(d.contextDigest)&&
  d.policyId===POLICY_ID&&Number.isSafeInteger(d.revision)&&d.revision>0&&
  typeof d.digest==="string"&&HASH.test(d.digest)&&
  Number.isSafeInteger(d.epoch)&&d.epoch>0&&
  Number.isSafeInteger(d.evaluatedAtMs)&&d.evaluatedAtMs>=0&&
  typeof d.signerKeyId==="string"&&HASH.test(d.signerKeyId)&&
  (d.decision==="DENY"||d.decision==="SIMULATED_ALLOW")&&
  typeof d.reasonCode==="string"&&/^[A-Z][A-Z0-9_]{1,59}$/.test(d.reasonCode)&&
  (d.decision==="SIMULATED_ALLOW"?(d.reasonCode==="SIMULATION_ONLY"):
   d.reasonCode!=="SIMULATION_ONLY");
}
function signDecision(payload,privateKey){
 if(!decisionValid(payload))throw Error("DECISION_SCHEMA_INVALID");
 return {...payload,signature:crypto.sign(null,
  canonical(payload,DECISION_KEYS,"W26_PDP_SIGN_V1"),
  privateKey).toString("base64")};
}
function verifyDecision(reply,publicPem,expected){
 if(!labOnly()||!exact(reply,SIGNED_DECISION_KEYS)||!exact(expected,[
  "requestId","nonce","contextDigest","policyId","revision","digest","epoch","evaluatedAtMs","signerKeyId"
 ].sort()))return false;
 const {signature,...decision}=reply;
 return decisionValid(decision)&&
  Object.keys(expected).every(k=>decision[k]===expected[k])&&
  keyId(publicPem)===expected.signerKeyId&&
  verifiedSignature(canonical(decision,DECISION_KEYS,"W26_PDP_SIGN_V1"),
   signature,publicPem);
}
module.exports={POLICY_SCHEMA,RESPONSE_SCHEMA,POLICY_ID,CONTEXT_KEYS,
 POLICY_KEYS,DECISION_KEYS,labOnly,keyId,contextValid,contextDigest,
 bundleDigest,manifestValid,makeSignedManifest,verifySignedManifest,
 policyDecision,signDecision,verifyDecision};
