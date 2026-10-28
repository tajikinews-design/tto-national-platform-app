"use strict";
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {resolve,join}=require("node:path");
const {mkdirSync}=require("node:fs");
const {createHash}=require("node:crypto");
const {chromium}=require("playwright");
const ROOT=resolve(__dirname,".."),PORT=32977,BASE="http://127.0.0.1:"+PORT,URL="/review/interactive/nav-07";
const SHA=process.env.TTO_PHASE4C_EXPECTED_SOURCE_SHA;
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||!/^[a-f0-9]{40}$/.test(SHA??"")||process.env.VERCEL||process.env.APIIR_TOKEN)throw Error("NAV07_PRIVATE_ONLY");
let server,browser;const screens=[],checks=[];
function ok(value,label){assert.ok(value,label);checks.push(label);}
async function ready(){for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error("NEXT_DIED");try{if((await fetch(BASE+URL,{signal:AbortSignal.timeout(1500)})).status===200)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error("NEXT_NOT_READY");}
async function verify(width,height,deep){
 const ctx=await browser.newContext({viewport:{width,height},locale:"fa-IR",reducedMotion:"reduce"});
 const page=await ctx.newPage(),errors=[],external=[],writes=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith(BASE))external.push(r.url());if(r.method()!=="GET")writes.push(r.method());});
 try{
  ok((await page.goto(BASE+URL,{waitUntil:"networkidle"})).status()===200,"HTTP_"+width);
  ok(await page.locator('main.nav07-shell[dir="rtl"][data-source-mode="UNVERIFIED"]').count()===1,"DENY_"+width);
  ok(await page.locator(".w1a-side-link").count()===11,"ROOTS_"+width);
  ok(await page.locator(".nav06-section-button").count()===10,"SECTIONS_"+width);
  ok(await page.locator(".nav06-tile").count()===0,"EMPTY_DEFAULT_"+width);
  ok(await page.locator(".w1a-kpi").count()===4,"KPI_"+width);
  ok(await page.locator(".w1a-summary-panel").count()===4,"PANELS_"+width);
  await page.getByRole("button",{name:"ابزار بررسی توسعه‌دهنده"}).click();
  await page.getByRole("button",{name:"نمونه کاملاً ساختگی",exact:true}).click();
  await page.getByRole("button",{name:"بستن ابزارهای بررسی"}).click();
  ok(await page.locator(".nav06-tile").count()===2,"DEMO_OPTIN_"+width);
  for(const b of await page.locator(".nav06-submit-guard button").all())ok(await b.isDisabled(),"NO_REQUEST_"+width);
  if(width<=980){const b=page.locator(".w1a-mobile-menu-toggle");await b.click();ok(await b.getAttribute("aria-expanded")==="true","MOBILE_OPEN_"+width);await b.focus();await page.keyboard.press("Escape");ok(await b.getAttribute("aria-expanded")==="false","MOBILE_CLOSE_"+width);}
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"NO_OVERFLOW_"+width);
  await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();scrollTo(0,0);});
  await page.waitForFunction(()=>scrollY===0);
  const file=join("/workspace/.qa-artifacts",SHA,"nav07-"+width+".png");
  const bytes=await page.screenshot({path:file,type:"png",fullPage:width===1536,animations:"disabled"});
  screens.push({width,height,file,sha256:createHash("sha256").update(bytes).digest("hex"),length:bytes.length});
  ok(bytes.length>15000,"SCREENSHOT_"+width);
  if(deep){
   for(let i=0;i<10;i++){const b=page.locator(".nav06-section-button").nth(i);await b.click();ok(await b.getAttribute("aria-pressed")==="true","CATEGORY_"+i+"_"+width);ok(await page.locator(".nav06-tile").count()>0,"ITEMS_"+i+"_"+width);await page.getByRole("button",{name:"مشاهده جزئیات نمونه ←"}).first().click();ok(await page.locator("#nav07-details").isVisible(),"DETAIL_"+i+"_"+width);for(const x of await page.locator(".nav06-disabled button").all())ok(await x.isDisabled(),"NO_WRITE_"+i+"_"+width);await page.getByRole("button",{name:"بستن جزئیات"}).click();}
   await page.getByRole("button",{name:"ابزار بررسی توسعه‌دهنده"}).click();
   await page.getByRole("button",{name:"منبع بازار در دسترس نیست",exact:true}).click();
   ok(await page.locator(".nav06-tile").count()===0,"SOURCE_LOSS_DENY_"+width);
  }
  ok(errors.length===0,"ZERO_JS_ERRORS_"+width);ok(external.length===0,"ZERO_EXTERNAL_"+width);ok(writes.length===0,"ZERO_WRITES_"+width);
 }finally{await ctx.close();}
}
async function main(){
 const cwd=resolve(ROOT,"apps/shareholder");server=spawn(process.execPath,[resolve(cwd,"node_modules/next/dist/bin/next"),"start","-p",String(PORT),"--hostname","127.0.0.1"],{cwd,env:{...process.env,PORT:String(PORT),TTO_API_BASE_URL:"",NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore"});
 await ready();mkdirSync(join("/workspace/.qa-artifacts",SHA),{recursive:true});browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 await verify(1440,900,true);await verify(1536,1024,false);await verify(768,1024,false);await verify(390,844,true);await verify(320,740,false);
 console.log("TTO_NAV07_CHROMIUM_VIEWPORTS=5/5");console.log("TTO_NAV07_CHROMIUM_CHECKS="+checks.length);
 console.log("TTO_NAV07_SCREENSHOT_HASHES="+JSON.stringify(screens));console.log("TTO_NAV07_CHROMIUM_PASS_SHA="+SHA);
}
main().catch(e=>{console.error("NAV07_CHROMIUM_FAILED="+String(e.stack??e));process.exitCode=1;}).finally(async()=>{if(browser)await browser.close().catch(()=>{});if(server&&server.exitCode===null)server.kill("SIGTERM");});
