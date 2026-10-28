"use client";
import {useRef,useState} from "react";
import {NAV06_FIXTURES,NAV06_RELEASE_GATES,NAV06_SECTIONS,type Nav06Section,type Nav06Mode} from "./services-fixtures";

/** NAV06 specializes the same approved NAV04/NAV05 UI shell; all data is fake.
 * No network, form, identity, booking, payment, voucher redemption or certification.
 */
const ROOTS=[
 ["⌂","داشبورد","/review/interactive"],
 ["♙","سهام و عضویت من","/review/interactive/nav-02"],
 ["▥","خرید و فروش سهام","/review/interactive/nav-03"],
 ["♜","مجامع و انتخابات","/review/interactive/nav-04"],
 ["▣","اخبار و ارتباط با شرکت","/review/interactive/nav-05"],
 ["⚙","خدمات من","/review/interactive/nav-06"],
 ["▣","فروشگاه و فرصت‌ها","/review/nav-07"],
 ["▤","پروژه‌های شرکت","/review/nav-08"],
 ["◇","شفافیت و اسناد شرکت","/review/nav-09"],
 ["▥","گزارش‌های من","/review/nav-10"],
 ["⚙","تنظیمات حساب","/review/nav-11"]
] as const;

const MODES:{id:Nav06Mode;label:string;description:string}[]=[
 {id:"UNVERIFIED",label:"منبع معتبر تأیید نشده",description:"خدمات، اهلیت، رزروها، گواهی‌ها و مزایای واقعی قابل نمایش نیستند. وضعیت نامعلوم به معنی صفر خدمت یا نبود استحقاق نیست."},
 {id:"SOURCE_UNAVAILABLE",label:"منبع خدمات در دسترس نیست",description:"اختلال منبع یا نشست به معنی لغو رزرو، تکمیل دوره یا انقضای ووچر نیست؛ هیچ مقدار یا حکم جایگزین ساخته نمی‌شود."},
 {id:"DEMO_CONTENT",label:"نمونه کاملاً ساختگی",description:"۱۶ رکورد فرضی صرفاً برای بازبینی چیدمان و تعامل. هیچ خدمت، درخواست، کلاس، رزرو، گواهی یا ووچری ثبت یا صادر نمی‌شود."}
];
const OVERVIEW:{id:Nav06Section;title:string;icon:string}[]=[
 {id:"REQUESTS",title:"درخواست‌های خدمات من",icon:"▣"},
 {id:"MY_COURSES",title:"دوره‌های آموزشی من",icon:"▤"},
 {id:"BOOKINGS",title:"رزروها و رویدادهای من",icon:"◷"},
 {id:"BENEFITS",title:"مزایا و استحقاق‌های من",icon:"◇"}
];
const METRICS=[["درخواست‌های من","REQUESTS","▣","w1a-kpi-sky"],["دوره‌های من","MY_COURSES","▤","w1a-kpi-lilac"],
 ["رزروهای من","BOOKINGS","◷","w1a-kpi-apricot"],["مزایای من","BENEFITS","◇","w1a-kpi-mint"]] as const;
