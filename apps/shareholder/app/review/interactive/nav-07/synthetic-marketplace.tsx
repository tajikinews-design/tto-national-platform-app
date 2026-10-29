"use client";
import {useRef,useState} from "react";
import {NAV07_FIXTURES,NAV07_RELEASE_GATES,NAV07_SECTIONS,type Nav07Section,type Nav07Mode} from "./market-fixtures";
/** Review-only static sample. No live catalog, payment, order, proposal or application. */
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
 ["⚙","تنظیمات حساب","/review/nav-11"]
] as const;


const MODES:{id:Nav07Mode;label:string;description:string}[]=[
 {id:"UNVERIFIED",label:"منبع معتبر تأیید نشده",description:"محصول، فروشنده، قیمت، سفارش، پرداخت و فرصت معتبر تأیید نشده‌اند. «نامعلوم» به معنی صفر سفارش یا نبود فرصت نیست."},
 {id:"SOURCE_UNAVAILABLE",label:"منبع بازار در دسترس نیست",description:"از دسترس خارج‌شدن منبع، نشانه لغو سفارش، بازگشت وجه یا تکمیل تحویل نیست؛ وضعیت واقعی نامعلوم است."},
 {id:"DEMO_CONTENT",label:"نمونه کاملاً ساختگی",description:"۱۵ مورد کاملاً فرضی برای آزمایش رابط؛ هیچ سفارش، پرداخت، معرفی محصول یا درخواست واقعی ثبت نمی‌شود."}
];
const OVERVIEW:{id:Nav07Section;title:string;icon:string}[]=[
 {id:"COOP_PRODUCTS",title:"محصولات شرکت",icon:"▣"},
 {id:"MY_ORDERS",title:"سفارش‌های من",icon:"▤"},
 {id:"SPECIAL",title:"پیشنهادهای ویژه",icon:"✦"},
 {id:"OPPORTUNITIES",title:"فرصت‌های کسب‌وکار",icon:"◇"}
];
const METRICS=[
 ["محصولات شرکت","COOP_PRODUCTS","▣","w1a-kpi-sky"],
 ["سفارش‌های من","MY_ORDERS","▤","w1a-kpi-lilac"],
 ["پیشنهادهای ویژه","SPECIAL","✦","w1a-kpi-apricot"],
 ["فرصت‌های کسب‌وکار","OPPORTUNITIES","◇","w1a-kpi-mint"]
] as const;
const GROUPS=[
 {title:"فروشگاه و بازار ملی",ids:["STORE","COOP_PRODUCTS","NATIONAL","OTHER_COOPS","SPECIAL"] as Nav07Section[]},
 {title:"سفارش و تحویل",ids:["MY_ORDERS","PAY_ORDER","DELIVERY"] as Nav07Section[]},
 {title:"مشارکت اقتصادی",ids:["SUGGEST","OPPORTUNITIES"] as Nav07Section[]}
];
function Sidebar(){
 const [expanded,setExpanded]=useState(false);
 return <aside className={"w1a-sidebar"+(expanded?" w1a-mobile-menu-open":"")} aria-label="منوی پنل سهامدار" onKeyDown={event=>{if(event.key==="Escape")setExpanded(false);}}>
  <div className="w1a-brand">
   <span className="w1a-brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" width="44" height="44" focusable="false"><path d="M26 4C34 4 42 2 45 0v19c-7 3-12 9-17 14L26 4Z" fill="#204a81"/><path d="M22 4C13 4 6 7 2 12v12c7 0 13 4 20 10V4Z" fill="#19b6bc"/><path d="M2 27c8-2 14 2 20 9v12C13 44 7 42 2 36V27Z" fill="#22ad78"/><path d="M26 37c5-10 12-14 19-16v13c-4 8-10 12-19 14V37Z" fill="#0a69ab"/></svg></span>
   <div><strong>پلتفرم ملی تعاونی توسعه و عمران</strong><small>شبکه هوشمند خدمات و راهبری تعاونی‌ها</small></div>
  </div>
  <button type="button" className="w1a-mobile-menu-toggle" aria-controls="w1a-side-nav" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><span aria-hidden="true">☰</span>بخش‌های پنل</button>
  <nav id="w1a-side-nav" className="w1a-side-links" aria-label="یازده بخش مصوب پنل">
   {ROOTS.map(([icon,label,href],index)=><a key={label} href={href} className={"w1a-side-link"+(index===6?" w1a-active":"")} aria-current={index===6?"page":undefined}>
    <span aria-hidden="true" className="w1a-side-icon">{icon}</span><span>{label}</span></a>)}
  </nav>
  <div className="w1a-sidebar-foot">پنل بازبینی · سفارش، پرداخت و درخواست واقعی غیرفعال</div>
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


export function SyntheticMarketplace(){
 const [mode,setMode]=useState<Nav07Mode>("UNVERIFIED");
 const [diagnostics,setDiagnostics]=useState(false);
 const [section,setSection]=useState<Nav07Section>("STORE");
 const [query,setQuery]=useState("");
 const [detailId,setDetailId]=useState<string|null>(null);
 const detailRef=useRef<HTMLElement>(null),catalogRef=useRef<HTMLElement>(null);
 const demo=mode==="DEMO_CONTENT";
 const current=NAV07_SECTIONS.find(x=>x.id===section)!;
 const items=demo?NAV07_FIXTURES.filter(x=>x.section===section&&
   (x.title.includes(query.trim())||x.summary.includes(query.trim())||x.id.includes(query.trim()))):[];
 const detail=demo?NAV07_FIXTURES.find(x=>x.id===detailId&&x.section===section):undefined;
 function navigate(next:Nav07Section,id?:string){
  setSection(next);setDetailId(id??null);setQuery("");
  requestAnimationFrame(()=>catalogRef.current?.scrollIntoView({block:"start"}));
 }
 function open(id:string){
  setDetailId(id);requestAnimationFrame(()=>{detailRef.current?.focus();detailRef.current?.scrollIntoView({block:"nearest"});});
 }
 function switchMode(next:Nav07Mode){setMode(next);setDetailId(null);setQuery("");}
 return <main className="w1a-shell nav06-shell nav07-shell" dir="rtl" lang="fa" data-source-mode={mode}>
  <Sidebar/>
  <div className="w1a-frame nav06-frame">
   <Header/>
   <header className="w1a-page-heading"><div><h1>فروشگاه و فرصت‌ها</h1><p>بازار کالا و خدمات تعاونی‌ها، سفارش‌ها و فرصت‌های کسب‌وکار سهامداران</p></div><span>W1 / NAV-07 · نسخه بازبینی</span></header>
   <section className="nav06-hero nav07-hero" aria-label="معرفی بازار و وضعیت انتشار">
    <div className="nav06-hero-copy"><span className="nav06-hero-eyebrow">کسب‌وکار و بازار · نسخه کاملاً آزمایشی</span>
     <h2>محصولات تعاونی‌ها و فرصت‌های همکاری در یک نگاه</h2>
     <p>خرید کالا یا خدمت با بازار سهام تفاوت دارد. فروشنده طرف معامله در نسخه اولیه، تعاونی واجد شرایط است؛ پیشنهاد محصول سهامدار به معنی مجوز عرضه نیست.</p>
     <button type="button" className="nav06-primary" onClick={()=>navigate("STORE")} aria-controls="nav07-section-catalog">مشاهده نمونه فروشگاه ←</button>
    </div>
    <div className="nav06-hero-art" aria-hidden="true"><div className="nav06-hero-card"><span>▣</span><i/><i/><i/></div><div className="nav06-hero-badge">✦</div></div>
   </section>
   <section className="w1a-kpi-row nav06-kpi" aria-label="خلاصه ساختگی بازار">
    {METRICS.map(([label,id,icon,color])=><article key={id} className={"w1a-kpi "+color}>
      <span className="w1a-kpi-icon" aria-hidden="true">{icon}</span>
      <div><h3>{label}</h3><strong>{demo?NAV07_FIXTURES.filter(x=>x.section===id).length.toLocaleString("fa-IR"):"—"}</strong>
       <small>{demo?"شمارش موارد صرفاً ساختگی":"وضعیت واقعی نامعلوم"}</small></div>
     </article>)}
   </section>
   <section className="w1a-four-panels nav06-overview" aria-label="چهار پنل اصلی بازار">
    {OVERVIEW.map(card=>{const examples=demo?NAV07_FIXTURES.filter(x=>x.section===card.id).slice(0,3):[];
     return <article className="w1a-summary-panel" key={card.id}>
      <div className="w1a-panel-heading"><h3>{card.title}</h3><button type="button" onClick={()=>navigate(card.id)}>مشاهده همه ←</button></div>
      {examples.length?examples.map(item=><button type="button" key={item.id} className="nav06-preview-item" onClick={()=>navigate(item.section,item.id)}>
       <span className="w1a-file-icon" aria-hidden="true">{card.icon}</span>
       <span><strong>{item.title}</strong><small>{item.status} · فقط نمونه</small></span></button>):
       <div className="nav06-none"><strong>—</strong><span>اطلاعات دارای مجوز انتشار موجود نیست</span></div>}
      <p className="w1a-panel-tip">نمایش واقعی نیازمند احراز منبع، فروشنده و دسترسی است.</p>
     </article>;})}
   </section>
   <section className="w1a-actions-row nav06-shortcuts" aria-label="میانبرهای بازار">
    {([
     ["STORE","فروشگاه","کالا و خدمات تعاونی‌ها","▣","w1a-action-blue"],
     ["MY_ORDERS","سفارش‌های من","فقط با احراز صاحب سفارش","▤","w1a-action-green"],
     ["SUGGEST","معرفی محصول من","پیشنهاد، نه آگهی فروش","◇","w1a-action-orange"],
     ["OPPORTUNITIES","فرصت‌های کسب‌وکار","همکاری و درخواست‌های مجاز","✦","w1a-action-purple"]
    ] as const).map(([id,title,description,icon,color])=><button type="button" className={"w1a-action "+color} key={id} onClick={()=>navigate(id)}>
     <span aria-hidden="true">{icon}</span><div><strong>{title}</strong><small>{description}</small></div><span aria-hidden="true">←</span>
    </button>)}
   </section>
   <section className="nav06-catalog" id="nav07-section-catalog" ref={catalogRef} aria-label="ده زیرمنوی رسمی فروشگاه و فرصت‌ها">
    <div className="nav06-title-row"><div><span>Navigation v1.0 · بازار کالا و خدمات، نه بازار سهام</span><h2>فروشگاه و فرصت‌های من</h2></div><small>۱۰ زیرمنوی رسمی</small></div>
    <div className="nav06-groups">
     {GROUPS.map(g=><div className="nav06-group" key={g.title}><h3>{g.title}</h3><div className="nav06-group-links">
      {g.ids.map(id=>{const item=NAV07_SECTIONS.find(x=>x.id===id)!;return <button type="button" key={id} aria-pressed={section===id}
       className={"nav06-section-button"+(section===id?" nav06-selected":"")} onClick={()=>navigate(id)}>{item.label}</button>;})}
     </div></div>)}
    </div>
    <div className="nav06-title-row nav06-content-title"><div><span>مرجع دامنه: {current.owner} · {current.type}</span><h2>{current.label}</h2></div>
      <span className="nav06-notice">{demo?"اطلاعات کاملاً ساختگی":"مجوز انتشار و اهلیت تأیید نشده"}</span></div>
    {demo?<div className="nav06-search"><label htmlFor="nav07-search">جست‌وجو در موارد نمونه</label>
     <input id="nav07-search" type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)}
      placeholder="جست‌وجوی نام کالا یا فرصت آزمایشی..." /><span>{items.length.toLocaleString("fa-IR")} نمونه</span></div>:
     <div className="nav06-empty" role="status"><strong>—</strong><p>{mode==="UNVERIFIED"?
      "فروشنده، قیمت، سفارش و فرصت دارای مجوز انتشار هنوز تأیید نشده‌اند.":
      "منبع بازار در دسترس نیست؛ وضعیت سفارش و پرداخت واقعی نامعلوم است."}</p></div>}
    {demo?<div className="nav06-grid">{items.length?items.map(item=><article className="nav06-tile" key={item.id}>
      <span className="nav06-tag">{item.label}</span><h3>{item.title}</h3><p>{item.summary}</p>
      <div className="nav06-tile-foot"><small>{item.syntheticMeta}</small><span>{item.status}</span></div>
      <button type="button" onClick={()=>open(item.id)} aria-controls="nav07-details" aria-expanded={detailId===item.id}>مشاهده جزئیات نمونه ←</button>
     </article>):<p className="nav06-no-search">هیچ مورد نمونه‌ای با این عبارت پیدا نشد.</p>}</div>:null}
    <section id="nav07-details" className="w1a-public-details nav06-details" ref={detailRef} tabIndex={-1} hidden={!detail} aria-label="جزئیات فقط‌خواندنی">
     {detail?<><div className="w1a-public-details-head"><div><span className="w1a-label">فقط نمونه · فاقد اعتبار خرید، پرداخت یا مشارکت</span>
      <h2>{detail.title}</h2><p>{detail.syntheticMeta}</p></div>
      <button type="button" className="w1a-public-close" onClick={()=>setDetailId(null)}>بستن جزئیات</button></div>
      <p>{detail.summary}</p><dl className="nav06-fields">
       <div><dt>مالک داده</dt><dd>{detail.owner}</dd></div>
       <div><dt>شناسه ساختگی</dt><dd dir="ltr">{detail.id}</dd></div>
       <div><dt>اهلیت</dt><dd>تأییدنشده</dd></div>
       <div><dt>تاریخ/قیمت</dt><dd>غیرقابل‌استناد</dd></div>
       <div><dt>وضعیت</dt><dd>{detail.status}</dd></div>
       <div><dt>اثر مالی/حقوقی</dt><dd>هیچ عملیات واقعی انجام نمی‌شود</dd></div>
      </dl><div className="nav06-disabled">
       <button type="button" disabled>ثبت سفارش (غیرفعال)</button>
       <button type="button" disabled>پرداخت (غیرفعال)</button>
       <button type="button" disabled>معرفی محصول (غیرفعال)</button>
       <button type="button" disabled>درخواست همکاری (غیرفعال)</button>
      </div>
      <p className="nav06-warning">معرفی محصول ≠ عرضه فروش؛ درخواست همکاری ≠ قرارداد؛ پرداخت گزارش‌شده ≠ تأیید قطعی سفارش؛ بازار کالا ≠ بازار سهام.</p>
     </>:null}
    </section>
    <section className="nav06-submit-guard"><h3>سفارش، پرداخت و معرفی محصول</h3>
     <p>این نسخه فقط پیش‌نمایش است. هیچ مبلغی دریافت، سفارش یا درخواست واقعی ارسال، قیمت قطعی نمایش یا محصولی از سوی سهامدار منتشر نمی‌شود.</p>
     <div><button type="button" disabled>ثبت سفارش (غیرفعال)</button>
      <button type="button" disabled>پرداخت سفارش (غیرفعال)</button>
      <button type="button" disabled>ثبت پیشنهاد فروشندگی (غیرفعال)</button></div>
    </section>
   </section>
   <section className="w1a-review-toolbox nav06-tools" aria-label="ابزار بازبینی توسعه‌دهنده">
    <button type="button" className="w1a-review-tools-toggle" aria-expanded={diagnostics} aria-controls="nav07-review-panels"
      onClick={()=>setDiagnostics(!diagnostics)}>{diagnostics?"بستن ابزارهای بررسی":"ابزار بررسی توسعه‌دهنده"}<span aria-hidden="true">{diagnostics?"⌃":"⌄"}</span></button>
    <div id="nav07-review-panels" className="w1a-review-detail-panels" hidden={!diagnostics}>
     <section className="w1a-mode-section"><h2>وضعیت منبع بازار برای بازبینی</h2>
      <div className="w1a-mode-controls" role="group" aria-label="انتخاب حالت منبع">{MODES.map(x=><button type="button" key={x.id}
        aria-pressed={mode===x.id} className={"w1a-choice"+(mode===x.id?" w1a-choice-active":"")} onClick={()=>switchMode(x.id)}>{x.label}</button>)}</div>
      <p role="status" aria-live="polite" className={"w1a-message"+(demo?" w1a-message-demo":"")}>{MODES.find(x=>x.id===mode)?.description}</p>
     </section>
     <section className="w1a-gates"><h2>شرایط مستقل راه‌اندازی واقعی</h2><ol>{NAV07_RELEASE_GATES.map(g=><li key={g}>{g}</li>)}</ol></section>
     <p className="w1a-guard"><strong>حدود حقوقی:</strong> کاتالوگ کالا ≠ بازار سهام؛ پیشنهاد عضو ≠ عرضه کالا؛ سفارش ≠ پرداخت تأییدشده؛ ابراز علاقه ≠ قرارداد. عملیات واقعی همچنان غیرفعال‌اند.</p>
    </div>
   </section>
   <footer className="w1a-footer nav06-footer">W1 · NAV-07 | نمونه غیرعملیاتی؛ خرید، پرداخت، تحویل، معرفی محصول و درخواست همکاری واقعی غیرفعال است.</footer>
  </div>
 </main>;
}
