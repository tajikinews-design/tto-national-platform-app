"use strict";
/** W1 cross-NAV, private Chromium: 11 routes, mobile, links, no external requests or writes. */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {resolve,join}=require("node:path");
const {mkdirSync}=require("node:fs");
const {createHash}=require("node:crypto");
const {chromium}=require("playwright");
const ROOT=resolve(__dirname,".."),PORT=32982,BASE="http://127.0.0.1:"+PORT;
const PATHS=["/review/interactive",...Array.from({length:10},(_,i)=>"/review/interactive/nav-"+String(i+2).padStart(2,"0"))];
const SHA=process.env.TTO_PHASE4C_EXPECTED_SOURCE_SHA;
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||!/^[a-f0-9]{40}$/.test(SHA??"")||process.env.VERCEL||process.env.APIIR_TOKEN)throw Error("W1_INTEGRATION_PRIVATE_ONLY");
let server,browser,count=0;const shots=[];
const ok=(condition,code)=>{assert.ok(condition,code);count++};
async function ready(){for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error("NEXT_EXIT");try{if((await fetch(BASE+PATHS[0],{signal:AbortSignal.timeout(1500)})).status===200)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error("NEXT_NOT_READY")}
async function test(width,height){
 const ctx=await browser.newContext({viewport:{width,height},locale:"fa-IR",reducedMotion:"reduce"});
 const page=await ctx.newPage(),errors=[],externals=[],writes=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith(BASE))externals.push(r.url());if(r.method()!=="GET")writes.push(r.method())});
 try{
  for(let i=0;i<PATHS.length;i++){
   const path=PATHS[i],r=await page.goto(BASE+path,{waitUntil:"networkidle"});
   ok(r!==null && r.status()===200,"ROUTE_HTTP_"+width+"_"+i);
   ok(await page.locator("h1").count()>=1,"TITLE_"+width+"_"+i);
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"OVERFLOW_"+width+"_"+i);
   if(i>=3){
    const links=page.locator(".w1a-side-link[href]");
    ok(await links.count()===11,"SIDEBAR_LINKS_"+width+"_"+i);
    const active=page.locator('.w1a-side-link[aria-current="page"]');
    ok(await active.count()===1,"ACTIVE_"+width+"_"+i);
    if(width<=768){
     const b=page.locator(".w1a-mobile-menu-toggle");
     await b.click();ok(await b.getAttribute("aria-expanded")==="true","MENU_OPEN_"+width+"_"+i);
     await b.focus();await page.keyboard.press("Escape");
     ok(await b.getAttribute("aria-expanded")==="false","MENU_CLOSE_"+width+"_"+i);
    }
   }
  }
  // Navigate across the exact previously broken links from NAV04, ensuring landing sections.
  await page.goto(BASE+PATHS[3],{waitUntil:"networkidle"});
  if(width<=768)await page.locator(".w1a-mobile-menu-toggle").click();
  await page.locator('.w1a-side-link[href="/review/interactive/nav-10"]').click();
  ok(new URL(page.url()).pathname===PATHS[9],"NAV04_TO_NAV10_"+width);
  if(width<=768)await page.locator(".w1a-mobile-menu-toggle").click();
  await page.locator('.w1a-side-link[href="/review/interactive/nav-11"]').click();
  ok(new URL(page.url()).pathname===PATHS[10],"NAV10_TO_NAV11_"+width);
  ok(await page.locator('main[data-source-mode="UNVERIFIED"]').count()===1,"ACCOUNT_DEFAULT_DENY_"+width);
  // Screenshot only synthetic settings view; no secrets.
  const f=join("/workspace/.qa-artifacts",SHA,"w1-integrated-"+width+".png");
  mkdirSync(join("/workspace/.qa-artifacts",SHA),{recursive:true});
  const data=await page.screenshot({path:f,animations:"disabled"});
  shots.push({width,file:f,sha256:createHash("sha256").update(data).digest("hex")});
  ok(data.length>10000,"PNG_"+width);
  ok(errors.length===0,"JS_"+width);ok(externals.length===0,"EXTERNAL_"+width);ok(writes.length===0,"WRITES_"+width);
 }finally{await ctx.close()}
}
async function main(){
 const cwd=resolve(ROOT,"apps/shareholder");
 server=spawn(process.execPath,[resolve(cwd,"node_modules/next/dist/bin/next"),"start","-p",String(PORT),"--hostname","127.0.0.1"],{cwd,env:{...process.env,PORT:String(PORT),TTO_API_BASE_URL:"",NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore"});
 await ready();browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 await test(1440,900);await test(768,1024);await test(390,844);await test(320,740);
 console.log("TTO_W1_ALL_11_ROUTES=PASS");
 console.log("TTO_W1_CROSS_NAV_MOBILE_VIEWPORTS=4/4");
 console.log("TTO_W1_INTEGRATED_CHROMIUM_CHECKS="+count);
 console.log("TTO_W1_INTEGRATED_SCREENSHOT_HASHES="+JSON.stringify(shots));
 console.log("TTO_W1_INTEGRATED_CHROMIUM_PASS_SHA="+SHA);
}
main().catch(e=>{console.error("TTO_W1_INTEGRATED_CHROMIUM_FAILED="+String(e.stack??e));process.exitCode=1}).finally(async()=>{if(browser)await browser.close().catch(()=>{});if(server&&server.exitCode===null)server.kill("SIGTERM")});
