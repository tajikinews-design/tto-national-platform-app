"use strict";
/** Isolated Chromium NAV05 review: synthetic content only. No POST, network mocks,
 * remote requests, acknowledgement or legal publication permitted.
 */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {resolve,join}=require("node:path");
const {mkdirSync}=require("node:fs");
const {createHash}=require("node:crypto");
const {chromium}=require("playwright");
const ROOT=resolve(__dirname,".."),PORT=32975,BASE="http://127.0.0.1:"+PORT;
const URL="/review/interactive/nav-05",SHA=process.env.TTO_PHASE4C_EXPECTED_SOURCE_SHA;
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||
 !/^[a-f0-9]{40}$/.test(SHA??"")||process.env.VERCEL||process.env.APIIR_TOKEN)
 throw Error("NAV05_VISUAL_PRIVATE_LOOPBACK_ONLY");
const IDS=["NEWS","NOTICES","ASSURED","ACK","SURVEYS","VOICE","PROPOSALS","RESPONSES","TICKETS","ALERTS"];
const LABELS=["اخبار شرکت","اطلاعیه‌ها","ابلاغ‌های مهم","پیام‌های نیازمند تأیید","نظرسنجی‌ها","صدای من","پیشنهادهای من","پاسخ مدیریت","تیکت‌های من","اعلان‌ها"];
const COUNTS=[2,2,1,1,1,1,1,1,2,1];
let server,browser;const checks=[],viewports=[];
function ok(value,label){assert.ok(value,label);checks.push(label);}
async function ready(){
 for(let i=0;i<110;i++){
  if(server.exitCode!==null)throw Error("NAV05_NEXT_DIED");
  try{const response=await fetch(BASE+URL,{signal:AbortSignal.timeout(1500)});
   if(response.status===200)return;}catch{}
  await new Promise(r=>setTimeout(r,230));
 }
 throw Error("NAV05_NEXT_NOT_READY");
}
async function verify(width,height,interact){
 const ctx=await browser.newContext({viewport:{width,height},locale:"fa-IR",reducedMotion:"reduce"});
 const page=await ctx.newPage(),errors=[],external=[],writes=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",req=>{
  if(!req.url().startsWith(BASE))external.push(req.url());
  if(req.method()!=="GET")writes.push(req.url());
 });
 try{
  const resp=await page.goto(BASE+URL,{waitUntil:"networkidle",timeout:30000});
  ok(resp.status()===200,"HTTP_200_"+width);
  ok(await page.locator('main.nav05-shell[dir="rtl"][data-source-mode="UNVERIFIED"]').count()===1,"DEFAULT_FAIL_CLOSED_"+width);
  ok(await page.locator(".w1a-side-link").count()===11,"CANONICAL_11_ROOTS_"+width);
  ok(await page.locator(".nav05-category").count()===10,"CANONICAL_10_SUBMENUS_"+width);
  ok(await page.locator(".w1a-kpi").count()===4,"APPROVED_4_KPI_"+width);
  ok(await page.locator(".w1a-summary-panel").count()===4,"APPROVED_4_PANELS_"+width);
  ok(await page.locator(".w1a-action").count()===4,"APPROVED_4_SHORTCUTS_"+width);
  ok(await page.locator(".nav05-record").count()===0,"NO_UNVERIFIED_RECORDS_"+width);
  ok(await page.locator(".nav05-source-empty").isVisible(),"NO_DATA_NOT_ZERO_"+width);
  ok(await page.locator("#nav05-review-panels").isHidden(),"REVIEW_TOOLS_HIDDEN_"+width);
  const tools=page.getByRole("button",{name:"ابزار بررسی توسعه‌دهنده"});
  await tools.click();
  ok(await page.locator("#nav05-review-panels").isVisible(),"SOURCE_CONTROL_OPTIN_AVAILABLE_"+width);
  await page.getByRole("button",{name:"نمونه کاملاً ساختگی",exact:true}).click();
  ok(await page.locator('main.nav05-shell[data-source-mode="DEMO_CONTENT"]').count()===1,"DEMO_OPTIN_ONLY_"+width);
  await page.getByRole("button",{name:"بستن ابزارهای بررسی"}).click();
  ok(await page.locator(".nav05-record").count()===2,"NEWS_SAMPLE_COUNT_"+width);
  ok(await page.locator(".nav05-panel-empty").count()===0,"ALL_FOUR_OVERVIEW_SAMPLES_"+width);
  ok(await page.locator(".nav05-record h3").first().textContent().then(x=>x?.includes("نمونه")),"EXPLICITLY_SYNTHETIC_LABEL_"+width);
  const noSubmit=page.locator(".nav05-composition-only button");
  ok(await noSubmit.count()===3,"NONOPERATIVE_SEND_CONTROLS_"+width);
  for(let k=0;k<3;k++)ok(await noSubmit.nth(k).isDisabled(),"NO_REAL_SUBMIT_"+width+"_"+k);
  if(width<=980){
   const menu=page.locator(".w1a-mobile-menu-toggle");
   ok(await menu.isVisible(),"MOBILE_MENU_VISIBLE_"+width);
   await menu.click();ok(await menu.getAttribute("aria-expanded")==="true","MOBILE_MENU_OPEN_"+width);
   await menu.focus();await page.keyboard.press("Escape");
   ok(await menu.getAttribute("aria-expanded")==="false","ESCAPE_CLOSES_MENU_"+width);
  }
  const display=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth,
   dir:getComputedStyle(document.body).direction}));
  ok(display.scroll<=width+2,"NO_HORIZONTAL_OVERFLOW_"+width);
  ok(display.dir==="rtl","DOCUMENT_RTL_"+width);
  const captured=await page.evaluate(()=>{
   if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
   window.scrollTo(0,0);
   return document.activeElement?.tagName;
  });
  await page.waitForFunction(()=>window.scrollY===0);
  ok(["BODY","HTML"].includes(captured),"NEUTRAL_FOCUS_BEFORE_SCREENSHOT_"+width);
  if(width===1440)ok(await page.locator(".w1a-page-heading").evaluate(el=>{
    const rect=el.getBoundingClientRect();return rect.top>=0&&rect.bottom<window.innerHeight;
   }),"1440_PAGE_HEADING_IN_FRAME");
  const file=join("/workspace/.qa-artifacts",SHA,"nav05-"+width+".png");
  const bytes=await page.screenshot({type:"png",animations:"disabled",path:file,fullPage:width===1536});
  const hash=createHash("sha256").update(bytes).digest("hex");
  viewports.push({width,height,file,sha256:hash,length:bytes.length});
  ok(bytes.length>20000,"REAL_CHROMIUM_SCREENSHOT_"+width);
  if(interact){
   for(let i=0;i<10;i++){
    const button=page.locator(".nav05-category").nth(i);
    ok(await button.textContent().then(x=>x?.trim()===LABELS[i]),"LABEL_"+IDS[i]+"_"+width);
    await button.click();
    ok(await button.getAttribute("aria-pressed")==="true","SECTION_SELECTED_"+IDS[i]+"_"+width);
    ok(await page.locator(".nav05-record").count()===COUNTS[i],"DATA_COUNT_"+IDS[i]+"_"+width);
    const detail=page.getByRole("button",{name:"مشاهده جزئیات نمونه ←"}).first();
    await detail.click();
    const panel=page.locator("#nav05-public-details");
    ok(await panel.isVisible(),"DETAIL_VISIBLE_"+IDS[i]+"_"+width);
    ok(await panel.getByText("صرفاً پیش‌نمایش؛ انتشار رسمی نشده").isVisible(),"NOT_OFFICIAL_"+IDS[i]+"_"+width);
    for(const action of await panel.locator(".nav05-sensitive-actions button").all())
      ok(await action.isDisabled(),"NO_LEGAL_ACTION_"+IDS[i]+"_"+width);
    await page.getByRole("button",{name:"بستن جزئیات"}).click();
    ok(await panel.isHidden(),"DETAIL_CLOSE_"+IDS[i]+"_"+width);
   }
   await page.getByRole("button",{name:"اخبار شرکت",exact:true}).click();
   const search=page.getByRole("searchbox",{name:"جست‌وجوی موارد نمونه"});
   await search.fill("این واژه وجود ندارد");
   ok(await page.locator(".nav05-record").count()===0,"SEARCH_NO_FALSE_RESULTS_"+width);
   await search.fill("");ok(await page.locator(".nav05-record").count()===2,"SEARCH_RESTORES_RESULTS_"+width);
   await page.getByRole("button",{name:"ابزار بررسی توسعه‌دهنده"}).click();
   await page.getByRole("button",{name:"منبع در دسترس نیست",exact:true}).click();
   ok(await page.locator(".nav05-record").count()===0,"SOURCE_LOSS_CLEARS_CONTENT_"+width);
   ok(await page.locator(".nav05-source-empty").isVisible(),"SOURCE_LOSS_FAIL_CLOSED_"+width);
   ok(await page.locator(".w1a-kpi strong").first().textContent().then(x=>x==="—"),"UNKNOWN_NOT_ZERO_"+width);
  }
  ok(errors.length===0,"ZERO_PAGE_ERRORS_"+width);
  ok(external.length===0,"ZERO_EXTERNAL_NETWORK_"+width);
  ok(writes.length===0,"ZERO_POST_OR_WRITE_"+width);
 }finally{await ctx.close();}
}
async function main(){
 const cwd=resolve(ROOT,"apps/shareholder"),entry=resolve(cwd,"node_modules/next/dist/bin/next");
 server=spawn(process.execPath,[entry,"start","-p",String(PORT),"--hostname","127.0.0.1"],{
  cwd,env:{...process.env,PORT:String(PORT),TTO_API_BASE_URL:"",NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore"
 });
 await ready();mkdirSync(join("/workspace/.qa-artifacts",SHA),{recursive:true});
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 await verify(1440,900,true);await verify(1536,1024,false);await verify(768,1024,false);
 await verify(390,844,true);await verify(320,740,false);
 console.log("TTO_NAV05_CHROMIUM_VIEWPORTS=5/5");
 console.log("TTO_NAV05_CHROMIUM_CHECKS="+checks.length);
 console.log("TTO_NAV05_SCREENSHOT_HASHES="+JSON.stringify(viewports));
 console.log("TTO_NAV05_CHROMIUM_PASS_SHA="+SHA);
}
main().catch(e=>{console.error("NAV05_CHROMIUM_FAILED="+String(e?.stack??e));process.exitCode=1;})
 .finally(async()=>{if(browser)await browser.close().catch(()=>{});if(server&&server.exitCode===null)server.kill("SIGTERM");});
