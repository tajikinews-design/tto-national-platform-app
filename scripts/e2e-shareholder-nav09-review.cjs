"use strict";
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {resolve,join}=require("node:path");
const {mkdirSync}=require("node:fs");
const {createHash}=require("node:crypto");
const {chromium}=require("playwright");
const ROOT=resolve(__dirname,".."),PORT=32979,BASE="http://127.0.0.1:"+PORT,URL="/review/interactive/nav-09";
const SHA=process.env.TTO_PHASE4C_EXPECTED_SOURCE_SHA;
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||!/^[a-f0-9]{40}$/.test(SHA??"")||process.env.VERCEL||process.env.APIIR_TOKEN)throw Error("NAV09_PRIVATE_ONLY");
let server,browser;let total=0;const screens=[];
function ok(x,name){assert.ok(x,name);total++;}
async function ready(){for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error("NEXT_EXIT");try{if((await fetch(BASE+URL,{signal:AbortSignal.timeout(1500)})).status===200)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error("NEXT_NOT_READY");}
async function check(width,height,deep){
const c=await browser.newContext({viewport:{width,height},locale:"fa-IR",reducedMotion:"reduce"}),p=await c.newPage(),errors=[],external=[],writes=[];
p.on("pageerror",e=>errors.push(e.message));p.on("request",r=>{if(!r.url().startsWith(BASE))external.push(r.url());if(r.method()!=="GET")writes.push(r.method());});
try{
ok((await p.goto(BASE+URL,{waitUntil:"networkidle"})).status()===200,"HTTP");
ok(await p.locator('main.nav09-shell[dir="rtl"][data-source-mode="UNVERIFIED"]').count()===1,"DENY");
ok(await p.locator(".w1a-side-link").count()===11,"ROOTS");
ok(await p.locator(".nav06-section-button").count()===8,"MENUS");
ok(await p.locator(".nav06-tile").count()===0,"NO_LEAK");
ok(await p.locator(".w1a-kpi").count()===4,"KPI");
ok(await p.locator(".w1a-summary-panel").count()===4,"PANELS");
await p.getByRole("button",{name:"ابزار بررسی توسعه‌دهنده"}).click();
await p.getByRole("button",{name:"نمونه کاملاً ساختگی",exact:true}).click();
await p.getByRole("button",{name:"بستن ابزارهای بررسی"}).click();
ok(await p.locator(".nav06-tile").count()===2,"DEMO");
for(const b of await p.locator(".nav06-submit-guard button").all())ok(await b.isDisabled(),"DISABLED");
if(width<=980){const b=p.locator(".w1a-mobile-menu-toggle");await b.click();ok(await b.getAttribute("aria-expanded")==="true","OPEN");await b.focus();await p.keyboard.press("Escape");ok(await b.getAttribute("aria-expanded")==="false","CLOSE");}
ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"OVERFLOW");
await p.evaluate(()=>scrollTo(0,0));await p.waitForFunction(()=>scrollY===0);
const file=join("/workspace/.qa-artifacts",SHA,"nav09-"+width+".png");
const bytes=await p.screenshot({path:file,type:"png",fullPage:width===1536,animations:"disabled"});
screens.push({width,height,file,sha256:createHash("sha256").update(bytes).digest("hex"),length:bytes.length});ok(bytes.length>15000,"PNG");
if(deep){for(let i=0;i<8;i++){await p.locator(".nav06-section-button").nth(i).click();ok(await p.locator(".nav06-tile").count()>0,"ITEM");await p.getByRole("button",{name:"مشاهده جزئیات نمونه ←"}).first().click();ok(await p.locator("#nav09-details").isVisible(),"DETAIL");for(const b of await p.locator(".nav06-disabled button").all())ok(await b.isDisabled(),"NO_WRITE");await p.getByRole("button",{name:"بستن جزئیات"}).click();}
 await p.getByRole("button",{name:"ابزار بررسی توسعه‌دهنده"}).click();
 await p.getByRole("button",{name:"منبع اسناد در دسترس نیست",exact:true}).click();
 ok(await p.locator(".nav06-tile").count()===0,"SOURCE_UNAVAILABLE_DENY");
}
ok(errors.length===0,"JS");ok(external.length===0,"EXTERNAL");ok(writes.length===0,"WRITES");
}finally{await c.close();}}
async function main(){const cwd=resolve(ROOT,"apps/shareholder");server=spawn(process.execPath,[resolve(cwd,"node_modules/next/dist/bin/next"),"start","-p",String(PORT),"--hostname","127.0.0.1"],{cwd,env:{...process.env,PORT:String(PORT),TTO_API_BASE_URL:"",NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore"});
await ready();mkdirSync(join("/workspace/.qa-artifacts",SHA),{recursive:true});browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
await check(1440,900,true);await check(1536,1024,false);await check(768,1024,false);await check(390,844,true);await check(320,740,false);
console.log("TTO_NAV09_CHROMIUM_VIEWPORTS=5/5");console.log("TTO_NAV09_CHROMIUM_CHECKS="+total);console.log("TTO_NAV09_SCREENSHOT_HASHES="+JSON.stringify(screens));console.log("TTO_NAV09_CHROMIUM_PASS_SHA="+SHA);}
main().catch(e=>{console.error("NAV09_CHROMIUM_FAILED="+String(e.stack??e));process.exitCode=1;}).finally(async()=>{if(browser)await browser.close().catch(()=>{});if(server&&server.exitCode===null)server.kill("SIGTERM");});
