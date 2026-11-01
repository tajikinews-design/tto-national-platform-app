"use strict";
/* W2.12 synthetic crash-recoverable coordinator.
 * One local append-only authenticated-by-hash fixture, no real transaction.
 */
const fs=require("node:fs"),crypto=require("node:crypto"),path=require("node:path");
const ZERO="0".repeat(64);
function gated(){if(process.env.CI!=="true"||process.env.NODE_ENV!=="test"||
 process.env.TTO_W212_RECOVERY_LAB!=="1"||process.env.DATABASE_URL||
 process.env.VERCEL||process.env.TTO_API_BASE_URL)throw Error("W212_DISABLED")}
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
function record(line){const x=JSON.parse(line);
 if(!x||Object.keys(x).sort().join(",")!=="action,epoch,hash,id,previous,sequence"||
 !Number.isSafeInteger(x.epoch)||x.epoch<1||
 !Number.isSafeInteger(x.sequence)||x.sequence<1||
 typeof x.id!=="string"||!/^[a-f0-9]{64}$/.test(x.previous)||
 typeof x.action!=="string"||!/^[a-f0-9]{64}$/.test(x.hash)||
 sha(JSON.stringify([x.sequence,x.previous,x.epoch,x.action,x.id]))!==x.hash)
 throw Error("W212_LOG_INTEGRITY");
 return x;
}
class OfflineRecoveryCoordinator{
 #file;#head=ZERO;#sequence=0;#epoch=1;#active=true;#decisions=new Set();#state="COLD";
 constructor(file){gated();if(!path.isAbsolute(file))throw Error("W212_PATH_INVALID");this.#file=file}
 state(){return {state:this.#state,epoch:this.#epoch,sequence:this.#sequence,active:this.#active}}
 recover(){
  gated();this.#state="QUARANTINED";this.#head=ZERO;this.#sequence=0;this.#epoch=1;this.#active=true;this.#decisions.clear();
  const raw=fs.readFileSync(this.#file,"utf8");
  if(raw&&!raw.endsWith("\n"))throw Error("W212_TORN_TAIL");
  for(const line of raw.split("\n").filter(Boolean)){
   const r=record(line);
   if(r.previous!==this.#head||r.sequence!==this.#sequence+1||
    r.epoch<this.#epoch)throw Error("W212_CHAIN_ROLLBACK");
   if(r.action==="REVOKE"){
    if(r.epoch!==this.#epoch+1)throw Error("W212_EPOCH_INVALID");
    this.#epoch=r.epoch;this.#active=false;
   }else if(r.action==="ROTATE"){
    if(r.epoch!==this.#epoch+1)throw Error("W212_EPOCH_INVALID");
    this.#epoch=r.epoch;this.#active=true;
   }else if(r.action==="COMMIT"){
    if(r.epoch!==this.#epoch||!this.#active||this.#decisions.has(r.id))
     throw Error("W212_COMMIT_REPLAY_OR_REVOKED");
    this.#decisions.add(r.id);
   }else throw Error("W212_UNKNOWN_EVENT");
   this.#sequence=r.sequence;this.#head=r.hash;
  }
  this.#state="READY";return this.state();
 }
 #append(action,id,epoch){
  if(this.#state!=="READY")return {ok:false,reason:"W212_QUARANTINED"};
  const sequence=this.#sequence+1,previous=this.#head;
  const hash=sha(JSON.stringify([sequence,previous,epoch,action,id]));
  const fd=fs.openSync(this.#file,"a");
  try{fs.writeSync(fd,JSON.stringify({sequence,previous,epoch,action,id,hash})+"\n");fs.fsyncSync(fd)}
  finally{fs.closeSync(fd)}
  this.#sequence=sequence;this.#head=hash;
  return {ok:true,sequence};
 }
 revoke(){gated();const next=this.#epoch+1;const r=this.#append("REVOKE","authority",next);
  if(r.ok){this.#epoch=next;this.#active=false}return r}
 rotate(){gated();const next=this.#epoch+1;const r=this.#append("ROTATE","authority",next);
  if(r.ok){this.#epoch=next;this.#active=true}return r}
 commit({id,expectedEpoch}){
  gated();
  if(typeof id!=="string"||!id||!Number.isSafeInteger(expectedEpoch)||
   this.#state!=="READY"||this.#epoch!==expectedEpoch||!this.#active||
   this.#decisions.has(id))return {ok:false,reason:"W212_FENCED_OR_DUPLICATE"};
  try{
   const r=this.#append("COMMIT",id,expectedEpoch);
   if(!r.ok)return r;
   this.#decisions.add(id);
   return {ok:true,simulationOnly:true,canGrantPermission:false,sequence:r.sequence};
  }catch{this.#state="QUARANTINED";return {ok:false,reason:"W212_OUTCOME_UNKNOWN"}}
 }
 // Torn, damaged, or uncertain append requires explicit recovery and cannot
 // be automatically retried as a new effect.
}
function initialize(file){gated();fs.writeFileSync(file,"",{flag:"wx",mode:0o600})}
module.exports={OfflineRecoveryCoordinator,initialize};
