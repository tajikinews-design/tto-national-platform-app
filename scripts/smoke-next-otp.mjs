import { spawn } from "node:child_process";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"..");
const slugs=["shareholder","cooperative-management","national-admin"];
let checks=0;
for (let idx=0;idx<slugs.length;idx++){
 const slug=slugs[idx],port=32110+idx;
 const cwd=resolve(root,"apps",slug);
 const next=resolve(cwd,"node_modules/next/dist/bin/next");
 const server=spawn(process.execPath,[next,"start","-p",String(port)],{
  cwd,env:{...process.env,TTO_API_BASE_URL:"",PORT:String(port),NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore"
 });
 try{
  let ready=false;
  for(let n=0;n<80;n++){
   if(server.exitCode!==null)throw Error(slug+" exited");
   try{const r=await fetch("http://127.0.0.1:"+port+"/");if(r.ok){ready=true;const html=await r.text();
    if(!html.includes("ورود با رمز یک‌بارمصرف"))throw Error(slug+" missing OTP form");
    if(!html.includes("در این نسخه پیش‌نمایش"))throw Error(slug+" did not fail closed");
    checks++;break;}}catch{}
   await new Promise(r=>setTimeout(r,200));
  }
  if(!ready)throw Error(slug+" not ready");
  // Shareholder NAV-02/03/05 now have session-gated workspaces, not the
  // legacy static placeholder. Without a backend they MUST render only the
  // fail-closed OTP surface and MUST NOT render private workspace content.
  const moduleCases=[
   ["/modules/nav-02","NAV-02"],
   ["/modules/nav-11","NAV-11"],
   ...(slug==="shareholder"?[
     ["/modules/nav-03","NAV-03"],
     ["/modules/nav-05","NAV-05"]
   ]:[])
  ];
  for(const [path,title] of moduleCases){
   const response=await fetch("http://127.0.0.1:"+port+path);
   if(response.status!==200)throw Error(slug+" module route "+path+" returned "+response.status);
   const html=await response.text();
   if(!html.includes(title)||!html.includes('aria-current="page"'))
     throw Error(slug+" module view lost canonical/current navigation");
   const protectedShareholder=slug==="shareholder" &&
     ["/modules/nav-02","/modules/nav-03","/modules/nav-05"].includes(path);
   if(protectedShareholder){
     if(!html.includes("ورود با رمز یک‌بارمصرف")||
        !html.includes("در این نسخه پیش‌نمایش")||
        html.includes("کارپوشه شخصی سهامدار")||
        html.includes("عضویت فعال — منبع تأییدشده")||
        html.includes("تعداد سهام: "))
       throw Error(slug+" protected module leaked private data or lacked fail-closed OTP");
   }else{
     if(!html.includes("ساختار این بخش آماده بررسی است")||
        !html.includes("هیچ داده، مانده سهام"))
       throw Error(slug+" legacy module lost safe placeholder");
   }
   checks++;
  }
  // Tenant context BFF must fail closed even in protected Preview, without a user session.
  const tid="44444444-4444-4444-8444-444444444444";
  const contextUrl="http://127.0.0.1:"+port+"/api/tenants/"+tid+"/context";
  const anonymousContext=await fetch(contextUrl);
  if(anonymousContext.status!==401 || (await anonymousContext.json()).tenantContextVerified!==false)
    throw Error(slug+" anonymous tenant access was not denied");
  if(!/no-store/.test(anonymousContext.headers.get("cache-control")??""))
    throw Error(slug+" tenant gate response cache policy missing");
  checks+=2;
  const forgedContext=await fetch(contextUrl,{headers:{Authorization:"Bearer "+"a".repeat(48),"X-Tenant-Id":tid,"X-Role":"COOPERATIVE_MANAGER"}});
  if(forgedContext.status!==401)throw Error(slug+" tenant gate accepted forged client headers");
  checks++;
  const invalidContext=await fetch("http://127.0.0.1:"+port+"/api/tenants/not-a-uuid/context");
  if(invalidContext.status!==400)throw Error(slug+" malformed tenant ID accepted");
  checks++;
  const localCookie=await fetch(contextUrl,{headers:{Cookie:"tto_session="+"b".repeat(48)}});
  if(localCookie.status!==503)throw Error(slug+" tenant gate did not fail closed on missing backend");
  checks++;
  const unauth=await fetch("http://127.0.0.1:"+port+"/api/me/tenant-options");
  if(unauth.status!==401||(await unauth.json()).items.length!==0)
    throw Error(slug+" exposed tenant options to anonymous user");
  checks++;
  // Never expose Child06 membership or Child07 holdings through a forged
  // browser Authorization header. Both reads require the real HttpOnly cookie
  // and remain unavailable when the protected backend is not configured.
  if(slug==="shareholder"){
   for(const domain of ["member-record","shareholding"]){
    const endpoint="http://127.0.0.1:"+port+"/api/tenants/"+tid+"/me/"+domain;
    const anonymous=await fetch(endpoint);
    const payload=await anonymous.json();
    if(anonymous.status!==401||payload.available!==false||payload.code!=="SESSION_REQUIRED"||
       !/no-store/.test(anonymous.headers.get("cache-control")??""))
      throw Error("shareholder "+domain+" did not fail closed for anonymous user");
    checks++;
    const forged=await fetch(endpoint,{headers:{
      Authorization:"Bearer "+"a".repeat(48),"X-Tenant-Id":tid,"X-Role":"MEMBER"
    }});
    if(forged.status!==401)throw Error("shareholder "+domain+" trusted forged client credentials");
    checks++;
   }
  }
  const invalid=await fetch("http://127.0.0.1:"+port+"/modules/nav-12");
  if(invalid.status!==404)throw Error(slug+" invalid NAV route did not reject");
  checks++;
  for(const route of ["/api/auth/otp/request","/api/auth/otp/verify"]){
   const response=await fetch("http://127.0.0.1:"+port+route,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mobile:"09123456789",otp:"123456"})
   });
   if(response.status!==503)throw Error(slug+" "+route+" unexpectedly returned "+response.status);
   checks++;
  }
 }finally{server.kill("SIGTERM");}
}
// API activation is read at server runtime rather than baked into static HTML.
// The deliberately invalid HTTPS hostname is NEVER called: this probes SSR form availability only.
for(let idx=0;idx<slugs.length;idx++){
 const slug=slugs[idx],port=32200+idx,cwd=resolve(root,"apps",slug);
 const next=resolve(cwd,"node_modules/next/dist/bin/next");
 const server=spawn(process.execPath,[next,"start","-p",String(port)],{
  cwd,env:{...process.env,TTO_API_BASE_URL:"https://invalid.example",PORT:String(port),NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore"
 });
 try{
  let ready=false;
  for(let n=0;n<80;n++){
   if(server.exitCode!==null)throw Error(slug+" dynamic SSR exited");
   try {
     const r=await fetch("http://127.0.0.1:"+port+"/");
     if(r.ok){
       const html=await r.text();
       if(!html.includes("در حال بررسی نشست ورود"))throw Error(slug+" runtime-enabled session restoration shell missing");
       checks++;ready=true;break;
     }
   }catch {}
   await new Promise(r=>setTimeout(r,200));
  }
  if(!ready)throw Error(slug+" runtime-enabled form did not appear");
 }finally{server.kill("SIGTERM");}
}
console.log("TTO_NEXT_VAZIRMATN_OTP_RUNTIME_ENV_SMOKE_PASS="+checks);
