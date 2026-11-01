"use strict";
/**
 * W2.4 OFFLINE/DISPOSABLE audit ledger — not a production log provider.
 *
 * File-backed on GitHub runner temp ONLY. Strict allowlist excludes any real
 * identity, token, cookies, tenant, owner, IP, source records, body or headers.
 * Hash chaining detects mutation with a trusted INDEPENDENT expected head.
 * It is NOT cryptographic signing, durable centralized storage, or a real
 * audit compliance guarantee: rewriting BOTH file and head can hide tampering.
 */
const fs=require("node:fs");
const path=require("node:path");
const {createHash}=require("node:crypto");

const VERSION="W2_4_OFFLINE_AUDIT_V0_1";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const REASON=/^[A-Z][A-Z0-9_]{1,59}$/;
const PHASES=new Set(["BFF_PRECHECK","NEST_SCOPE","PDP_DECISION","BFF_RESPONSE"]);
const DECISIONS=new Set(["NONE","DENY","SIMULATED_ALLOW"]);
const EVENT_FIELDS=["version","sequence","requestId","phase","decision","reasonCode","previousHash","hash"].sort();
const INPUT_FIELDS=["requestId","phase","decision","reasonCode"].sort();
const ZERO="0".repeat(64);
const MAX_BYTES=64*1024;
function enabled(){
 return process.env.CI==="true"&&process.env.NODE_ENV==="test"&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  process.env.TTO_W2_OFFLINE_LAB==="1"&&
  process.env.TTO_W24_AUDIT_LAB==="1"&&
  !process.env.VERCEL&&!process.env.DATABASE_URL&&
  !process.env.TTO_API_BASE_URL&&!process.env.APIIR_TOKEN&&
  !process.env.TEST_ADMIN_DATABASE_URL&&!process.env.TTO_DB_POOLER_HOST&&
  !process.env.TTO_DB_APP_PASSWORD;
}
function isRecord(v){return !!v&&typeof v==="object"&&!Array.isArray(v)}
function exact(v,keys){
 return isRecord(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify(keys);
}
function validInput(x){
 return exact(x,INPUT_FIELDS)&&typeof x.requestId==="string"&&UUID.test(x.requestId)&&
  PHASES.has(x.phase)&&DECISIONS.has(x.decision)&&
  typeof x.reasonCode==="string"&&REASON.test(x.reasonCode)&&
  (x.decision==="SIMULATED_ALLOW"?x.phase==="PDP_DECISION"&&x.reasonCode==="SIMULATION_ONLY":
   x.reasonCode!=="SIMULATION_ONLY");
}
function canonical(record){
 return JSON.stringify([
  record.version,record.sequence,record.requestId,record.phase,
  record.decision,record.reasonCode,record.previousHash
 ]);
}
function sha(input){return createHash("sha256").update(input).digest("hex")}
function checkRecord(x,sequence,previousHash){
 return exact(x,EVENT_FIELDS)&&x.version===VERSION&&x.sequence===sequence&&
  typeof x.requestId==="string"&&UUID.test(x.requestId)&&
  validInput({requestId:x.requestId,phase:x.phase,decision:x.decision,reasonCode:x.reasonCode})&&
  x.previousHash===previousHash&&typeof x.hash==="string"&&SHA.test(x.hash)&&
  x.hash===sha(canonical(x));
}
/**
 * The checkpoint MUST be supplied independently by the caller. Without a
 * trusted checkpoint, a self-consistent rewritten/truncated chain can pass.
 */
function verifyAuditFile(file,expected){
 if(!enabled())return {ok:false,code:"LAB_DISABLED"};
 if(!exact(expected,["count","head"])||!Number.isSafeInteger(expected.count)||
    expected.count<0||!SHA.test(expected.head))
  return {ok:false,code:"CHECKPOINT_INVALID"};
 try{
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_BYTES)
   return {ok:false,code:"FILE_INVALID"};
  if((stat.mode&0o077)!==0)return {ok:false,code:"PERMISSIONS_INVALID"};
  const bytes=fs.readFileSync(file,"utf8");
  const lines=bytes?bytes.split("\n"):[];
  if(lines.length&&lines.at(-1)!=="")
   return {ok:false,code:"PARTIAL_RECORD"};
  if(lines.length)lines.pop();
  let prev=ZERO;
  for(let i=0;i<lines.length;i++){
   const record=JSON.parse(lines[i]);
   if(!checkRecord(record,i+1,prev))
    return {ok:false,code:"CHAIN_INVALID"};
   prev=record.hash;
  }
  if(lines.length!==expected.count||prev!==expected.head)
   return {ok:false,code:"CHECKPOINT_MISMATCH"};
  return {ok:true,code:"VERIFIED",count:lines.length,head:prev};
 }catch{return {ok:false,code:"AUDIT_UNAVAILABLE"}}
}
class OfflineAuditLedger {
 constructor(file){
  if(!enabled())throw Error("W24_LAB_DISABLED");
  if(typeof file!=="string"||!path.isAbsolute(file))throw Error("AUDIT_PATH_INVALID");
  const parent=fs.realpathSync(path.dirname(file));
  if(!fs.statSync(parent).isDirectory())throw Error("AUDIT_PARENT_INVALID");
  if(fs.existsSync(file))throw Error("AUDIT_FILE_ALREADY_EXISTS");
  // Never open arbitrary existing files. Exclusive create, owner only.
  this.file=file;
  const fd=fs.openSync(file,"wx",0o600);
  fs.closeSync(fd);
  this.head=ZERO;
  this.count=0;
  this.failed=false;
 }
 checkpoint(){return Object.freeze({count:this.count,head:this.head})}
 append(input){
  if(!enabled()||this.failed)throw Error("AUDIT_UNAVAILABLE");
  if(!validInput(input))throw Error("AUDIT_EVENT_INVALID");
  const event={
   version:VERSION,sequence:this.count+1,
   requestId:input.requestId,phase:input.phase,
   decision:input.decision,reasonCode:input.reasonCode,
   previousHash:this.head
  };
  const record={...event,hash:sha(canonical(event))};
  const bytes=Buffer.from(JSON.stringify(record)+"\n","utf8");
  try{
   const stat=fs.lstatSync(this.file);
   if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||
      stat.size+bytes.length>MAX_BYTES)
    throw Error("AUDIT_FILE_UNSAFE");
   const fd=fs.openSync(this.file,"a");
   try{
    let offset=0;
    while(offset<bytes.length){
     const written=fs.writeSync(fd,bytes,offset,bytes.length-offset);
     if(written<=0)throw Error("AUDIT_SHORT_WRITE");
     offset+=written;
    }
    fs.fsyncSync(fd);
   }finally{fs.closeSync(fd)}
   this.count++;
   this.head=record.hash;
   return Object.freeze({sequence:this.count,hash:this.head});
  }catch{
   // A partial write may exist; never continue writing/authorizing.
   this.failed=true;
   throw Error("AUDIT_UNAVAILABLE");
  }
 }
 verify(){return verifyAuditFile(this.file,this.checkpoint())}
}
module.exports={VERSION,ZERO,OfflineAuditLedger,verifyAuditFile,enabled};
