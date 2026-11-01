"use strict";
/**
 * W2.8 — synthetic multi-instance trust propagation laboratory.
 * NOT a network protocol or production authorization. W2.7's independently
 * signed snapshots stay authoritative; a synchronous linearizable-in-fixture
 * head probe is required at the *final* sensitive-decision boundary.
 * A disconnected replica can NEVER authorize, even with a locally valid TTL.
 */
const {TrustedOfflineKeyring,snapshotValid,enabled,ZERO}=require("./w27-root-signed-trust-keyring.cjs");
function guard(){if(!enabled()||process.env.TTO_W28_SYNC_LAB!=="1")throw Error("W28_LAB_DISABLED")}
function safeCheckpoint(x){return x&&Number.isSafeInteger(x.epoch)&&x.epoch>=1&&typeof x.head==="string"&&/^[0-9a-f]{64}$/.test(x.head)}
class SyntheticTrustAuthority {
 #ring;#history=[];#up=true;
 constructor({pinnedRootPublicPem,clock}){guard();this.#ring=new TrustedOfflineKeyring({pinnedRootPublicPem,clock})}
 publish(signed){guard();const cp=this.#ring.apply(signed);this.#history.push(structuredClone(signed));return cp}
 setAvailable(v){guard();this.#up=v===true}
 current(){guard();if(!this.#up)throw Error("W28_AUTHORITY_UNAVAILABLE");return this.#ring.checkpoint()}
 since(epoch){guard();if(!this.#up)throw Error("W28_AUTHORITY_UNAVAILABLE");if(!Number.isSafeInteger(epoch)||epoch<0)throw Error("W28_CURSOR_INVALID");return structuredClone(this.#history.filter(s=>s.epoch>epoch))}
 // Fixture's single-threaded synchronous call models a serializable authority
 // read. Real multi-process implementations MUST supply a durable linearizable
 // read and handle revoke-vs-commit races transactionally.
 confirm(checkpoint){guard();if(!this.#up) return false;const current=this.#ring.checkpoint();return safeCheckpoint(checkpoint)&&current.epoch===checkpoint.epoch&&current.head===checkpoint.head}
}
class SyntheticTrustReplica {
 #ring;#authority;#state="COLD";#id;
 constructor({id,pinnedRootPublicPem,clock,authority}){
  guard();if(typeof id!=="string"||!id||!authority)throw Error("W28_CONFIG_INVALID");
  this.#id=id;this.#authority=authority;
  this.#ring=new TrustedOfflineKeyring({pinnedRootPublicPem,clock});
 }
 status(){return Object.freeze({id:this.#id,state:this.#state,...this.#ring.checkpoint()})}
 synchronize(){
  guard();this.#state="SYNCING";
  try{
   const snapshots=this.#authority.since(this.#ring.checkpoint().epoch);
   for(const s of snapshots)this.#ring.apply(s);
   const head=this.#authority.current(),local=this.#ring.checkpoint();
   if(local.epoch!==head.epoch||local.head!==head.head)throw Error("W28_HEAD_MISMATCH");
   this.#state="SYNCED";return this.status();
  }catch(e){this.#state="QUARANTINED";throw e}
 }
 // The last check must run at the *actual commit point* in any future
 // operational design; this fixture always returns a synthetic non-grant.
 evaluate(role,pem,{beforeFinalCheck}={}){
  guard();
  if(this.#state!=="SYNCED")return Object.freeze({ok:false,reason:"W28_REPLICA_NOT_SYNCED"});
  const local=this.#ring.check(role,pem);
  if(!local.ok){this.#state="QUARANTINED";return Object.freeze({ok:false,reason:local.reasonCode})}
  try{
   if(typeof beforeFinalCheck==="function")beforeFinalCheck();
   if(!this.#authority.confirm(this.#ring.checkpoint())){
    this.#state="QUARANTINED";
    return Object.freeze({ok:false,reason:"W28_AUTHORITY_HEAD_UNAVAILABLE_OR_CHANGED"});
   }
   // No real authorization is ever issued by this module.
   return Object.freeze({ok:true,simulationOnly:true,canGrantPermission:false,
    reason:"W28_SYNTHETIC_TRUST_VERIFIED",epoch:local.epoch});
  }catch{this.#state="QUARANTINED";return Object.freeze({ok:false,reason:"W28_AUTHORITY_CHECK_FAILED"})}
 }
}
module.exports={SyntheticTrustAuthority,SyntheticTrustReplica};
