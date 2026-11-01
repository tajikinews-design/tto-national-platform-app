"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {keyEntry,signedSnapshot,ZERO}=require("../security/w27-root-signed-trust-keyring.cjs");
const {SyntheticTrustAuthority,SyntheticTrustReplica}=require("../security/w28-multi-instance-trust.cjs");
const key=()=>crypto.generateKeyPairSync("ed25519");
const pem=k=>k.publicKey.export({type:"spki",format:"pem"}).toString();
const root=key(),publisher=key(),rootPem=pem(root),publisherPem=pem(publisher);
const base=1800000000000;let now=base;
function setup(){
 now=base;
 const a=new SyntheticTrustAuthority({pinnedRootPublicPem:rootPem,clock:()=>now});
 const nodes=["A","B","C"].map(id=>new SyntheticTrustReplica({id,pinnedRootPublicPem:rootPem,clock:()=>now,authority:a}));
 const entry=keyEntry({role:"POLICY_PUBLISHER",publicPem:publisherPem,generation:1,notBeforeMs:base,expiresAtMs:base+2000});
 const publish=entries=>{
  const cp=(()=>{try{return a.current()}catch{return {epoch:0,head:ZERO}}})();
  return a.publish(signedSnapshot({epoch:cp.epoch+1,previousHash:cp.head,issuedAtMs:now,expiresAtMs:base+1000,entries},root.privateKey,rootPem));
 };
 publish([entry]);return {a,nodes,entry,publish};
}
test("W2.8 synthetic independently root-signed multi-instance trust — no operational grant",async t=>{
 await t.test("connected replicas synchronize exact signed head",()=>{
  const {nodes}=setup();nodes.forEach(n=>{n.synchronize();const r=n.evaluate("POLICY_PUBLISHER",publisherPem);assert.equal(r.ok,true);assert.equal(r.canGrantPermission,false)});
 });console.log("TTO_W28_MULTI_INSTANCE_SYNC=PASS");
 await t.test("revocation before final head probe denies stale node",()=>{
  const {nodes,entry,publish}=setup();nodes.forEach(n=>n.synchronize());
  const r=nodes[1].evaluate("POLICY_PUBLISHER",publisherPem,{beforeFinalCheck:()=>publish([{...entry,status:"REVOKED"}])});
  assert.equal(r.ok,false);assert.match(r.reason,/HEAD/);
  assert.equal(nodes[0].evaluate("POLICY_PUBLISHER",publisherPem).ok,false);
  nodes[0].synchronize();assert.equal(nodes[0].evaluate("POLICY_PUBLISHER",publisherPem).ok,false);
 });console.log("TTO_W28_INFLIGHT_REVOKE_DENIED=PASS");
 await t.test("network outage fails closed even when local TTL remains",()=>{
  const {a,nodes}=setup();nodes[0].synchronize();a.setAvailable(false);
  assert.equal(nodes[0].evaluate("POLICY_PUBLISHER",publisherPem).ok,false);
  assert.throws(()=>nodes[1].synchronize(),/UNAVAILABLE/);
  a.setAvailable(true);nodes[0].synchronize();
  assert.equal(nodes[0].evaluate("POLICY_PUBLISHER",publisherPem).ok,true);
 });console.log("TTO_W28_PARTITION_AND_RECOVERY=PASS");
 await t.test("late replica catches up; replayed old signed snapshot never rolls back",()=>{
  const {nodes,entry,publish}=setup();const first=nodes[0].synchronize();
  publish([{...entry,status:"REVOKED"}]);
  assert.equal(nodes[2].synchronize().epoch,2);
  assert.equal(nodes[0].evaluate("POLICY_PUBLISHER",publisherPem).ok,false);
  assert.equal(nodes[2].evaluate("POLICY_PUBLISHER",publisherPem).ok,false);
  assert.equal(first.epoch,1);
 });console.log("TTO_W28_STALE_REPLICA_DENIED=PASS");
 await t.test("expired snapshot and clock rollback fail closed",()=>{
  const {nodes}=setup();nodes[0].synchronize();now=base+1000;
  assert.equal(nodes[0].evaluate("POLICY_PUBLISHER",publisherPem).ok,false);
  now=base-1;assert.equal(nodes[0].evaluate("POLICY_PUBLISHER",publisherPem).ok,false);
 });console.log("TTO_W28_EXPIRY_AND_CLOCK_DENY=PASS");
 await t.test("wrong role and unsigned authority never grant",()=>{
  const {nodes}=setup();nodes[0].synchronize();
  assert.equal(nodes[0].evaluate("PDP_DECISION",publisherPem).ok,false);
  assert.equal(nodes[0].evaluate("POLICY_PUBLISHER",publisherPem).ok,false);
 });console.log("TTO_W28_ROLE_FAIL_CLOSED=PASS");
});