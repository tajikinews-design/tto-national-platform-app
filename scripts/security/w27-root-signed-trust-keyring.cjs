"use strict";
/**
 * W2.7 synthetic, independently root-SIGNED key publication and revocation.
 *
 * Root public key is explicitly pinned at construction (out-of-band test
 * config), not learned from an untrusted PDP response or signed snapshot.
 * Root private key remains ONLY in ephemeral offline test authority.
 * Roles distinguish publisher from PDP; deny on missing/stale/replayed
 * snapshots, missing tombstones, key reuse, expired or revoked identities.
 * No actual CA, HSM, transparency log, operational ledger or real issuer.
 */
const crypto=require("node:crypto");
const {keyId}=require("./w26-signed-policy-protocol.cjs");
const VERSION="W27_OFFLINE_ROOT_SIGNED_TRUST_V0_1";
const ZERO="0".repeat(64);
const ROLES=new Set(["POLICY_PUBLISHER","PDP_DECISION"]);
const STATES=new Set(["ACTIVE","REVOKED"]);
const ENTRY_KEYS=["role","keyId","publicPem","generation",
 "notBeforeMs","expiresAtMs","status"].sort();
const SNAP_KEYS=["schemaVersion","rootKeyId","epoch",
 "issuedAtMs","expiresAtMs","previousHash","entries"].sort();
const SIGNED_KEYS=[...SNAP_KEYS,"signature"].sort();
const HASH=/^[0-9a-f]{64}$/;
const B64=/^[A-Za-z0-9+/]+={0,2}$/;
const MAX_ENTRIES=24;
function enabled(){
 return process.env.CI==="true"&&process.env.NODE_ENV==="test"&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  process.env.TTO_W26_SIGNED_LAB==="1"&&
  process.env.TTO_W27_TRUST_LAB==="1"&&
  !process.env.VERCEL&&!process.env.DATABASE_URL&&
  !process.env.TTO_API_BASE_URL&&!process.env.APIIR_TOKEN&&
  !process.env.TEST_ADMIN_DATABASE_URL&&!process.env.TTO_DB_POOLER_HOST&&
  !process.env.TTO_DB_APP_PASSWORD;
}
function record(x){return x!==null&&typeof x==="object"&&!Array.isArray(x)}
function exact(x,k){return record(x)&&JSON.stringify(Object.keys(x).sort())===JSON.stringify(k)}
function num(x){return Number.isSafeInteger(x)&&x>=0}
function hash(x){return crypto.createHash("sha256").update(x).digest("hex")}
function canonical(o){return Buffer.from(JSON.stringify([
 "W27_ROOT_PUBLICATION_V1",...SNAP_KEYS.map(k=>o[k])]),"utf8")}
function snapHash(s){return hash(Buffer.from(JSON.stringify([
 "W27_TRUST_CHAIN_V1",...SNAP_KEYS.map(k=>s[k]),s.signature]),"utf8"))}
