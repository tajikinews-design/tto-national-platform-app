"use strict";
// W2.14 synthetic owner token registry: isolated single authoritative broker.
const {OfflineRecoveryCoordinator,initialize}=require("./w212-crash-recovery-coordinator.cjs");
function gate(){if(process.env.CI!=="true"||process.env.NODE_ENV!=="test"||process.env.TTO_W214_OWNER_LAB!=="1"||process.env.DATABASE_URL||process.env.VERCEL)throw Error("W214_DISABLED")}
class SyntheticOwnerRegistry{
 #owner=null;#term=0;#live=true;#journal;
 constructor(file,{create=false}={}){gate();if(create)initialize(file);this.#journal=new OfflineRecoveryCoordinator(file);this.#journal.recover()}
 availability(v){this.#live=v===true}
 claim(owner){gate();if(!this.#live)return {ok:false,reason:"UNAVAILABLE"};if(typeof owner!=="string"||!owner)return {ok:false,reason:"INVALID"};
 if(this.#owner!==null)return {ok:false,reason:"HELD"};
 this.#owner=owner;this.#term++;return {ok:true,term:this.#term,simulationOnly:true}}
 release(owner,term){gate();if(!this.#live||owner!==this.#owner||term!==this.#term)return {ok:false};this.#owner=null;return {ok:true}}
 fence(owner,term){return this.#live&&owner===this.#owner&&term===this.#term&&this.#journal.state().state==="READY"}
 commit(owner,term,id,epoch){gate();if(!this.fence(owner,term))return {ok:false,reason:"STALE_OWNER"};
 const r=this.#journal.commit({id,expectedEpoch:epoch});return r.ok?{...r,canGrantPermission:false}:r}
 revoke(owner,term){gate();return this.fence(owner,term)?this.#journal.revoke():{ok:false,reason:"STALE_OWNER"}}
 status(){return {owner:this.#owner,term:this.#term,...this.#journal.state()}}
 // Crash transition is an explicit lab-only supervisor action; no lease timeout.
 crashOwner(owner,term){gate();if(!this.fence(owner,term))return false;this.#owner=null;return true}
}
module.exports={SyntheticOwnerRegistry};
