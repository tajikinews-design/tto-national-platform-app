"use strict";
/**
 * W2.5 strictly OFFLINE policy revision authority.
 *
 * The registry is a disposable single-process test authority, NOT an
 * operational policy store. No DB, network, legal admission or deployment.
 *
 * Revision numbers are monotonic and never reused; a SHA-256 digest binds the
 * exact synthetic bundle; activation epoch prevents replay on replacement or
 * revocation; trusted test clock enforces not-before/expiry. Hash is NOT a
 * signature, and the in-memory clock/registry is NOT distributed consensus.
 */
const {createHash}=require("node:crypto");
const REGISTRY_VERSION="W2_5_LAB_POLICY_REGISTRY_V0_1";
const POLICY_ID="SYNTHETIC_SELF_READ_ONLY";
const RULES=new Set(["SELF_READ_SYNTHETIC_V1","SELF_READ_SYNTHETIC_V2"]);
const BUNDLE_KEYS=["policyId","revision","ruleset","notBeforeMs","expiresAtMs"].sort();
const LEASE_KEYS=["policyId","revision","ruleset","digest","epoch","issuedAtMs","expiresAtMs"].sort();
const DIGEST=/^[a-f0-9]{64}$/;
const MAX_FUTURE=30*24*60*60*1000;
function enabled(){
 return process.env.CI==="true"&&process.env.NODE_ENV==="test"&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  process.env.TTO_W2_OFFLINE_LAB==="1"&&
  process.env.TTO_W25_POLICY_LAB==="1"&&
  !process.env.VERCEL&&!process.env.DATABASE_URL&&
  !process.env.TTO_API_BASE_URL&&!process.env.APIIR_TOKEN&&
  !process.env.TEST_ADMIN_DATABASE_URL&&!process.env.TTO_DB_POOLER_HOST&&
  !process.env.TTO_DB_APP_PASSWORD;
}
function record(v){return v!==null&&typeof v==="object"&&!Array.isArray(v)}
function exact(v,keys){
 return record(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify(keys);
}
function digestOf(b){
 return createHash("sha256").update(JSON.stringify([
  REGISTRY_VERSION,b.policyId,b.revision,b.ruleset,b.notBeforeMs,b.expiresAtMs
 ])).digest("hex");
}
function millis(v){return Number.isSafeInteger(v)&&v>=0}
class SyntheticPolicyRegistry{
 #clock;#bundles=new Map();#active=null;#epoch=0;#maxRevision=0;
 constructor({clock}={}){
  if(!enabled())throw Error("W25_LAB_DISABLED");
  if(typeof clock!=="function")throw Error("TRUSTED_CLOCK_REQUIRED");
  const t=clock();
  if(!millis(t))throw Error("TRUSTED_CLOCK_INVALID");
  this.#clock=clock;
 }
 #now(){const t=this.#clock();if(!millis(t))throw Error("TRUSTED_CLOCK_INVALID");return t}
 publish(b){
  if(!enabled())throw Error("W25_LAB_DISABLED");
  const now=this.#now();
  if(!exact(b,BUNDLE_KEYS)||b.policyId!==POLICY_ID||
     !Number.isSafeInteger(b.revision)||b.revision<=this.#maxRevision||
     b.revision>999999||!RULES.has(b.ruleset)||
     !millis(b.notBeforeMs)||!millis(b.expiresAtMs)||
     b.expiresAtMs<=b.notBeforeMs||
     b.expiresAtMs<=now||
     b.notBeforeMs>now+MAX_FUTURE||
     b.expiresAtMs>now+MAX_FUTURE)
   throw Error("POLICY_BUNDLE_INVALID");
  const bundle=Object.freeze({...b,digest:digestOf(b)});
  this.#bundles.set(b.revision,bundle);
  this.#maxRevision=b.revision;
  return Object.freeze({revision:b.revision,digest:bundle.digest});
 }
 activate(revision){
  if(!enabled())throw Error("W25_LAB_DISABLED");
  const bundle=this.#bundles.get(revision),now=this.#now();
  if(!bundle||bundle.notBeforeMs>now||bundle.expiresAtMs<=now||
     this.#active===revision||(this.#active!==null&&revision<this.#active))
   throw Error("POLICY_ACTIVATION_INVALID");
  // A retired revision may never be reactivated, even if it is not expired.
  if(this.#active!==null&&this.#bundles.get(this.#active)?.retired)
   throw Error("POLICY_ACTIVATION_INVALID");
  const old=this.#active;
  if(old!==null&&old!==revision){
   const o=this.#bundles.get(old);
   this.#bundles.set(old,Object.freeze({...o,retired:true}));
  }
  this.#active=revision;this.#epoch++;
  return Object.freeze({revision,epoch:this.#epoch,digest:bundle.digest});
 }
 revoke(revision){
  if(!enabled())throw Error("W25_LAB_DISABLED");
  if(this.#active!==revision)throw Error("POLICY_REVOCATION_INVALID");
  const existing=this.#bundles.get(revision);
  this.#bundles.set(revision,Object.freeze({...existing,retired:true}));
  this.#active=null;this.#epoch++;
  return Object.freeze({revision,epoch:this.#epoch,status:"REVOKED"});
 }
 issue(){
  if(!enabled())return Object.freeze({ok:false,reasonCode:"LAB_DISABLED"});
  let now;
  try{now=this.#now()}catch{return Object.freeze({ok:false,reasonCode:"CLOCK_UNAVAILABLE"})}
  const bundle=this.#active===null?null:this.#bundles.get(this.#active);
  if(!bundle||bundle.retired)
   return Object.freeze({ok:false,reasonCode:"POLICY_NOT_ACTIVE"});
  if(now<bundle.notBeforeMs)
   return Object.freeze({ok:false,reasonCode:"POLICY_NOT_YET_VALID"});
  if(now>=bundle.expiresAtMs)
   return Object.freeze({ok:false,reasonCode:"POLICY_EXPIRED"});
  return Object.freeze({ok:true,lease:Object.freeze({
   policyId:POLICY_ID,revision:bundle.revision,ruleset:bundle.ruleset,
   digest:bundle.digest,epoch:this.#epoch,
   issuedAtMs:now,expiresAtMs:bundle.expiresAtMs
  })});
 }
 check(lease){
  if(!enabled())return Object.freeze({ok:false,reasonCode:"LAB_DISABLED"});
  if(!exact(lease,LEASE_KEYS)||lease.policyId!==POLICY_ID||
     !Number.isSafeInteger(lease.revision)||
     !Number.isSafeInteger(lease.epoch)||
     !millis(lease.issuedAtMs)||!millis(lease.expiresAtMs)||
     !RULES.has(lease.ruleset)||
     typeof lease.digest!=="string"||!DIGEST.test(lease.digest))
   return Object.freeze({ok:false,reasonCode:"POLICY_LEASE_INVALID"});
  let now;
  try{now=this.#now()}catch{return Object.freeze({ok:false,reasonCode:"CLOCK_UNAVAILABLE"})}
  if(now>=lease.expiresAtMs)
   return Object.freeze({ok:false,reasonCode:"POLICY_EXPIRED"});
  if(this.#active===null)
   return Object.freeze({ok:false,reasonCode:"POLICY_REVOKED"});
  const current=this.#bundles.get(this.#active);
  if(!current||current.retired)
   return Object.freeze({ok:false,reasonCode:"POLICY_REVOKED"});
  if(this.#active!==lease.revision||this.#epoch!==lease.epoch)
   return Object.freeze({ok:false,reasonCode:"POLICY_VERSION_STALE"});
  if(now<current.notBeforeMs||now<lease.issuedAtMs)
   return Object.freeze({ok:false,reasonCode:"POLICY_NOT_YET_VALID"});
  if(now>=current.expiresAtMs)
   return Object.freeze({ok:false,reasonCode:"POLICY_EXPIRED"});
  if(current.digest!==lease.digest||current.ruleset!==lease.ruleset||
     current.expiresAtMs!==lease.expiresAtMs)
   return Object.freeze({ok:false,reasonCode:"POLICY_DIGEST_MISMATCH"});
  return Object.freeze({ok:true,reasonCode:"POLICY_CURRENT"});
 }
 state(){
  return Object.freeze({activeRevision:this.#active,epoch:this.#epoch,
   maxRevision:this.#maxRevision});
 }
}
module.exports={SyntheticPolicyRegistry,enabled,POLICY_ID,REGISTRY_VERSION};
