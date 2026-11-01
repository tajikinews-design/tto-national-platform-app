"use strict";
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {randomUUID,randomBytes,createHash}=require("node:crypto");
const {resolve}=require("node:path");
const {createRequire}=require("node:module");
const {Client}=createRequire(resolve(__dirname,"../../services/api/package.json"))("pg");
if(process.env.CI!=="true"||process.env.TTO_PCS010_LAB!=="1"||
 process.env.TEST_ADMIN_DATABASE_URL!=="postgresql://postgres@127.0.0.1:5432/tto")
 throw Error("PCS010_DISPOSABLE_CI_ONLY");
const db=new Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL});
const TENANT=randomUUID(),OTHER=randomUUID(),manager=randomUUID(),member=randomUUID();
const tokens={},port=32710,base="http://127.0.0.1:"+port;
let child;
async function issue(user){const token=randomBytes(48).toString("base64url");await db.query(
 "INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at) VALUES($1,$2,$3,0,now()+interval '10 minutes')",
 [randomUUID(),user,createHash("sha256").update(token).digest()]);return token}
async function request(user,t,ref){const r=await fetch(base+"/v1/pcs010-lab/tenants/"+t+"/fixture-reviews",
 {method:"POST",headers:{"content-type":"application/json",...(user?{authorization:"Bearer "+tokens[user]}:{})},
 body:JSON.stringify({fixtureRef:ref})});return {status:r.status,data:await r.json()}}
