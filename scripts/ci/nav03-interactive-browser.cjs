"use strict";
/* Local-only Chromium audit of already-implemented NAV03 synthetic review.
 * Hosted preview or production must NOT be used.
 * TTO_REVIEW_BASE_URL must be 127.0.0.1:32155 inside isolated docker namespace.
 */
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const BASE="http://127.0.0.1:32155";
const OUT=process.env.TTO_REVIEW_OUTPUT_DIR||"/results";
const SHA=process.env.TTO_REVIEW_EXPECTED_SOURCE_SHA||"";
const route="/review/interactive/nav-03/case-demo";
const cases=[
 ["DEMO-SELL-QUEUED","فروشنده در صف عرضه",4],
 ["DEMO-SELL-LISTED","عرضه نمایشی روی تابلو",7],
 ["DEMO-SELL-CANCELLED","انصراف قبل از وجود خریدار",5],
 ["DEMO-BUY-BOARD","خرید در انتظار مصوبه هیئت‌مدیره",4],
 ["DEMO-BUY-PAID-REPORTED","خریدار پرداخت را اعلام کرده؛ وصول تأیید نشده",9],
 ["DEMO-BUY-DISPUTED","اختلاف مبلغ پرداخت",10],
 ["DEMO-BUY-CANCEL-REQUEST","درخواست لغو بعد از رزرو",3],
 ["DEMO-BUY-REGISTERED","ثبت دفتر سهام، پیش از نهایی‌شدن",18],
 ["DEMO-BUY-COMPLETED","نمونه تکمیل معامله (فقط آموزشی)",21]
];
const screens=[{id:"desktop",width:1440,height:900},{id:"mobile",width:390,height:844}];
const results=[],images=[],issues=[];
function assert(test,text){if(!test)throw Error(text);results.push(text);}
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 let browser;
 try{
  assert(/^[a-f0-9]{40}$/.test(SHA),"pinned exact source SHA required");
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  for(const view of screens){
   const ctx=await browser.newContext({viewport:{width:view.width,height:view.height},
    locale:"fa-IR",reducedMotion:"reduce",serviceWorkers:"block"});
   const page=await ctx.newPage(),unexpected=[],errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   await ctx.route("**/*",async request=>{
    const r=request.request(),u=new URL(r.url());
    if(u.origin!==BASE||!["GET","HEAD"].includes(r.method())||u.pathname.startsWith("/api/")){
     unexpected.push(r.method()+" "+r.url());await request.abort();
    }else await request.continue();
   });
   try{
    const response=await page.goto(BASE+route,{waitUntil:"networkidle",timeout:60000});
    assert(response?.status()===200,view.id+" HTTP 200");
    assert(await page.locator(".w1t-case").count()===9,view.id+" nine synthetic dossier cards");
    assert(await page.locator(".w1t-summary h2").innerText()===cases[0][1],view.id+" first selected");
    assert((await page.locator(".w1t-global-guard").innerText()).includes("هیچ پرونده واقعی خوانده یا ذخیره نمی‌شود"),view.id+" privacy disclosure");
    assert((await page.locator(".w1t-global-guard").innerText()).includes("DEMO"),view.id+" DEMO disclosure");
    assert(await page.locator(".w1t-disabled-actions button").isDisabled(),view.id+" all actions disabled");
    assert(await page.getByRole("button",{name:"همه",exact:true}).getAttribute("aria-pressed")==="true",view.id+" default all filter");
    for(const [id,title,events] of cases){
     const card=page.locator(".w1t-case").filter({has:page.locator("small", {hasText:id})});
     assert(await card.count()===1,view.id+" available "+id);
     await card.click();
     assert((await page.locator(".w1t-summary h2").innerText())===title,view.id+" selected "+id);
     assert(await card.getAttribute("aria-pressed")==="true",view.id+" ARIA selected "+id);
     assert(await page.locator(".w1t-timeline .w1t-event").count()===events,view.id+" timeline "+id);
     assert((await page.locator(".w1t-legal-effect").innerText()).includes("هیچ مالکیتی ایجاد نمی‌کند"),view.id+" ownership boundary "+id);
     assert(await page.locator(".w1t-disabled-actions button").isDisabled(),view.id+" disabled actions "+id);
     if(id==="DEMO-BUY-PAID-REPORTED"){
      assert((await page.locator(".w1t-detail-section").filter({hasText:"پرداخت و تأیید وصول"}).innerText()).includes("فقط اعلام پرداخت"),view.id+" payment reported not receipt");
     }
     if(id==="DEMO-BUY-DISPUTED"){
      assert((await page.locator(".w1t-cancel").innerText()).includes("Finalization باید متوقف بماند"),view.id+" payment dispute blocks finalization");
     }
     if(id==="DEMO-BUY-REGISTERED"){
      assert((await page.locator(".w1t-legal-effect").innerText()).includes("Finalization هنوز کامل نیست"),view.id+" register entry not ownership");
     }
     if(id==="DEMO-BUY-COMPLETED"){
      assert((await page.locator(".w1t-legal-effect").innerText()).includes("هیچ مالکیت واقعی جابه‌جا نشده"),view.id+" completed mock not actual ownership");
     }
     const png=view.id+"-"+id.toLowerCase()+".png";
     await page.screenshot({path:path.join(OUT,png),fullPage:true,animations:"disabled"});
     images.push(png);
    }
    // Keyboard-only pathway: Tab focus, Enter selection, and expanded audit evidence.
    const first=page.locator(".w1t-case").first();
    await first.focus();
    assert(await first.evaluate(el=>el===document.activeElement),view.id+" keyboard focus placed");
    await page.keyboard.press("Enter");
    assert(await first.getAttribute("aria-pressed")==="true",view.id+" enter activates case card");
    const details=page.locator(".w1t-event details").first();
    await details.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert(await details.getAttribute("open")!==null,view.id+" keyboard expands audit");
    await details.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert(await details.getAttribute("open")===null,view.id+" keyboard closes audit");
    const sell=page.getByRole("button",{name:"فروش",exact:true});
    await sell.click();
    assert(await page.locator(".w1t-case").count()===3,view.id+" sale filter 3");
    const buy=page.getByRole("button",{name:"خرید",exact:true});
    await buy.click();
    assert(await page.locator(".w1t-case").count()===6,view.id+" buy filter 6");
    await page.getByRole("button",{name:"همه",exact:true}).click();
    assert(await page.locator(".w1t-case").count()===9,view.id+" reset all cases");
    const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,
      client:document.documentElement.clientWidth}));
    assert(width.scroll<=width.client+2,view.id+" no horizontal page overflow");
    assert(unexpected.length===0,view.id+" no external/API/mutation requests "+unexpected.join(","));
    assert(errors.length===0,view.id+" no hydration/browser JS exceptions "+errors.join(","));
   }catch(e){issues.push({view:view.id,message:String(e?.stack||e)});}
   finally{await ctx.close();}
  }
 }catch(e){issues.push({view:"suite",message:String(e?.stack||e)});}
 finally{if(browser)await browser.close();}
 const report={schema:"tto-nav03-interactive-browser-v1",
  expectedSha:SHA,baseUrl:BASE,viewports:screens.map(v=>v.id),
  casesExpected:cases.length,caseScreenshotsExpected:cases.length*screens.length,
  screenshots:images,checksPassed:results.length,checks:results,issues,pass:issues.length===0&&images.length===18};
 fs.writeFileSync(path.join(OUT,"nav03-browser-report.json"),JSON.stringify(report,null,2)+"\n");
 fs.writeFileSync(path.join(OUT,"nav03-browser-report.md"),[
  "# NAV03 interactive actual-browser audit", "Exact source SHA: "+SHA,
  "Views: desktop 1440×900, mobile 390×844",
  "Capture images: "+images.length+"/18", "Checks: "+results.length,
  "Issues: "+issues.length,...issues.map(i=>"- "+i.view+": "+i.message),
  "No production/private API or real shareholder data accessed."
 ].join("\n")+"\n");
 console.log("TTO_NAV03_BROWSER_CHECKS="+results.length);
 console.log("TTO_NAV03_BROWSER_SCREENSHOTS="+images.length+"/18");
 console.log("TTO_NAV03_BROWSER_ISSUES="+issues.length);
 if(report.pass)console.log("TTO_NAV03_BROWSER_VISUAL_INTERACTIVE_PASS_SHA="+SHA);
 else process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
