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
  // Opt into sample only: no public/legal/source record becomes valid.
  const mock=page.getByRole("button",{name:"نمونه کاملاً ساختگی",exact:true});
  await mock.click();
  ok(await mock.getAttribute("aria-pressed")==="true","DEMO_SWITCH_"+width);
  ok(await page.locator(".w1a-record").count()===6,"SIX_FIXTURES_"+width);
  // The user-approved visual structure must render only after opting into DEMO.
  ok(await page.locator(".w1a-approved-overview").count()===1,"APPROVED_OVERVIEW_VISIBLE_"+width);
  ok(await page.locator(".w1a-next-meeting").count()===1,"APPROVED_NEXT_MEETING_"+width);
  ok(await page.locator(".w1a-kpi").count()===4,"APPROVED_FOUR_STATUS_CARDS_"+width);
  ok(await page.locator(".w1a-summary-panel").count()===4,"APPROVED_FOUR_INFORMATION_PANELS_"+width);
  ok(await page.locator(".w1a-action").count()===4,"APPROVED_FOUR_ACTION_TILES_"+width);
  ok(await page.locator(".w1a-sidebar .w1a-side-link").count()===11,"CANONICAL_ELEVEN_NAV_ROOTS_"+width);
  ok(await page.locator(".w1a-global-header").count()===1,"SHARED_HEADER_PRESENT_"+width);
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
  const screenshot=await page.screenshot({type:"png",animations:"disabled",path:join("/workspace/.qa-artifacts",SHA,"nav04-"+width+".png")});
  ok(screenshot.byteLength>6000,"RENDERED_PIXELS_"+width);
  viewports.push({width,height,scrollWidth:geom.scrollWidth,pngSha256:createHash("sha256").update(screenshot).digest("hex")});
  if(interact){
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
 await verify(768,1024,false);
 await verify(390,844,true);
 await verify(320,740,false);
 console.log("TTO_NAV04_CHROMIUM_INTERACTIVE_VIEWPORTS=4/4");
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
