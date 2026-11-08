"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const os=require("node:os"),fs=require("node:fs"),path=require("node:path");
const {generateKeyPairSync,randomUUID}=require("node:crypto");
process.env.TTO_PH12_MOCK_ISSUER_LAB="1";
const {makeMockIssuer,MockIssuerVerifier,newRecord,signedEnvelope}=require("./ph12-mock-official-issuer.cjs");
const TENANT="SYNTHETIC_TENANT_A",ENTITY="SYNTHETIC_ENTITY_A";
async function lab(run){
 const issuer=makeMockIssuer(),baseUrl=await issuer.start();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ph12-lab-"));
 const checkpointFile=path.join(dir,"checkpoint.json");
 const verifier=()=>new MockIssuerVerifier({baseUrl,publicKey:issuer.publicKey,checkpointFile});
 issuer.setRecord(TENANT,ENTITY,newRecord());
 try{await run({issuer,baseUrl,dir,checkpointFile,verifier});}
 finally{await issuer.stop();fs.rmSync(dir,{recursive:true,force:true});}
}
function assertHold(r,reason){
 assert.equal(r.state,reason);assert.equal(r.official,false);assert.equal(r.active,false);
}
function assertLabEligible(r){
 assert.equal(r.state,"MOCK_ELIGIBLE_IN_LAB_ONLY");
 assert.equal(r.official,false);assert.equal(r.active,false);
}
test("PH12 signed HTTP: matching synthetic identity and pinned public key",async()=>{
 await lab(async({verifier})=>{
  const r=await verifier().check(TENANT,ENTITY);
  assertLabEligible(r);assert.equal(r.syntheticVersion,1);
 });
});
test("PH12 signed HTTP: same version fresh revalidation not replay from cache",async()=>{
 await lab(async({verifier,issuer})=>{
  const v=verifier();assertLabEligible(await v.check(TENANT,ENTITY));
  issuer.setOffline(true);
  assertHold(await v.check(TENANT,ENTITY),"MOCK_HOLD_SOURCE_UNAVAILABLE");
  issuer.setOffline(false);
  assertLabEligible(await v.check(TENANT,ENTITY));
 });
});
test("PH12 signed HTTP: tampering signed status rejects signature",async()=>{
 await lab(async({issuer,verifier})=>{
  issuer.setTransform(e=>{e.payload.status="REVOKED";return e;});
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_BAD_SIGNATURE");
 });
});
test("PH12 signed HTTP: signer key mismatch is denied",async()=>{
 await lab(async({issuer,baseUrl,checkpointFile})=>{
  const other=generateKeyPairSync("ed25519").publicKey;
  const verifier=new MockIssuerVerifier({baseUrl,publicKey:other,checkpointFile});
  assertHold(await verifier.check(TENANT,ENTITY),"MOCK_HOLD_BAD_SIGNATURE");
 });
});
test("PH12 signed HTTP: wrong issuer ID with valid test key denied",async()=>{
 await lab(async({issuer,verifier})=>{
  issuer.setTransform(e=>signedEnvelope({...e.payload,issuerId:"UNRELATED_ISSUER"},issuer.privateKey));
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_WRONG_BINDING");
 });
});
test("PH12 signed HTTP: cross-tenant signed response denied",async()=>{
 await lab(async({issuer,verifier})=>{
  issuer.setTransform(e=>signedEnvelope({...e.payload,tenantId:"SYNTHETIC_OTHER"},issuer.privateKey));
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_WRONG_BINDING");
 });
});
test("PH12 signed HTTP: cross-entity signed response denied",async()=>{
 await lab(async({issuer,verifier})=>{
  issuer.setTransform(e=>signedEnvelope({...e.payload,entityId:"SYNTHETIC_OTHER"},issuer.privateKey));
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_WRONG_BINDING");
 });
});
test("PH12 signed HTTP: challenge nonce blocks captured-envelope replay",async()=>{
 await lab(async({issuer,verifier})=>{
  let captured;
  issuer.setTransform(e=>{if(!captured)captured=e;return captured;});
  const v=verifier();assertLabEligible(await v.check(TENANT,ENTITY));
  assertHold(await v.check(TENANT,ENTITY),"MOCK_HOLD_WRONG_BINDING");
 });
});
test("PH12 signed HTTP: expired issuer document denied",async()=>{
 await lab(async({issuer,verifier})=>{
  issuer.setRecord(TENANT,ENTITY,newRecord({
   observedAt:new Date(Date.now()-7200000).toISOString(),
   expiresAt:new Date(Date.now()-3600000).toISOString()
  }));
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_EXPIRED_OR_FUTURE");
 });
});
test("PH12 signed HTTP: future-dated issuer document denied",async()=>{
 await lab(async({issuer,verifier})=>{
  issuer.setRecord(TENANT,ENTITY,newRecord({
   observedAt:new Date(Date.now()+3600000).toISOString(),
   expiresAt:new Date(Date.now()+7200000).toISOString()
  }));
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_EXPIRED_OR_FUTURE");
 });
});
test("PH12 signed HTTP: monotonic v2 and persisted v1 rollback prevention across restart",async()=>{
 await lab(async({issuer,verifier})=>{
  const v=verifier();assertLabEligible(await v.check(TENANT,ENTITY));
  issuer.setRecord(TENANT,ENTITY,newRecord({version:2,recordHash:"a".repeat(64)}));
  assertLabEligible(await v.check(TENANT,ENTITY));
  issuer.setRecord(TENANT,ENTITY,newRecord());
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_VERSION_ROLLBACK");
 });
});
test("PH12 signed HTTP: same version with different signed content detected",async()=>{
 await lab(async({issuer,verifier})=>{
  const v=verifier();assertLabEligible(await v.check(TENANT,ENTITY));
  issuer.setRecord(TENANT,ENTITY,newRecord({recordHash:"b".repeat(64)}));
  assertHold(await v.check(TENANT,ENTITY),"MOCK_HOLD_VERSION_EQUIVOCATION");
 });
});
test("PH12 signed HTTP: signed revocation persists and blocks resurrection",async()=>{
 await lab(async({issuer,verifier})=>{
  const v=verifier();assertLabEligible(await v.check(TENANT,ENTITY));
  issuer.setRecord(TENANT,ENTITY,newRecord({version:2,recordHash:"b".repeat(64),status:"REVOKED"}));
  assertHold(await v.check(TENANT,ENTITY),"MOCK_HOLD_REVOKED");
  issuer.setRecord(TENANT,ENTITY,newRecord({version:3,recordHash:"c".repeat(64),status:"CURRENT"}));
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_REVOKED");
 });
});
test("PH12 signed HTTP: temporary outage fails closed and recovery requires new signed reply",async()=>{
 await lab(async({issuer,verifier})=>{
  const v=verifier();assertLabEligible(await v.check(TENANT,ENTITY));
  issuer.setOffline(true);
  assertHold(await v.check(TENANT,ENTITY),"MOCK_HOLD_SOURCE_UNAVAILABLE");
  issuer.setOffline(false);
  issuer.setRecord(TENANT,ENTITY,newRecord({version:2,recordHash:"d".repeat(64)}));
  assertLabEligible(await v.check(TENANT,ENTITY));
 });
});
test("PH12 signed HTTP: corrupt durable checkpoint fails closed, not reset",async()=>{
 await lab(async({verifier,checkpointFile})=>{
  const v=verifier();assertLabEligible(await v.check(TENANT,ENTITY));
  fs.writeFileSync(checkpointFile,'{"malformed":true}');
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_CHECKPOINT_OR_VALIDATION_ERROR");
 });
});
test("PH12 signed HTTP: absent record returns HOLD, not implicit new tenant",async()=>{
 await lab(async({verifier})=>{
  assertHold(await verifier().check(TENANT,"SYNTHETIC_NOT_REGISTERED"),
    "MOCK_HOLD_SOURCE_UNAVAILABLE");
 });
});
test("PH12 signed HTTP: malformed key identity denied",async()=>{
 await lab(async({issuer,verifier})=>{
  issuer.setTransform(e=>{e.protectedHeader.kid="PH12_UNTRUSTED";return e;});
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_MALFORMED_ENVELOPE");
 });
});
test("PH12 signed HTTP: oversized response envelope denied",async()=>{
 await lab(async({issuer,verifier})=>{
  issuer.setTransform(e=>{e.padding="x".repeat(9000);return e;});
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_OVERSIZED");
 });
});
test("PH12 signed HTTP: noncanonical extra envelope metadata denied",async()=>{
 await lab(async({issuer,verifier})=>{
  issuer.setTransform(e=>({...e,trusted:true}));
  assertHold(await verifier().check(TENANT,ENTITY),"MOCK_HOLD_MALFORMED_ENVELOPE");
 });
});
test("PH12 signed HTTP: concurrent checks serialize on one checkpoint",async()=>{
 await lab(async({verifier})=>{
  const v=verifier();const all=await Promise.all(
   Array.from({length:5},()=>v.check(TENANT,ENTITY)));
  for(const x of all)assertLabEligible(x);
 });
});
test("PH12 signed HTTP: cannot instantiate production-capable client",async()=>{
 await lab(async({baseUrl,issuer,checkpointFile})=>{
  assert.throws(()=>new MockIssuerVerifier({
    baseUrl:"https://registry.example.org",publicKey:issuer.publicKey,checkpointFile
  }),/LOOPBACK_ONLY/);
  assert.throws(()=>new MockIssuerVerifier({
    baseUrl:"http://0.0.0.0:1234",publicKey:issuer.publicKey,checkpointFile
  }),/LOOPBACK_ONLY/);
  assert.equal(baseUrl.startsWith("http://127.0.0.1:"),true);
 });
});
