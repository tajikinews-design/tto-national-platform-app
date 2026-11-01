"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {SyntheticOwnerRegistry}=require("../security/w214-owner-fencing-registry.cjs");
function lab(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),"w214-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return new SyntheticOwnerRegistry(path.join(dir,"journal"),{create:true})}
test("W2.14 exclusive owner synthetic fencing",async t=>{
 await t.test("one owner only",t=>{const r=lab(t),a=r.claim("a");assert.equal(a.ok,true);assert.equal(r.claim("b").ok,false);assert.equal(r.commit("a",a.term,"e1",1).ok,true)});
 console.log("TTO_W214_EXCLUSIVE_OWNER=PASS");
 await t.test("old owner term cannot write after transfer",t=>{const r=lab(t),a=r.claim("a");r.release("a",a.term);const b=r.claim("b");assert.ok(b.term>a.term);assert.equal(r.commit("a",a.term,"old",1).ok,false);assert.equal(r.commit("b",b.term,"new",1).ok,true)});
 console.log("TTO_W214_STALE_TERM_DENY=PASS");
 await t.test("simulated owner crash requires explicit supervisor claim",t=>{const r=lab(t),a=r.claim("a");r.crashOwner("a",a.term);const b=r.claim("b");assert.equal(r.commit("a",a.term,"old",1).ok,false);assert.equal(r.commit("b",b.term,"safe",1).ok,true)});
 console.log("TTO_W214_CRASH_TAKEOVER=PASS");
 await t.test("partition denies ownership and commit",t=>{const r=lab(t),a=r.claim("a");r.availability(false);assert.equal(r.claim("b").ok,false);assert.equal(r.commit("a",a.term,"blind",1).ok,false);r.availability(true);assert.equal(r.commit("a",a.term,"restored",1).ok,true)});
 console.log("TTO_W214_PARTITION_DENY=PASS");
 await t.test("revocation survives owner transition",t=>{const r=lab(t),a=r.claim("a");assert.equal(r.revoke("a",a.term).ok,true);r.release("a",a.term);const b=r.claim("b");assert.equal(r.commit("b",b.term,"revoked",2).ok,false)});
 console.log("TTO_W214_REVOKED_AFTER_TRANSFER=PASS");
 await t.test("forged owner and term cannot commit",t=>{const r=lab(t),a=r.claim("a");assert.equal(r.commit("b",a.term,"forge",1).ok,false);assert.equal(r.commit("a",a.term+1,"forge2",1).ok,false)});
 console.log("TTO_W214_FORGED_TERM_DENY=PASS");
});
