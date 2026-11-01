"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {ZERO,keyEntry,signedSnapshot}=require("../security/w27-root-signed-trust-keyring.cjs");
const {SyntheticTrustAuthority}=require("../security/w28-multi-instance-trust.cjs");
const {OfflineDurableReplica}=require("../security/w29-durable-trust-recovery.cjs");
const keys=()=>crypto.generateKeyPairSync("ed25519");
const pem=x=>x.publicKey.export({format:"pem",type:"spki"}).toString();
const root=keys(),pub=keys(),rootPem=pem(root),pubPem=pem(pub),BASE=1800000000000;
let now=BASE;
function setup(t){
 now=BASE;const dir=fs.mkdtempSync(path.join(os.tmpdir(),"w29-")),data=path.join(dir,"data"),anchorDir=path.join(dir,"anchor");
 fs.mkdirSync(data);fs.mkdirSync(anchorDir);t.after(()=>fs.rmSync(dir,{force:true,recursive:true}));
 const witnessPath=path.join(anchorDir,"witness.json");
 const authority=new SyntheticTrustAuthority({pinnedRootPublicPem:rootPem,clock:()=>now});
 const entry=keyEntry({role:"POLICY_PUBLISHER",publicPem:pubPem,generation:1,notBeforeMs:BASE,expiresAtMs:BASE+60000});
 const publish=entries=>{const cp=authority.current();authority.publish(signedSnapshot({epoch:cp.epoch+1,previousHash:cp.head,issuedAtMs:now,expiresAtMs:BASE+60000,entries},root.privateKey,rootPem))};
 publish([entry]);
 const replica=()=>new OfflineDurableReplica({directory:data,witnessPath,pinnedRootPublicPem:rootPem,clock:()=>now,authority});
 return {replica,publish,entry,authority,journal:path.join(data,"trust.json"),witnessPath};
}
test("W2.9 offline persistent trust safety",async t=>{
 await t.test("restart recovers genuine root-signed history",t=>{const s=setup(t);s.replica().initialize();const r=s.replica();assert.equal(r.recover().state,"SYNCED");assert.equal(r.check("POLICY_PUBLISHER",pubPem).canGrantPermission,false)});
 console.log("TTO_W29_RESTART_RECOVERY=PASS");
 await t.test("old journal after revocation is rejected",t=>{const s=setup(t),r=s.replica();r.initialize();const old=fs.readFileSync(s.journal);s.publish([{...s.entry,status:"REVOKED"}]);r.sync();fs.writeFileSync(s.journal,old);assert.throws(()=>s.replica().recover(),/W29_ROLLBACK_OR_CORRUPT/)});
 console.log("TTO_W29_ROLLBACK_DENIED=PASS");
 await t.test("journal corruption rejects recovery",t=>{const s=setup(t);s.replica().initialize();fs.writeFileSync(s.journal,"{}");assert.throws(()=>s.replica().recover())});
 console.log("TTO_W29_CORRUPTION_DENIED=PASS");
 await t.test("missing independent witness rejects restart",t=>{const s=setup(t);s.replica().initialize();fs.unlinkSync(s.witnessPath);assert.throws(()=>s.replica().recover(),/W29_STORAGE_UNAVAILABLE/)});
 console.log("TTO_W29_WITNESS_REQUIRED=PASS");
 await t.test("offline revocation is replayed before trust evaluation",t=>{const s=setup(t);s.replica().initialize();s.publish([{...s.entry,status:"REVOKED"}]);const r=s.replica();assert.equal(r.recover().epoch,2);assert.equal(r.check("POLICY_PUBLISHER",pubPem).ok,false)});
 console.log("TTO_W29_REVOCATION_CATCHUP=PASS");
 await t.test("authority partition quarantines recovered replica",t=>{const s=setup(t);s.replica().initialize();s.authority.setAvailable(false);assert.throws(()=>s.replica().recover());s.authority.setAvailable(true);assert.equal(s.replica().recover().state,"SYNCED")});
 console.log("TTO_W29_PARTITION_RECOVERY=PASS");
 await t.test("truncated signed journal rejected",t=>{const s=setup(t),r=s.replica();r.initialize();s.publish([{...s.entry,status:"REVOKED"}]);r.sync();const j=JSON.parse(fs.readFileSync(s.journal));j.snapshots.pop();fs.writeFileSync(s.journal,JSON.stringify(j));assert.throws(()=>s.replica().recover())});
 console.log("TTO_W29_TRUNCATION_DENIED=PASS");
});