"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {OfflineRecoveryCoordinator,initialize}=require("../security/w212-crash-recovery-coordinator.cjs");
function lab(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"tto-w212-"));
 t.after(()=>fs.rmSync(dir,{force:true,recursive:true}));
 const file=path.join(dir,"ledger.jsonl");initialize(file);
 const open=()=>{const c=new OfflineRecoveryCoordinator(file);c.recover();return c};
 return {file,open};
}
test("W2.12 synthetic crash-recoverable coordinator",async t=>{
 await t.test("restart replays committed transaction and denies duplicate",t=>{
  const s=lab(t),a=s.open();assert.equal(a.commit({id:"effect-a",expectedEpoch:1}).ok,true);
  const b=s.open();assert.equal(b.state().sequence,1);
  assert.equal(b.commit({id:"effect-a",expectedEpoch:1}).ok,false);
  assert.equal(b.commit({id:"effect-b",expectedEpoch:1}).canGrantPermission,false);
 });console.log("TTO_W212_RESTART_NO_DUPLICATE=PASS");
 await t.test("revocation survives fresh coordinator restart",t=>{
  const s=lab(t),a=s.open();assert.equal(a.revoke().ok,true);
  const b=s.open();assert.equal(b.state().active,false);
  assert.equal(b.commit({id:"stale",expectedEpoch:1}).ok,false);
  assert.equal(b.commit({id:"new",expectedEpoch:2}).ok,false);
 });console.log("TTO_W212_REVOCATION_DURABLE=PASS");
 await t.test("rotation invalidates old epochs after restart",t=>{
  const s=lab(t),a=s.open();a.revoke();a.rotate();
  const b=s.open();assert.equal(b.state().epoch,3);
  assert.equal(b.commit({id:"old",expectedEpoch:1}).ok,false);
  assert.equal(b.commit({id:"fresh",expectedEpoch:3}).ok,true);
 });console.log("TTO_W212_ROTATION_EPOCH_FENCE=PASS");
 await t.test("truncated append quarantines rather than auto-recovers",t=>{
  const s=lab(t),a=s.open();a.revoke();fs.appendFileSync(s.file,'{"sequence":');
  assert.throws(()=>new OfflineRecoveryCoordinator(s.file).recover(),/W212_TORN_TAIL/);
 });console.log("TTO_W212_TORN_TAIL_DENY=PASS");
 await t.test("tampered old journal entry rejects recovery",t=>{
  const s=lab(t),a=s.open();a.revoke();
  const lines=fs.readFileSync(s.file,"utf8").split("\n");const entry=JSON.parse(lines[0]);entry.epoch=3;
  fs.writeFileSync(s.file,JSON.stringify(entry)+"\n");
  assert.throws(()=>new OfflineRecoveryCoordinator(s.file).recover(),/W212_LOG_INTEGRITY/);
 });console.log("TTO_W212_TAMPER_DENY=PASS");
 await t.test("out of order records rejected",t=>{
  const s=lab(t),a=s.open();a.revoke();a.rotate();
  const rows=fs.readFileSync(s.file,"utf8").trimEnd().split("\n");
  fs.writeFileSync(s.file,rows.reverse().join("\n")+"\n");
  assert.throws(()=>new OfflineRecoveryCoordinator(s.file).recover(),/W212_CHAIN_ROLLBACK/);
 });console.log("TTO_W212_ORDER_REPLAY_DENY=PASS");
 await t.test("unavailable journal rejects startup",t=>{
  const s=lab(t);fs.unlinkSync(s.file);
  assert.throws(()=>new OfflineRecoveryCoordinator(s.file).recover());
 });console.log("TTO_W212_MISSING_JOURNAL_DENY=PASS");
});