function entryValid(e){
 if(!exact(e,ENTRY_KEYS)||!ROLES.has(e.role)||!STATES.has(e.status)||
    typeof e.keyId!=="string"||!HASH.test(e.keyId)||
    typeof e.publicPem!=="string"||e.publicPem.length>1024||
    !Number.isSafeInteger(e.generation)||e.generation<1||
    !num(e.notBeforeMs)||!num(e.expiresAtMs)||
    e.expiresAtMs<=e.notBeforeMs)return false;
 try{return keyId(e.publicPem)===e.keyId}catch{return false}
}
function keyEntry({role,publicPem,generation,notBeforeMs,expiresAtMs,status="ACTIVE"}){
 if(!enabled())throw Error("W27_LAB_DISABLED");
 const e={role,keyId:keyId(publicPem),publicPem,generation,
  notBeforeMs,expiresAtMs,status};
 if(!entryValid(e))throw Error("W27_KEY_ENTRY_INVALID");
 return Object.freeze(e);
}
function signedSnapshot(props,rootPrivateKey,rootPublicPem){
 if(!enabled()||!record(props)||!Array.isArray(props.entries))
  throw Error("W27_LAB_DISABLED");
 const sorted=props.entries.map(e=>({...e})).sort((a,b)=>
  (a.role+"|"+a.keyId).localeCompare(b.role+"|"+b.keyId));
 const base={schemaVersion:VERSION,rootKeyId:keyId(rootPublicPem),
  epoch:props.epoch,issuedAtMs:props.issuedAtMs,
  expiresAtMs:props.expiresAtMs,previousHash:props.previousHash,
  entries:sorted};
 const signature=crypto.sign(null,canonical(base),rootPrivateKey).toString("base64");
 return Object.freeze({...base,entries:Object.freeze(sorted.map(e=>Object.freeze(e))),signature});
}
function snapshotValid(s,pinnedRootPem){
 if(!exact(s,SIGNED_KEYS)||s.schemaVersion!==VERSION||
    s.rootKeyId!==keyId(pinnedRootPem)||
    !Number.isSafeInteger(s.epoch)||s.epoch<1||
    !num(s.issuedAtMs)||!num(s.expiresAtMs)||
    s.expiresAtMs<=s.issuedAtMs||
    typeof s.previousHash!=="string"||!HASH.test(s.previousHash)||
    !Array.isArray(s.entries)||s.entries.length>MAX_ENTRIES||
    !s.entries.every(entryValid)||
    typeof s.signature!=="string"||s.signature.length>128||
    !B64.test(s.signature))return false;
 for(let i=1;i<s.entries.length;i++){
  const before=s.entries[i-1].role+"|"+s.entries[i-1].keyId;
  const after=s.entries[i].role+"|"+s.entries[i].keyId;
  if(before>=after)return false;
 }
 try{
  const raw=Buffer.from(s.signature,"base64");
  return raw.length===64&&raw.toString("base64")===s.signature&&
   crypto.verify(null,canonical(s),crypto.createPublicKey(pinnedRootPem),raw);
 }catch{return false}
}
class TrustedOfflineKeyring{
 #rootPem;#clock;#lastNow;#snapshot=null;#hash=ZERO;#epoch=0;
 #entries=new Map();#maxGeneration=new Map();
 constructor({pinnedRootPublicPem,clock}={}){
  if(!enabled()||typeof clock!=="function"||
     typeof pinnedRootPublicPem!=="string")
   throw Error("W27_TRUST_CONFIG_INVALID");
  keyId(pinnedRootPublicPem);
  this.#rootPem=pinnedRootPublicPem;
  this.#clock=clock;
  this.#lastNow=clock();
  if(!num(this.#lastNow))throw Error("W27_TRUST_CLOCK_INVALID");
 }
 #now(){
  const v=this.#clock();
  if(!num(v)||v<this.#lastNow)throw Error("W27_TRUST_CLOCK_INVALID");
  this.#lastNow=v;return v;
 }
 checkpoint(){return Object.freeze({epoch:this.#epoch,head:this.#hash})}
 snapshot(){return this.#snapshot}
 apply(signed){
  if(!enabled())throw Error("W27_LAB_DISABLED");
  const now=this.#now();
  if(!snapshotValid(signed,this.#rootPem)||
     signed.epoch!==this.#epoch+1||signed.previousHash!==this.#hash||
     signed.issuedAtMs>now||signed.expiresAtMs<=now)
   throw Error("W27_TRUST_PUBLICATION_INVALID");
  const upcoming=new Map();
  const activeRoles=new Set();
  const maxGeneration=new Map(this.#maxGeneration);
  for(const e of signed.entries){
   const old=this.#entries.get(e.keyId);
   if(old){
    if(e.role!==old.role||e.publicPem!==old.publicPem||
       e.generation!==old.generation||
       e.notBeforeMs!==old.notBeforeMs||
       e.expiresAtMs!==old.expiresAtMs||
       (old.status==="REVOKED"&&e.status!=="REVOKED"))
     throw Error("W27_TRUST_REUSE_OR_RESURRECTION");
   }else{
    const previous=maxGeneration.get(e.role)||0;
    if(e.generation<=previous)throw Error("W27_TRUST_GENERATION_ROLLBACK");
    maxGeneration.set(e.role,e.generation);
   }
   if(e.status==="ACTIVE"){
    if(activeRoles.has(e.role)||e.notBeforeMs>now||e.expiresAtMs<=now)
     throw Error("W27_TRUST_ACTIVE_ROLE_INVALID");
    activeRoles.add(e.role);
   }
   upcoming.set(e.keyId,Object.freeze({...e}));
  }
  // No silent removal: every previously known key remains as a signed
  // ACTIVE or explicitly REVOKED tombstone, including after rotation.
  for(const id of this.#entries.keys())
   if(!upcoming.has(id))throw Error("W27_TRUST_TOMBSTONE_MISSING");
  this.#entries=upcoming;
  this.#maxGeneration=maxGeneration;
  this.#snapshot=Object.freeze({...signed,
   entries:Object.freeze(signed.entries.map(e=>Object.freeze({...e})))});
  this.#hash=snapHash(signed);
  this.#epoch=signed.epoch;
  return this.checkpoint();
 }
 check(role,publicPem,{minimumEpoch=1}={}){
  if(!enabled())return Object.freeze({ok:false,reasonCode:"TRUST_LAB_DISABLED"});
  let now,id;
  try{now=this.#now();id=keyId(publicPem)}catch{
   return Object.freeze({ok:false,reasonCode:"TRUST_INPUT_OR_CLOCK_INVALID"});
  }
  if(!ROLES.has(role)||!Number.isSafeInteger(minimumEpoch)||
     minimumEpoch<1)
   return Object.freeze({ok:false,reasonCode:"TRUST_ROLE_INVALID"});
  if(!this.#snapshot||this.#epoch<minimumEpoch)
   return Object.freeze({ok:false,reasonCode:"TRUST_SNAPSHOT_MISSING_OR_STALE"});
  if(now<this.#snapshot.issuedAtMs||now>=this.#snapshot.expiresAtMs)
   return Object.freeze({ok:false,reasonCode:"TRUST_SNAPSHOT_EXPIRED"});
  const e=this.#entries.get(id);
  if(!e||e.role!==role)
   return Object.freeze({ok:false,reasonCode:"TRUST_KEY_UNKNOWN_OR_WRONG_ROLE"});
  if(e.status!=="ACTIVE")
   return Object.freeze({ok:false,reasonCode:"TRUST_KEY_REVOKED"});
  if(now<e.notBeforeMs||now>=e.expiresAtMs)
   return Object.freeze({ok:false,reasonCode:"TRUST_KEY_EXPIRED"});
  return Object.freeze({ok:true,reasonCode:"TRUST_ACTIVE",
   role,keyId:id,generation:e.generation,epoch:this.#epoch,
   head:this.#hash});
 }
}
module.exports={VERSION,ZERO,enabled,keyEntry,signedSnapshot,
 snapshotValid,TrustedOfflineKeyring};
