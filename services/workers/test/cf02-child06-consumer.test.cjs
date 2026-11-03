"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {consumeOne,validate}=require("../src/cf02-child06-consumer.cjs");
const e={event_id:"00000000-0000-4000-8000-000000000001",tenant_id:"00000000-0000-4000-8000-000000000002",party_id:"00000000-0000-4000-8000-000000000003",relationship_id:"00000000-0000-4000-8000-000000000004",source_version:1,event_name:"MEMBERSHIP_APPROVED"};
function setup({source=e,result="PROJECTED",error=false}={}){
 const calls=[];
 const ports={readSource:async()=>{calls.push("read");return source},
 project:async()=>{calls.push("project");if(error)throw Error("unsafe database error");return result},
 ack:async()=>{calls.push("ack")},quarantine:async()=>{calls.push("quarantine")},retry:async()=>{calls.push("retry")}};
 return {ports,calls};
}
async function run(s,envelope=e,options={}){return consumeOne(envelope,{enabled:true,authorized:true,ports:s.ports,...options})}
test("CONS-01 mismatched tenant/Party/source rejected without projection",async()=>{const s=setup({source:{...e,party_id:"00000000-0000-4000-8000-000000000099"}});assert.equal((await run(s)).status,"QUARANTINED");assert.deepEqual(s.calls,["read","quarantine"])});
test("CONS-02 source gaps and stale projector outcome quarantined",async()=>{for(const result of ["SOURCE_VERSION_GAP","STALE_OR_CONFLICTING_SOURCE_VERSION"]){const s=setup({result});assert.equal((await run(s)).status,"QUARANTINED");assert.deepEqual(s.calls,["read","project","quarantine"]) }});
test("CONS-03 duplicate exact event acknowledged without duplicate adapter projection write",async()=>{const s=setup({result:"ALREADY_PROJECTED"});assert.equal((await run(s)).status,"ACKED_REPLAY");assert.deepEqual(s.calls,["read","project","ack"])});
test("CONS-04 transient projector crash never acknowledges",async()=>{const s=setup({error:true});assert.equal((await run(s)).status,"RETRY");assert.deepEqual(s.calls,["read","project","retry"])});
test("CONS-05 no adapter-level concurrency promises; backend must serialize",()=>{assert.equal(typeof consumeOne,"function");assert.equal(validate(e),true)});
test("CONS-06 disabled gate and no approved service principal have zero side effects",async()=>{const s=setup();assert.equal((await run(s,e,{enabled:false})).status,"DISABLED");assert.equal((await run(s,e,{authorized:false})).status,"DISABLED");assert.deepEqual(s.calls,[])});
test("CONS-07 tenant cross-talk fails source comparison",async()=>{const s=setup({source:{...e,tenant_id:"00000000-0000-4000-8000-000000000099"}});assert.equal((await run(s)).status,"QUARANTINED");assert.ok(!s.calls.includes("project"))});
test("CONS-08 unavailable projector retries without ack",async()=>{const s=setup({error:true});assert.equal((await run(s)).status,"RETRY");assert.ok(!s.calls.includes("ack"))});
test("CONS-09 no ports means fail closed without IO",async()=>{assert.deepEqual(await consumeOne(e,{enabled:true,authorized:true}),{status:"DISABLED"})});
test("CONS-10 no secret or original errors in result",async()=>{const s=setup({error:true});const response=await run(s);assert.deepEqual(response,{status:"RETRY"});assert.ok(!JSON.stringify(response).includes("unsafe database error"))});
test("CONS-11 unhandled MEMBERSHIP_ENDED rejected as envelope",async()=>{const s=setup();assert.equal((await run(s,{...e,event_name:"MEMBERSHIP_ENDED"})).status,"REJECTED_ENVELOPE");assert.deepEqual(s.calls,[])});
test("CONS-12 safe success ack and zero implicit other side effects",async()=>{const s=setup();assert.equal((await run(s)).status,"ACKED");assert.deepEqual(s.calls,["read","project","ack"])});
