"use client";
import {useRef,useState} from "react";
import {NAV11_SECTIONS,NAV11_FIXTURES,NAV11_GUARDS,type Nav11Mode,type Nav11Section} from "./settings-fixtures";
/** NAV11 private synthetic UI only. No settings/auth/network command. */
const ROOTS=[
 ["⌂","داشبورد","/review/interactive"],
 ["♙","سهام و عضویت من","/review/interactive/nav-02"],
 ["▥","خرید و فروش سهام","/review/interactive/nav-03"],
 ["♜","مجامع و انتخابات","/review/interactive/nav-04"],
 ["▣","اخبار و ارتباط با شرکت","/review/interactive/nav-05"],
 ["⚙","خدمات من","/review/interactive/nav-06"],
 ["▣","فروشگاه و فرصت‌ها","/review/interactive/nav-07"],
 ["▤","پروژه‌های شرکت","/review/interactive/nav-08"],
 ["◇","شفافیت و اسناد شرکت","/review/interactive/nav-09"],
 ["▥","گزارش‌های من","/review/interactive/nav-10"],
 ["⚙","تنظیمات حساب","/review/interactive/nav-11"]
] as const;





function Sidebar(){
 const [expanded,setExpanded]=useState(false);
 return <aside className={"w1a-sidebar"+(expanded?" w1a-mobile-menu-open":"")} aria-label="منوی پنل سهامدار" onKeyDown={event=>{if(event.key==="Escape")setExpanded(false);}}>
  <div className="w1a-brand">
   <span className="w1a-brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" width="44" height="44" focusable="false"><path d="M26 4C34 4 42 2 45 0v19c-7 3-12 9-17 14L26 4Z" fill="#204a81"/><path d="M22 4C13 4 6 7 2 12v12c7 0 13 4 20 10V4Z" fill="#19b6bc"/><path d="M2 27c8-2 14 2 20 9v12C13 44 7 42 2 36V27Z" fill="#22ad78"/><path d="M26 37c5-10 12-14 19-16v13c-4 8-10 12-19 14V37Z" fill="#0a69ab"/></svg></span>
   <div><strong>پلتفرم ملی تعاونی توسعه و عمران</strong><small>شبکه هوشمند خدمات و راهبری تعاونی‌ها</small></div>
  </div>
  <button type="button" className="w1a-mobile-menu-toggle" aria-controls="w1a-side-nav" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><span aria-hidden="true">☰</span>بخش‌های پنل</button>
  <nav id="w1a-side-nav" className="w1a-side-links" aria-label="یازده بخش مصوب پنل">
   {ROOTS.map(([icon,label,href],index)=><a key={label} href={href} className={"w1a-side-link"+(index===10?" w1a-active":"")} aria-current={index===10?"page":undefined}>
    <span aria-hidden="true" className="w1a-side-icon">{icon}</span><span>{label}</span></a>)}
  </nav>
  <div className="w1a-sidebar-foot">پنل بازبینی · تنظیمات عملیاتی و امنیتی غیرفعال</div>
 </aside>;
}
function Header(){
 return <div className="w1a-global-header">
  <div className="w1a-cooperative-switch" aria-label="تعاونی انتخاب‌شده ـ فقط نمایشی" aria-disabled="true">
   <span aria-hidden="true" className="w1a-coop-icon">▦</span><span>تعاونی توسعه و عمران شهرستان نمونه</span><span aria-hidden="true">⌄</span>
  </div>
  <div className="w1a-global-user">
   <span className="w1a-header-icon" aria-label="پیام‌ها ـ غیرفعال"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></span>
   <span className="w1a-header-icon w1a-bell" aria-label="اعلان‌ها ـ غیرفعال"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg></span>
   <span className="w1a-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span>
   <div><strong>سهامدار نمونه</strong><small>پنل بازبینی · داده غیرعملیاتی</small></div>
  </div>
 </div>;
}





