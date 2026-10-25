"use strict";
/**
 * TTO Phase4B CLIENT-only session privacy tests with synthetic intercepted BFF
 * responses. All 200 records below are fake browser fixtures; the real backend
 * is never called and this test grants NO authorization or source approval.
 */
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const BASE=process.env.TTO_PHASE4B_BASE_URL||"http://127.0.0.1:32165";
const OUT=process.env.TTO_PHASE4B_OUTPUT_DIR||"/results";
const SHA=process.env.TTO_PHASE4B_EXPECTED_SOURCE_SHA||"";
const TENANT="44444444-4444-4444-8444-444444444444";
const checkpoints=[],failures=[];
let requests=0,casesPassed=0,casesExecuted=0;
function ok(condition,label){
 if(!condition)throw Error(label);
 checkpoints.push(label);
}
const nap=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){
 for(let i=0;i<80;i++){
  if(await predicate())return;
  await nap(100);
 }
 throw Error("TIMEOUT "+label);
}
async function exercise(browser,name,fn){
 casesExecuted++;
 const context=await browser.newContext({
  viewport:{width:390,height:844},locale:"fa-IR",reducedMotion:"reduce"
 });
 const state={session:"valid",discovery:200,scope:200,member:200,holding:200,
  trade:403,notices:403,forbidden:[],log:[],responseStatuses:{}};
 await context.route("**/*",async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  if(url.origin!==BASE){state.forbidden.push(method+" "+url.origin);await route.abort();return;}
  if(!url.pathname.startsWith("/api/")){await route.continue();return;}
  requests++;state.log.push(method+" "+url.pathname);
  if(method!=="GET"){
   state.forbidden.push(method+" "+url.pathname);
   await route.fulfill({status:405,body:"{}"});
   return;
  }
  const json=(status,body)=>{
   if(!Number.isInteger(status)||status<200||status>599)
    throw Error("INVALID_SYNTHETIC_HTTP_STATUS "+String(status)+" "+url.pathname);
   state.responseStatuses[url.pathname]=status;
   return route.fulfill({
    status,contentType:"application/json",
    headers:{"Cache-Control":"private, no-store"},
    body:JSON.stringify(body)
   });
  };
  const p=url.pathname;
  if(p==="/api/auth/session"){
   if(state.session==="expired")return json(200,{authenticated:false});
   if(state.session==="unavailable")return json(503,{error:"SESSION_CHECK_UNAVAILABLE"});
   if(state.session==="malformed")return json(200,{authenticated:"yes"});
   return json(200,{authenticated:true});
  }
  if(p==="/api/me/tenant-options"){
   if(state.discovery!==200)return json(state.discovery,{items:[]});
   return json(200,{items:[{tenantId:TENANT,displayName:"تعاونی آزمایشی فقط در مرورگر",
    evidenceStatus:"MEMBERSHIP_EVIDENCE"}]});
  }
  if(p===`/api/tenants/${TENANT}/context`)
   return json(state.scope,state.scope===200?
     {tenantContextVerified:true,tenantId:TENANT}:{tenantContextVerified:false,code:"SESSION_REQUIRED"});
  if(p===`/api/tenants/${TENANT}/me/member-record`)
   return json(state.member,state.member===200?
    {available:true,record:{membershipStatus:"ACTIVE",partyKind:"PERSON",
     sourceVersion:2,sourceAsOf:"2026-10-01T00:00:00Z"}}:{available:false,code:"SESSION_REQUIRED"});
  if(p===`/api/tenants/${TENANT}/me/shareholding`)
   return json(state.holding,state.holding===200?
    {available:true,record:{shareQuantity:"271",ledgerVersion:3,ledgerAsOf:"2026-10-01T00:00:00Z"}}:
    {available:false,code:"SESSION_REQUIRED"});
  for(const domain of ["trade-requests","notices"])
   if(p===`/api/tenants/${TENANT}/me/${domain}`)
    return json(domain==="trade-requests"?state.trade:state.notices,
     {available:false,code:"SOURCE_UNAVAILABLE"});
  state.forbidden.push("UNKNOWN "+method+" "+p);
  return json(404,{error:"NOT_MOCKED"});
 });
 const page=await context.newPage();
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await fn(page,state);
  ok(state.forbidden.length===0,name+" no external/mutation/unmapped API "+state.forbidden.join(","));
  ok(errors.length===0,name+" no page errors "+errors.join(","));
  casesPassed++;
  console.log("PASS "+name);
 }catch(e){
  failures.push({case:name,error:String(e?.stack||e),requests:state.log,forbidden:state.forbidden});
  console.error("FAIL "+name+" "+String(e?.message||e));
 }finally{await context.close();}
}
async function authenticated(page,route="/modules/nav-02"){
 const r=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:60000});
 ok(r&&r.status()===200,route+" HTTP200");
 await page.locator("section.sw").waitFor({timeout:15000});
 ok(await page.locator("section.sw").count()===1,route+" verified-only workspace mounted");
 await page.locator('#sw-tenant option[value="'+TENANT+'"]').waitFor({state:"attached",timeout:10000});
}
async function selectAndVerify(page){
 await page.locator("#sw-tenant").selectOption(TENANT);
 await page.getByRole("button",{name:"تأیید محدوده و استعلام"}).click();
 await page.locator(".sw-scope-ok").waitFor({timeout:10000});
}
async function locked(page,name){
 await until(async()=>await page.locator("section.sw").count()===0,name+" private workspace unmounted");
 ok(await page.locator("section.sw").count()===0,name+" no private workspace");
 ok(!(await page.locator(".sw-confirmed").count()),name+" private cards removed");
}
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  await exercise(browser,"anonymous-denied",async(page,state)=>{
   state.session="expired";
   await page.goto(BASE+"/modules/nav-02",{waitUntil:"domcontentloaded"});
   await page.locator("form:has(#tto-mobile)").waitFor({timeout:12000});
   ok(await page.locator("section.sw").count()===0,"anonymous does not mount private UI");
  });
  await exercise(browser,"revoke-after-holdings-visible",async(page,state)=>{
   await authenticated(page);
   await selectAndVerify(page);
   await until(async()=>await page.locator(".sw-confirmed").count()===2,"approved mock source records");
   ok(await page.getByText(/تعداد سهام: /).count()===1,"synthetic holding visible before revoke");
   state.session="expired";
   await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
   await locked(page,"revoked");
   await page.locator("form:has(#tto-mobile)").waitFor({timeout:10000});
   ok(!(await page.getByText(/تعداد سهام: /).count()),"expired screen has no holdings");
  });
  await exercise(browser,"session-503-fail-closed-and-retry",async(page,state)=>{
   await authenticated(page);await selectAndVerify(page);
   await until(async()=>await page.locator(".sw-confirmed").count()===2,"mock data visible before error");
   state.session="unavailable";
   await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
   await locked(page,"503");
   await page.getByRole("button",{name:"تلاش مجدد"}).waitFor({timeout:10000});
   ok(await page.getByText(/بررسی نشست ممکن نیست/).count()>=1,"network failure not called logout");
   state.session="valid";
   await page.getByRole("button",{name:"تلاش مجدد"}).click();
   await page.locator("section.sw").waitFor({timeout:10000});
   ok(await page.locator(".sw-confirmed").count()===0,"no stale holdings after retry");
   ok(await page.locator("#sw-tenant").inputValue()==="","tenant scope reset on remount");
  });
  await exercise(browser,"session-malformed-fail-closed",async(page,state)=>{
   await authenticated(page);
   state.session="malformed";
   await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
   await locked(page,"malformed session response");
   await page.getByRole("button",{name:"تلاش مجدد"}).waitFor({timeout:10000});
  });
  await exercise(browser,"tenant-discovery-401-unmounts",async(page,state)=>{
   state.discovery=401;
   await page.goto(BASE+"/modules/nav-02",{waitUntil:"domcontentloaded"});
   await page.locator("form:has(#tto-mobile)").waitFor({timeout:12000});
   ok(await page.locator("section.sw").count()===0,"401 tenant discovery removed workspace");
  });
  await exercise(browser,"tenant-context-401-unmounts",async(page,state)=>{
   state.scope=401;
   await authenticated(page);
   await page.locator("#sw-tenant").selectOption(TENANT);
   await page.getByRole("button",{name:"تأیید محدوده و استعلام"}).click();
   await locked(page,"tenant 401");
  });
  await exercise(browser,"membership-401-unmounts",async(page,state)=>{
   state.member=401;
   await authenticated(page);await selectAndVerify(page).catch(async e=>{
    if(await page.locator("section.sw").count()!==0)throw e;
   });
   await locked(page,"member record 401");
  });
  for(const [domain,route] of [["trade","/modules/nav-03"],["notices","/modules/nav-05"]]){
   await exercise(browser,domain+"-401-unmounts",async(page,state)=>{
    state[domain==="trade"?"trade":"notices"]=401;
    await authenticated(page,route);
    await page.locator("#sw-tenant").selectOption(TENANT);
    await page.getByRole("button",{name:"تأیید محدوده و استعلام"}).click();
    await locked(page,domain+" source 401");
    const endpoint="/api/tenants/"+TENANT+"/me/"+(domain==="trade"?"trade-requests":"notices");
    ok(state.responseStatuses[endpoint]===401,domain+" source returned REAL MOCK 401");
   });
  }
  await exercise(browser,"scope-403-stays-locked-not-logged-out",async(page,state)=>{
   state.scope=403;
   await authenticated(page);
   await page.locator("#sw-tenant").selectOption(TENANT);
   await page.getByRole("button",{name:"تأیید محدوده و استعلام"}).click();
   await page.getByText(/دسترسی به این محدوده مجاز نیست/).waitFor({timeout:10000});
   ok(await page.locator("section.sw").count()===1,"403 denies scope but not login");
   ok(await page.locator(".sw-confirmed").count()===0,"403 reveals no approved values");
  });
  await exercise(browser,"source-403-is-not-session-loss",async(page,state)=>{
   state.notices=403;
   await authenticated(page,"/modules/nav-05");
   await selectAndVerify(page);
   await page.getByText(/مرجع رسمی، مجوز مخاطب/).waitFor({timeout:12000});
   ok(await page.locator("section.sw").count()===1,"source access denied without false logout");
  });
 }catch(e){
  failures.push({case:"suite",error:String(e?.stack||e)});
 }finally{if(browser)await browser.close();}
 const result={
  schema:"tto-phase4b-session-mocked-browser-v1",sourceSha:SHA||"UNSET",
  browserOnlySyntheticBff:true,realAuthenticationVerified:false,
  operationalSourceApproval:false,checksPassed:checkpoints.length,
  casesPassed,casesExecuted,casesExpected:11,requestsIntercepted:requests,
  failures,pass:failures.length===0&&casesExecuted===11&&casesPassed===11
 };
 fs.writeFileSync(path.join(OUT,"phase4b-session-report.json"),JSON.stringify(result,null,2)+"\n");
 fs.writeFileSync(path.join(OUT,"phase4b-session-report.md"),[
  "# Phase 4B - simulated session loss browser review", "Exact source: "+result.sourceSha,
  "Checks: "+result.checksPassed,"Passed cases: "+result.casesPassed+"/"+result.casesExpected,
  "Failures: "+failures.length,
  "All API responses synthetic within isolated browser: NOT real backend/security/legal acceptance.",
  ...failures.map(x=>"- "+x.case+": "+x.error)
 ].join("\n")+"\n");
 console.log("TTO_PHASE4B_BROWSER_CASES="+result.casesPassed+"/"+result.casesExpected);
 console.log("TTO_PHASE4B_BROWSER_CHECKS="+result.checksPassed);
 console.log("TTO_PHASE4B_BROWSER_FAILURES="+failures.length);
 if(!result.pass)process.exitCode=1;
 else console.log("TTO_PHASE4B_CLIENT_BROWSER_PASS_SHA="+result.sourceSha);
})().catch(e=>{console.error(e);process.exitCode=1});
