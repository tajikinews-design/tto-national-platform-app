"use strict";
/**
 * PH12 protected three-portal ANONYMOUS / FORGED-SESSION Chromium boundary test.
 * This is not an authenticated real-user test and cannot unlock official workflows.
 * No live secrets, real accounts, remote APIs, SMS, banking or official share register.
 */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {resolve}=require("node:path");
const {chromium}=require("playwright");
const root=resolve(__dirname,"../..");
const portals=[
 {kind:"national",dir:"national-admin",port:32931,session:"/api/auth/session",user:"#national-username",password:"#national-password"},
 {kind:"cooperative",dir:"cooperative-management",port:32932,session:"/api/auth/password/session",user:"#portal-user",password:"#portal-pass"},
 {kind:"shareholder",dir:"shareholder",port:32933,session:"/api/auth/password/session",user:"#portal-user",password:"#portal-pass"}
];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function start(p){
 const cwd=resolve(root,"apps",p.dir);
 const entry=require.resolve("next/dist/bin/next",{paths:[cwd]});
 const env={...process.env,CI:"true",VERCEL:"",VERCEL_ENV:"",TTO_API_BASE_URL:"",
  TTO_LOOPBACK_E2E:"",DATABASE_URL:"",APIIR_TOKEN:"",TTO_PRODUCTION_DB_URL:"",
  NEXT_TELEMETRY_DISABLED:"1"};
 const proc=spawn(process.execPath,[entry,"start","-p",String(p.port),"-H","127.0.0.1"],{
  cwd,env,stdio:["ignore","pipe","pipe"]});
 let log="";
 for(const stream of [proc.stdout,proc.stderr])stream.on("data",s=>{log=(log+String(s)).slice(-5000)});
 const base="http://127.0.0.1:"+p.port;
 for(let tries=0;tries<100;tries++){
  if(proc.exitCode!==null)throw Error(p.kind+" SERVER_EXIT "+log);
  try{const result=await fetch(base+"/login",{signal:AbortSignal.timeout(1700)});
   if(result.status===200)return {proc,base};
  }catch{}
  await wait(450);
 }
 proc.kill("SIGTERM");throw Error(p.kind+" SERVER_TIMEOUT "+log);
}
async function run(){
 const children=[];
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 let checks=0;
 try{
  for(const p of portals){
   const server=await start(p);children.push(server.proc);
   for(const size of [{width:1440,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport:size,locale:"fa-IR",serviceWorkers:"block"});
    const page=await context.newPage();
    const runtimeErrors=[];page.on("pageerror",e=>runtimeErrors.push(String(e)));
    await page.route("**/*",async route=>{
     const url=route.request().url();
     if(url.startsWith(server.base+"/")||url===server.base)await route.continue();
     else {runtimeErrors.push("BLOCKED_EXTERNAL_REQUEST");await route.abort();}
    });
    try{
     const login=await page.goto(server.base+"/login",{waitUntil:"domcontentloaded",timeout:25000});
     assert.equal(login?.status(),200,p.kind+" login request");
     if(p.kind!=="national"){
      const tab=page.getByRole("tab",{name:"نام کاربری و رمز"});
      await tab.waitFor({state:"visible",timeout:13000});
      await tab.click();
     }
     await page.locator(p.user).waitFor({state:"visible",timeout:13000});
     await page.locator(p.password).waitFor({state:"visible",timeout:13000});
     if(p.kind!=="national"){
      const label=p.kind==="cooperative"?"مدیر تعاونی":"سهامدار";
      await page.getByRole("button",{name:"ورود به پنل "+label}).waitFor({state:"visible",timeout:10000});
     }
     assert.equal(await page.locator(p.user).inputValue(),"","username prefilled");
     assert.equal(await page.locator(p.password).inputValue(),"","password prefilled");
     const absent=await page.evaluate(async u=>{
      const response=await fetch(u,{credentials:"same-origin",cache:"no-store"});
      return {status:response.status,payload:await response.json()};
     },p.session);
     assert.equal(absent.status,200,p.kind+" absent cookie session HTTP");
     assert.equal(absent.payload.authenticated,false,p.kind+" absent cookie unexpectedly authenticated");
     checks+=3;
     // A syntactically valid cookie is not a proof of a server-attested session.
     await context.addCookies([{name:"tto_session",value:"A".repeat(48),domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax"}]);
     const forged=await page.evaluate(async u=>{
      const response=await fetch(u,{credentials:"same-origin",cache:"no-store"});
      return {status:response.status,payload:await response.json()};
     },p.session);
     assert.notEqual(forged.payload.authenticated,true,p.kind+" forged cookie authorized");
     assert.ok(forged.status===503||forged.status===401||forged.status===403,
      p.kind+" forged cookie did not fail closed");
     const rootResponse=await page.goto(server.base+"/",{waitUntil:"domcontentloaded",timeout:25000});
     assert.ok(rootResponse&&rootResponse.status()>=200&&rootResponse.status()<400);
     await page.waitForTimeout(800);
     assert.equal(await page.locator(".tto-approved-grid").count(),0,p.kind+" privileged dashboard rendered");
     assert.equal(await page.locator(".tto-approved-kpis").count(),0,p.kind+" privileged KPIs rendered");
     assert.ok(runtimeErrors.length===0,p.kind+" errors: "+runtimeErrors.join(" | "));
     checks+=4;
     console.log("TTO_THREE_PORTAL_ANON_FORGED_COOKIE_"+p.kind+"_"+size.width+"_PASS");
    }finally{await context.close();}
   }
  }
  console.log("TTO_THREE_PORTAL_CHROMIUM_NEGATIVE_ACCESS_CHECKS="+checks);
 }finally{
  await browser.close();
  for(const p of children)p.kill("SIGTERM");
 }
}
run().catch(e=>{console.error("TTO_THREE_PORTAL_CHROMIUM_NEGATIVE_ACCESS_FAIL",e.stack||e);process.exitCode=1;});
