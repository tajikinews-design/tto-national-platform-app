"use strict";
/** W2.10 deterministic, in-process serializable commit-fencing fixture.
 * No external DB, network, operational grant or distributed consensus.
 */
const {enabled}=require("./w27-root-signed-trust-keyring.cjs");
function gate(){if(!enabled()||process.env.TTO_W210_FENCE_LAB!=="1")throw Error("W210_LAB_DISABLED")}
const isHead=x=>x&&Number.isSafeInteger(x.epoch)&&x.epoch>=1&&
 typeof x.head==="string"&&/^[a-f0-9]{64}$/.test(x.head);
class SyntheticCommitFencer{
 #authority;#events=[];#sequence=0;#online=true;#pending=new Map();
 constructor({authority}){gate();if(!authority)throw Error("W210_BAD_AUTHORITY");this.#authority=authority}
 setAvailable(v){gate();this.#online=v===true}
 #current(){if(!this.#online)throw Error("W210_FENCE_UNAVAILABLE");return this.#authority.current()}
 prepare({id,head,role,pem,verify}){
  gate();if(typeof id!=="string"||!id||this.#pending.has(id)||!isHead(head)||
   typeof verify!=="function"||typeof role!=="string"||typeof pem!=="string")
   return {ok:false,reason:"W210_PREPARE_INVALID"};
  try{
   const current=this.#current();
   if(current.epoch!==head.epoch||current.head!==head.head||verify(role,pem)!==true)
    return {ok:false,reason:"W210_TRUST_STALE_OR_REVOKED"};
   const ticket={id,head:structuredClone(head),role,pem};
   this.#pending.set(id,ticket);
   return {ok:true,id,simulationOnly:true};
  }catch{return {ok:false,reason:"W210_PREPARE_UNAVAILABLE"}}
 }
 // All changes in this fixture run on one JS event loop; commit and
 // authority update must be serialized in same boundary by test scheduler.
 commit(id,{verify,beforeLinearization}={}){
  gate();const t=this.#pending.get(id);
  if(!t)return {ok:false,reason:"W210_TICKET_MISSING"};
  this.#pending.delete(id); // one shot, including failed attempt
  try{
   if(typeof beforeLinearization==="function")beforeLinearization();
   const current=this.#current();
   if(!isHead(current)||current.epoch!==t.head.epoch||current.head!==t.head.head||
    typeof verify!=="function"||verify(t.role,t.pem)!==true)
    return {ok:false,reason:"W210_FENCED_STALE"};
   const record={id,sequence:++this.#sequence,epoch:current.epoch,head:current.head,
    synthetic:true,canGrantPermission:false};
   this.#events.push(Object.freeze(record));
   return {ok:true,record,simulationOnly:true,canGrantPermission:false};
  }catch{return {ok:false,reason:"W210_FENCE_UNAVAILABLE"}}
 }
 events(){return this.#events.map(x=>({...x}))}
 // Failed or lost attempt never gets automatically accepted on recovery.
 abort(id){gate();return this.#pending.delete(id)}
 restart(){gate();this.#pending.clear();this.#online=false}
 recover(){gate();this.#current();this.#online=true} // fail closed if unavailable
}
module.exports={SyntheticCommitFencer};
