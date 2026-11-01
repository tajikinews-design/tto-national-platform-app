"use strict";
/** PCS-008: real Chromium two-Next-page fictional flow. No auth, official ledger, DB, SMS, remote API. */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {resolve}=require("node:path");
const {chromium}=require("/tmp/tto-pcs008-browser/node_modules/playwright");
const ROOT=resolve(__dirname,"../..");
const ENV={...process.env,CI:"true",NODE_ENV:"test",TTO_PCS007_LAB:"1",
 TTO_PCS007_TOKEN:"PCS008_PRIVATE_FAKE_TOKEN",DATABASE_URL:"",TTO_API_BASE_URL:"",
 APIIR_TOKEN:"",VERCEL:""};
const components=[];
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function wait(port,path="/"){for(let i=0;i<90;i++){try{const r=await fetch("http://127.0.0.1:"+port+path,{signal:AbortSignal.timeout(1500)});if(r.status===200)return}catch{}await sleep(350)}throw Error("NOT_READY_"+port)}
async function main(){
 const broker=spawn(process.execPath,["scripts/security/pcs007-synthetic-cooperative-broker.cjs"],{cwd:ROOT,env:ENV,stdio:"ignore"});components.push(broker);await wait(32990,"/view");
 const apps=[["cooperative-management",32982],["shareholder",32981]];
 for(const [app,port] of apps){const cwd=resolve(ROOT,"apps",app);
  const nextBin=require.resolve("next/dist/bin/next",{paths:[cwd]});
  const p=spawn(process.execPath,[nextBin,"start","-H","127.0.0.1","-p",String(port)],{cwd,env:ENV,stdio:"ignore"});
  components.push(p);await wait(port);
 }
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:width===390?844:900},locale:"fa-IR",serviceWorkers:"block"});
   const manager=await ctx.newPage(),holder=await ctx.newPage(),failures=[];
   for(const page of [manager,holder]){page.on("pageerror",e=>failures.push(e.message));await page.route("**/*",async route=>{
    const req=route.request();if(!/^http:\/\/127\.0\.0\.1:3298[12]\//.test(req.url())){failures.push("OUTBOUND_"+req.url());await route.abort()}else await route.continue();
   })}
   await manager.goto("http://127.0.0.1:32982/review/pcs007",{waitUntil:"networkidle"});
   await holder.goto("http://127.0.0.1:32981/review/pcs007",{waitUntil:"networkidle"});
   assert.match(await manager.locator("body").innerText(),/در انتظار تأیید نمایشی|تأیید نمایشی انجام شده/);
   if(width===390)assert.match(await holder.locator("body").innerText(),/اطلاعات تأییدنشده/);
   await manager.getByRole("button",{name:"تأیید اطلاعات ساختگی"}).click();
   await holder.reload({waitUntil:"networkidle"});
   assert.match(await holder.locator("body").innerText(),/۱۲۵|125/);
   assert.match(await holder.locator("body").innerText(),/غیررسمی/);
   assert.match(await holder.locator("body").innerText(),/معامله غیرفعال است/);
   assert.equal(await manager.locator("body").evaluate(e=>e.scrollWidth>e.clientWidth+3),false);
   assert.equal(await holder.locator("body").evaluate(e=>e.scrollWidth>e.clientWidth+3),false);
   assert.deepEqual(failures,[]);
   console.log("TTO_PCS008_CROSS_PORTAL_"+width+"=PASS");
   await ctx.close();
  }
 }finally{await browser.close()}
}
main().catch(e=>{console.error("TTO_PCS008_BROWSER_FAIL",e);process.exitCode=1}).finally(()=>{for(const p of components)p.kill("SIGTERM")});
