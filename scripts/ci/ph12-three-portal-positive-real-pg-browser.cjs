"use strict";
/**
 * PH12 synthetic-only positive Chromium UAT:
 * Browser -> three independent Next apps -> real NestJS -> disposable PG17.
 *
 * Imported by the existing CF02 E2E after verified synthetic credentials and
 * role/tenant evidence have been staged. Not an authorized real-person UAT.
 * Never print test passwords, tokens, cookies, names or response bodies.
 */
const assert=require("node:assert/strict");
const {chromium}=require("/tmp/tto-ph12-positive-browser/node_modules/playwright");
const PORTALS=[
 {surface:"national",port:32723,username:"ci-national-root",password:"CI-National-Root-Synthetic-2026#",user:"#national-username",pass:"#national-password",tab:null},
 {surface:"cooperative",port:32722,username:"ci-manager",password:"CI-Synthetic-Strong-Only-2026#",user:"#portal-user",pass:"#portal-pass",tab:"نام کاربری و رمز",path:"/login?workspace=ci-legal-a"},
 {surface:"shareholder",port:32721,username:"ci-member",password:"CI-Synthetic-Strong-Only-2026#",user:"#portal-user",pass:"#portal-pass",tab:"نام کاربری و رمز"}
];
const BASE_HOST="http://127.0.0.1";
async function check(){
 if(process.env.CI!=="true"||process.env.TTO_PH12_POSITIVE_BROWSER!=="1"||
    process.env.APIIR_TOKEN||process.env.VERCEL||
    process.env.TEST_ADMIN_DATABASE_URL!=="postgresql://postgres@127.0.0.1:5432/tto")
   throw Error("POSITIVE_BROWSER_LOCAL_DISPOSABLE_ONLY");
 let completed=0;
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const p of PORTALS){
   const origin=BASE_HOST+":"+p.port;
   const context=await browser.newContext({locale:"fa-IR",viewport:{width:1440,height:900},serviceWorkers:"block"});
   const page=await context.newPage(),errors=[],authStatus=[];
   page.on("pageerror",error=>errors.push(String(error).slice(0,80)));
   page.on("response",response=>{
    if(/\/api\/(national-login|auth\/password\/(login|session)|auth\/session)$/.test(new URL(response.url()).pathname))
      authStatus.push({path:new URL(response.url()).pathname,status:response.status()});
   });
   await page.route("**/*",async route=>{
    const url=route.request().url();
    if(url.startsWith(origin+"/")||url===origin)return route.continue();
    errors.push("EXTERNAL_BROWSER_CALL_BLOCKED");return route.abort();
   });
   try{
    const login=await page.goto(origin+(p.path||"/login"),{waitUntil:"domcontentloaded",timeout:25000});
    assert.equal(login.status(),200,p.surface+" dedicated login route");
    if(p.tab)await page.getByRole("tab",{name:p.tab}).click();
    await page.locator(p.user).waitFor({state:"visible",timeout:11000});
    await page.locator(p.pass).waitFor({state:"visible",timeout:11000});
    await page.locator(p.user).fill(p.username);
    await page.locator(p.pass).fill(p.password);
    const submit=page.getByRole("button",{name:p.surface==="national"?/ورود به (سامانه|پنل|مدیریت)/:"ورود به پنل "+(p.surface==="cooperative"?"مدیر تعاونی":"سهامدار")});
    if(p.surface==="national"){
      // Use the actual national root form; no direct API injection into browser.
      await page.locator("form").filter({has:page.locator(p.user)}).locator('button[type="submit"]').click();
    }else await submit.click();
    // Wait for the successful login navigation to finish before asserting the
    // cookie. A React-side replace() can race a second fetch on /login.
    try{
     await page.waitForURL(url=>url.pathname===(p.surface==="cooperative"?"/c/ci-legal-a":"/"),{timeout:14000});
    }catch{
     // Only normalized route/status codes; never record credentials or cookies.
     console.error("TTO_PH12_POSITIVE_BROWSER_NAV_DIAGNOSTIC",
      p.surface,JSON.stringify(authStatus.slice(-8)),new URL(page.url()).pathname);
     throw Error("PH12_POSITIVE_BROWSER_AUTH_NAV_NOT_COMPLETED_"+p.surface);
    }
    const sessionRoute=p.surface==="national"?"/api/auth/session":"/api/auth/password/session";
    await page.waitForFunction(async url=>{
      try{const r=await fetch(url,{credentials:"same-origin",cache:"no-store"});if(!r.ok)return false;
      const s=await r.json();return s.authenticated===true;}catch{return false;}
    },sessionRoute,{timeout:13000});
    const session=await page.evaluate(async url=>{
      const response=await fetch(url,{credentials:"same-origin",cache:"no-store"});
      return {status:response.status,body:await response.json()};
    },sessionRoute);
    assert.equal(session.status,200,p.surface+" server-attested cookie session");
    assert.equal(session.body.authenticated,true,p.surface+" positive authentication");
    if(p.surface==="national"){
      assert.equal(session.body.nationalRoot,true);
      assert.equal(session.body.mustChangeCredentials,false);
    }else{
      assert.equal(session.body.surface,p.surface);
      assert.equal(session.body.workspaceSlug,"ci-legal-a");
      assert.match(session.body.tenantId,/^[a-f0-9-]{36}$/);
    }
    // The browser must reach a real authenticated page after the BFF signs in.
    const target=p.surface==="cooperative"?"/c/ci-legal-a":"/";
    await page.goto(origin+target,{waitUntil:"domcontentloaded",timeout:25000});
    await page.locator(".tto-approved-grid").waitFor({state:"visible",timeout:14000});
    assert.equal(await page.locator(".tto-approved-grid").count(),1,p.surface+" authenticated dashboard absent");
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(180);
    assert.equal(await page.locator(".tto-approved-grid").count(),1,p.surface+" mobile dashboard absent");
    assert.equal(errors.length,0,p.surface+" browser page errors or external requests");
    completed++;
    console.log("TTO_PH12_SYNTHETIC_POSITIVE_"+p.surface.toUpperCase()+"_BROWSER_REAL_BACKEND_PASS");
   }finally{await context.close();}
  }
  assert.equal(completed,3,"all three distinct password identities must be proven");
  console.log("TTO_PH12_THREE_PORTAL_SYNTHETIC_POSITIVE_CHROMIUM_3_OF_3_PASS_NOT_REAL_UAT");
 }finally{await browser.close();}
}
module.exports={check};
