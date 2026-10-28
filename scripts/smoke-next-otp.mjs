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
  // All ten shareholder module pages mount only fail-closed public SSR without
  // backend/session; authenticated owner information never renders anonymously.
  const moduleCases=[
   ["/modules/nav-02","NAV-02"],
   ["/modules/nav-11","NAV-11"],
   ...(slug==="shareholder"?[
     ["/modules/nav-03","NAV-03"],
     ["/modules/nav-05","NAV-05"],
     ["/modules/nav-04","NAV-04"],
     ["/modules/nav-06","NAV-06"],
     ["/modules/nav-07","NAV-07"],
     ["/modules/nav-08","NAV-08"],
     ["/modules/nav-09","NAV-09"],
     ["/modules/nav-10","NAV-10"]
   ]:[])
  ];
  for(const [path,title] of moduleCases){
   const response=await fetch("http://127.0.0.1:"+port+path);
   if(response.status!==200)throw Error(slug+" module route "+path+" returned "+response.status);
   const html=await response.text();
   if(!html.includes(title)||!html.includes('aria-current="page"'))
     throw Error(slug+" module view lost canonical/current navigation");
   const protectedShareholder=slug==="shareholder" &&
     ["/modules/nav-02","/modules/nav-03","/modules/nav-05",
      "/modules/nav-04","/modules/nav-06","/modules/nav-07","/modules/nav-08",
      "/modules/nav-09","/modules/nav-10","/modules/nav-11"].includes(path);
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
   // Phase-2 source-authority gates: a syntactically valid cookie cannot
   // enable a read model while Child07/Child09 approvals are unimplemented.
   for(const domain of ["trade-requests","notices"]){
    const endpoint="http://127.0.0.1:"+port+"/api/tenants/"+tid+"/me/"+domain;
    const anon=await fetch(endpoint);
    const unauthBody=await anon.json();
    if(anon.status!==401||unauthBody.available!==false||unauthBody.code!=="SESSION_REQUIRED"||
       !/no-store/.test(anon.headers.get("cache-control")??""))
      throw Error("source-gated "+domain+" leaked anonymous data");
    checks++;
    const spoofed=await fetch(endpoint,{headers:{
     Authorization:"Bearer "+"a".repeat(48),"X-Role":"MEMBER","X-Party-Id":tid,
     "X-Tenant-Id":tid
    }});
    if(spoofed.status!==401)throw Error("source-gated "+domain+" trusted forged client headers");
    checks++;
    const cookie=await fetch(endpoint,{headers:{Cookie:"tto_session="+"b".repeat(48)}});
    const disabled=await cookie.json();
    // Valid-looking token without a configured backend is NOT authenticated.
    if(cookie.status!==503||disabled.available!==false||
       disabled.code!=="SOURCE_UNAVAILABLE"||
       !/no-store/.test(cookie.headers.get("cache-control")??""))
      throw Error("source-gated "+domain+" accepted unapproved source");
    checks++;
    const malformed=await fetch("http://127.0.0.1:"+port+
     "/api/tenants/invalid-tenant/me/"+domain);
    if(malformed.status!==400)throw Error("source-gated "+domain+" accepted invalid tenant ID");
    checks++;
   }
  }
  // Anonymous navigation is allowed only for public-design review copy.
  // The actual shareholder operational portal remains guarded by OTP and legal sources.
  if(slug==="shareholder"){
   const reviews=["/review",...Array.from({length:10},(_,i)=>
    "/review/nav-"+String(i+2).padStart(2,"0"))];
   for(const route of reviews){
    const response=await fetch("http://127.0.0.1:"+port+route);
    if(response.status!==200)throw Error("shareholder review route failed: "+route+" status="+response.status);
    const page=await response.text();
    if(!page.includes("نسخه بازبینی")||!page.includes("بدون اطلاعات یا عملیات واقعی"))
     throw Error("shareholder review disclosure missing: "+route);
    checks++;
   }
   // W1 synthetic-only interactive NAV01 preview is NOT an authenticated workspace.
   const interactive=await fetch("http://127.0.0.1:"+port+"/review/interactive");
   if(interactive.status!==200)throw Error("W1 review interactive missing");
   const interactiveHtml=await interactive.text();
   if(!interactiveHtml.includes("داده کاملاً مصنوعی")||
      !interactiveHtml.includes("منبع تأیید نشده")||
      !interactiveHtml.includes("داشبورد سهامدار"))
      throw Error("W1 synthetic preview legal boundary missing");
   checks++;
   const nav02=await fetch("http://127.0.0.1:"+port+"/review/interactive/nav-02");
   if(nav02.status!==200)throw Error("W1 NAV02 synthetic route unavailable");
   const nav02html=await nav02.text();
   if(!nav02html.includes("CHILD06_MEMBERSHIP")||!nav02html.includes("CHILD07_HOLDINGS"))throw Error("W1 NAV02 boundaries missing");
   checks++;
   const nav03=await fetch("http://127.0.0.1:"+port+"/review/interactive/nav-03");
   if(nav03.status!==200)throw Error("W1 NAV03 market preview HTTP status "+nav03.status);
   const nav03html=await nav03.text();
   for(const text of ["خرید و فروش سهام","درخواست فروش سهام","درخواست خرید سهام",
                      "راهنمای قانونی این صفحه","هیچ درخواست واقعی ثبت نمی‌شود"]){
    if(!nav03html.includes(text))throw Error("W1 NAV03 required source boundary missing: "+text);
   }
   checks++;
   // Static review-only trade dossier must not expose operational user data.
   if(slug==="shareholder"){
    const caseRes=await fetch("http://127.0.0.1:"+port+"/review/interactive/nav-03/case-demo");
    if(caseRes.status!==200)throw Error("W1 NAV03 case demo route "+caseRes.status);
    const caseHtml=await caseRes.text();
    for(const marker of ["جزئیات و پیگیری پرونده معامله","DEMO-SELL-QUEUED",
                         "DEMO-BUY-COMPLETED","مالکیت منتقل نشده است",
                         "داده کاملاً مصنوعی","هیچ پرونده واقعی خوانده یا ذخیره نمی‌شود"]){
      if(!caseHtml.includes(marker))throw Error("W1 NAV03 case demo disclosure missing: "+marker);
    }
    checks++;
   }
   // NAV04 official assembly/election sources are NOT connected. SSR must fail closed.
   if(slug==="shareholder"){
    const asm=await fetch("http://127.0.0.1:"+port+"/review/interactive/nav-04");
    if(asm.status!==200)throw Error("NAV04 synthetic review HTTP status "+asm.status);
    const html=await asm.text();
    for(const marker of ["مجامع عمومی و انتخابات تعاونی","منبع رسمی تأیید نشده",
                          "هیچ حق رأی","مرجع رسمی هنوز تأیید نشده"]){
     if(!html.includes(marker))throw Error("NAV04 fail-closed marker missing: "+marker);
    }
    checks++;
   }
   // NAV05 remains a review-only shell; Child09/10/13 data cannot be assumed.
   const comm=await fetch("http://127.0.0.1:"+port+"/review/interactive/nav-05");
   if(comm.status!==200)throw Error("NAV05 review HTTP status "+comm.status);
   const commHtml=await comm.text();
   // Inspect only the default UNVERIFIED SSR: conditional DEMO detail text is not rendered.
   // A legal-publication disclaimer must appear unconditionally in the footer.
   for(const marker of ["اخبار و ارتباط با شرکت","مرکز اطلاع‌رسانی",
    "منبع رسمی تأیید نشده","ابلاغ‌های مهم","پیام‌های نیازمند تأیید",
    "تیکت‌های من","انتشار خبر", "ثبت درخواست جدید"]){
    if(!commHtml.includes(marker))throw Error("NAV05 fail-closed SSR marker missing: "+marker);
   }
   if(commHtml.includes("DEMO-NEWS-01"))throw Error("NAV05 synthetic source leaked into default SSR");
   checks++;
   // NAV06 dedicated synthetic review: all eleven canonical sections, default deny.
   const svc=await fetch("http://127.0.0.1:"+port+"/review/interactive/nav-06");
   if(svc.status!==200)throw Error("NAV06 review HTTP status "+svc.status);
   const svcHtml=await svc.text();
   for(const marker of ["خدمات من","درخواست‌های من","آکادمی","دوره‌های من",
      "رویدادها","رزروهای من","گواهی‌های آموزشی","مزایای من","Voucherها",
      "خدمات شرکت","تقویم من","مرجع و مجوز تأیید نشده","ثبت خدمات"]){
     if(!svcHtml.includes(marker))throw Error("NAV06 fail-closed SSR marker missing: "+marker);
   }
   if(svcHtml.includes("DEMO-SVC-01"))throw Error("NAV06 synthetic source leaked into default SSR");
   checks++;
   // NAV07 review-only synthetic marketplace route: never activate product or payment.
   const nav07=await fetch("http://127.0.0.1:"+port+"/review/interactive/nav-07");
   if(nav07.status!==200)throw Error("NAV07 review HTTP status "+nav07.status);
   const nav07Html=await nav07.text();
   for(const m of ["فروشگاه و فرصت‌ها","محصولات شرکت","بازار ملی سهامداران",
     "محصولات سایر تعاونی‌ها","سفارش‌های من","پرداخت سفارش","وضعیت تحویل",
     "معرفی محصول من","فرصت‌های کسب‌وکار","مجوز انتشار و اهلیت تأیید نشده"]){
     if(!nav07Html.includes(m))throw Error("NAV07 fail-closed SSR marker missing: "+m);
   }
   checks++;
   // NAV08 static projects review: never expose unapproved asset/permit records.
   const nav08=await fetch("http://127.0.0.1:"+port+"/review/interactive/nav-08");
   if(nav08.status!==200)throw Error("NAV08 review HTTP status "+nav08.status);
   const nav08Html=await nav08.text();
   for(const label of ["پروژه‌های شرکت","پیشرفت پروژه‌ها","دارایی‌های قابل افشا",
     "سرمایه‌گذاری‌های شرکت","پروژه‌های جدید","فرصت‌های همکاری",
     "فرصت‌های شغلی","برنامه‌های مسئولیت اجتماعی","اثرگذاری محلی",
     "منبع و مجوز افشا تأیید نشده"]){
     if(!nav08Html.includes(label))throw Error("NAV08 fail-closed SSR marker missing: "+label);
   }
   if(nav08Html.includes("DEMO-PRJ-001"))throw Error("NAV08 fixture leaked into default SSR");
   checks++;
   const invalidReview=await fetch("http://127.0.0.1:"+port+"/review/not-a-nav");
   if(invalidReview.status!==404)throw Error("shareholder review invalid slug allowed");
   checks++;
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
