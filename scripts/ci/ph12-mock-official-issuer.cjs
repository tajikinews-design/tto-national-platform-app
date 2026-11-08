"use strict";
/*
 * PH12 STRICTLY TEST-ONLY official-issuer simulator.
 * No application import, no DB writes, no official keys, no API integration.
 * Positive means SYNTHETIC_ONLY and cannot activate a tariff.
 */
const {createServer} = require("node:http");
const {generateKeyPairSync,sign,verify,randomUUID,createHash} = require("node:crypto");
const fs=require("node:fs"), path=require("node:path");
const ISSUER="PH12_SYNTHETIC_ISSUER_NOT_OFFICIAL";
const KID="PH12_TEST_ED25519_KEY_01";
function canonical(x){
 if(x===null||typeof x==="string"||typeof x==="boolean")return JSON.stringify(x);
 if(typeof x==="number"&&Number.isFinite(x))return JSON.stringify(x);
 if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";
 if(x&&typeof x==="object"&&Object.getPrototypeOf(x)===Object.prototype){
  const keys=Object.keys(x).sort();
  if(keys.some(k=>["__proto__","constructor","prototype"].includes(k)))throw Error("NONCANONICAL_KEY");
  return "{"+keys.map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";
 }
 throw Error("NONCANONICAL_VALUE");
}
const sha=x=>createHash("sha256").update(canonical(x)).digest("hex");
function exactKeys(o,keys){
 return o!==null&&typeof o==="object"&&!Array.isArray(o)&&
 Object.keys(o).sort().join("|")===keys.slice().sort().join("|");
}
function signedEnvelope(payload,privateKey,kid=KID){
 const protectedHeader={alg:"Ed25519",kid,format:"PH12_SYNTHETIC_V1"};
 const signature=sign(null,Buffer.from(canonical({protectedHeader,payload})),privateKey).toString("base64url");
 return {protectedHeader,payload,signature};
}
function makeMockIssuer({keyId=KID}={}){
 if(process.env.TTO_PH12_MOCK_ISSUER_LAB!=="1")throw Error("LAB_FLAG_REQUIRED");
 const keys=generateKeyPairSync("ed25519");
 const records=new Map();let offline=false,transform=null;
 const server=createServer((req,res)=>{
  const match=req.method==="GET"&&/^\/v1\/synthetic\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/.exec(req.url||"");
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Content-Type","application/json");
  if(!match){res.writeHead(404);res.end('{"error":"NOT_FOUND"}');return;}
  if(offline){res.writeHead(503);res.end('{"error":"SYNTHETIC_OUTAGE"}');return;}
  const [_,tenantId,entityId]=match;
  const record=records.get(tenantId+":"+entityId);
  if(!record){res.writeHead(404);res.end('{"error":"NO_SYNTHETIC_RECORD"}');return;}
  const nonce=req.headers["x-ph12-nonce"];
  if(typeof nonce!=="string"||!nonce.match(/^[0-9a-f-]{36}$/)){
    res.writeHead(400);res.end('{"error":"NONCE_REQUIRED"}');return;
  }
  const payload={issuerId:ISSUER,tenantId,entityId,nonce,
   version:record.version,recordHash:record.recordHash,status:record.status,
   observedAt:record.observedAt,expiresAt:record.expiresAt};
  let envelope=signedEnvelope(payload,keys.privateKey,keyId);
  if(transform)envelope=transform(structuredClone(envelope));
  res.writeHead(200);res.end(JSON.stringify(envelope));
 });
 return {
  publicKey:keys.publicKey, privateKey:keys.privateKey,keyId,
  setRecord(tenant,entity,record){records.set(tenant+":"+entity,{...record});},
  setOffline(value){offline=!!value;},
  setTransform(fn){transform=fn;},
  async start(){
   await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
   });
   return "http://127.0.0.1:"+server.address().port;
  },
  async stop(){if(server.listening)await new Promise(r=>server.close(r));}
 };
}
function newRecord(overrides={}){
 return {version:1,recordHash:sha({synthetic:true,version:1}),
  status:"CURRENT",observedAt:new Date(Date.now()-30000).toISOString(),
  expiresAt:new Date(Date.now()+120000).toISOString(),...overrides};
}
class CheckpointStore {
 constructor(file){this.file=file;}
 read(){
  if(!fs.existsSync(this.file))return Object.create(null);
  const x=JSON.parse(fs.readFileSync(this.file,"utf8"));
  if(!exactKeys(x,["format","entries"])||x.format!=="PH12_LAB_CHECKPOINT_V1"||
     !x.entries||typeof x.entries!=="object"||Array.isArray(x.entries))throw Error("BAD_CHECKPOINT");
  for(const [k,v] of Object.entries(x.entries)){
    if(!/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(k)||
       !exactKeys(v,["version","recordHash","revoked"])||
       !Number.isSafeInteger(v.version)||v.version<1||
       !/^[a-f0-9]{64}$/.test(v.recordHash)||typeof v.revoked!=="boolean")
      throw Error("BAD_CHECKPOINT");
  }
  return x.entries;
 }
 save(entries){
  fs.mkdirSync(path.dirname(this.file),{recursive:true});
  const temp=this.file+".tmp-"+randomUUID();
  let fd;
  try{
   fd=fs.openSync(temp,"wx",0o600);
   fs.writeSync(fd,JSON.stringify({format:"PH12_LAB_CHECKPOINT_V1",entries}));
   fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
   fs.renameSync(temp,this.file);
  }finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp);}
 }
}
class MockIssuerVerifier {
 constructor({baseUrl,publicKey,checkpointFile,now=()=>Date.now()}){
  if(process.env.TTO_PH12_MOCK_ISSUER_LAB!=="1")throw Error("LAB_FLAG_REQUIRED");
  if(!/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(baseUrl))throw Error("LOOPBACK_ONLY");
  this.baseUrl=baseUrl;this.publicKey=publicKey;this.store=new CheckpointStore(checkpointFile);
  this.now=now;this.locks=new Map();
 }
 async check(tenantId,entityId){
  if(!/^[A-Za-z0-9_-]+$/.test(tenantId)||!/^[A-Za-z0-9_-]+$/.test(entityId))
   return {state:"MOCK_HOLD_INVALID_SUBJECT",official:false,active:false};
  const key=tenantId+":"+entityId;
  // Serialize per entity to avoid out-of-order in-flight replays.
  const prev=this.locks.get(key)||Promise.resolve();
  const next=prev.catch(()=>{}).then(()=>this._check(tenantId,entityId,key));
  this.locks.set(key,next);
  try{return await next;}finally{if(this.locks.get(key)===next)this.locks.delete(key);}
 }
 async _check(tenantId,entityId,key){
  const deny=state=>({state,official:false,active:false});
  const nonce=randomUUID();
  let envelope;
  try{
   const r=await fetch(this.baseUrl+"/v1/synthetic/"+tenantId+"/"+entityId,
      {headers:{"x-ph12-nonce":nonce},cache:"no-store",signal:AbortSignal.timeout(2000)});
   if(!r.ok)return deny("MOCK_HOLD_SOURCE_UNAVAILABLE");
   const body=await r.text();
   if(body.length>8192)return deny("MOCK_HOLD_OVERSIZED");
   envelope=JSON.parse(body);
  }catch{return deny("MOCK_HOLD_SOURCE_UNAVAILABLE");}
  try{
   if(!exactKeys(envelope,["protectedHeader","payload","signature"])||
      !exactKeys(envelope.protectedHeader,["alg","kid","format"])||
      envelope.protectedHeader.alg!=="Ed25519"||
      envelope.protectedHeader.kid!==KID||
      envelope.protectedHeader.format!=="PH12_SYNTHETIC_V1"||
      !exactKeys(envelope.payload,["issuerId","tenantId","entityId","nonce",
       "version","recordHash","status","observedAt","expiresAt"])||
      typeof envelope.signature!=="string"||
      !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature))
     return deny("MOCK_HOLD_MALFORMED_ENVELOPE");
   const bytes=Buffer.from(canonical({protectedHeader:envelope.protectedHeader,payload:envelope.payload}));
   if(!verify(null,bytes,this.publicKey,Buffer.from(envelope.signature,"base64url")))
     return deny("MOCK_HOLD_BAD_SIGNATURE");
   const p=envelope.payload;
   if(p.issuerId!==ISSUER||p.tenantId!==tenantId||p.entityId!==entityId||p.nonce!==nonce)
     return deny("MOCK_HOLD_WRONG_BINDING");
   if(!Number.isSafeInteger(p.version)||p.version<1||
      typeof p.recordHash!=="string"||!/^[a-f0-9]{64}$/.test(p.recordHash)||
      !["CURRENT","REVOKED"].includes(p.status))
     return deny("MOCK_HOLD_INVALID_RECORD");
   const observed=Date.parse(p.observedAt), expires=Date.parse(p.expiresAt),now=this.now();
   if(!Number.isFinite(observed)||!Number.isFinite(expires)||observed>now+1000||expires<=now||observed>=expires)
     return deny("MOCK_HOLD_EXPIRED_OR_FUTURE");
   const entries=this.store.read();
   const previous=entries[key];
   if(previous&&p.version<previous.version)return deny("MOCK_HOLD_VERSION_ROLLBACK");
   if(previous&&p.version===previous.version&&previous.recordHash!==p.recordHash)
     return deny("MOCK_HOLD_VERSION_EQUIVOCATION");
   if(p.status==="REVOKED"||previous?.revoked){
     entries[key]={version:p.version,recordHash:p.recordHash,revoked:true};
     this.store.save(entries);
     return deny("MOCK_HOLD_REVOKED");
   }
   entries[key]={version:p.version,recordHash:p.recordHash,revoked:false};
   this.store.save(entries);
   return {state:"MOCK_ELIGIBLE_IN_LAB_ONLY",official:false,active:false,
       syntheticVersion:p.version};
  }catch{return deny("MOCK_HOLD_CHECKPOINT_OR_VALIDATION_ERROR");}
 }
}
module.exports={makeMockIssuer,MockIssuerVerifier,newRecord,canonical,signedEnvelope,CheckpointStore};
