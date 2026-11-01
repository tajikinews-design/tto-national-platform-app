"use strict";
// W2.13 experimental IPC broker + W2.12 recovery journal.
// One designated writer only; NO cross-process file arbitration.
const {OfflineRecoveryCoordinator,initialize}=require("./w212-crash-recovery-coordinator.cjs");
function guard(){if(process.env.CI!=="true"||process.env.NODE_ENV!=="test"||
 process.env.TTO_W213_INTEGRATION_LAB!=="1"||process.env.DATABASE_URL||
 process.env.TTO_API_BASE_URL||process.env.VERCEL)throw Error("W213_DISABLED")}
class RecoveredIpcBroker {
 #coord;#tickets=new Map();#boot;#connected=true;
 constructor({file,create=false}){guard();if(create)initialize(file);
  this.#coord=new OfflineRecoveryCoordinator(file);this.#coord.recover();
  this.#boot=Symbol("restart-invalidates-prepared-tickets");
 }
 status(){return this.#coord.state()}
 partition(online){this.#connected=online===true}
 dispatch(owner,action,payload={}){
  guard();
  if(!this.#connected)return {ok:false,reason:"W213_PARTITION"};
  if(action==="PREPARE"){
   const state=this.#coord.state(),id=payload.ticket;
   if(!state.active||typeof id!=="string"||!id||
     this.#tickets.has(id)||state.state!=="READY")
    return {ok:false,reason:"W213_PREPARE_DENIED"};
   this.#tickets.set(id,{owner,epoch:state.epoch,boot:this.#boot});
   return {ok:true,epoch:state.epoch,simulationOnly:true};
  }
  if(action==="COMMIT"){
   const t=this.#tickets.get(payload.ticket);
   if(!t||t.owner!==owner||t.boot!==this.#boot)return {ok:false,reason:"W213_NO_TICKET"};
   this.#tickets.delete(payload.ticket);
   return this.#coord.commit({id:payload.ticket,expectedEpoch:t.epoch});
  }
  if(action==="REVOKE")return this.#coord.revoke();
  if(action==="ROTATE")return this.#coord.rotate();
  if(action==="STATUS")return {ok:true,...this.#coord.state()};
  return {ok:false,reason:"W213_UNKNOWN"};
 }
 // A failed/lost response after durable append is resolved by replaying the
 // ledger, not by blindly issuing a second side effect.
 killOwner(owner){for(const [k,t] of this.#tickets)if(t.owner===owner)this.#tickets.delete(k)}
}
module.exports={RecoveredIpcBroker};
