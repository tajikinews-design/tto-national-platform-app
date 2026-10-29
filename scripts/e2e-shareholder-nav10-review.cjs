"use strict";
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {resolve,join}=require("node:path");
const {mkdirSync}=require("node:fs");
const {createHash}=require("node:crypto");
const {chromium}=require("playwright");
const ROOT=resolve(__dirname,".."),PORT=32980,BASE="http://127.0.0.1:"+PORT,URL="/review/interactive/nav-10";
const SHA=process.env.TTO_PHASE4C_EXPECTED_SOURCE_SHA;
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||!/^[a-f0-9]{40}$/.test(SHA??"")||process.env.VERCEL||process.env.APIIR_TOKEN)throw Error("NAV10_PRIVATE_ONLY");
let server,browser;let total=0;const screens=[];
function ok(x,name){assert.ok(x,name);total++;}
async function ready(){for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error("NEXT_EXIT");try{if((await fetch(BASE+URL,{signal:AbortSignal.timeout(1500)})).status===200)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error("NEXT_NOT_READY");}
async function check(width,height,deep){
const context=await browser.newContext({viewport:{width,height},locale:"fa-IR",reducedMotion:"reduce"});
const page=await context.newPage(),errors=[],external=[],writes=[];
page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(!r.url().startsWith(BASE))external.push(r.url());if(r.method()!=="GET")writes.push(r.method());});
try{
 ok((await page.goto(BASE+URL,{waitUntil:"networkidle"})).status()===200,"HTTP");
 ok(await page.locator('main.nav10-shell[dir="rtl"][data-source-mode="UNVERIFIED"]').count()===1,"DEFAULT_DENY");
 ok(await page.locator(".w1a-side-link").count()===11,"ROOTS_11");
 ok(await page.locator(".nav06-section-button").count()===8,"CANONICAL_EIGHT");
 ok(await page.locator(".nav06-tile").count()===0,"NO_PERSONAL_DATA");
 ok(await page.locator(".w1a-kpi").count()===4,"FOUR_KPIS");
 ok(await page.locator(".w1a-summary-panel").count()===4,"FOUR_PANELS");
 ok(await page.locator('a[aria-current="page"]').count()===1,"ACTIVE_NAV");
 ok((await page.getByText("دریافت گزارش/PDF",{exact:true}).count())>0,"PDF_SECTION_LABEL");
 await page.getByRole("button",{name:"نمونه کاملاً ساختگی",exact:true}).click();
 ok(await page.locator(".nav06-tile").count()===2,"FICTIONAL_FIXTURES");
 ok(await page.locator('main[data-source-mode="DEMO_CONTENT"]').count()===1,"DEMO_MODE");
 await page.getByRole("button",{name:"مشاهده جزئیات ←"}).first().click();
 ok(await page.locator(".nav10-detail").isVisible(),"DETAIL");
 ok(await page.locator(".nav10-detail").getByText("PDF: غیرفعال").count()===1,"NO_PDF");
 await page.getByRole("button",{name:"بستن جزئیات"}).click();
 ok(await page.locator(".nav10-detail").count()===0,"CLOSE_DETAIL");
 if(deep){
  for(let i=0;i<8;i++){
   await page.locator(".nav06-section-button").nth(i).click();
   ok(await page.locator(".nav06-tile").count()===2,"EIGHT_FIXTURES_"+i);
   const search=page.locator("#nav10-search");
   await search.fill("NO-RESULT-EXPECTED");
   ok(await page.locator(".nav06-tile").count()===0,"FILTER_"+i);
   await search.fill("");
  }
  await page.getByRole("button",{name:"منبع در دسترس نیست",exact:true}).click();
  ok(await page.locator(".nav06-tile").count()===0,"SOURCE_UNAVAILABLE_FAIL_CLOSED");
  await page.getByRole("button",{name:"دسترسی مجاز نیست",exact:true}).click();
  ok(await page.locator(".nav06-tile").count()===0,"ACCESS_DENIED_FAIL_CLOSED");
 }
 if(width<=980){const b=page.locator(".w1a-mobile-menu-toggle");await b.click();ok(await b.getAttribute("aria-expanded")==="true","MOBILE_OPEN");await b.focus();await page.keyboard.press("Escape");ok(await b.getAttribute("aria-expanded")==="false","MOBILE_CLOSE");}
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"NO_HORIZONTAL_OVERFLOW");
 await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();scrollTo(0,0);});
 await page.waitForFunction(()=>scrollY===0);
 const file=join("/workspace/.qa-artifacts",SHA,"nav10-"+width+".png");
 const bytes=await page.screenshot({path:file,type:"png",fullPage:width===1536,animations:"disabled"});
 screens.push({width,height,file,sha256:createHash("sha256").update(bytes).digest("hex"),length:bytes.length});
 ok(bytes.length>12000,"SCREENSHOT");
 ok(errors.length===0,"NO_JS_ERROR");
 ok(external.length===0,"NO_EXTERNAL_CALL");
 ok(writes.length===0,"NO_WRITES");
}finally{await context.close();}}
async function main(){
const cwd=resolve(ROOT,"apps/shareholder");
server=spawn(process.execPath,[resolve(cwd,"node_modules/next/dist/bin/next"),"start","-p",String(PORT),"--hostname","127.0.0.1"],{cwd,env:{...process.env,PORT:String(PORT),TTO_API_BASE_URL:"",NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore"});
await ready();mkdirSync(join("/workspace/.qa-artifacts",SHA),{recursive:true});
browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await check(1440,900,true);await check(1536,1024,false);await check(768,1024,false);await check(390,844,true);await check(320,740,false);
console.log("TTO_NAV10_CHROMIUM_VIEWPORTS=5/5");
console.log("TTO_NAV10_CHROMIUM_CHECKS="+total);
console.log("TTO_NAV10_SCREENSHOT_HASHES="+JSON.stringify(screens));
console.log("TTO_NAV10_CHROMIUM_PASS_SHA="+SHA);
}
main().catch(e=>{console.error("NAV10_CHROMIUM_FAILED="+String(e.stack??e));process.exitCode=1;}).finally(async()=>{if(browser)await browser.close().catch(()=>{});if(server&&server.exitCode===null)server.kill("SIGTERM");});
