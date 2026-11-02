"use strict";
/* Isolated CI: 3 Next servers, no backend, no cookies or live identities.
   Browser assertions are independent from source-only presence checks. */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const path=require("node:path");
const {chromium}=require("playwright");
const axe=require("axe-core");
const root=path.resolve(__dirname,"../..");
const cfg=[
 {slug:"shareholder",title:"پنل سهامداران",port:32601},
 {slug:"cooperative-management",title:"مدیریت تعاونی",port:32602},
 {slug:"national-admin",title:"مرکز مدیریت ملی",port:32603}
];
function lum(rgb){const m=rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(!m)throw Error("unknown rgb "+rgb);
 const [r,g,b]=m.slice(1).map(v=>{const c=Number(v)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});
 return r*.2126+g*.7152+b*.0722;}
function ratio(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
async function serve(app){
 const cwd=path.join(root,"apps",app.slug),next=require.resolve("next/dist/bin/next",{paths:[cwd]});
 const proc=spawn(process.execPath,[next,"start","-p",String(app.port),"-H","127.0.0.1"],{
  cwd,env:{...process.env,TTO_API_BASE_URL:"",APIIR_TOKEN:"",DATABASE_URL:"",NEXT_TELEMETRY_DISABLED:"1"},stdio:["ignore","pipe","pipe"]
 });
 let logs=""; for(const stream of [proc.stdout,proc.stderr])stream.on("data",v=>logs+=String(v).slice(0,900));
 const url="http://127.0.0.1:"+app.port;
 for(let n=0;n<80;n++){
  if(proc.exitCode!==null)throw Error(app.slug+" exited "+logs.slice(-1500));
  try{const r=await fetch(url,{signal:AbortSignal.timeout(2000)});if(r.status===200)return {proc,url};}catch{}
  await new Promise(r=>setTimeout(r,400));
 }
 proc.kill("SIGTERM");throw Error(app.slug+" unavailable "+logs.slice(-1500));
}
async function main(){
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 let checks=0;
 try {
  for(const app of cfg){
   let server;try{
    server=await serve(app);
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
     const context=await browser.newContext({viewport,locale:"fa-IR",colorScheme:"light",javaScriptEnabled:true});
     try{
      const page=await context.newPage();
      for(const route of ["/","/modules/nav-02","/modules/nav-07","/modules/nav-11"]){
       const response=await page.goto(server.url+route,{waitUntil:"domcontentloaded",timeout:25000});
       assert.equal(response.status(),200,app.slug+" "+route);
       assert.equal(await page.locator("html").getAttribute("dir"),"rtl");
       assert.equal(await page.locator("html").getAttribute("lang"),"fa");
       assert.equal(await page.locator(".nav-link").count(),11,app.slug+" NAV count");
       await page.getByRole("main").waitFor();
       await page.getByRole("navigation",{name:"منوی اصلی "+app.title}).waitFor();
       assert.equal(await page.locator('[aria-current="page"]').count(),1);
       assert.equal(await page.locator(".otp-panel").count(),1);
       assert.equal(await page.locator(".otp-unavailable").count(),1);
       assert.equal(await page.getByRole("button",{name:"دریافت کد"}).count(),0,"no OTP forms without backend");
       if(route!=="/"&&app.slug!=="shareholder"){
        await page.getByText("دسترسی ماژول نیازمند تأیید مجوز است").waitFor();
        assert.equal(await page.locator(".module-status").count()>0,true);
       }
       const style=await page.locator(".nav-link").first().evaluate(el=>({
        c:getComputedStyle(el).color,
        bg:getComputedStyle(el).backgroundColor,
        body:getComputedStyle(document.querySelector(".nav-area")).backgroundColor,
        over:document.documentElement.scrollWidth-document.documentElement.clientWidth
       }));
       assert.ok(ratio(style.c,style.bg==="rgba(0, 0, 0, 0)"?style.body:style.bg)>=4.5,app.slug+" text contrast");
       assert.ok(style.over<=2,app.slug+" horizontal document overflow "+style.over);
       checks+=8;
       if(route==="/"||route==="/modules/nav-02"){
        await page.addScriptTag({content:axe.source});
        const violations=await page.evaluate(async()=> {
          const report=await window.axe.run(document,{runOnly:{type:"tag",
            values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}});
          return report.violations.map(v=>({id:v.id,impact:v.impact,
            nodes:v.nodes.slice(0,5).map(n=>({target:n.target,message:n.failureSummary?.slice(0,160)}))}));
        });
        assert.deepEqual(violations,[],app.slug+" "+route+" WCAG violations");
        checks++;
       }
      }
      await page.goto(server.url,{waitUntil:"domcontentloaded"});
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(".skip-to-content").evaluate(el=>el===document.activeElement),true,"first keyboard focus is skip link");
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(()=>location.hash),"#main-content");
      checks+=2;
      const sess=await page.evaluate(async()=>{const r=await fetch("/api/auth/session",{cache:"no-store"});
       return {status:r.status,body:await r.json()};});
      assert.equal(sess.status,200);
      assert.equal(sess.body.authenticated,false);
      checks+=2;
      const invalid=await page.goto(server.url+"/modules/not-a-nav",{waitUntil:"domcontentloaded"});
      assert.equal(invalid.status(),404);
      checks++;
      console.log("TTO_PH03_BROWSER_"+app.slug+"_"+viewport.width+"_PASS");
     }finally{await context.close();}
    }
   }finally{if(server){server.proc.kill("SIGTERM");}}
  }
 }finally{await browser.close();}
 console.log("TTO_PH03_3PORTAL_CHROMIUM_A11Y_ROUTE_PASS_CHECKS="+checks);
}
main().catch(e=>{console.error("TTO_PH03_3PORTAL_CHROMIUM_FAIL:",e.stack||e.message);process.exitCode=1;});
