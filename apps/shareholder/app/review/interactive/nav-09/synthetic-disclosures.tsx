"use client";
import {useRef,useState} from "react";
import {NAV09_FIXTURES,NAV09_RELEASE_GATES,NAV09_SECTIONS,type Nav09Section,type Nav09Mode} from "./disclosure-fixtures";
/** NAV09 review only: default-denied project disclosure and 18 explicit fictional fixtures. */
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
 ["▥","گزارش‌های من","/review/nav-10"],
 ["⚙","تنظیمات حساب","/review/nav-11"]
] as const;



const MODES:{id:Nav09Mode;label:string;description:string}[]=[
 {id:"UNVERIFIED",label:"منبع معتبر تأیید نشده",description:"گزارش‌ها و اسناد دارای مجوز انتشار هنوز احراز نشده‌اند. نامعلوم به معنی صفر نیست."},
 {id:"SOURCE_UNAVAILABLE",label:"منبع اسناد در دسترس نیست",description:"اختلال منبع به معنی ابطال سند، حذف گزارش یا تأیید دریافت نیست."},
 {id:"DEMO_CONTENT",label:"نمونه کاملاً ساختگی",description:"۱۶ رکورد فرضی برای بازبینی؛ هیچ صورت مالی یا ابلاغی ثبت نمی‌شود."}
];
const OVERVIEW:{id:Nav09Section;title:string;icon:string}[]=[
 {id:"FINANCIAL",title:"گزارش‌های مالی",icon:"▤"},
 {id:"BOARD",title:"گزارش هیئت‌مدیره",icon:"▣"},
 {id:"LEGAL",title:"اسناد قانونی",icon:"♜"},
 {id:"WARNINGS",title:"هشدارهای مهم شرکت",icon:"◇"}
];
const METRICS=[
 ["گزارش‌های مالی","FINANCIAL","▤","w1a-kpi-sky"],
 ["گزارش هیئت‌مدیره","BOARD","▣","w1a-kpi-lilac"],
 ["اسناد قانونی","LEGAL","♜","w1a-kpi-apricot"],
 ["هشدارهای مهم","WARNINGS","◇","w1a-kpi-mint"]
] as const;
const GROUPS=[
 {title:"شفافیت و گزارش‌ها",ids:["TRANSPARENCY","FINANCIAL","BOARD","AUDITOR"] as Nav09Section[]},
 {title:"اسناد و حقوق سهامدار",ids:["LEGAL","RIGHTS"] as Nav09Section[]},
 {title:"حریم خصوصی و هشدارها",ids:["PRIVACY","WARNINGS"] as Nav09Section[]}
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
   {ROOTS.map(([icon,label,href],index)=><a key={label} href={href} className={"w1a-side-link"+(index===8?" w1a-active":"")} aria-current={index===8?"page":undefined}>
    <span aria-hidden="true" className="w1a-side-icon">{icon}</span><span>{label}</span></a>)}
  </nav>
  <div className="w1a-sidebar-foot">پنل بازبینی · دریافت فایل و تأیید ابلاغ غیرفعال</div>
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



export function SyntheticDisclosures(){
 const [mode,setMode]=useState<Nav09Mode>("UNVERIFIED");
 const [diagnostics,setDiagnostics]=useState(false);
 const [section,setSection]=useState<Nav09Section>("TRANSPARENCY");
 const [query,setQuery]=useState("");
 const [detailId,setDetailId]=useState<string|null>(null);
 const detailRef=useRef<HTMLElement>(null),catalogRef=useRef<HTMLElement>(null);
 const demo=mode==="DEMO_CONTENT";
 const current=NAV09_SECTIONS.find(x=>x.id===section)!;
 const items=demo?NAV09_FIXTURES.filter(x=>x.section===section&&(x.title.includes(query.trim())||x.summary.includes(query.trim())||x.id.includes(query.trim()))):[];
 const detail=demo?NAV09_FIXTURES.find(x=>x.id===detailId&&x.section===section):undefined;
 function navigate(next:Nav09Section,id?:string){
  setSection(next);setDetailId(id??null);setQuery("");
  requestAnimationFrame(()=>catalogRef.current?.scrollIntoView({block:"start"}));
 }
 function open(id:string){setDetailId(id);requestAnimationFrame(()=>{detailRef.current?.focus();detailRef.current?.scrollIntoView({block:"nearest"});});}
 function switchMode(next:Nav09Mode){setMode(next);setDetailId(null);setQuery("");}
 return <main className="w1a-shell nav06-shell nav07-shell nav08-shell nav09-shell" dir="rtl" lang="fa" data-source-mode={mode}>
  <Sidebar/>
  <div className="w1a-frame nav06-frame">
   <Header/>
   <header className="w1a-page-heading"><div><h1>شفافیت و اسناد شرکت</h1><p>گزارش‌های قانونی و مالی قابل انتشار، حقوق سهامدار و هشدارها</p></div><span>W1 / NAV-09 · نسخه بازبینی</span></header>
   <section className="nav06-hero nav09-hero" aria-label="معرفی مرکز شفافیت">
    <div className="nav06-hero-copy"><span className="nav06-hero-eyebrow">ریسک و شفافیت · نسخه کاملاً آزمایشی</span>
     <h2>گزارش‌ها و اسناد فقط با مجوز انتشار معتبر</h2>
     <p>اصل گزارش، منبع، دوره، نسخه و دامنه دسترسی باید تأیید شوند. پلتفرم دفترکل حسابداری شرکت نیست.</p>
     <button type="button" className="nav06-primary" onClick={()=>navigate("TRANSPARENCY")} aria-controls="nav09-section-catalog">مشاهده نمونه‌ها ←</button>
    </div>
    <div className="nav06-hero-art" aria-hidden="true"><div className="nav06-hero-card"><span>▤</span><i/><i/><i/></div><div className="nav06-hero-badge">✦</div></div>
   </section>
   <section className="w1a-kpi-row nav06-kpi" aria-label="خلاصه ساختگی شفافیت و اسناد">
    {METRICS.map(([label,id,icon,color])=><article key={id} className={"w1a-kpi "+color}>
     <span className="w1a-kpi-icon" aria-hidden="true">{icon}</span>
     <div><h3>{label}</h3><strong>{demo?NAV09_FIXTURES.filter(x=>x.section===id).length.toLocaleString("fa-IR"):"—"}</strong>
      <small>{demo?"شمارش موارد کاملاً فرضی":"وضعیت واقعی نامعلوم"}</small></div>
    </article>)}
   </section>
   <section className="w1a-four-panels nav06-overview" aria-label="چهار پنل شفافیت و اسناد">
    {OVERVIEW.map(card=>{const examples=demo?NAV09_FIXTURES.filter(x=>x.section===card.id).slice(0,3):[];
     return <article key={card.id} className="w1a-summary-panel">
      <div className="w1a-panel-heading"><h3>{card.title}</h3><button type="button" onClick={()=>navigate(card.id)}>مشاهده همه ←</button></div>
      {examples.length?examples.map(item=><button type="button" className="nav06-preview-item" key={item.id} onClick={()=>navigate(item.section,item.id)}>
       <span className="w1a-file-icon" aria-hidden="true">{card.icon}</span>
       <span><strong>{item.title}</strong><small>{item.status} · نمونه فرضی</small></span>
      </button>):<div className="nav06-none"><strong>—</strong><span>اطلاعات دارای مجوز افشا دریافت نشده است</span></div>}
      <p className="w1a-panel-tip">انتشار نیازمند منبع معتبر، نسخه و مجوز افشا است.</p>
     </article>;})}
   </section>
   <section className="w1a-actions-row nav06-shortcuts" aria-label="میانبرهای شفافیت">
    {([
      ["FINANCIAL","گزارش‌های مالی","بسته مالی با منبع رسمی","▤","w1a-action-blue"],
      ["BOARD","گزارش هیئت‌مدیره","نسخه و تأیید انتشار","▣","w1a-action-green"],
      ["LEGAL","اسناد قانونی","اسناد مجاز به افشا","♜","w1a-action-orange"],
      ["WARNINGS","هشدارهای مهم شرکت","ابلاغ ≠ تأیید دریافت","◇","w1a-action-purple"]
    ] as const).map(([id,title,description,icon,color])=><button type="button" className={"w1a-action "+color} key={id} onClick={()=>navigate(id)}>
      <span aria-hidden="true">{icon}</span><div><strong>{title}</strong><small>{description}</small></div><span aria-hidden="true">←</span>
    </button>)}
   </section>
   <section className="nav06-catalog" id="nav09-section-catalog" ref={catalogRef} aria-label="هشت زیرمنوی رسمی شفافیت و اسناد">
    <div className="nav06-title-row"><div><span>Navigation v1.0 · فقط داده مجاز به افشا</span><h2>شفافیت و اسناد شرکت</h2></div><small>۸ زیرمنوی رسمی</small></div>
    <div className="nav06-groups">{GROUPS.map(g=><div key={g.title} className="nav06-group"><h3>{g.title}</h3><div className="nav06-group-links">
     {g.ids.map(id=>{const x=NAV09_SECTIONS.find(s=>s.id===id)!;return <button key={id} type="button" aria-pressed={section===id}
       className={"nav06-section-button"+(section===id?" nav06-selected":"")} onClick={()=>navigate(id)}>{x.label}</button>;})}
    </div></div>)}</div>
    <div className="nav06-title-row nav06-content-title"><div><span>مالک داده: {current.owner} · منبع و نسخه در انتظار تأیید</span><h2>{current.label}</h2></div>
     <span className="nav06-notice">{demo?"صرفاً داده فرضی":"منبع و مجوز افشا تأیید نشده"}</span></div>
    {demo?<div className="nav06-search"><label htmlFor="nav09-search">جست‌وجو در اسناد فرضی</label>
     <input id="nav09-search" type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder="نام گزارش یا سند نمونه..." />
     <span>{items.length.toLocaleString("fa-IR")} مورد فرضی</span></div>:
     <div className="nav06-empty" role="status"><strong>—</strong><p>{mode==="UNVERIFIED"?
      "اطلاعات و گزارش‌های دارای مجوز انتشار هنوز تأیید نشده‌اند.":
      "منبع اسناد در دسترس نیست؛ اصالت، انتشار و ابلاغ واقعی نامعلوم است."}</p></div>}
    {demo?<div className="nav06-grid">{items.length?items.map(item=><article key={item.id} className="nav06-tile">
      <span className="nav06-tag">{item.label}</span><h3>{item.title}</h3><p>{item.summary}</p>
      <div className="nav06-tile-foot"><small>شناسه ساختگی: {item.id}</small><span>{item.status}</span></div>
      <button type="button" onClick={()=>open(item.id)} aria-controls="nav09-details" aria-expanded={detailId===item.id}>مشاهده جزئیات نمونه ←</button>
     </article>):<p className="nav06-no-search">نمونه‌ای با این عبارت یافت نشد.</p>}</div>:null}
    <section id="nav09-details" className="w1a-public-details nav06-details" ref={detailRef} tabIndex={-1} hidden={!detail} aria-label="جزئیات فقط خواندنی">
     {detail?<><div className="w1a-public-details-head"><div><span className="w1a-label">نمایشی و فاقد اعتبار قانونی و مالی</span>
      <h2>{detail.title}</h2><p>{detail.status}</p></div>
      <button type="button" className="w1a-public-close" onClick={()=>setDetailId(null)}>بستن جزئیات</button></div>
      <p>{detail.summary}</p><dl className="nav06-fields">
       <div><dt>دامنه مالک</dt><dd>{detail.owner}</dd></div>
       <div><dt>شناسه نمونه</dt><dd dir="ltr">{detail.id}</dd></div>
       <div><dt>مجوز افشا</dt><dd>تأیید نشده</dd></div>
       <div><dt>منبع و اصالت سند</dt><dd>نامعلوم؛ اثبات نشده</dd></div>
       <div><dt>دوره و نسخه گزارش</dt><dd>نامعلوم و غیرقابل استناد</dd></div>
       <div><dt>اثر حقوقی و مالی</dt><dd>هیچ عملیات واقعی انجام نمی‌شود</dd></div>
      </dl><div className="nav06-disabled">
       <button type="button" disabled>دریافت PDF (غیرفعال)</button>
       <button type="button" disabled>تأیید دریافت ابلاغ (غیرفعال)</button>
       <button type="button" disabled>ویرایش سند (غیرفعال)</button>
       <button type="button" disabled>ثبت اعتراض (غیرفعال)</button>
      </div><p className="nav06-warning">ارسال اعلان، مطالعه و تأیید دریافت سه رویداد متفاوت‌اند.</p>
     </>:null}
    </section>
    <section className="nav06-submit-guard"><h3>دریافت گزارش و تأیید ابلاغ</h3>
     <p>این صفحه فقط پیش‌نمایش است؛ اطلاعات مالی، اسناد مالکیت، اشتغال یا گزارش اثرگذاری واقعی ارسال یا تأیید نمی‌کند.</p>
     <div><button type="button" disabled>درخواست سند (غیرفعال)</button>
      <button type="button" disabled>دریافت PDF (غیرفعال)</button>
      <button type="button" disabled>درخواست سرمایه‌گذاری (غیرفعال)</button></div>
    </section>
   </section>
   <section className="w1a-review-toolbox nav06-tools" aria-label="ابزار بازبینی توسعه‌دهنده">
    <button type="button" className="w1a-review-tools-toggle" aria-expanded={diagnostics} aria-controls="nav09-review-panels"
     onClick={()=>setDiagnostics(!diagnostics)}>{diagnostics?"بستن ابزارهای بررسی":"ابزار بررسی توسعه‌دهنده"}<span aria-hidden="true">{diagnostics?"⌃":"⌄"}</span></button>
    <div id="nav09-review-panels" className="w1a-review-detail-panels" hidden={!diagnostics}>
     <section className="w1a-mode-section"><h2>وضعیت منبع اسناد و افشای شرکت</h2>
      <div className="w1a-mode-controls" role="group" aria-label="انتخاب حالت منبع">
       {MODES.map(x=><button type="button" key={x.id} aria-pressed={mode===x.id} className={"w1a-choice"+(mode===x.id?" w1a-choice-active":"")} onClick={()=>switchMode(x.id)}>{x.label}</button>)}
      </div><p role="status" aria-live="polite" className={"w1a-message"+(demo?" w1a-message-demo":"")}>{MODES.find(x=>x.id===mode)?.description}</p>
     </section>
     <section className="w1a-gates"><h2>شرایط مستقل راه‌اندازی واقعی</h2><ol>{NAV09_RELEASE_GATES.map(g=><li key={g}>{g}</li>)}</ol></section>
     <p className="w1a-guard"><strong>مرز حقوقی:</strong> ثبت پروژه ≠ مالکیت/مجوز؛ ارقام مالی به معنای حسابداری یا تضمین سود نیستند؛ فعالیت ≠ اثرگذاری؛ ابراز علاقه ≠ قرارداد.</p>
    </div>
   </section>
   <footer className="w1a-footer nav06-footer">W1 · NAV-09 | نمایش ساختگی؛ دریافت سند و تأیید ابلاغ واقعی غیرفعال است.</footer>
  </div>
 </main>;
}
