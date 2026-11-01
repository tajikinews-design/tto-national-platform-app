"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{spawn}=require("node:child_process");
test("PCS009 fictional role, tenant/Party and immutable audit",async()=>{
 const env={...process.env,CI:"true",NODE_ENV:"test",TTO_PCS007_LAB:"1",TTO_PCS009_LAB:"1",
 TTO_PCS007_TOKEN:"legacy-placeholder",TTO_PCS009_MANAGER_TOKEN:"demo-manager-secret",
 TTO_PCS009_HOLDER_TOKEN:"demo-holder-secret",DATABASE_URL:"",TTO_API_BASE_URL:"",APIIR_TOKEN:"",VERCEL:""};
 const child=spawn(process.execPath,["scripts/security/pcs007-synthetic-cooperative-broker.cjs"],{env,stdio:"ignore"});
 const root="http://127.0.0.1:32990",headers=(role,tenant="DEMO-TENANT-001",party="DEMO-PARTY-001")=>({
 "x-pcs007-lab-token":role==="manager"?env.TTO_PCS009_MANAGER_TOKEN:env.TTO_PCS009_HOLDER_TOKEN,
 "x-demo-tenant":tenant,"x-demo-party":party});
 const request=async(path,role,method="GET",tenant,party)=>{const res=await fetch(root+path,{method,headers:headers(role,tenant,party)});return {status:res.status,data:await res.json()}};
 try{
  let ready=false;for(let i=0;i<60;i++){try{const v=await request("/view","holder");if(v.status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  assert.equal(ready,true);
  assert.equal((await request("/view","holder")).data.holdings,null);
  assert.equal((await request("/approve","holder","POST")).status,403);
  assert.equal((await request("/approve","manager","POST","OTHER-TENANT")).status,403);
  assert.equal((await request("/view","holder","GET",undefined,"OTHER-PARTY")).status,403);
  assert.equal((await request("/audit","holder")).status,403);
  assert.equal((await request("/approve","manager","POST")).status,200);
  assert.equal((await request("/approve","manager","POST")).status,409);
  const v=await request("/view","holder");assert.equal(v.data.holdings.quantity,"125");
  assert.equal(v.data.official,false);assert.equal(v.data.canTrade,false);assert.equal(v.data.canTransfer,false);
  const audit=await request("/audit","manager");assert.equal(audit.data.events.length,1);
  assert.equal(audit.data.events[0].action,"APPROVE_SYNTHETIC");
  assert.equal((await fetch(root+"/view")).status,401);
 }finally{child.kill("SIGTERM")}
});
