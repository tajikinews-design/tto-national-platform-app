"use strict";
/* NAV04 synthetic-only governance interaction audit on exact SHA local browser.
 * No real cooperative records, voting, candidacy, documents, or backend calls.
 */
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const BASE="http://127.0.0.1:32155",OUT=process.env.TTO_REVIEW_OUTPUT_DIR||"/results";
const SHA=process.env.TTO_REVIEW_EXPECTED_SOURCE_SHA||"";
const snapshots=[
 ["ASSEMBLY","DEMO-ASM-INVITE-01"],["ASSEMBLY","DEMO-ASM-MINUTES-02"],
 ["ASSEMBLY","DEMO-ASM-POSTPONED-03"],["ELECTION","DEMO-ELEC-BOARD-01"],
 ["ELECTION","DEMO-ELEC-INSPECTOR-02"]
];
const sizes=[{name:"desktop",width:1440,height:900},{name:"mobile",width:390,height:844}];
const captures=[],checks=[],issues=[];
function check(ok,name){if(!ok)throw Error(name);checks.push(name)}
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});let browser;
 try{
  check(/^[a-f0-9]{40}$/.test(SHA),"exact commit required");
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  for(const size of sizes){
   const ctx=await browser.newContext({viewport:{width:size.width,height:size.height},
    locale:"fa-IR",reducedMotion:"reduce",serviceWorkers:"block"});
   const page=await ctx.newPage(),forbidden=[],errors=[];
   page.on("pageerror",err=>errors.push(err.message));
   await ctx.route("**/*",async entry=>{
    const request=entry.request(),u=new URL(request.url());
    if(u.origin!==BASE||!["GET","HEAD"].includes(request.method())||u.pathname.startsWith("/api/")){
     forbidden.push(request.method()+" "+request.url());await entry.abort();
    }else await entry.continue();
   });
   try{
    const res=await page.goto(BASE+"/review/interactive/nav-04",{waitUntil:"networkidle",timeout:60000});
    check(res?.status()===200,size.name+" NAV04 HTTP200");
    check(await page.locator(".w1a-empty").isVisible(),size.name+" default BLOCKED");
    check(await page.locator(".w1a-items").count()===0,size.name+" no records on first render");
    check((await page.locator(".w1a-source-status").innerText()).includes("هیچ رکورد یا نتیجه واقعی نمایش داده نمی‌شود"),size.name+" no actual results");
    check(await page.getByRole("button",{name:"منبع مسدود",exact:true}).getAttribute("aria-pressed")==="true",size.name+" aria default blocked");
    await page.getByRole("button",{name:"نمایش نمونه‌های کاملاً ساختگی",exact:true}).click();
    check(await page.locator(".w1a-item").count()===3,size.name+" three fake assemblies");
    check((await page.locator(".w1a-source-status").innerText()).includes("تمام رکوردها DEMO"),size.name+" DEMO banner");
    for(const [kind,id] of snapshots){
     if(kind==="ELECTION"&&await page.locator(".w1a-item").count()===3)
      await page.locator(".w1a-tab").filter({hasText:"انتخابات تعاونی"}).click();
     const option=page.locator(".w1a-item").filter({has:page.locator("small",{hasText:id})});
     check(await option.count()===1,size.name+" selected target exists "+id);
     await option.click();
     check(await option.getAttribute("aria-pressed")==="true",size.name+" selected aria "+id);
     check((await page.locator(".w1a-pairs").first().innerText()).includes(id),size.name+" provenance "+id);
     check(await page.locator(".w1a-doc button").count()>=1,size.name+" documents listed "+id);
     check(await page.locator(".w1a-doc button:not([disabled])").count()===0,size.name+" no usable document link "+id);
     check((await page.locator(".w1a-auth").innerText()).includes("حق رأی"),size.name+" voting eligibility unknown "+id);
     const fn=size.name+"-"+id.toLowerCase()+".png";
     await page.screenshot({path:path.join(OUT,fn),fullPage:true,animations:"disabled"});
     captures.push(fn);
    }
    // Keyboard activation on the election tab and a dossier entry.
    const electionTab=page.locator(".w1a-tab").filter({hasText:"مجامع عمومی"});
    await electionTab.focus();await page.keyboard.press("Enter");
    check(await electionTab.getAttribute("aria-pressed")==="true",size.name+" keyboard switches to assemblies");
    const row=page.locator(".w1a-item").first();
    await row.focus();await page.keyboard.press("Enter");
    check(await row.getAttribute("aria-pressed")==="true",size.name+" keyboard opens assembly record");
    await page.getByRole("button",{name:"منبع مسدود",exact:true}).click();
    check(await page.locator(".w1a-empty").isVisible(),size.name+" blocked mode hides demo records");
    check(await page.locator(".w1a-items").count()===0,size.name+" no old records remain");
    const w=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,
     visible:document.documentElement.clientWidth}));
    check(w.scroll<=w.visible+2,size.name+" no horizontal overflow");
    check(forbidden.length===0,size.name+" no external/private/API/mutation request "+forbidden.join(","));
    check(errors.length===0,size.name+" no hydration errors "+errors.join(","));
   }catch(e){issues.push({screen:size.name,detail:String(e?.stack||e)})}
   finally{await ctx.close()}
  }
 }catch(e){issues.push({screen:"suite",detail:String(e?.stack||e)})}
 finally{if(browser)await browser.close()}
 const report={schema:"tto-nav04-synthetic-browser-v1",
  expectedSha:SHA,viewports:sizes.map(v=>v.name),checks:checks.length,
  expectedScreenshots:10,screenshots:captures,issues,
  pass:issues.length===0&&captures.length===10};
 fs.writeFileSync(path.join(OUT,"nav04-browser-report.json"),JSON.stringify(report,null,2)+"\n");
 fs.writeFileSync(path.join(OUT,"nav04-browser-report.md"),[
  "# NAV04 read-only governance browser preview", "Exact SHA: "+SHA,
  "Visual captures: "+captures.length+"/10", "Checks: "+checks.length,
  "Failures: "+issues.length,...issues.map(x=>"- "+x.screen+": "+x.detail),
  "No legal results, real votes, voting rights or genuine documents."
 ].join("\n")+"\n");
 console.log("TTO_NAV04_BROWSER_CHECKS="+checks.length);
 console.log("TTO_NAV04_BROWSER_SCREENSHOTS="+captures.length+"/10");
 console.log("TTO_NAV04_BROWSER_ISSUES="+issues.length);
 if(report.pass)console.log("TTO_NAV04_BROWSER_VISUAL_INTERACTIVE_PASS_SHA="+SHA);
 else process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
