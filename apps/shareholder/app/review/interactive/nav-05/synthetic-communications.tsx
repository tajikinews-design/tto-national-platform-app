"use client";
import {useRef,useState} from "react";
import {NAV05_FIXTURES,NAV05_RELEASE_GATES,NAV05_SECTIONS,type SectionId,type Nav05Mode} from "./communications-fixtures";

/** Preserves exactly the 11 NAV roots and approved NAV04 sidebar/header geometry.
 * This page deliberately duplicates no business source: every record is a DEMO fixture.
 */
const ROOTS=[
 ["⌂","داشبورد","/review/interactive"],
 ["♙","سهام و عضویت من","/review/interactive/nav-02"],
 ["▥","خرید و فروش سهام","/review/interactive/nav-03"],
 ["♜","مجامع و انتخابات","/review/interactive/nav-04"],
 ["▣","اخبار و ارتباط با شرکت","/review/interactive/nav-05"],
 ["⚙","خدمات من","/review/interactive/nav-06"],
 ["▣","فروشگاه و فرصت‌ها","/review/interactive/nav-07"],
 ["▤","پروژه‌های شرکت","/review/interactive/nav-08"],
 ["◇","شفافیت و اسناد شرکت","/review/nav-09"],
 ["▥","گزارش‌های من","/review/nav-10"],
 ["⚙","تنظیمات حساب","/review/nav-11"]
] as const;
const MODES:{id:Nav05Mode;label:string;description:string}[]=[
 {id:"UNVERIFIED",label:"منبع رسمی تأیید نشده",description:"هیچ خبر، پیام، اطلاعیه، ابلاغ یا تیکت واقعی دریافت نشده است. نبود پاسخ منبع به معنی صفر پیام یا نبود اطلاعیه نیست."},
 {id:"SOURCE_UNAVAILABLE",label:"منبع در دسترس نیست",description:"اختلال منبع هیچ داده سابق، تحویل، مطالعه، ابلاغ یا پاسخ رسمی را معتبر نمی‌کند."},
 {id:"DEMO_CONTENT",label:"نمونه کاملاً ساختگی",description:"۱۳ رکورد ساختگی برای بازبینی طراحی؛ هیچ انتشار، ارسال، مطالعه، تأیید دریافت، پاسخ یا تیکت قانونی اتفاق نمی‌افتد."}
];
const PANELS:{id:SectionId;title:string;icon:string}[]=[
 {id:"NEWS",title:"آخرین اخبار شرکت",icon:"▤"},
 {id:"NOTICES",title:"اطلاعیه‌های اخیر",icon:"▣"},
 {id:"TICKETS",title:"مکاتبات و تیکت‌های من",icon:"✉"},
 {id:"SURVEYS",title:"نظرسنجی و صدای سهامدار",icon:"◇"}
];
const KPI=[["اخبار جدید","NEWS","▤","w1a-kpi-sky"],
 ["اطلاعیه‌های مهم","ASSURED","♧","w1a-kpi-apricot"],
 ["پیام‌های نیازمند تأیید","ACK","✉","w1a-kpi-lilac"],
 ["درخواست‌های باز","TICKETS","▢","w1a-kpi-mint"]] as const;
