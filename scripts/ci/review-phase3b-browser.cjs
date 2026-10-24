"use strict";
/*
 * Local-only review preview browser gate.
 * Execute in an isolated Playwright container with NODE_PATH pointing to
 * Playwright, TTO_REVIEW_BASE_URL=http://127.0.0.1:32150, and
 * TTO_REVIEW_OUTPUT_DIR=/results. No privileged session or real API required.
 */
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const BASE=process.env.TTO_REVIEW_BASE_URL||"http://127.0.0.1:32150";
const OUT=process.env.TTO_REVIEW_OUTPUT_DIR||"/results";
const screens=["/review",...Array.from({length:10},(_,i)=>"/review/nav-"+String(i+2).padStart(2,"0"))];
const sizes=[{name:"desktop",width:1440,height:900},{name:"mobile",width:390,height:844}];
const tabs=[["overview",".rv-detail-body"],["journey",".rv-journey"],["access",".rv-access"]];
const expectedSource=process.env.TTO_REVIEW_EXPECTED_SOURCE_SHA||"";
const failures=[],checks=[],captures=[];

function check(ok,label){
 if(!ok)throw Error(label);
 checks.push(label);
}
function luminance(color){
 const match=color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
 if(!match)throw Error("NOT_RGB "+color);
 const values=match.slice(1,4).map(x=>{
  const t=Number(x)/255;return t<=0.04045?t/12.92:((t+0.055)/1.055)**2.4;
 });
 return .2126*values[0]+.7152*values[1]+.0722*values[2];
}
function contrast(foreground,background){
 const l1=luminance(foreground),l2=luminance(background);
 return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
}
async function sampleContrast(page,selector){
 return page.locator(selector).first().evaluate(el=>{
  const style=getComputedStyle(el);
  let ancestor=el;
  let background="rgb(255, 255, 255)";
  while(ancestor){
   const c=getComputedStyle(ancestor).backgroundColor;
   if(c&&c!=="transparent"&&!c.endsWith(", 0)")){background=c;break}
   ancestor=ancestor.parentElement;
  }
  return {foreground:style.color,background,size:parseFloat(style.fontSize)};
 });
}
async function activeVisible(page){
 return page.evaluate(()=>{
  const nav=document.querySelector(".rv-navigation");
  const current=nav?.querySelector('[aria-current="page"]');
  if(!nav||!current)return false;
  const box=nav.getBoundingClientRect();
  const target=current.getBoundingClientRect();
  return target.left>=box.left-2&&target.right<=box.right+2;
 });
}
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  for(const viewport of sizes)for(let idx=0;idx<screens.length;idx++){
   const route=screens[idx];
   const slug=idx===0?"nav-01":"nav-"+String(idx+1).padStart(2,"0");
   const context=await browser.newContext({
    viewport:{width:viewport.width,height:viewport.height},
    locale:"fa-IR",
    reducedMotion:"reduce"
   });
   const page=await context.newPage();
   const forbidden=[],jsErrors=[];
   page.on("pageerror",e=>jsErrors.push(e.message));
   try{
    await context.route("**/*",async intercepted=>{
     const req=intercepted.request(),u=new URL(req.url());
     if(u.origin!==BASE||!["GET","HEAD"].includes(req.method())||u.pathname.startsWith("/api/")){
      forbidden.push(req.method()+" "+req.url());await intercepted.abort();
     }else await intercepted.continue();
    });
    const response=await page.goto(BASE+route,{waitUntil:"networkidle",timeout:60000});
    check(response?.status()===200,viewport.name+" "+route+" HTTP200");
    check(await page.locator("html").getAttribute("lang")==="fa",viewport.name+" "+route+" fa");
    check(await page.locator("html").getAttribute("dir")==="rtl",viewport.name+" "+route+" RTL");
    const links=page.locator(".rv-navigation .rv-nav-link");
    check(await links.count()===11,viewport.name+" "+route+" 11 navigation links");
    const current=page.locator('.rv-navigation [aria-current="page"]');
    check(await current.count()===1,viewport.name+" "+route+" current link");
    check(await current.getAttribute("href")===route,viewport.name+" "+route+" correct current path");
    if(viewport.name==="mobile"){
     await page.waitForFunction(()=> {
      const nav=document.querySelector(".rv-navigation");
      const el=nav?.querySelector('[aria-current="page"]');
      if(!nav||!el)return false;
      const n=nav.getBoundingClientRect(),r=el.getBoundingClientRect();
      return r.left>=n.left-2&&r.right<=n.right+2;
     },null,{timeout:10000});
     check(await activeVisible(page),viewport.name+" "+route+" active menu in viewport");
     check(await page.locator(".rv-nav-hint").isVisible(),viewport.name+" "+route+" swipe hint visible");
    }else{
     check(!await page.locator(".rv-nav-hint").isVisible(),viewport.name+" "+route+" swipe hint hidden");
    }
    const overflow=await page.evaluate(()=>({
     total:document.documentElement.scrollWidth,
     available:document.documentElement.clientWidth
    }));
    check(overflow.total<=overflow.available+2,viewport.name+" "+route+" no page-wide horizontal overflow");
    const body=await page.locator("body").innerText();
    check(body.includes("نسخه بازبینی")&&body.includes("بدون اطلاعات یا عملیات واقعی"),
     viewport.name+" "+route+" preview-only disclosure");
    check(await page.locator(".rv-app form,.rv-app input,.rv-app textarea,.rv-app select").count()===0,
     viewport.name+" "+route+" no data entry");
    const contrastTargets=[".rv-section-head p",".rv-top-label",".rv-section-kicker",".rv-section-count"];
    if(idx===0)contrastTargets.push(".rv-module-card p",".rv-module-footer");
    else contrastTargets.push(".rv-tab:not(.rv-tab-active)");
    for(const selector of contrastTargets){
     const example=await sampleContrast(page,selector);
     const value=contrast(example.foreground,example.background);
     check(value>=4.5,viewport.name+" "+route+" contrast "+selector+"="+value.toFixed(2));
    }
    if(idx===0){
     check(await page.locator(".rv-module-card").count()===10,viewport.name+" dashboard module cards");
     const target=path.join(OUT,viewport.name+"-"+slug+"-dashboard.png");
     await page.screenshot({path:target,fullPage:true,animations:"disabled"});
     captures.push(path.basename(target));
    }else{
     const buttons=page.getByRole("tab");
     check(await buttons.count()===3,viewport.name+" "+route+" 3 tabs");
     for(let t=0;t<tabs.length;t++){
      await buttons.nth(t).click();
      check(await buttons.nth(t).getAttribute("aria-selected")==="true",
       viewport.name+" "+route+" tab "+tabs[t][0]+" selected");
      check(await page.locator(tabs[t][1]).isVisible(),
       viewport.name+" "+route+" tab "+tabs[t][0]+" panel visible");
      const target=path.join(OUT,viewport.name+"-"+slug+"-"+tabs[t][0]+".png");
      await page.screenshot({path:target,fullPage:true,animations:"disabled"});
      captures.push(path.basename(target));
     }
    }
    check(forbidden.length===0,viewport.name+" "+route+" no external/private/mutation requests: "+forbidden.join(","));
    check(jsErrors.length===0,viewport.name+" "+route+" no page errors: "+jsErrors.join(","));
    console.log("PASS "+viewport.name+" "+route+" images="+(idx===0?1:3));
   }catch(e){
    failures.push({screen:viewport.name+" "+route,detail:String(e?.stack||e)});
    console.error("FAIL "+viewport.name+" "+route+" "+e?.message);
   }finally{
    await context.close();
   }
  }
  const request=await browser.newContext();
  const invalid=await request.request.get(BASE+"/review/not-a-nav");
  check(invalid.status()===404,"invalid slug 404");
  await request.close();
 }catch(e){
  failures.push({screen:"suite",detail:String(e?.stack||e)});
 }finally{if(browser)await browser.close()}
 const expected=2*(1+10*3);
 if(captures.length!==expected)failures.push({screen:"screenshots",detail:"expected "+expected+" got "+captures.length});
 const report={
  schema:"tto-phase3b-review-v1",
  reviewedSourceSha:expectedSource||"SPECIFY_SOURCE_SHA",
  url:BASE,
  checksPassed:checks.length,
  viewportScreens:22,
  screenshotsExpected:expected,
  screenshotsCaptured:captures.length,
  screenshots:captures,
  failures,
  pass:failures.length===0
 };
 fs.writeFileSync(path.join(OUT,"phase3b-report.json"),JSON.stringify(report,null,2)+"\n");
 fs.writeFileSync(path.join(OUT,"phase3b-report.md"),[
  "# Phase 3b local browser visual acceptance",
  "Source: "+report.reviewedSourceSha,
  "Screenshots: "+captures.length+"/"+expected,
  "Checks: "+checks.length,
  "Failures: "+failures.length,
  "Scope: review UI only; no operational auth, live BFF, share trading or hosted CI.",
  ...failures.map(f=>"- "+f.screen+": "+f.detail)
 ].join("\n")+"\n");
 console.log("TTO_PHASE3B_BROWSER_SCREENSHOTS="+captures.length);
 console.log("TTO_PHASE3B_BROWSER_CHECKS="+checks.length);
 console.log("TTO_PHASE3B_BROWSER_FAILURES="+failures.length);
 if(!failures.length)console.log("TTO_PHASE3B_LOCAL_BROWSER_PASS_SHA="+report.reviewedSourceSha);
 else process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
