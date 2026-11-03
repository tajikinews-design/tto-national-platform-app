"use strict";
// Issue #154: single-event CF02 consumer adapter. NO start loop, SQL grants or deploy.
// All database checks and durable ack are delegated to independently authorized ports.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCEPTED=new Set(["PROJECTED","ALREADY_PROJECTED"]);
const QUARANTINE=new Set(["UNKNOWN_SOURCE_EVENT","SOURCE_RELATIONSHIP_INVALID","SOURCE_DECISION_INVALID","STALE_OR_CONFLICTING_SOURCE_VERSION","SOURCE_VERSION_GAP","LEGACY_OR_ACTIVE_PROJECTION_CONFLICT"]);
const REQUIRED=["event_id","tenant_id","party_id","relationship_id","source_version","event_name"];
function validate(event){
 if(!event||typeof event!=="object"||Array.isArray(event)||REQUIRED.some(k=>!Object.hasOwn(event,k)))return false;
 if(!["event_id","tenant_id","party_id","relationship_id"].every(k=>typeof event[k]==="string"&&UUID.test(event[k])))return false;
 return event.event_name==="MEMBERSHIP_APPROVED"&&Number.isSafeInteger(event.source_version)&&event.source_version>0;
}
function isPort(ports){return ports&&["readSource","project","ack","quarantine","retry"].every(k=>typeof ports[k]==="function")}
async function consumeOne(envelope,{enabled=false,authorized=false,ports}={}){
 // Fail closed without accessing input or persistence when gate/authority absent.
 if(enabled!==true||authorized!==true||!isPort(ports))return {status:"DISABLED"};
 if(!validate(envelope))return {status:"REJECTED_ENVELOPE"};
 const event=await ports.readSource(envelope.event_id,envelope.tenant_id);
 // Never rely on untrusted message metadata; validate all source fields.
 if(!validate(event)||REQUIRED.some(k=>event[k]!==envelope[k])){
  await ports.quarantine(envelope.event_id,envelope.tenant_id,"SOURCE_MISMATCH");
  return {status:"QUARANTINED"};
 }
 let outcome;
 try{ outcome=await ports.project(event.tenant_id,event.event_id); }
 catch(_error){
  await ports.retry(event.event_id,event.tenant_id,"PROJECTOR_UNAVAILABLE");
  return {status:"RETRY"};
 }
 if(ACCEPTED.has(outcome)){
  // Ack only after project() confirms durable database commit.
  // If ack fails, caller redelivers and projector's immutable receipt is idempotent.
  await ports.ack(event.event_id,event.tenant_id);
  return {status:outcome==="PROJECTED"?"ACKED":"ACKED_REPLAY"};
 }
 if(QUARANTINE.has(outcome)){
  await ports.quarantine(event.event_id,event.tenant_id,outcome);
  return {status:"QUARANTINED"};
 }
 if(outcome==="DENIED")return {status:"DENIED"};
 await ports.retry(event.event_id,event.tenant_id,"UNKNOWN_PROJECTOR_RESULT");
 return {status:"RETRY"};
}
module.exports={validate,consumeOne};