const MODES:readonly {id:Nav11Mode;label:string;description:string}[]=[
 {id:"UNVERIFIED",label:"تنظیمات معتبر دریافت نشده",description:"هیچ مشخصه، شماره تماس، نشست یا ترجیح واقعی حساب دریافت نشده است."},
 {id:"SOURCE_UNAVAILABLE",label:"منبع در دسترس نیست",description:"اختلال منبع به معنی خاموش بودن MFA یا نبود نشست فعال نیست."},
 {id:"ACCESS_DENIED",label:"دسترسی مجاز نیست",description:"تنظیمات حساس و عملیات احراز هویت فقط با مجوز سمت سرور قابل دستیابی‌اند."},
 {id:"DEMO_CONTENT",label:"نمونه کاملاً ساختگی",description:"ده نمونه تصویری ساختگی و غیرقابل ویرایش؛ هیچ تنظیمی ذخیره نمی‌شود."}
];
const GROUPS=[
 {label:"هویت و تماس",ids:["ACCOUNT","AVATAR","CONTACT"] as Nav11Section[]},
 {label:"ارتباط و حریم خصوصی",ids:["NOTICES","CHANNEL","PRIVACY"] as Nav11Section[]},
 {label:"امنیت و دسترسی",ids:["SECURITY","SESSIONS","OTP","SIGNOUT"] as Nav11Section[]}
];
export function SyntheticSettings(){
 const [mode,setMode]=useState<Nav11Mode>("UNVERIFIED");
 const [section,setSection]=useState<Nav11Section>("ACCOUNT");
 const [detail,setDetail]=useState(false);
 const catalog=useRef<HTMLElement>(null);
 const demo=mode==="DEMO_CONTENT";
 const selected=NAV11_SECTIONS.find(x=>x.id===section)!;
 const fixture=NAV11_FIXTURES.find(x=>x.section===section)!;
 function pick(value:Nav11Section){setSection(value);setDetail(false);requestAnimationFrame(()=>catalog.current?.scrollIntoView({block:"start"}));}
 return <main className="w1a-shell nav06-shell nav07-shell nav08-shell nav09-shell nav10-shell nav11-shell" dir="rtl" lang="fa" data-source-mode={mode}>
  <Sidebar/>
  <div className="w1a-frame nav06-frame">
   <Header/>
   <header className="w1a-page-heading"><div><h1>تنظیمات حساب</h1><p>نمای تنظیمات و امنیت حساب · تغییر واقعی تنها پس از پذیرش قرارداد سرور</p></div><span>W1 / NAV-11 · نسخه بازبینی</span></header>
   <section className="nav06-hero nav09-hero nav11-hero">
    <div className="nav06-hero-copy"><span className="nav06-hero-eyebrow">هویت، ارتباط و امنیت · نسخه آزمایشی</span>
     <h2>مدیریت حساب با کنترل مجوز مستقل</h2>
     <p>مشخصات حساب، اعلان‌ها، حریم خصوصی و نشست‌ها در یک مکان؛ این نمونه هیچ داده واقعی دریافت نمی‌کند و هیچ تغییر، خروج یا OTP واقعی انجام نمی‌دهد.</p>
     <button type="button" className="nav06-primary" onClick={()=>catalog.current?.scrollIntoView({block:"start"})}>مشاهده تنظیمات ←</button>
    </div>
    <div className="nav06-hero-art" aria-hidden="true"><div className="nav06-hero-card"><span>⚙</span><i/><i/><i/></div><div className="nav06-hero-badge">✦</div></div>
   </section>
   <section className="w1a-kpi-row nav06-kpi" aria-label="نمای وضعیت تنظیمات غیرعملیاتی">
    {([["اطلاعات حساب","ACCOUNT","♙","w1a-kpi-sky"],["ارتباط و اعلان‌ها","NOTICES","▣","w1a-kpi-lilac"],["حریم خصوصی","PRIVACY","◇","w1a-kpi-apricot"],["امنیت حساب","SECURITY","⚙","w1a-kpi-mint"]] as const).map(([label,id,icon,color])=><article key={id} className={"w1a-kpi "+color}>
     <span className="w1a-kpi-icon" aria-hidden="true">{icon}</span><div><h3>{label}</h3><strong>{demo?"نمونه":"—"}</strong><small>{demo?"فاقد اعتبار عملیاتی":"وضعیت واقعی نامعلوم"}</small></div>
    </article>)}
   </section>
   <section className="w1a-four-panels nav06-overview" aria-label="دسترسی سریع به تنظیمات">
    {(["ACCOUNT","CONTACT","NOTICES","SECURITY"] as const).map(id=>{const x=NAV11_SECTIONS.find(x=>x.id===id)!;return <article className="w1a-summary-panel" key={id}>
     <div className="w1a-panel-heading"><h3>{x.label}</h3><button type="button" onClick={()=>pick(id)}>مشاهده ←</button></div>
     <div className="nav06-none"><strong>—</strong><span>{demo?"مورد کاملاً فرضی و غیرقابل تغییر":"تنظیمات واقعی دریافت نشده است"}</span></div>
     <p className="w1a-panel-tip">فقط نمایش؛ هیچ تغییر حساب ثبت نمی‌شود.</p>
    </article>})}
   </section>
   <section className="w1a-actions-row nav06-shortcuts" aria-label="میانبرهای حساب">
    {(["ACCOUNT","PRIVACY","SESSIONS","OTP"] as const).map((id,index)=>{const x=NAV11_SECTIONS.find(x=>x.id===id)!;return <button type="button" key={id} className={"w1a-action "+(["w1a-action-blue","w1a-action-green","w1a-action-orange","w1a-action-purple"][index])} onClick={()=>pick(id)}>
     <span aria-hidden="true">⚙</span><div><strong>{x.label}</strong><small>نمای فقط‌خواندنی</small></div><span aria-hidden="true">←</span></button>})}
   </section>
   <section className="nav06-catalog" ref={catalog} id="nav11-section-catalog" aria-label="ده زیرمنوی مصوب تنظیمات حساب">
    <div className="nav06-title-row"><div><span>Navigation v1.0 · ساختار مصوب</span><h2>تنظیمات حساب</h2></div><small>۱۰ زیرمنوی رسمی</small></div>
    <div className="nav06-groups nav11-groups">{GROUPS.map(g=><div className="nav06-group" key={g.label}><h3>{g.label}</h3><div className="nav06-group-links">{g.ids.map(id=>{const x=NAV11_SECTIONS.find(x=>x.id===id)!;return <button type="button" key={id} aria-pressed={section===id} className={"nav06-section-button"+(section===id?" nav06-selected":"")} onClick={()=>pick(id)}>{x.label}</button>})}</div></div>)}</div>
    <div className="nav06-title-row nav06-content-title"><div><span>مالک قراردادی: {selected.owner} · اتصال عملیاتی مسدود</span><h2>{selected.label}</h2></div><span className="nav06-notice">{demo?"نمونه غیرواقعی":"داده تأیید نشده"}</span></div>
    <div className="nav11-mode-panel" aria-label="حالت منبع تنظیمات"><p>حالت بازبینی · پیش‌فرض بدون داده واقعی</p><div className="nav11-mode-buttons">{MODES.map(m=><button type="button" key={m.id} aria-pressed={mode===m.id} onClick={()=>{setMode(m.id);setDetail(false)}}>{m.label}</button>)}</div><p role="status">{MODES.find(x=>x.id===mode)!.description}</p></div>
    {demo?<article className="nav11-setting-card"><span className="nav06-tag">فقط اطلاعات کاملاً فرضی</span><h3>{fixture.title}</h3><p>{fixture.description}</p><div className="nav11-locked">🔒 ویرایش، ذخیره، پیامک، بارگذاری، خروج و تغییر MFA غیرفعال است</div>
     <button type="button" onClick={()=>setDetail(!detail)} aria-expanded={detail}>{detail?"بستن جزئیات":"مشاهده توضیحات نمایشی"}</button>
     {detail?<div className="nav11-details" role="region" aria-label="توضیح آزمایشی"><p>شناسه: {fixture.id} · وضعیت: {fixture.status}</p><p>هیچ User Account، Tenant، Party، Session، شماره تماس یا کلید امنیتی واقعی در این نمونه وجود ندارد.</p></div>:null}
    </article>:<div className="nav06-empty"><strong>—</strong><p>تا پذیرش منبع، مجوز سمت سرور و سیاست‌های امنیتی، تنظیمات حساب ارائه نمی‌شود.</p></div>}
   </section>
   <section className="nav11-guardrails" aria-label="محدودیت‌های امنیتی"><h2>قواعد قطعی تنظیمات حساب</h2><ul>{NAV11_GUARDS.map(x=><li key={x}>{x}</li>)}</ul></section>
  </div>
 </main>;
}
