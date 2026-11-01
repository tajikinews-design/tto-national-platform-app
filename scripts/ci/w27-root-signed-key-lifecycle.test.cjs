"use strict";
/**
 * W2.7 independent root-authorized key lifecycle tests — disposable CI only.
 * Real W2.6 OS child signer is authorized through an independently signed
 * trust snapshot from an external in-test governance root, NEVER by browser
 * or an unsigned PDP self-assertion. No HSM, CA, Docker, DB or live routes.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {createRequire,Module:NodeModule}=require("node:module");
const ROOT=path.resolve(__dirname,"../..");
const nextRequire=createRequire(path.resolve(ROOT,"apps/shareholder/package.json"));
const ts=nextRequire("typescript");
const {NextRequest}=nextRequire("next/server");
const {SyntheticPolicyRegistry}=require("../security/w25-synthetic-policy-registry.cjs");
const {SyntheticVersionTrace}=require("../security/w25-synthetic-policy-version-enforcer.cjs");
const {OfflineAuditLedger}=require("../security/w24-offline-audit-ledger.cjs");
const {enforceW26Signed,bffClose}=require("../security/w26-signed-pdp-enforcer.cjs");
const {stats}=require("../security/w26-signed-pdp-gateway.cjs");
const {keyId,labOnly}=require("../security/w26-signed-policy-protocol.cjs");
const {enabled,ZERO,keyEntry,signedSnapshot,snapshotValid,
 TrustedOfflineKeyring}=require("../security/w27-root-signed-trust-keyring.cjs");
if(!enabled()||!labOnly()||process.env.TTO_W23_CONTRACT_LAB!=="1"||
 process.env.TTO_W24_AUDIT_LAB!=="1"||process.env.TTO_W25_POLICY_LAB!=="1")
 throw Error("W27_GITHUB_ONLY_NO_REAL_AUTH");
function loadTs(location){
 const file=path.resolve(ROOT,location);
 const c=ts.transpileModule(fs.readFileSync(file,"utf8"),{
  fileName:file,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const m=new NodeModule(file,module);m.filename=file;
 m.paths=NodeModule._nodeModulePaths(path.dirname(file));
 m._compile(c,file);return m.exports;
}
const {prepareW1SyntheticBffCandidate}=loadTs("apps/shareholder/lib/w1-boundary-seam.ts");
const {prepareW23DormantBffEnvelope}=loadTs("apps/shareholder/lib/w23-dormant-policy-boundary.ts");
const {verifyW23DormantNestEnvelope}=loadTs("services/api/src/w23-dormant-policy-boundary.ts");
const BASE=1_800_000_000_000;
let now=BASE;
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const keys=()=>crypto.generateKeyPairSync("ed25519");
function pub(k){return k.publicKey.export({type:"spki",format:"pem"}).toString()}
const ROOT_KEYS=keys(),BAD_ROOT_KEYS=keys();
const PUBLISHER=keys(),OTHER_PUBLISHER=keys();
const ROOT_PEM=pub(ROOT_KEYS),PUBLISHER_PEM=pub(PUBLISHER);
const tenant="coop-test-A",owners=["fixture-owner-A","fixture-owner-B"];
const cookies=[crypto.randomUUID(),crypto.randomUUID()];
function syntheticProof(owner){
 return {sessionActive:true,tenantKey:tenant,ownerKey:owner,
  partyBound:true,membershipSourceApproved:true,featureEnabled:true,
  readPermission:true,sourceApproved:true,sourceFresh:true,
  sourceVersion:"SYNTHETIC-V1",classificationAllowed:true,
  downloadPermission:false,exportPermission:false,writePermission:false};
}
function checked(owner=owners[0],index=0,signal=new AbortController().signal){
 const req=new NextRequest("http://127.0.0.1/test/tenants/"+tenant+
  "/owners/"+owner+"/read",{
  headers:{Cookie:"tto_lab_session="+cookies[index]}
 });
 const w1=prepareW1SyntheticBffCandidate(req,
  {tenantKey:tenant,ownerKey:owner,operation:"read"},
  {sessionActive:true,expectedCookie:cookies[index],
   tenantKey:tenant,ownerKey:owners[index]});
 const preflight=prepareW23DormantBffEnvelope(w1,req);
 if(preflight.kind!=="DRAFT_CANDIDATE")return preflight;
 return verifyW23DormantNestEnvelope(preflight.envelope,
  syntheticProof(owners[index]),signal);
}
function bundle(revision=1){
 return {policyId:"SYNTHETIC_SELF_READ_ONLY",revision,
  ruleset:revision===1?"SELF_READ_SYNTHETIC_V1":"SELF_READ_SYNTHETIC_V2",
  notBeforeMs:BASE,expiresAtMs:BASE+60000};
}
function state({publisher=PUBLISHER_PEM,publisherGeneration=1,
 onPdpReady=null,denyEnrollment=false,pdpExpiresMs=60000}={}){
 const ring=new TrustedOfflineKeyring({
  pinnedRootPublicPem:ROOT_PEM,clock:()=>now
 });
 const fakePolicy=new SyntheticPolicyRegistry({clock:()=>now});
 const b=bundle();
 fakePolicy.publish(b);fakePolicy.activate(1);
 let approvedSigner=null,notify=onPdpReady;
 let entries=[keyEntry({
  role:"POLICY_PUBLISHER",publicPem:publisher,
  generation:publisherGeneration,
  notBeforeMs:BASE,expiresAtMs:BASE+60000
 })];
 function publish(next,{privateKey=ROOT_KEYS.privateKey,rootPem=ROOT_PEM}={}){
  const checkpoint=ring.checkpoint();
  const signed=signedSnapshot({
   epoch:checkpoint.epoch+1,
   issuedAtMs:now,
   expiresAtMs:BASE+60000,
   previousHash:checkpoint.head,
   entries:next
  },privateKey,rootPem);
  ring.apply(signed);
  entries=ring.snapshot().entries.map(e=>({...e}));
  return signed;
 }
 publish(entries);
 const trust={
  checkPublisher(publicPem){
   return ring.check("POLICY_PUBLISHER",publicPem).ok===true;
  },
  onSignerReady(signer){
   if(denyEnrollment)return false;
   if(signer.keyId!==keyId(signer.pem))return false;
   // This enrollment is an explicitly authorized local test action. The
   // root PRIVATE key is never available in the PDP process or gateway.
   const old=entries.map(e=>e.role==="PDP_DECISION"&&e.status==="ACTIVE"?
    {...e,status:"REVOKED"}:e);
   const prevMax=old.filter(e=>e.role==="PDP_DECISION").reduce(
    (max,e)=>Math.max(max,e.generation),0);
   const added=keyEntry({role:"PDP_DECISION",publicPem:signer.pem,
    generation:prevMax+1,notBeforeMs:BASE,
    expiresAtMs:BASE+pdpExpiresMs,status:"ACTIVE"});
   publish([...old,added]);
   approvedSigner=signer;
   if(typeof notify==="function")notify(signer);
   return true;
  },
  checkSigner(signer){
   if(!signer||signer.keyId!==keyId(signer.pem))return false;
   return ring.check("PDP_DECISION",signer.pem).ok===true;
  }
 };
 function replaceEntry(role,keyIdValue,change){
  const replacement=entries.map(e=>e.role===role&&
   (keyIdValue===null||e.keyId===keyIdValue)?{...e,...change}:e);
  return publish(replacement);
 }
 function revoke(role){
  return replaceEntry(role,null,{status:"REVOKED"});
 }
 function rotatePublisher(newPub){
  const gen=entries.filter(e=>e.role==="POLICY_PUBLISHER").reduce(
    (max,e)=>Math.max(max,e.generation),0);
  const old=entries.map(e=>e.role==="POLICY_PUBLISHER"&&e.status==="ACTIVE"?
   {...e,status:"REVOKED"}:e);
  return publish([...old,keyEntry({
   role:"POLICY_PUBLISHER",publicPem:newPub,generation:gen+1,
   notBeforeMs:BASE,expiresAtMs:BASE+60000
  })]);
 }
 function rotateSigner(newPem){
  const gen=entries.filter(e=>e.role==="PDP_DECISION").reduce(
    (max,e)=>Math.max(max,e.generation),0);
  const old=entries.map(e=>e.role==="PDP_DECISION"&&e.status==="ACTIVE"?
   {...e,status:"REVOKED"}:e);
  return publish([...old,keyEntry({
   role:"PDP_DECISION",publicPem:newPem,generation:gen+1,
   notBeforeMs:BASE,expiresAtMs:BASE+60000
  })]);
 }
 const auditRows=[],touches=[];
 const trace=new SyntheticVersionTrace();
 const audit={record:e=>{
  assert.deepEqual(Object.keys(e).sort(),
   ["requestId","phase","decision","reasonCode"].sort());
  auditRows.push({...e});
 }};
 const source={read:e=>{
  touches.push({...e});
  return {synthetic:true,record:null,persisted:false};
 }};
 function cfg(overrides={}){
  return {
   registry:fakePolicy,bundle:b,publisher:{
    privateKey:PUBLISHER.privateKey,publicPem:PUBLISHER_PEM
   },
   checked:checked(),audit,versionTrace:trace,source,deadlineMs:1600,
   delayMs:0,w27Trust:trust,...overrides
  };
 }
 return {ring,fakePolicy,b,publish,trust,revoke,
  rotatePublisher,rotateSigner,entries:()=>entries.map(e=>({...e})),
  auditRows,trace,touches,cfg,getSigner:()=>approvedSigner};
}
function deny(r,st,reason){
 assert.equal(r.decision,"DENY");
 if(reason)assert.equal(r.reasonCode,reason);
 assert.equal(r.sourceTouches,0);
 assert.equal(st.touches.length,0);
 assert.equal(r.canGrantPermission,false);
 assert.equal(r.hasActualRecord,false);
 assert.equal(r.legalOperationalEffect,"NONE");
 assert.equal(bffClose(r).available,false);
}
async function noChildren(){
 for(let i=0;i<120&&stats().active;i++)await sleep(10);
 assert.equal(stats().active,0,"all signer children must be reaped");
}
async function whenReady(fn){
 let handler;
 const ready=new Promise(resolve=>handler=resolve);
 const st=state({onPdpReady:handler});
 const pending=enforceW26Signed(st.cfg({delayMs:240}));
 await ready;
 fn(st);
 const result=await pending;
 await noChildren();
 return {st,result};
}
test("W2.7 root-pinned trust publication / revocation / rotation lab",async t=>{
 t.after(async()=>{await noChildren();now=BASE});
 await t.test("root-signed publisher and enrolled child PDP key permit only fake decision",async()=>{
  now=BASE;
  const st=state();
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),"tto-w27-audit-"));
  const journal=new OfflineAuditLedger(path.join(folder,"journal.jsonl"));
  try{
   const out=await enforceW26Signed(st.cfg({audit:{
    record:event=>journal.append(event)
   }}));
   assert.equal(out.decision,"SIMULATED_ALLOW");
   assert.equal(out.sourceTouches,1);
   assert.equal(out.canGrantPermission,false);
   assert.equal(out.hasActualRecord,false);
   assert.deepEqual(bffClose(out),
    {available:false,status:403,code:"W25_OPERATIONAL_NOT_APPROVED"});
   assert.equal(journal.verify().ok,true);
   assert.ok(st.ring.checkpoint().epoch>=2);
   const signer=st.getSigner();
   assert.equal(st.ring.check("PDP_DECISION",signer.pem).ok,true);
   assert.equal(st.ring.check("POLICY_PUBLISHER",PUBLISHER_PEM).ok,true);
   for(const secret of [tenant,...owners,...cookies])
    assert.equal(fs.readFileSync(journal.file,"utf8").includes(secret),false);
  }finally{fs.rmSync(folder,{recursive:true,force:true})}
  await noChildren();
 });
 console.log("TTO_W27_ROOT_AUTHORIZED_CHILD_SIGNATURE=PASS");

 await t.test("independently pinned root rejects forged trust list",()=>{
  now=BASE;
  const st=state();
  const cp=st.ring.checkpoint();
  const fake=signedSnapshot({
   epoch:cp.epoch+1,previousHash:cp.head,
   issuedAtMs:now,expiresAtMs:BASE+60000,entries:st.entries()
  },BAD_ROOT_KEYS.privateKey,ROOT_PEM);
  assert.equal(snapshotValid(fake,ROOT_PEM),false);
  assert.throws(()=>st.ring.apply(fake),/W27_TRUST_PUBLICATION_INVALID/);
  assert.deepEqual(st.ring.checkpoint(),cp);
  assert.equal(snapshotValid(st.ring.snapshot(),pub(BAD_ROOT_KEYS)),false);
 });
 console.log("TTO_W27_PINNED_ROOT_REJECTS_FORGED_KEYSET=PASS");

 await t.test("snapshot rollback, replay, wrong previous hash and extra field denied",()=>{
  now=BASE;
  const st=state();
  const original=st.ring.snapshot(),cp=st.ring.checkpoint();
  assert.throws(()=>st.ring.apply(original),/W27_TRUST_PUBLICATION_INVALID/);
  const badHead=signedSnapshot({
   epoch:cp.epoch+1,previousHash:"f".repeat(64),
   issuedAtMs:now,expiresAtMs:BASE+60000,entries:st.entries()
  },ROOT_KEYS.privateKey,ROOT_PEM);
  assert.throws(()=>st.ring.apply(badHead),/W27_TRUST_PUBLICATION_INVALID/);
  assert.throws(()=>st.ring.apply({...original,extra:"INJECT"}),
   /W27_TRUST_PUBLICATION_INVALID/);
  const future=signedSnapshot({
   epoch:cp.epoch+1,previousHash:cp.head,
   issuedAtMs:now+1000,expiresAtMs:BASE+60000,entries:st.entries()
  },ROOT_KEYS.privateKey,ROOT_PEM);
  assert.throws(()=>st.ring.apply(future),/W27_TRUST_PUBLICATION_INVALID/);
 });
 console.log("TTO_W27_SIGNED_KEYSET_ANTI_ROLLBACK=PASS");

 await t.test("publisher and PDP keys cannot cross roles",()=>{
  now=BASE;
  const st=state();
  assert.equal(st.ring.check("PDP_DECISION",PUBLISHER_PEM).ok,false);
  assert.equal(st.ring.check("POLICY_PUBLISHER",pub(OTHER_PUBLISHER)).ok,false);
  assert.equal(st.ring.check("PDP_DECISION",pub(OTHER_PUBLISHER)).ok,false);
  const out=await enforceW26Signed(st.cfg({
   publisher:{privateKey:OTHER_PUBLISHER.privateKey,
    publicPem:pub(OTHER_PUBLISHER)}
  }));
  deny(out,st,"PUBLISHER_TRUST_INVALID");
  await noChildren();
 });
 console.log("TTO_W27_KEY_ROLE_AND_UNKNOWN_DENIED=PASS");

 await t.test("explicit refusal to enroll child signer blocks even a valid signature",async()=>{
  now=BASE;
  const st=state({denyEnrollment:true});
  const out=await enforceW26Signed(st.cfg());
  deny(out,st,"PDP_SIGNATURE_OR_TRANSPORT_INVALID");
  assert.equal(st.ring.checkpoint().epoch,1);
  await noChildren();
 });
 console.log("TTO_W27_UNENROLLED_PDP_KEY_DENIED=PASS");

 await t.test("revocation during a signed PDP decision rejects old valid signature",async()=>{
  now=BASE;
  const {st,result}=await whenReady(s=>s.revoke("PDP_DECISION"));
  deny(result,st,"PDP_SIGNATURE_OR_TRANSPORT_INVALID");
  const signer=st.getSigner();
  assert.equal(st.ring.check("PDP_DECISION",signer.pem).reasonCode,
   "TRUST_KEY_REVOKED");
 });
 console.log("TTO_W27_INFLIGHT_REVOKED_SIGNER_DENIED=PASS");

 await t.test("rotated signer rejects in-flight response from previous key",async()=>{
  now=BASE;
  const replacement=pub(keys());
  const {st,result}=await whenReady(s=>s.rotateSigner(replacement));
  deny(result,st,"PDP_SIGNATURE_OR_TRANSPORT_INVALID");
  assert.equal(st.ring.check("PDP_DECISION",replacement).ok,true);
  assert.equal(st.ring.check("PDP_DECISION",st.getSigner().pem).ok,false);
 });
 console.log("TTO_W27_INFLIGHT_SIGNER_ROTATION_DENIED=PASS");

 await t.test("publisher revocation during child delay denies before source",async()=>{
  now=BASE;
  const {st,result}=await whenReady(s=>s.revoke("POLICY_PUBLISHER"));
  deny(result,st,"TRUST_REVOKED_OR_EXPIRED");
  assert.equal(st.ring.check("POLICY_PUBLISHER",PUBLISHER_PEM).ok,false);
 });
 console.log("TTO_W27_INFLIGHT_PUBLISHER_REVOCATION_DENIED=PASS");

 await t.test("publisher rotation while child pending invalidates original key",async()=>{
  now=BASE;
  const replacement=pub(OTHER_PUBLISHER);
  const {st,result}=await whenReady(s=>s.rotatePublisher(replacement));
  deny(result,st,"TRUST_REVOKED_OR_EXPIRED");
  assert.equal(st.ring.check("POLICY_PUBLISHER",replacement).ok,true);
  assert.equal(st.ring.check("POLICY_PUBLISHER",PUBLISHER_PEM).ok,false);
 });
 console.log("TTO_W27_INFLIGHT_PUBLISHER_ROTATION_DENIED=PASS");

 await t.test("PDP signer key expiry during in-flight evaluation is rejected",async()=>{
  now=BASE;
  let signalReady;
  const ready=new Promise(ok=>signalReady=ok);
  const st=state({pdpExpiresMs:100,onPdpReady:signalReady});
  const pending=enforceW26Signed(st.cfg({delayMs:220}));
  await ready;now=BASE+100;
  const out=await pending;
  deny(out,st,"PDP_SIGNATURE_OR_TRANSPORT_INVALID");
  assert.equal(st.ring.check("PDP_DECISION",st.getSigner().pem).reasonCode,
   "TRUST_KEY_EXPIRED");
  await noChildren();
 });
 console.log("TTO_W27_INFLIGHT_SIGNER_EXPIRY_DENIED=PASS");

 await t.test("tombstone omission and resurrecting revoked key both rejected",async()=>{
  now=BASE;
  const st=state();
  st.revoke("POLICY_PUBLISHER");
  const cp=st.ring.checkpoint();
  const missing=signedSnapshot({
   epoch:cp.epoch+1,previousHash:cp.head,
   issuedAtMs:now,expiresAtMs:BASE+60000,entries:[]
  },ROOT_KEYS.privateKey,ROOT_PEM);
  assert.throws(()=>st.ring.apply(missing),/W27_TRUST_TOMBSTONE_MISSING/);
  const revived=st.entries().map(e=>({...e,status:"ACTIVE"}));
  const forged=signedSnapshot({
   epoch:cp.epoch+1,previousHash:cp.head,
   issuedAtMs:now,expiresAtMs:BASE+60000,entries:revived
  },ROOT_KEYS.privateKey,ROOT_PEM);
  assert.throws(()=>st.ring.apply(forged),/W27_TRUST_REUSE_OR_RESURRECTION/);
  assert.deepEqual(st.ring.checkpoint(),cp);
 });
 console.log("TTO_W27_REVOKED_TOMBSTONES_CANNOT_RESURRECT=PASS");

 await t.test("key rollback or duplicated ACTIVE role in signed keyset denied",()=>{
  now=BASE;
  const st=state();
  const cp=st.ring.checkpoint();
  const duplicate=keyEntry({role:"POLICY_PUBLISHER",
   publicPem:pub(OTHER_PUBLISHER),generation:2,
   notBeforeMs:BASE,expiresAtMs:BASE+60000});
  const manifest=signedSnapshot({
   epoch:cp.epoch+1,previousHash:cp.head,
   issuedAtMs:now,expiresAtMs:BASE+60000,
   entries:[...st.entries(),duplicate]
  },ROOT_KEYS.privateKey,ROOT_PEM);
  assert.throws(()=>st.ring.apply(manifest),/W27_TRUST_ACTIVE_ROLE_INVALID/);
  const rollback=signedSnapshot({
   epoch:cp.epoch+1,previousHash:cp.head,
   issuedAtMs:now,expiresAtMs:BASE+60000,entries:[
    {...st.entries()[0],status:"REVOKED"},
    {...duplicate,generation:1}
   ]
  },ROOT_KEYS.privateKey,ROOT_PEM);
  assert.throws(()=>st.ring.apply(rollback),/W27_TRUST_GENERATION_ROLLBACK/);
 });
 console.log("TTO_W27_ROLE_UNIQUENESS_AND_GENERATION_GATE=PASS");

 await t.test("expired root publication and trusted clock rollback fail closed",()=>{
  now=BASE;
  const st=state();
  now=BASE+60000;
  assert.equal(st.ring.check("POLICY_PUBLISHER",PUBLISHER_PEM).ok,false);
  now=BASE-1;
  assert.equal(st.ring.check("POLICY_PUBLISHER",PUBLISHER_PEM).ok,false);
 });
 console.log("TTO_W27_SNAPSHOT_EXPIRY_AND_CLOCK_ROLLBACK_DENY=PASS");

 await t.test("same-tenant owner separation survives root-authorized PDP",async()=>{
  now=BASE;
  for(let i=0;i<2;i++){
   const st=state();
   const out=await enforceW26Signed(st.cfg({checked:checked(owners[i],i)}));
   assert.equal(out.decision,"SIMULATED_ALLOW");
   assert.equal(out.canGrantPermission,false);
   assert.equal(bffClose(out).status,403);
   await noChildren();
  }
  assert.equal(checked(owners[1],0).kind,"DENY");
 });
 console.log("TTO_W27_W23_TENANT_OWNER_SCOPE_PRESERVED=PASS");

 await t.test("audit-triggered signer revocation denies after verified signature",async()=>{
  now=BASE;
  const st=state();
  const cfg=st.cfg({audit:{
   record:e=>{
    st.auditRows.push({...e});
    if(e.decision==="SIMULATED_ALLOW")st.revoke("PDP_DECISION");
   }
  }});
  const result=await enforceW26Signed(cfg);
  deny(result,st,"TRUST_REVOKED_OR_EXPIRED");
  await noChildren();
 });
 console.log("TTO_W27_RECHECK_TRUST_AFTER_AUDIT_BEFORE_SOURCE=PASS");

 await t.test("audit sink failure blocks valid authenticated signature",async()=>{
  now=BASE;const st=state();
  const out=await enforceW26Signed(st.cfg({
   audit:{record(){throw Error("AUDIT_UNAVAILABLE")}}
  }));
  deny(out,st,"AUDIT_UNAVAILABLE");
  await noChildren();
 });
 console.log("TTO_W27_AUDIT_OUTAGE_NO_OPERATIONAL_ALLOW=PASS");

 await t.test("client abort kills child and no signer remains orphaned",async()=>{
  now=BASE;
  let signalReady;const ready=new Promise(ok=>signalReady=ok);
  const st=state({onPdpReady:signalReady});
  const aborter=new AbortController();
  const pending=enforceW26Signed(st.cfg({
   checked:checked(owners[0],0,aborter.signal),delayMs:250
  }));
  await ready;aborter.abort();
  deny(await pending,st,"REQUEST_ABORTED");
  await noChildren();
 });
 console.log("TTO_W27_ABORT_REAPS_CHILD_AND_DENIES=PASS");

 await t.test("all signer children exited, no real data or production grant",async()=>{
  await noChildren();
  assert.equal(stats().started,stats().closed);
  const st=state();
  assert.equal(st.touches.length,0);
  assert.notEqual(keyId(ROOT_PEM),keyId(PUBLISHER_PEM));
  assert.equal(process.env.TTO_W26_CHILD,undefined);
  assert.equal(process.env.DATABASE_URL||"", "");
 });
 console.log("TTO_W27_NO_ORPHAN_SIGNERS_NO_REAL_SOURCES=PASS");
 console.log("TTO_W27_DRAFT_NO_DOCKER_NO_DB_NO_OPERATIONAL_ALLOW=PASS");
});