async function main(){await db.connect();await db.query("ALTER ROLE tto_app LOGIN");
 await db.query("INSERT INTO tto.user_accounts(user_id) VALUES ($1),($2)",[manager,member]);
 await db.query("INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES($1,$3,'PCS010 Fake A','ACTIVE'),($2,$4,'PCS010 Fake B','ACTIVE')",
 [TENANT,OTHER,"pcs010-"+randomUUID().slice(0,8),"pcs010-"+randomUUID().slice(0,8)]);
 await db.query("INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'COOPERATIVE_MANAGER'),($4,$5,$3,'MEMBER')",
 [randomUUID(),manager,TENANT,randomUUID(),member]);
 tokens.manager=await issue(manager);tokens.member=await issue(member);
 child=spawn(process.execPath,["dist/main.js"],{cwd:resolve(__dirname,"../../services/api"),env:{
 ...process.env,DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto",
 TTO_PCS010_LAB:"1",PORT:String(port),VERCEL:"",APIIR_TOKEN:""
 },stdio:"ignore"});
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(base+"/ready");if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,160))}
 assert.equal(ready,true,"Nest+PG did not start");
 const ref="PCS010-FAKE-00000001";
 assert.equal((await request(null,TENANT,ref)).status,401,"No session must deny");
 assert.equal((await request("member",TENANT,ref)).status,403,"Member cannot approve");
 assert.equal((await request("manager",OTHER,ref)).status,403,"Wrong tenant must deny");
 assert.equal((await request("manager",TENANT,"OFFICIAL-12345678")).status,400,"Only fake refs");
 const good=await request("manager",TENANT,ref);
 assert.equal(good.status,201,JSON.stringify(good));
 assert.equal(good.data.official,false);assert.equal(good.data.canTrade,false);assert.equal(good.data.canTransfer,false);
 assert.equal((await request("manager",TENANT,ref)).status,403,"No duplicate approval");
 const rows=await db.query("SELECT tenant_id,actor_id,event_kind,fixture_ref,is_official FROM tto.pcs010_fixture_reviews WHERE fixture_ref=$1",[ref]);
 assert.equal(rows.rowCount,1);assert.equal(rows.rows[0].actor_id,manager);assert.equal(rows.rows[0].is_official,false);
 const before=await db.query("SELECT count(*)::int AS n FROM tto.shareholding_source_snapshots");assert.equal(before.rows[0].n,0,"Never writes official shares");
 // PCS011: real cooperative-management Next BFF against the same authenticated Nest/PG fixture.
 const nextCwd=resolve(__dirname,"../../apps/cooperative-management");
 const nextBin=require.resolve("next/dist/bin/next",{paths:[nextCwd]});
 const next=spawn(process.execPath,[nextBin,"start","-H","127.0.0.1","-p","32711"],{cwd:nextCwd,
  env:{...process.env,CI:"true",TTO_PCS011_LAB:"1",TTO_API_BASE_URL:base,TTO_LOOPBACK_E2E:"1",DATABASE_URL:"",VERCEL:""},stdio:"ignore"});
 let nextReady=false;for(let i=0;i<100;i++){try{let r=await fetch("http://127.0.0.1:32711/");if(r.ok){nextReady=true;break}}catch{}await new Promise(x=>setTimeout(x,160))}
 assert.equal(nextReady,true,"cooperative Next not ready");
 try{
  const endpoint="http://127.0.0.1:32711/api/pcs011/tenants/"+TENANT+"/reviews";
  const withCookie=(user)=>({"cookie":"tto_session="+tokens[user]});
  assert.equal((await fetch(endpoint)).status,401);
  assert.equal((await fetch(endpoint,{headers:withCookie("member")})).status,403);
  assert.equal((await fetch(endpoint,{headers:withCookie("manager")})).status,200);
  const posted=await fetch(endpoint,{method:"POST",headers:{...withCookie("manager"),
    "content-type":"application/json",origin:"http://127.0.0.1:32711"},
    body:JSON.stringify({fixtureRef:"PCS010-FAKE-MANAGER-0001"})});
  assert.equal(posted.status,201,await posted.text());
  const after=await fetch(endpoint,{headers:withCookie("manager")});
  assert.equal(after.status,200);assert.equal((await after.json()).items,2);
  const wrong=await fetch(endpoint,{method:"POST",headers:{...withCookie("manager"),
   "content-type":"application/json",origin:"https://attacker.invalid"},
   body:JSON.stringify({fixtureRef:"PCS010-FAKE-EVIL-0001"})});
  assert.equal(wrong.status,403,"cross origin must not submit");
  if(process.env.TTO_PCS012_BROWSER==="1"){
   const {chromium}=require("/tmp/tto-pcs012-browser/node_modules/playwright");
   const browser=await chromium.launch({headless:true});
   try{
    for(const width of [390,1440]){
     const context=await browser.newContext({viewport:{width,height:width===390?844:900},locale:"fa-IR"});
     await context.addCookies([{name:"tto_session",value:tokens.manager,url:"http://127.0.0.1:32711",httpOnly:true,sameSite:"Lax"}]);
     const page=await context.newPage();
     const errors=[];page.on("pageerror",e=>errors.push(e.message));
     const response=await page.goto("http://127.0.0.1:32711/review/pcs011/"+TENANT,{waitUntil:"networkidle",timeout:45000});
     assert.equal(response.status(),200);
     await page.getByText("تعداد رویدادهای ساختگی ثبت‌شده:").waitFor({timeout:25000});
     await page.getByText("PCS010-FAKE-MANAGER-0001").waitFor({timeout:15000});
     if(width===390){
      await page.getByRole("button",{name:"تأیید پرونده ساختگی"}).click();
      await page.getByText("PCS010-FAKE-MANAGER-0002").waitFor({timeout:15000});
     }
     assert.equal(await page.locator("body").evaluate(e=>e.scrollWidth>e.clientWidth+3),false);
     assert.deepEqual(errors,[]);
     console.log("TTO_PCS012_CHROMIUM_REAL_PG_"+width+"=PASS");
     await context.close();
    }
   }finally{await browser.close()}
  }
  console.log("TTO_PCS011_NEXT_BFF_REAL_PG_PASS=7");
 }finally{next.kill("SIGTERM")}
 console.log("TTO_PCS010_REAL_NEST_PG_FIXTURE_APPROVAL_PASS=8");
}
main().catch(e=>{console.error("TTO_PCS010_REAL_PG_FAIL",e);process.exitCode=1}).finally(async()=>{if(child)child.kill("SIGTERM");await db.end().catch(()=>{})});
