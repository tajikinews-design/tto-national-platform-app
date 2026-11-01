"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {TrustedOfflineKeyring,enabled}=require("./w27-root-signed-trust-keyring.cjs");
const hash=x=>crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
function guard(){if(!enabled()||process.env.TTO_W29_PERSISTENCE_LAB!=="1")throw Error("W29_LAB_DISABLED")}
function read(p){try{return JSON.parse(fs.readFileSync(p,"utf8"))}catch{throw Error("W29_STORAGE_UNAVAILABLE")}}
function write(p,x){
 const tmp=p+"."+crypto.randomUUID();
 try{
  fs.writeFileSync(tmp,JSON.stringify(x),{flag:"wx",mode:0o600});
  const fd=fs.openSync(tmp,"r");try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  fs.renameSync(tmp,p);
  const dir=fs.openSync(path.dirname(p),"r");try{fs.fsyncSync(dir)}finally{fs.closeSync(dir)}
 }finally{try{fs.unlinkSync(tmp)}catch{}}
}
class OfflineDurableReplica {
 #journal;#witness;#root;#clock;#authority;#ring;#snapshots=[];#state="COLD";
 constructor({directory,witnessPath,pinnedRootPublicPem,clock,authority}){
  guard();if(!path.isAbsolute(directory)||!path.isAbsolute(witnessPath)||
   path.dirname(witnessPath)===directory)throw Error("W29_BAD_PATH");
  this.#journal=path.join(directory,"trust.json");this.#witness=witnessPath;
  this.#root=pinnedRootPublicPem;this.#clock=clock;this.#authority=authority;
  this.#ring=this.#fresh();
 }
 #fresh(){return new TrustedOfflineKeyring({pinnedRootPublicPem:this.#root,clock:this.#clock})}
 status(){return {state:this.#state,...this.#ring.checkpoint()}}
 #replay(snapshots){
  if(!Array.isArray(snapshots)||snapshots.length===0)throw Error("W29_EMPTY_HISTORY");
  const ring=this.#fresh();
  for(const snapshot of snapshots)ring.apply(snapshot);
  return ring;
 }
 #verify(){
  const j=read(this.#journal),w=read(this.#witness);
  if(j.version!==1||w.version!==1||hash(j)!==w.digest)throw Error("W29_ROLLBACK_OR_CORRUPT");
  const ring=this.#replay(j.snapshots),head=ring.checkpoint();
  if(head.epoch!==j.head.epoch||head.head!==j.head.head||
     head.epoch!==w.head.epoch||head.head!==w.head.head)
   throw Error("W29_HEAD_MISMATCH");
  return {ring,snapshots:j.snapshots};
 }
 #save(list){
  const ring=this.#replay(list),head=ring.checkpoint();
  const journal={version:1,snapshots:list,head};
  write(this.#journal,journal);
  write(this.#witness,{version:1,digest:hash(journal),head});
  this.#ring=ring;this.#snapshots=structuredClone(list);
 }
 initialize(){
  guard();this.#state="QUARANTINED";
  if(fs.existsSync(this.#journal)||fs.existsSync(this.#witness))
   throw Error("W29_RECOVERY_REQUIRED");
  this.#save(this.#authority.since(0));return this.sync();
 }
 recover(){
  guard();this.#state="QUARANTINED";
  const restored=this.#verify();
  this.#ring=restored.ring;this.#snapshots=structuredClone(restored.snapshots);
  return this.sync();
 }
 sync(){
  guard();this.#state="QUARANTINED";
  const updates=this.#authority.since(this.#ring.checkpoint().epoch);
  if(updates.length)this.#save([...this.#snapshots,...updates]);
  const remote=this.#authority.current(),local=this.#ring.checkpoint();
  if(remote.epoch!==local.epoch||remote.head!==local.head)
   throw Error("W29_AUTHORITY_MISMATCH");
  this.#verify();this.#state="SYNCED";return this.status();
 }
 check(role,pem){
  guard();if(this.#state!=="SYNCED")return {ok:false};
  try{
   const local=this.#ring.check(role,pem);
   const remote=this.#authority.current(),head=this.#ring.checkpoint();
   this.#verify();
   if(!local.ok||remote.epoch!==head.epoch||remote.head!==head.head)
    throw Error("W29_UNVERIFIED");
   return {ok:true,simulationOnly:true,canGrantPermission:false};
  }catch{this.#state="QUARANTINED";return {ok:false}}
 }
}
module.exports={OfflineDurableReplica};
