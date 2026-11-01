"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{spawn}=require("node:child_process");
const env={...process.env,CI:"true",NODE_ENV:"test",TTO_PCS007_LAB:"1",TTO_PCS007_TOKEN:"PCS007_SYNTHETIC_LOCAL_TOKEN",DATABASE_URL:"",TTO_API_BASE_URL:"",APIIR_TOKEN:"",VERCEL:""};
test("PCS007 manager-approved synthetic data visible without legal effect",async()=>{
 const child=spawn(process.execPath,["scripts/security/pcs007-synthetic-cooperative-broker.cjs"],{env,stdio:"ignore"});
 try{
  const base="http://127.0.0.1:32990",headers={"x-pcs007-lab-token":env.TTO_PCS007_TOKEN};
  let ready=false;for(let i=0;i<40;i++){try{const x=await fetch(base+"/view",{headers});if(x.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  assert.equal(ready,true,"synthetic broker failed to start");
  const pre=await (await fetch(base+"/view",{headers})).json();
  assert.equal(pre.reviewStatus,"PENDING");assert.equal(pre.holdings,null);
  assert.equal((await fetch(base+"/approve",{method:"POST"})).status,403);
  assert.equal((await fetch(base+"/approve",{method:"GET",headers})).status,404);
  assert.equal((await fetch(base+"/approve",{method:"POST",headers})).status,200);
  const after=await (await fetch(base+"/view",{headers})).json();
  assert.equal(after.reviewStatus,"APPROVED_SYNTHETIC");assert.equal(after.holdings.quantity,"125");
  assert.equal(after.official,false);assert.equal(after.canTransfer,false);assert.equal(after.canTrade,false);
  assert.equal(after.member.sourceVersion,after.holdings.ledgerVersion);
 }finally{child.kill("SIGTERM")}
});