const GROUPS=[
 {title:"اخبار و اطلاع‌رسانی",ids:["NEWS","NOTICES","ASSURED","ACK"] as SectionId[]},
 {title:"مشارکت و پیشنهادها",ids:["SURVEYS","VOICE","PROPOSALS","RESPONSES"] as SectionId[]},
 {title:"پشتیبانی و اعلان‌ها",ids:["TICKETS","ALERTS"] as SectionId[]}
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
   {ROOTS.map(([icon,label,href],index)=><a key={label} href={href} className={"w1a-side-link"+(index===4?" w1a-active":"")} aria-current={index===4?"page":undefined}>
    <span aria-hidden="true" className="w1a-side-icon">{icon}</span><span>{label}</span></a>)}
  </nav>
  <div className="w1a-sidebar-foot">پنل بازبینی · اطلاعات شخصی، ابلاغ و مکاتبه رسمی غیرفعال</div>
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
export function SyntheticCommunications(){
 const [mode,setMode]=useState<Nav05Mode>("UNVERIFIED");
 const [toolsExpanded,setToolsExpanded]=useState(false);
 const [section,setSection]=useState<SectionId>("NEWS");
 const [query,setQuery]=useState("");
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const detailRef=useRef<HTMLElement>(null);
 const sectionRef=useRef<HTMLElement>(null);
 const demo=mode==="DEMO_CONTENT";
 const currentSection=NAV05_SECTIONS.find(x=>x.id===section)!;
 const filtered=demo?NAV05_FIXTURES.filter(x=>x.section===section&&
  (x.title.includes(query.trim())||x.summary.includes(query.trim())||x.id.includes(query.trim()))):[];
 const selected=demo?NAV05_FIXTURES.find(x=>x.id===selectedId&&x.section===section):undefined;
 function goToSection(next:SectionId){
  setSection(next);setSelectedId(null);setQuery("");
  requestAnimationFrame(()=>sectionRef.current?.scrollIntoView({block:"start"}));
 }
 function openDetail(id:string){
  setSelectedId(id);requestAnimationFrame(()=>{
   detailRef.current?.focus();detailRef.current?.scrollIntoView({block:"nearest"});
  });
 }
 function changeMode(next:Nav05Mode){
  setMode(next);setSelectedId(null);setQuery("");
 }
 return <main className="w1a-shell nav05-shell" dir="rtl" lang="fa" data-source-mode={mode}>
  <Sidebar/>
  <div className="w1a-frame nav05-frame">
   <Header/>
   <header className="w1a-page-heading"><div><h1>اخبار و ارتباط با شرکت</h1><p>مرکز اطلاع‌رسانی، دریافت پیام‌ها و ارتباط دوسویه سهامداران</p></div><span>W1 / NAV-05 · نسخه بازبینی</span></header>
   <section className="nav05-hero" aria-label="خبر شاخص و وضعیت منبع">
    <div className="nav05-hero-text">
     <span className="nav05-hero-kicker">اطلاع‌رسانی شفاف · فقط نمونه طراحی</span>
     <h2>{demo?"خبر شاخص نمونه: گزارش فعالیت‌های تعاونی":"اطلاعیه‌ها و خبرهای شرکت"}</h2>
     <p>{demo?"این خبر ساختگی، نمای تصویری قالب اخبار را نشان می‌دهد و هیچ شرکت، فعالیت یا نتیجه واقعی را معرفی نمی‌کند.":"پس از تأیید مرجع نشر و مخاطب مجاز، اخبار و پیام‌های معتبر این بخش نمایش داده می‌شوند."}</p>
     <button type="button" className="nav05-hero-btn" onClick={()=>goToSection("NEWS")} aria-controls="nav05-section-catalog">مشاهده اخبار {demo?"نمونه":""} ←</button>
    </div>
    <div className="nav05-hero-art" aria-hidden="true"><div className="nav05-art-page"><span>▤</span><i/><i/><i/></div><div className="nav05-art-mail">✉</div></div>
   </section>
   <section className="w1a-kpi-row nav05-kpi" aria-label="چهار شاخص ارتباطات">
    {KPI.map(([label,id,icon,color])=><article key={id} className={"w1a-kpi "+color}>
     <span aria-hidden="true" className="w1a-kpi-icon">{icon}</span><div><h3>{label}</h3><strong>{demo?NAV05_FIXTURES.filter(x=>x.section===id).length.toLocaleString("fa-IR"):"—"}</strong><small>{demo?"تعداد کاملاً ساختگی":"منبع معتبر متصل نیست"}</small></div>
    </article>)}
   </section>
   <section className="w1a-four-panels nav05-overview-panels" aria-label="چهار ناحیه اصلی اخبار و ارتباط">
    {PANELS.map(panel=>{
      const items=demo?NAV05_FIXTURES.filter(x=>x.section===panel.id).slice(0,3):[];
      return <article key={panel.id} className="w1a-summary-panel">
       <div className="w1a-panel-heading"><h3>{panel.title}</h3><button type="button" onClick={()=>goToSection(panel.id)} aria-controls="nav05-section-catalog">همه موارد ←</button></div>
       {items.length?items.map(rec=><button type="button" key={rec.id} className="nav05-overview-record" onClick={()=>{goToSection(rec.section);openDetail(rec.id);}}><span aria-hidden="true" className="w1a-file-icon">{panel.icon}</span><span><strong>{rec.title}</strong><small>{rec.displayDate} · فقط نمونه</small></span></button>):<div className="nav05-panel-empty"><strong>—</strong><span>داده تأییدشده در دسترس نیست</span></div>}
       <p className="w1a-panel-tip">{panel.id==="TICKETS"?"ثبت درخواست و پاسخ واقعی غیرفعال است.":"نمایش تنها پس از تعیین منبع، نسخه و مخاطب مجاز."}</p>
      </article>;
    })}
   </section>
   <section className="w1a-actions-row nav05-shortcuts" aria-label="میانبرهای ارتباطی">
    {([
     ["NEWS","آخرین اخبار","مرور محتوای قابل انتشار","▤","w1a-action-blue"],
     ["NOTICES","اطلاعیه‌ها","وضعیت نشر و مخاطبان","▣","w1a-action-green"],
     ["TICKETS","پیگیری مکاتبات","نمایش سوابق و پاسخ‌ها","✉","w1a-action-orange"],
     ["VOICE","صدای سهامدار","نظرسنجی و پیشنهادهای غیرحقوقی","◇","w1a-action-purple"]
    ] as const).map(([id,title,subtitle,icon,color])=><button type="button" key={id} onClick={()=>goToSection(id)} className={"w1a-action "+color}>
      <span aria-hidden="true">{icon}</span><div><strong>{title}</strong><small>{subtitle}</small></div><span aria-hidden="true">←</span>
     </button>)}
   </section>
   <section className="nav05-catalog" id="nav05-section-catalog" ref={sectionRef} aria-label="ده زیرمنوی مصوب NAV-05">
    <div className="nav05-section-heading"><div><span>معماری مصوب Navigation v1.0</span><h2>بخش‌های اخبار و ارتباط با شرکت</h2></div><small>۱۰ زیرمنوی رسمی · CHILD09 / CHILD10 / CHILD13 / CF05</small></div>
    <div className="nav05-category-groups">
     {GROUPS.map(group=><div key={group.title} className="nav05-category-group"><h3>{group.title}</h3><div className="nav05-category-buttons">
       {group.ids.map(id=>{const rec=NAV05_SECTIONS.find(x=>x.id===id)!;return <button key={id} type="button" className={"nav05-category"+(id===section?" nav05-category-active":"")}
         aria-pressed={id===section} onClick={()=>{setSection(id);setSelectedId(null);setQuery("");}}>{rec.label}</button>;})}
      </div></div>)}
    </div>
    <div className="nav05-section-heading nav05-browser-heading"><div><span>{currentSection.owner} · {currentSection.kind}</span><h2>{currentSection.label}</h2></div><span className="nav05-state-badge">{demo?"محتوای فرضی":"منبع رسمی تأیید نشده"}</span></div>
    {demo?<div className="nav05-search-row"><label htmlFor="nav05-search">جست‌وجوی موارد نمونه</label><input id="nav05-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="عنوان یا متن نمونه را جست‌وجو کنید" autoComplete="off"/><span>{filtered.length.toLocaleString("fa-IR")} مورد ساختگی</span></div>:<div className="nav05-source-empty" role="status"><strong>—</strong><p>{mode==="UNVERIFIED"?"منبع رسمی تأیید نشده؛ نمایش اطلاعات واقعی مسدود است.":"منبع اطلاعات در دسترس نیست؛ وضعیت‌ها نامعلوم‌اند."}</p></div>}
    {demo?<div className="nav05-item-grid">{filtered.length?filtered.map(rec=><article className="nav05-record" key={rec.id}>
     <span className="nav05-record-kind">{currentSection.kind} · صرفاً آزمایشی</span><h3>{rec.title}</h3><p>{rec.summary}</p><small>{rec.displayDate}</small>
     <button type="button" onClick={()=>openDetail(rec.id)} aria-controls="nav05-public-details" aria-expanded={selectedId===rec.id}>مشاهده جزئیات نمونه ←</button>
    </article>):<p className="nav05-search-empty">مورد نمونه‌ای با این عبارت پیدا نشد.</p>}</div>:null}
    <section className="w1a-public-details nav05-details" id="nav05-public-details" ref={detailRef} tabIndex={-1} hidden={!selected} aria-label="جزئیات فقط خواندنی نمونه">
     {selected?<><div className="w1a-public-details-head"><div><span className="w1a-label">فقط مشاهده اطلاعات فرضی · فاقد اثر حقوقی</span><h2>{selected.title}</h2><p>{selected.displayDate}</p></div><button type="button" className="w1a-public-close" onClick={()=>setSelectedId(null)}>بستن جزئیات</button></div>
     <p>{selected.summary}</p><dl className="nav05-metadata"><div><dt>مرجع مالک</dt><dd>{selected.sourceDomain}</dd></div><div><dt>شناسه نمونه</dt><dd dir="ltr">{selected.id}</dd></div><div><dt>مخاطب</dt><dd>{selected.audience}</dd></div><div><dt>وضعیت انتشار</dt><dd>صرفاً پیش‌نمایش؛ انتشار رسمی نشده</dd></div><div><dt>نسخه</dt><dd>{selected.version} · ساختگی</dd></div><div><dt>اعتبار حقوقی</dt><dd>تأییدنشده</dd></div></dl>
     <div className="nav05-sensitive-actions"><button disabled type="button">تأیید دریافت (غیرفعال)</button><button disabled type="button">ارسال پاسخ (غیرفعال)</button><button disabled type="button">دریافت پیوست (غیرفعال)</button></div>
     <p className="nav05-legal-note">تحویل اعلان ≠ مطالعه محتوا ≠ تأیید دریافت. هیچ تأیید دریافت، پیام یا پرونده واقعی ایجاد نمی‌شود.</p></>:null}
    </section>
    <section className="nav05-composition-only" aria-label="امکانات ارتباطی نیازمند مجوز">
     <h3>ارتباط دوسویه با تعاونی</h3><p>ارسال تیکت، پاسخ، پیشنهاد، رأی نظرسنجی و بارگذاری پیوست صرفاً پس از تأیید CHILD10، CHILD13 و سیاست‌های دسترسی فعال می‌شوند.</p>
     <div><button type="button" disabled>ثبت درخواست جدید (غیرفعال)</button><button type="button" disabled>ارسال پیشنهاد (غیرفعال)</button><button type="button" disabled>شرکت در نظرسنجی (غیرفعال)</button></div>
    </section>
   </section>
   <section className="w1a-review-toolbox nav05-toolbox" aria-label="ابزار بررسی توسعه‌دهنده">
    <button type="button" className="w1a-review-tools-toggle" aria-expanded={toolsExpanded} aria-controls="nav05-review-panels" onClick={()=>setToolsExpanded(!toolsExpanded)}>
     {toolsExpanded?"بستن ابزارهای بررسی":"ابزار بررسی توسعه‌دهنده"}<span aria-hidden="true">{toolsExpanded?"⌃":"⌄"}</span></button>
    <div id="nav05-review-panels" className="w1a-review-detail-panels" hidden={!toolsExpanded}>
     <section className="w1a-mode-section" aria-label="وضعیت دسترسی به منبع رسمی"><h2>انتخاب حالت برای آزمون رابط (بدون اتصال واقعی)</h2><div className="w1a-mode-controls" role="group" aria-label="حالت داده">
      {MODES.map(item=><button key={item.id} type="button" aria-pressed={mode===item.id} className={"w1a-choice"+(mode===item.id?" w1a-choice-active":"")} onClick={()=>changeMode(item.id)}>{item.label}</button>)}
     </div><p role="status" aria-live="polite" className={"w1a-message"+(demo?" w1a-message-demo":"")}>{MODES.find(item=>item.id===mode)?.description}</p></section>
     <section className="w1a-gates"><h2>گیت‌های لازم برای عملیاتی‌شدن</h2><ol>{NAV05_RELEASE_GATES.map(gate=><li key={gate}>{gate}</li>)}</ol></section>
     <p className="w1a-guard"><strong>محدوده حقوقی:</strong> NAV05 منبع اصلی مصوبات مجمع (NAV04) یا اسناد مالی (NAV09) نیست؛ Notice Assurance و ارسال اعلان با انتشار محتوا متفاوت‌اند. بدون مجوز مستقل، داده واقعی یا اقدام رسمی فعال نمی‌شود.</p>
    </div>
   </section>
   <footer className="w1a-footer nav05-footer">W1 · NAV-05 | پیش‌نمایش فقط‌خواندنی و فاقد داده واقعی. انتشار خبر، ابلاغ قانونی، تأیید دریافت، رأی‌گیری، ثبت درخواست، پاسخ، پیوست و ارسال SMS/Email/Push غیرفعال است.</footer>
  </div>
 </main>;
}