const GROUPS=[
 {title:"دسترسی به خدمات و درخواست‌ها",ids:["SERVICES","REQUESTS","COMPANY"] as Nav06Section[]},
 {title:"آموزش و تجربه",ids:["ACADEMY","MY_COURSES","EVENTS","BOOKINGS","CERTIFICATES"] as Nav06Section[]},
 {title:"مزایا و برنامه شخصی",ids:["BENEFITS","VOUCHERS","CALENDAR"] as Nav06Section[]}
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
   {ROOTS.map(([icon,label,href],index)=><a key={label} href={href} className={"w1a-side-link"+(index===5?" w1a-active":"")} aria-current={index===5?"page":undefined}>
    <span aria-hidden="true" className="w1a-side-icon">{icon}</span><span>{label}</span></a>)}
  </nav>
  <div className="w1a-sidebar-foot">پنل بازبینی · ثبت خدمت، رزرو و صدور گواهی واقعی غیرفعال</div>
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

export function SyntheticServices(){
 const [mode,setMode]=useState<Nav06Mode>("UNVERIFIED");
 const [diagnostics,setDiagnostics]=useState(false);
 const [section,setSection]=useState<Nav06Section>("SERVICES");
 const [query,setQuery]=useState("");
 const [detailId,setDetailId]=useState<string|null>(null);
 const detailRef=useRef<HTMLElement>(null),catalogRef=useRef<HTMLElement>(null);
 const demo=mode==="DEMO_CONTENT";
 const current=NAV06_SECTIONS.find(x=>x.id===section)!;
 const items=demo?NAV06_FIXTURES.filter(x=>x.section===section&&
   (x.title.includes(query.trim())||x.summary.includes(query.trim())||x.id.includes(query.trim()))):[];
 const detail=demo?NAV06_FIXTURES.find(x=>x.id===detailId&&x.section===section):undefined;
 function navigate(next:Nav06Section,id?:string){
  setSection(next);setDetailId(id??null);setQuery("");
  requestAnimationFrame(()=>catalogRef.current?.scrollIntoView({block:"start"}));
 }
 function open(id:string){
  setDetailId(id);
  requestAnimationFrame(()=>{detailRef.current?.focus();detailRef.current?.scrollIntoView({block:"nearest"});});
 }
 function switchMode(next:Nav06Mode){setMode(next);setDetailId(null);setQuery("");}
 return <main className="w1a-shell nav06-shell" dir="rtl" lang="fa" data-source-mode={mode}>
  <Sidebar/>
  <div className="w1a-frame nav06-frame">
   <Header/>
   <header className="w1a-page-heading"><div><h1>خدمات من</h1><p>دسترسی به خدمات تعاونی، آموزش، رویدادها، رزروها و مزایای اعضا</p></div><span>W1 / NAV-06 · نسخه بازبینی</span></header>
   <section className="nav06-hero" aria-label="معرفی خدمات و وضعیت انتشار">
    <div className="nav06-hero-copy"><span className="nav06-hero-eyebrow">مرکز خدمات سهامداران · نسخه کاملاً آزمایشی</span>
     <h2>خدمات، آموزش و مزایای عضویت در یک نگاه</h2>
     <p>خدمات واقعی تنها پس از احراز هویت، عضویت، اهلیت، مرجع تصویب‌شده و محدوده تعاونی نمایش داده می‌شوند. این صفحه فعلاً صرفاً پیش‌نمایش طراحی است.</p>
     <button type="button" className="nav06-primary" onClick={()=>navigate("SERVICES")} aria-controls="nav06-section-catalog">مشاهده خدمات نمونه ←</button>
    </div>
    <div className="nav06-hero-art" aria-hidden="true"><div className="nav06-hero-card"><span>▤</span><i/><i/><i/></div><div className="nav06-hero-badge">✦</div></div>
   </section>
   <section className="w1a-kpi-row nav06-kpi" aria-label="خلاصه خدمات و وضعیت‌ها">
    {METRICS.map(([label,id,icon,color])=><article key={id} className={"w1a-kpi "+color}><span className="w1a-kpi-icon" aria-hidden="true">{icon}</span>
     <div><h3>{label}</h3><strong>{demo?NAV06_FIXTURES.filter(x=>x.section===id).length.toLocaleString("fa-IR"):"—"}</strong><small>{demo?"تعداد صرفاً ساختگی":"وضعیت واقعی نامعلوم"}</small></div>
    </article>)}
   </section>
   <section className="w1a-four-panels nav06-overview" aria-label="چهار پنل اصلی خدمات">
    {OVERVIEW.map(card=>{const examples=demo?NAV06_FIXTURES.filter(x=>x.section===card.id).slice(0,3):[];
     return <article className="w1a-summary-panel" key={card.id}>
      <div className="w1a-panel-heading"><h3>{card.title}</h3><button type="button" onClick={()=>navigate(card.id)}>مشاهده همه ←</button></div>
      {examples.length?examples.map(x=><button type="button" className="nav06-preview-item" key={x.id} onClick={()=>navigate(x.section,x.id)}>
       <span className="w1a-file-icon" aria-hidden="true">{card.icon}</span><span><strong>{x.title}</strong><small>{x.sampleState} · فقط نمونه</small></span>
      </button>):<div className="nav06-none"><strong>—</strong><span>داده قابل‌استناد دریافت نشده است</span></div>}
      <p className="w1a-panel-tip">نمایش اطلاعات واقعی نیازمند تأیید منبع و اهلیت است.</p>
     </article>;
    })}
   </section>
   <section className="w1a-actions-row nav06-shortcuts" aria-label="میانبرهای خدمات">
    {([
      ["ACADEMY","آکادمی تعاونی","دوره‌ها و مسیرهای یادگیری","▤","w1a-action-blue"],
      ["EVENTS","رویدادها","برنامه‌های قابل بررسی","◷","w1a-action-green"],
      ["VOUCHERS","مزایای غیرنقدی","مزایا و ووچرهای مجاز","◇","w1a-action-orange"],
      ["CALENDAR","تقویم من","موعدها و یادآورهای نمونه","▦","w1a-action-purple"]
    ] as const).map(([id,title,desc,icon,color])=><button type="button" className={"w1a-action "+color} onClick={()=>navigate(id)} key={id}>
      <span aria-hidden="true">{icon}</span><div><strong>{title}</strong><small>{desc}</small></div><span aria-hidden="true">←</span>
    </button>)}
   </section>
   <section className="nav06-catalog" id="nav06-section-catalog" ref={catalogRef} aria-label="یازده زیرمنوی رسمی خدمات من">
    <div className="nav06-title-row"><div><span>مطابق Navigation v1.0 · بدون تغییر معماری</span><h2>خدمات و امکانات من</h2></div><small>۱۱ زیرمنوی رسمی</small></div>
    <div className="nav06-groups">
     {GROUPS.map(g=><div className="nav06-group" key={g.title}><h3>{g.title}</h3><div className="nav06-group-links">
       {g.ids.map(id=>{const item=NAV06_SECTIONS.find(x=>x.id===id)!;return <button type="button" key={id}
          aria-pressed={section===id} className={"nav06-section-button"+(section===id?" nav06-selected":"")}
          onClick={()=>navigate(id)}>{item.label}</button>;})}
      </div></div>)}
    </div>
    <div className="nav06-title-row nav06-content-title"><div><span>مرجع مالک: {current.owner} · {current.type}</span><h2>{current.label}</h2></div>
     <span className="nav06-notice">{demo?"محتوای کاملاً ساختگی":"مرجع و مجوز تأیید نشده"}</span></div>
    {demo?<div className="nav06-search"><label htmlFor="nav06-filter">جست‌وجو در موارد نمونه</label>
      <input id="nav06-filter" type="search" autoComplete="off" placeholder="نام خدمت، دوره یا رویداد نمونه..." value={query} onChange={e=>setQuery(e.target.value)}/>
      <span>{items.length.toLocaleString("fa-IR")} نمونه</span></div>:<div className="nav06-empty" role="status">
       <strong>—</strong><p>{mode==="UNVERIFIED"?"هیچ داده یا استحقاق قابل‌استنادی تأیید نشده است.":"منبع فعلاً در دسترس نیست؛ وضعیت واقعی نامعلوم است."}</p>
      </div>}
    {demo?<div className="nav06-grid">{items.length?items.map(item=><article className="nav06-tile" key={item.id}>
       <span className="nav06-tag">{current.type} · صرفاً نمایش آزمایشی</span><h3>{item.title}</h3><p>{item.summary}</p>
       <div className="nav06-tile-foot"><small>{item.sampleTime}</small><span>{item.sampleState}</span></div>
       <button type="button" onClick={()=>open(item.id)} aria-controls="nav06-details" aria-expanded={detailId===item.id}>مشاهده جزئیات نمونه ←</button>
      </article>):<p className="nav06-no-search">هیچ مورد نمونه‌ای با این عبارت یافت نشد.</p>}</div>:null}
    <section className="w1a-public-details nav06-details" id="nav06-details" ref={detailRef} tabIndex={-1} hidden={!detail} aria-label="جزئیات خواندنی نمونه">
     {detail?<><div className="w1a-public-details-head"><div><span className="w1a-label">فقط نمونه · فاقد حق، اهلیت یا اعتبار حقوقی</span><h2>{detail.title}</h2>
       <p>{detail.sampleTime}</p></div><button type="button" className="w1a-public-close" onClick={()=>setDetailId(null)}>بستن جزئیات</button></div>
       <p>{detail.summary}</p><dl className="nav06-fields">
        <div><dt>مالک داده</dt><dd>{detail.owner}</dd></div><div><dt>شناسه آزمایشی</dt><dd dir="ltr">{detail.id}</dd></div>
        <div><dt>مخاطب</dt><dd>{detail.audience}</dd></div><div><dt>اهلیت</dt><dd>تأییدنشده</dd></div>
        <div><dt>وضعیت</dt><dd>{detail.sampleState}</dd></div><div><dt>اثر عملیاتی</dt><dd>هیچ اقدامی ثبت نمی‌شود</dd></div>
       </dl><div className="nav06-disabled"><button type="button" disabled>ثبت درخواست (غیرفعال)</button>
        <button type="button" disabled>رزرو رویداد (غیرفعال)</button><button type="button" disabled>دریافت گواهی (غیرفعال)</button>
        <button type="button" disabled>استفاده از ووچر (غیرفعال)</button></div>
       <p className="nav06-warning">ثبت حضور ≠ تکمیل دوره؛ صدور گواهی آموزشی ≠ صلاحیت قانونی؛ امتیاز غیرنقدی ≠ سود سهام و کیف پول نقدی.</p>
      </>:null}
    </section>
    <section className="nav06-submit-guard"><h3>درخواست خدمات و ثبت‌نام</h3>
     <p>در این نسخه، درخواست، ثبت‌نام دوره، رزرو ظرفیت، دریافت گواهی و مصرف Voucher صرفاً برای نمایش ساختار در نظر گرفته شده‌اند و هیچ عملیاتی انجام نمی‌شود.</p>
     <div><button type="button" disabled>درخواست خدمت (غیرفعال)</button><button type="button" disabled>ثبت‌نام دوره (غیرفعال)</button>
       <button type="button" disabled>رزرو و استفاده از مزایا (غیرفعال)</button></div>
    </section>
   </section>
   <section className="w1a-review-toolbox nav06-tools" aria-label="ابزار بازبینی توسعه‌دهنده">
    <button type="button" className="w1a-review-tools-toggle" aria-expanded={diagnostics} aria-controls="nav06-review-panels"
     onClick={()=>setDiagnostics(!diagnostics)}>{diagnostics?"بستن ابزارهای بررسی":"ابزار بررسی توسعه‌دهنده"}<span aria-hidden="true">{diagnostics?"⌃":"⌄"}</span></button>
    <div id="nav06-review-panels" className="w1a-review-detail-panels" hidden={!diagnostics}>
     <section className="w1a-mode-section"><h2>وضعیت منبع برای آزمایش رابط</h2>
      <div className="w1a-mode-controls" role="group" aria-label="انتخاب حالت منبع">{MODES.map(x=><button type="button" key={x.id} aria-pressed={mode===x.id}
       className={"w1a-choice"+(mode===x.id?" w1a-choice-active":"")} onClick={()=>switchMode(x.id)}>{x.label}</button>)}</div>
      <p role="status" aria-live="polite" className={"w1a-message"+(demo?" w1a-message-demo":"")}>{MODES.find(x=>x.id===mode)?.description}</p></section>
     <section className="w1a-gates"><h2>شرایط فعال‌سازی واقعی</h2><ol>{NAV06_RELEASE_GATES.map(x=><li key={x}>{x}</li>)}</ol></section>
     <p className="w1a-guard"><strong>محدوده امنیتی:</strong> اعتبار عضویت، گواهی، ظرفیت رویداد و مزایای غیرنقدی تنها توسط مالکان Domain تعیین می‌شوند. این پیش‌نمایش مجوزی برای ثبت یا انتقال داده نیست.</p>
    </div>
   </section>
   <footer className="w1a-footer nav06-footer">W1 · NAV-06 | نسخه فقط‌خواندنی و کاملاً ساختگی. ثبت خدمات، ثبت‌نام، رزرو، گواهی، استحقاق و مصرف ووچر واقعی غیرفعال است.</footer>
  </div>
 </main>;
}
