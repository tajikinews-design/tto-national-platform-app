
(() => {
 const roots=[
 ["NAV-01","داشبورد","▦"],["NAV-02","اعضا و سهام","♧"],["NAV-03","بازار و سرمایه","▥"],
 ["NAV-04","حاکمیت و مجامع","⌂"],["NAV-05","ارتباط با سهامداران","▤"],["NAV-06","عملیات و خدمات","⚙"],
 ["NAV-07","کسب‌وکار و بازار","♙"],["NAV-08","پروژه و توسعه","▣"],["NAV-09","ریسک و شفافیت","◇"],
 ["NAV-10","گزارش و هوشمندی","▥"],["NAV-11","تنظیمات","⚙"]
 ];
 const variants={
 shareholder:{
  who:"سهامدار",sub:"پنل شخصی",title:"پنل هوشمند سهامداران",
  hero:"دسترسی آسان به سهام، مجامع، اطلاعیه‌ها، مزایا و خدمات شرکت",
  kpis:["سهام من","ارزش کارشناسی جاری","درخواست‌های باز","سلامت حساب"],
  chart:"روند ارزش سهام",actions:"اقدام‌های من",alerts:"اطلاعیه‌ها و اقدام‌های مهم",campaign:"پیام‌ها و کمپین‌های ارتباطی",ads:"تبلیغات و پیشنهادهای ویژه",metrics:"شاخص‌های شخصی من",
  labels:["داشبورد","سهام و عضویت من","خرید و فروش سهام","مجامع و انتخابات","اخبار و ارتباط با شرکت","خدمات من","فروشگاه و فرصت‌ها","پروژه‌های شرکت","شفافیت و اسناد شرکت","گزارش‌های من","تنظیمات حساب"]
 },
 cooperative:{
  who:"مدیر تعاونی",sub:"مدیریت و راهبری",title:"مرکز مدیریت تعاونی توسعه و عمران",
  hero:"مدیریت یکپارچه اعضا، سهام، مجامع، خدمات و عملیات تعاونی",
  kpis:["اعضای فعال","سهامداران ثبت‌شده","معاملات در انتظار","سلامت سامانه"],
  chart:"روند فعالیت تعاونی",actions:"اقدام‌های مدیریتی در انتظار",alerts:"هشدارها و اقدام‌های مهم",campaign:"کمپین‌های ارتباطی",ads:"تبلیغات فعال",metrics:"شاخص‌های مدیریتی",
  labels:roots.map(x=>x[1])
 },
 national:{
  who:"مدیر پلتفرم ملی",sub:"مدیریت سراسری",title:"مرکز راهبری پلتفرم ملی تعاونی توسعه و عمران",
  hero:"نمای یکپارچه شبکه تعاونی‌ها، سرویس‌ها و اتصال‌ها",
  kpis:["تعاونی‌های فعال","سهامداران شبکه","سفارش‌های سرویس","سلامت اتصال‌ها"],
  chart:"رشد شبکه تعاونی‌ها",actions:"تعاونی‌های در حال راه‌اندازی",alerts:"هشدارها و اقدام‌های مهم",campaign:"کمپین‌های ارتباطی ملی",ads:"تبلیغات ملی فعال",metrics:"شاخص‌های هوشمندی شبکه",
  labels:roots.map(x=>x[1])
 }
 };
 const key=document.body.dataset.surface||"shareholder";const p=variants[key]||variants.shareholder;
 const icons=["♙","▧","▤","♧"];
 const escape=(s)=>String(s).replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
 const section=(label,contents="",extra="")=>'<section class="card '+extra+'"><div class="section-title"><span>'+escape(label)+'</span><a href="#" data-demo="more">مشاهده همه</a></div>'+contents+'</section>';
 const item=(label,i)=>'<div class="fake-item"><span class="symbol">'+["♧","▤","▥"][i%3]+'</span><div class="description"><b>'+escape(label)+'</b><small>اطلاعات پس از اتصال به منبع معتبر نمایش داده می‌شود</small></div><span class="pill">بدون داده</span></div>';
 const empty='<div class="empty-banner">هنوز داده قابل تأیید برای نمایش وجود ندارد.<br>این نمونه فقط برای تأیید چیدمان و تجربه کاربری است.</div>';
 const nav=roots.map((r,i)=>'<button type="button" title="'+r[0]+'" class="'+(i===0?'selected':'')+'" data-demo="nav"><span class="nav-icon">'+r[2]+'</span><span>'+escape(p.labels[i])+'</span></button>').join("");
 const middle=[
  section(p.alerts,item("مورد قابل بررسی",0)+item("اعلان‌های منتشرشده",1)),
  section(p.actions,item("اقدامات منتظر بررسی",0)+item("وضعیت درخواست‌ها",1)),
  section(p.chart,'<div class="chart-empty"><div class="empty-icon">▥</div><b>داده‌ای برای نمایش موجود نیست</b><span>نمودار پس از اتصال به Metric Registry معتبر بارگذاری می‌شود</span></div>',"wide")
 ].join("");
 const bottom=[
 section(p.campaign,item("آخرین ارتباطات تأییدشده",0)+item("کمپین‌های فعال",1)),
 section(p.ads,'<div class="empty-banner">جایگاه محتوای تبلیغاتی تأییدشده<br>بدون تبلیغ واقعی یا پیشنهاد سرمایه‌گذاری</div>'),
 section(p.metrics,empty,"wide")
 ].join("");
 document.getElementById("app").innerHTML='<div class="layout">'+
 '<aside class="sidebar" aria-label="ناوبری اصلی"><div class="brand"><div class="brand-logo">❧</div><div>پلتفرم ملی تعاونی توسعه و عمران<small>شبکه هوشمند خدمات و راهبری تعاونی‌ها</small></div></div><nav class="nav" aria-label="گروه‌های اصلی">'+nav+'</nav><button class="signout" type="button" data-demo="logout">خروج از حساب (نمایشی)</button></aside>'+
 '<main><header class="topbar"><div class="searchbox" aria-label="جست‌وجوی غیرفعال">جست‌وجوی اطلاعیه‌ها، مجامع، سهام و خدمات …</div><div class="profile"><span class="chip">● پیش‌نمایش نمایشی / بدون داده واقعی</span><span class="avatar" aria-hidden="true">●</span><span><b>'+escape(p.who)+'</b><small>'+escape(p.sub)+'</small></span></div></header>'+
 '<div class="hero"><div class="hero-content"><h1>'+escape(p.title)+'</h1><p>'+escape(p.hero)+'</p><button class="demo-button" type="button" data-demo="hero">مشاهده جزئیات ←</button></div><span class="ad-mark">جایگاه تبلیغات</span></div>'+
 '<div class="kpis">'+p.kpis.map((label,i)=>'<section class="card kpi"><div class="kpi-header"><span>'+escape(label)+'</span><span class="kpi-icon">'+icons[i]+'</span></div><div class="kpi-value" aria-label="بدون داده">—</div><p>داده‌ای برای نمایش موجود نیست</p></section>').join("")+'</div>'+
 '<div class="middle">'+middle+'</div><div class="bottom">'+bottom+'</div><div class="tiny-footer">مرجع: TTO Dashboard UI Handoff v1.0 · NAV-01…NAV-11 · وضعیت: نمونه ایستا، بدون احراز هویت یا API عملیاتی · '+escape(key)+'</div></main></div>'+
 '<div class="demo-note" role="status" id="notice">این صفحه فقط برای بازبینی داخلی رابط کاربری آماده شده است؛ لینک عمومی مجاز نیست.</div>';
 document.querySelectorAll("[data-demo]").forEach(el=>el.addEventListener("click",(e)=>{e.preventDefault();document.getElementById("notice").textContent="عملیات در این نمونه فعال نیست. هیچ اطلاعات یا تراکنشی ثبت نشده است."; }));
})();
