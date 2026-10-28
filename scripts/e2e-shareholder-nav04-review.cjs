"use strict";
/** NAV04 executable Chromium test in disposable private local Docker browser.
 * No network interception or fake response; all dataset is static and labeled.
 */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {resolve,join}=require("node:path");
const {mkdirSync}=require("node:fs");
const {createHash}=require("node:crypto");
const {chromium}=require("playwright");
const ROOT=resolve(__dirname,".."),PORT=32974,BASE="http://127.0.0.1:"+PORT;
const URL="/review/interactive/nav-04";
const SHA=process.env.TTO_PHASE4C_EXPECTED_SOURCE_SHA;
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||
 !/^[a-f0-9]{40}$/.test(SHA??"")||process.env.VERCEL||process.env.APIIR_TOKEN)
 throw Error("NAV04_VISUAL_PRIVATE_LOOPBACK_ONLY");
let server,browser;
const checks=[],viewports=[];
function ok(value,label){assert.ok(value,label);checks.push(label);}
async function waitReady(){
 for(let t=0;t<110;t++){
  if(server.exitCode!==null)throw Error("NAV04_NEXT_DIED");
  try{let r=await fetch(BASE+URL,{signal:AbortSignal.timeout(1500)});if(r.status===200)return;}catch{}
  await new Promise(r=>setTimeout(r,230));
 }
 throw Error("NAV04_NEXT_NOT_READY");
}
async function verify(width,height,interact){
 const ctx=await browser.newContext({viewport:{width,height},locale:"fa-IR",reducedMotion:"reduce"});
 const page=await ctx.newPage(),errors=[],external=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith(BASE))external.push(r.url());});
 try{
  let response=await page.goto(BASE+URL,{waitUntil:"networkidle",timeout:30000});
  ok(response.status()===200,"SSR_HTTP200_"+width);
  ok(await page.locator("main.w1a-shell[dir=rtl]").count()===1,"RTL_"+width);
  ok(await page.locator(".w1a-list .w1a-record").count()===0,"DEFAULT_SOURCE_BLOCKED_"+width);
  ok(await page.locator(".w1a-empty").count()===1,"NO_MOCK_BEFORE_OPTIN_"+width);
  ok(await page.locator(".w1a-approved-overview").count()===0,"NO_APPROVED_FIXTURE_OVERVIEW_BEFORE_OPTIN_"+width);
  ok(await page.getByRole("button",{name:"ثبت رأی (غیرفعال)"}).count()===0,
    "NO_VOTE_WHEN_BLOCKED_"+width);
  // Source controls are reviewer-only: expand explicitly before opt-in.
  const reviewerDetails=page.locator("#w1a-review-detail-panels");
  const reviewerToggle=page.locator("button.w1a-review-tools-toggle");
  ok(await reviewerDetails.isHidden(),"REVIEW_DIAGNOSTICS_HIDDEN_BY_DEFAULT_"+width);
  ok(await reviewerToggle.getAttribute("aria-expanded")==="false","REVIEW_DIAGNOSTICS_COLLAPSED_"+width);
  await reviewerToggle.click();
  ok(await reviewerDetails.isVisible(),"REVIEW_SOURCE_MODE_ACCESSIBLE_"+width);
  const mock=page.getByRole("button",{name:"نمونه کاملاً ساختگی",exact:true});
  await mock.click();
  ok(await mock.getAttribute("aria-pressed")==="true","DEMO_SWITCH_"+width);
  await reviewerToggle.click();
  ok(await reviewerDetails.isHidden(),"REVIEW_SOURCE_MODE_REHIDDEN_AFTER_OPTIN_"+width);
  ok(await page.locator(".w1a-mode-section").isHidden(),"NO_SOURCE_MODE_BAR_IN_APPROVED_OVERVIEW_"+width);
  ok(await page.locator(".w1a-record").count()===6,"SIX_FIXTURES_"+width);
  // The user-approved visual structure must render only after opting into DEMO.
  ok(await page.locator(".w1a-approved-overview").count()===1,"APPROVED_OVERVIEW_VISIBLE_"+width);
  ok(await page.locator(".w1a-next-meeting").count()===1,"APPROVED_NEXT_MEETING_"+width);
  ok(await page.locator(".w1a-kpi").count()===4,"APPROVED_FOUR_STATUS_CARDS_"+width);
  ok(await page.locator(".w1a-summary-panel").count()===4,"APPROVED_FOUR_INFORMATION_PANELS_"+width);
  ok(await page.locator(".w1a-action").count()===4,"APPROVED_FOUR_ACTION_TILES_"+width);
  ok(await page.locator(".w1a-sidebar .w1a-side-link").count()===11,"CANONICAL_ELEVEN_NAV_ROOTS_"+width);
  ok(await page.locator(".w1a-global-header").count()===1,"SHARED_HEADER_PRESENT_"+width);
  ok(await page.locator(".w1a-panel-line").count()>=12,"APPROVED_DENSE_INFORMATION_ROWS_"+width);
  ok(await page.locator(".w1a-cooperative-switch").count()===1,"APPROVED_COOPERATIVE_SELECTOR_"+width);
  ok(await page.locator(".w1a-attendance-state").count()===1,"LEGAL_SAFE_ATTENDANCE_STATUS_"+width);
  const photo=await page.locator(".w1a-meeting-tile img").evaluate((img)=>({
    complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight
  }));
  ok(photo.complete&&photo.naturalWidth>=300&&photo.naturalHeight>=220,"APPROVED_MEETING_PHOTO_LOADED_"+width);
  ok(await page.locator(".w1a-meeting-buttons button").isDisabled(),"UNVERIFIED_ATTENDANCE_CANNOT_SUBMIT_"+width);
  ok(await reviewerDetails.isHidden(),"REVIEW_DIAGNOSTICS_STAY_HIDDEN_IN_OVERVIEW_"+width);
  const screen=await page.evaluate(()=>{
    const sidebar=document.querySelector(".w1a-sidebar");
    const kpi=document.querySelector(".w1a-kpi");
    const panel=document.querySelector(".w1a-summary-panel");
    const box=sidebar?.getBoundingClientRect();
    return {sidebarRect:box&&{x:box.x,width:box.width},
      kpi: kpi&&getComputedStyle(kpi).backgroundColor,
      panel:panel&&getComputedStyle(panel).backgroundColor,
      bodyDirection:getComputedStyle(document.body).direction};
  });
  ok(screen.sidebarRect?.width>0,"SIDEBAR_DIMENSIONS_"+width);
  ok(screen.bodyDirection==="rtl","GLOBAL_RTL_DIRECTION_"+width);
  const layout=await page.evaluate(()=>{
    const rect=(selector)=>{
      const el=document.querySelector(selector);
      if(!el)return null;
      const b=el.getBoundingClientRect();
      return {left:b.left,right:b.right,top:b.top,width:b.width};
    };
    return {sidebar:rect(".w1a-sidebar"),content:rect(".w1a-frame"),
      image:rect(".w1a-meeting-tile"),information:rect(".w1a-meeting-info"),
      counter:rect(".w1a-countdown"),
      results:rect(".w1a-action-purple"),assemblies:rect(".w1a-action-blue")};
  });
  if(width>=981){
    ok(layout.sidebar.left>layout.content.left,"APPROVED_RIGHT_RAIL_"+width);
    ok(layout.image.left<layout.information.left &&
       layout.information.left<layout.counter.left,"APPROVED_MEETING_LTR_GEOMETRY_"+width);
    ok(layout.results.left>layout.assemblies.left,"APPROVED_ACTION_ORDER_"+width);
  }else if(width<=680){
    ok(layout.image.top<layout.information.top,"APPROVED_MOBILE_IMAGE_ABOVE_DETAILS_"+width);
  }else{
    ok(layout.image.left<layout.information.left,"APPROVED_TABLET_MEETING_LAYOUT_"+width);
  }
  const buttons=page.locator(".w1a-vote button");
  ok(await buttons.count()===3,"THREE_ACTIONS_PRESENT_"+width);
  for(let i=0;i<3;i++)ok(await buttons.nth(i).isDisabled(),"VOTING_PUBLISHING_DISABLED_"+width+"_"+i);
  const download=page.locator(".w1a-doc button").first();
  ok(await download.isDisabled(),"DOCUMENT_DOWNLOAD_DISABLED_"+width);
  const geom=await page.evaluate(()=>({
   scrollWidth:document.documentElement.scrollWidth,
   clientWidth:document.documentElement.clientWidth,
   innerWidth:innerWidth
  }));
  ok(geom.scrollWidth<=width+2,"NO_HORIZONTAL_OVERFLOW_"+width);
  const navToggle=page.locator(".w1a-mobile-menu-toggle");
  if(width<=980){
    ok(await navToggle.isVisible(),"MOBILE_MENU_VISIBLE_"+width);
    ok(await navToggle.getAttribute("aria-expanded")==="false","MOBILE_MENU_INIT_CLOSED_"+width);
    await navToggle.click();
    ok(await navToggle.getAttribute("aria-expanded")==="true","MOBILE_MENU_OPEN_"+width);
    ok(await page.locator("#w1a-side-nav").isVisible(),"MOBILE_CANONICAL_LINKS_VISIBLE_"+width);
    await navToggle.focus();
    await page.keyboard.press("Escape");
    ok(await navToggle.getAttribute("aria-expanded")==="false","MOBILE_MENU_ESCAPE_CLOSED_"+width);
    ok(await page.locator("#w1a-side-nav").isHidden(),"MOBILE_NAV_HIDDEN_AFTER_ESCAPE_"+width);
  }else{
    ok(await navToggle.isHidden(),"DESKTOP_MENU_TOGGLE_HIDDEN_"+width);
  }
  const screenshot=await page.screenshot({type:"png",animations:"disabled",path:join("/workspace/.qa-artifacts",SHA,"nav04-"+width+".png"),fullPage:width===1536});
  ok(screenshot.byteLength>6000,"RENDERED_PIXELS_"+width);
  if(width===1536){
    const screenshotRect=await page.evaluate(()=>({
      diagnosticsCollapsed:document.querySelector("#w1a-review-detail-panels")?.hidden===true,
      sourceModeNotVisible:document.querySelector(".w1a-mode-section")?.getClientRects().length===0,
      publicDetailHidden:document.querySelector("#w1a-public-details")?.hidden===true,
      visibleHeight:document.querySelector("main.w1a-shell")?.getBoundingClientRect().height??0
    }));
    ok(screenshotRect.diagnosticsCollapsed,"APPROVED_SCREENSHOT_NO_DEBUG_PANELS");
    ok(screenshotRect.sourceModeNotVisible,"APPROVED_SCREENSHOT_NO_SOURCE_MODE_BAR");
    ok(screenshotRect.publicDetailHidden,"APPROVED_SCREENSHOT_DETAILS_COLLAPSED");
    ok(screenshotRect.visibleHeight<1600,"APPROVED_OVERVIEW_COMPACT_HEIGHT");
  }
  viewports.push({width,height,scrollWidth:geom.scrollWidth,pngSha256:createHash("sha256").update(screenshot).digest("hex")});
  if(interact){
   const publicDetails=page.locator("#w1a-public-details");
   ok(await publicDetails.isHidden(),"PUBLIC_DETAILS_COLLAPSED_BY_DEFAULT_"+width);
   const heroDetails=page.getByRole("button",{name:/مشاهده جزئیات نمونه/});
   await heroDetails.click();
   ok(await publicDetails.isVisible(),"HERO_DETAILS_REACH_VISIBLE_CONTENT_"+width);
   await page.waitForFunction(()=>document.activeElement?.id==="w1a-public-details");
   ok(await publicDetails.evaluate(el=>el===document.activeElement),"HERO_DETAILS_FOCUSED_"+width);
   ok(await publicDetails.getByText("جزئیات مجامع نمونه").isVisible(),"HERO_DETAILS_CORRECT_CONTENT_"+width);
   await page.getByRole("button",{name:/بستن جزئیات/}).click();
   ok(await publicDetails.isHidden(),"HERO_DETAILS_CLOSE_"+width);
   await page.locator("button.w1a-action-purple").click();
   ok(await publicDetails.getByText("نتایج و مصوبات نمونه").isVisible(),"RESULTS_ACTION_OPENS_READONLY_DETAILS_"+width);
   await page.getByRole("button",{name:/بستن جزئیات/}).click();
   const assembliesQuick=page.locator("button.w1a-action-blue");
   await assembliesQuick.focus();
   await page.keyboard.press("Enter");
   ok(await publicDetails.getByText("جزئیات مجامع نمونه").isVisible(),"KEYBOARD_ASSEMBLY_ACTION_REACHES_CONTENT_"+width);
   await page.getByRole("button",{name:/بستن جزئیات/}).click();
   ok(await publicDetails.isHidden(),"ALL_OVERVIEW_DETAILS_COLLAPSED_AFTER_CLOSE_"+width);
   await reviewerToggle.click();
   ok(await reviewerDetails.isVisible(),"REVIEW_DIAGNOSTICS_OPEN_ON_REQUEST_"+width);
   ok(await reviewerToggle.getAttribute("aria-expanded")==="true","REVIEW_DIAGNOSTICS_TOGGLE_ACCESSIBLE_"+width);
   const invitation=page.getByRole("button",{name:"دعوت‌نامه‌ها",exact:true});
   await invitation.click();
   ok(await page.locator(".w1a-record").count()===2,"TWO_INVITATIONS");
   const election=page.getByRole("button",{name:"اطلاعات انتخابات",exact:true});
   await election.focus();
   await page.keyboard.press("Enter");
   ok(await election.getAttribute("aria-pressed")==="true","KEYBOARD_FILTER");
   ok(await page.locator(".w1a-record").count()===1,"ONE_ELECTION");
   ok(await page.getByText("نامعلوم و تأییدنشده",{exact:false}).count()>=1,"NO_VOTE_RIGHT_ASSERTION");
   const minutes=page.getByRole("button",{name:"صورت‌جلسات",exact:true});
   await minutes.click();
   const second=page.locator(".w1a-record").nth(1);
   await second.focus();
   await page.keyboard.press("Enter");
   ok(await second.getAttribute("aria-pressed")==="true","KEYBOARD_SECOND_MINUTES");
   ok(await page.locator(".w1a-doc button").first().isDisabled(),"DOC_STILL_DISABLED");
   const unavailable=page.getByRole("button",{name:"مرجع اطلاعات در دسترس نیست",exact:true});
   await unavailable.click();
   ok(await page.locator(".w1a-record").count()===0,"SOURCE_LOSS_HIDES_ALL");
   ok(await page.locator(".w1a-empty").count()===1,"SOURCE_LOSS_FAIL_CLOSED");
  }
  ok(errors.length===0,"ZERO_BROWSER_PAGE_ERRORS_"+width);
  ok(external.length===0,"ZERO_EXTERNAL_NETWORK_REQUESTS_"+width);
 }finally{await ctx.close();}
}
async function run(){
 const cwd=resolve(ROOT,"apps/shareholder"),entry=resolve(cwd,"node_modules/next/dist/bin/next");
 server=spawn(process.execPath,[entry,"start","-p",String(PORT),"--hostname","127.0.0.1"],{
  cwd,env:{...process.env,PORT:String(PORT),TTO_API_BASE_URL:"",NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore"});
 await waitReady();
 mkdirSync(join("/workspace/.qa-artifacts",SHA),{recursive:true});
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 await verify(1440,900,true);
 await verify(1536,1024,false);
 await verify(768,1024,false);
 await verify(390,844,true);
 await verify(320,740,false);
 console.log("TTO_NAV04_CHROMIUM_INTERACTIVE_VIEWPORTS=5/5");
 console.log("TTO_NAV04_CHROMIUM_INTERACTIVE_CHECKS="+checks.length);
 console.log("TTO_NAV04_CHROMIUM_INTERACTIVE_REPORT="+JSON.stringify({
  SHA,fixtureOnly:true,realVoting:false,realPublication:false,viewports,pngHashesOnly:true
 }));
 console.log("TTO_NAV04_CHROMIUM_INTERACTIVE_PASS_SHA="+SHA);
}
run().catch(e=>{console.error("NAV04_CHROMIUM_FAILED="+String(e?.stack??e));process.exitCode=1;})
.finally(async()=>{
 if(browser)await browser.close().catch(()=>{});
 if(server&&server.exitCode===null)server.kill("SIGTERM");
});
