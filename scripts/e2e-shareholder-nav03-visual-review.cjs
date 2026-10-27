"use strict";
/** Strictly local review-only Chromium UI/geometry audit.
 * Runs inside disposable Playwright Docker in the PG17 private namespace.
 * No DB access, no SMS, no real user, no external network, no upload.
 */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {createHash}=require("node:crypto");
const {resolve}=require("node:path");
const {chromium}=require("playwright");
const ROOT=resolve(__dirname,"..");
const PORT=32973, ORIGIN="http://127.0.0.1:"+PORT;
const PATH="/review/interactive/nav-03/case-demo";
const EXPECTED_SHA=process.env.TTO_PHASE4C_EXPECTED_SOURCE_SHA;
const paths=["/review/interactive/nav-03",PATH];
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||
 !/^[0-9a-f]{40}$/.test(EXPECTED_SHA??"")||
 process.env.APIIR_TOKEN||process.env.VERCEL)
 throw Error("NAV03_VISUAL_REVIEW_PRIVATE_CI_ONLY");
const CHECKS=[];
function check(value,name){assert.ok(value,name);CHECKS.push(name);}
const observed=[];
let server=null, browser=null;
async function ready(){
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw Error("NEXT_PROCESS_TERMINATED");
  try{
   const res=await fetch(ORIGIN+PATH,{signal:AbortSignal.timeout(1500)});
   if(res.status===200)return;
  }catch{}
  await new Promise(ok=>setTimeout(ok,250));
 }
 throw Error("PRIVATE_NEXT_NOT_READY");
}
async function suite(viewport,doInteractions){
 const ctx=await browser.newContext({viewport,locale:"fa-IR",reducedMotion:"reduce"});
 const page=await ctx.newPage();
 const errors=[],external=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("request",r=>{if(!r.url().startsWith(ORIGIN))external.push(r.url());});
 try{
  const resp=await page.goto(ORIGIN+PATH,{waitUntil:"networkidle",timeout:30000});
  check(resp.status()===200,"HTTP200_"+viewport.width);
  await page.locator(".w1t-cases .w1t-case").first().waitFor();
  check(await page.locator("main[dir=rtl]").count()===1,"RTL_MAIN_"+viewport.width);
  check(await page.locator(".w1t-cases .w1t-case").count()===9,"NINE_FIXTURES_"+viewport.width);
  check(await page.locator(".w1t-case").filter({hasText:"DEMO-SELL-QUEUED"}).count()===1,"SAFE_DEFAULT_"+viewport.width);
  check(await page.getByText("مالکیت منتقل نشده است",{exact:true}).count()===1,"NO_TRANSFER_DEFAULT_"+viewport.width);
  const disabled=page.locator(".w1t-disabled-actions button");
  check(await disabled.isDisabled(),"NO_OPERATIONS_"+viewport.width);
  // Bounding boxes are backed by the actual chromium layout, not CSS-only guesses.
  const geom=await page.evaluate(()=>{
   const doc=document.documentElement;
   return {scrollWidth:doc.scrollWidth,innerWidth:window.innerWidth,
    badCards:[...document.querySelectorAll(".w1t-cases .w1t-case")].some(
      el=>el.getBoundingClientRect().width<90)};
  });
  check(geom.scrollWidth<=geom.innerWidth+2,"NO_HORIZONTAL_OVERFLOW_"+viewport.width+
   "_scroll_"+geom.scrollWidth+"_vp_"+geom.innerWidth);
  check(!geom.badCards,"CARD_MIN_WIDTH_"+viewport.width);
  const shot=await page.screenshot({type:"png",fullPage:false,animations:"disabled"});
  check(shot.byteLength>6000,"NONEMPTY_RENDER_"+viewport.width);
  observed.push({viewport,geom,shotSha256:createHash("sha256").update(shot).digest("hex")});
  if(doInteractions){
   const buy=page.getByRole("button",{name:"خرید",exact:true});
   await buy.click();
   check(await buy.getAttribute("aria-pressed")==="true","BUY_FILTER_ACTIVE");
   check(await page.locator(".w1t-case").count()===6,"BUY_FILTER_SIX");
   const dis=page.locator(".w1t-case").filter({hasText:"DEMO-BUY-DISPUTED"});
   await dis.click();
   check(await dis.getAttribute("aria-pressed")==="true","DISPUTE_SELECTED");
   check(await page.getByText("پرونده نمونه دارای اختلاف پرداخت باز است").count()===1||
         await page.getByText("پرونده نمونه دارای اختلاف پرداخت باز است؛ هرگونه Finalization باید متوقف بماند.").count()===1,
         "DISPUTE_BLOCKS_FINALIZATION");
   const details=page.getByText("نمونه کدهای دلیل اختلاف طبق Specification");
   await details.click();
   check(await page.getByText("PAYMENT_AMOUNT_MISMATCH",{exact:true}).count()>=1,
       "DISPUTE_REASON_VISIBLE");
   const registered=page.locator(".w1t-case").filter({hasText:"DEMO-BUY-REGISTERED"});
   await registered.click();
   check(await page.getByText("در نمونه، ثبت دفتر انجام شده؛ Finalization هنوز کامل نیست").count()===1,
         "REGISTER_IS_NOT_TRANSFER");
   const completed=page.locator(".w1t-case").filter({hasText:"DEMO-BUY-COMPLETED"});
   await completed.click();
   check(await page.locator(".w1t-timeline li").count()===21,"COMPLETE_FIXTURE_21_EVENTS");
   check(await page.getByText("هیچ مالکیت واقعی جابه‌جا نشده",{exact:false}).count()>=1,
         "COMPLETED_MARKED_FICTION");
   const seller=page.getByRole("button",{name:"فروش",exact:true});
   await seller.focus();
   await page.keyboard.press("Enter");
   check(await seller.getAttribute("aria-pressed")==="true","KEYBOARD_ENTER_FILTER");
   check(await page.locator(".w1t-case").count()===3,"SELL_FILTER_THREE");
   const cancelled=page.locator(".w1t-case").filter({hasText:"DEMO-SELL-CANCELLED"});
   await cancelled.focus();
   await page.keyboard.press("Enter");
   check(await cancelled.getAttribute("aria-pressed")==="true","KEYBOARD_ENTER_CASE");
   check(await page.getByText("لغو در سناریوی فرضی",{exact:false}).count()>=1,
         "SELL_CANCEL_DISCLOSURE");
   check(await disabled.isDisabled(),"STILL_DISABLED_AFTER_INTERACTION");
  }
  check(errors.length===0,"NO_REACT_BROWSER_ERRORS_"+viewport.width);
  check(external.length===0,"NO_EXTERNAL_REQUESTS_"+viewport.width);
 }finally{await ctx.close();}
}
async function run(){
 const cwd=resolve(ROOT,"apps/shareholder");
 const bin=resolve(cwd,"node_modules/next/dist/bin/next");
 server=spawn(process.execPath,[bin,"start","-p",String(PORT),"--hostname","127.0.0.1"],{
  cwd,env:{...process.env,PORT:String(PORT),TTO_API_BASE_URL:"",NEXT_TELEMETRY_DISABLED:"1"},
  stdio:"ignore"});
 await ready();
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 await suite({width:1440,height:900},true);
 await suite({width:768,height:1024},false);
 await suite({width:390,height:844},true);
 await suite({width:320,height:740},false);
 console.log("TTO_NAV03_CHROMIUM_VISUAL_VIEWPORTS=4/4");
 console.log("TTO_NAV03_CHROMIUM_VISUAL_CHECKS="+CHECKS.length);
 console.log("TTO_NAV03_CHROMIUM_VISUAL_REPORT="+JSON.stringify({
  sourceSha:EXPECTED_SHA,syntheticOnly:true,realTrade:false,viewports:observed,
  checks:CHECKS.length,shotHashesOnlyNoUploadedImages:true
 }));
 console.log("TTO_NAV03_CHROMIUM_VISUAL_PASS_SHA="+EXPECTED_SHA);
}
run().catch(e=>{console.error("NAV03_VISUAL_FAIL="+String(e?.stack??e));process.exitCode=1;})
.finally(async()=>{
 if(browser)await browser.close().catch(()=>{});
 if(server&&server.exitCode===null)server.kill("SIGTERM");
});
