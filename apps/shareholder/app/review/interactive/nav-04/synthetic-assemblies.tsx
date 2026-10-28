"use client";
import {useRef,useState} from "react";
import {ASSEMBLY_FIXTURES,KIND_LABEL,REFERENCE_REVIEW_GATES,
 type RecordType,type DemoSourceState} from "./assembly-fixtures";

type Filter="ALL"|RecordType;
type OverviewDetail="ASSEMBLIES"|"RESULTS"|"DOCUMENTS"|"NOTICES"|"ELECTIONS";
type ReadonlyDetailRow={title:string;subtitle:string;description:string};
const FILTERS:readonly {value:Filter;label:string}[]=[
 {value:"ALL",label:"همه"},
 {value:"INVITATION",label:"دعوت‌نامه‌ها"},
 {value:"MINUTES",label:"صورت‌جلسات"},
 {value:"ELECTION_INFO",label:"اطلاعات انتخابات"},
 {value:"RESULT",label:"نتایج و سوابق"}
];
const MODES:readonly {id:DemoSourceState;label:string;message:string}[]=[
 {id:"UNVERIFIED",label:"منبع رسمی تأیید نشده",
  message:"هیچ دعوت‌نامه، مصوبه، صورت‌جلسه یا نتیجه واقعی دریافت نشده است؛ نبود داده به معنی نبود مجمع یا انتخابات نیست."},
 {id:"SOURCE_UNAVAILABLE",label:"مرجع اطلاعات در دسترس نیست",
  message:"اختلال منبع به معنی تأیید، رد، لغو جلسه یا صدور نتیجه نیست. اطلاعات پیشین نیز نشان داده نمی‌شوند."},
 {id:"DEMO_CONTENT",label:"نمونه کاملاً ساختگی",
  message:"همه شناسه‌ها، تاریخ‌ها، اسناد و وضعیت‌ها فرضی‌اند. این صفحه هیچ رأی یا تصمیمی را ثبت نمی‌کند."}
];

const SIDE_MENU=[
 ["⌂","داشبورد","/review/interactive"],
 ["♙","سهام و عضویت من","/review/interactive/nav-02"],
 ["▥","خرید و فروش سهام","/review/interactive/nav-03"],
 ["♜","مجامع و انتخابات","/review/interactive/nav-04"],
 ["▢","اخبار و ارتباط با شرکت","/review/interactive/nav-05"],
 ["⚙","خدمات من","/review/interactive/nav-06"],
 ["▣","فروشگاه و فرصت‌ها",""],
 ["▤","پروژه‌های شرکت",""],
 ["◇","شفافیت و اسناد شرکت",""],
 ["▥","گزارش‌های من",""],
 ["⚙","تنظیمات حساب",""]
] as const;
function ReviewSidebar(){
 const [menuOpen,setMenuOpen]=useState(false);
 return <aside className={"w1a-sidebar"+(menuOpen?" w1a-mobile-menu-open":"")} aria-label="منوی پنل سهامدار" onKeyDown={event=>{if(event.key==="Escape")setMenuOpen(false);}}>
  <div className="w1a-brand"><span className="w1a-brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" width="44" height="44" focusable="false">
   <path d="M26 4C34 4 42 2 45 0v19c-7 3-12 9-17 14L26 4Z" fill="#204a81"/>
   <path d="M22 4C13 4 6 7 2 12v12c7 0 13 4 20 10V4Z" fill="#19b6bc"/>
   <path d="M2 27c8-2 14 2 20 9v12C13 44 7 42 2 36V27Z" fill="#22ad78"/>
   <path d="M26 37c5-10 12-14 19-16v13c-4 8-10 12-19 14V37Z" fill="#0a69ab"/>
  </svg></span>
   <div><strong>پلتفرم ملی تعاونی توسعه و عمران</strong><small>شبکه هوشمند خدمات و راهبری تعاونی‌ها</small></div>
  </div>
  <button type="button" className="w1a-mobile-menu-toggle" aria-controls="w1a-side-nav" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}><span aria-hidden="true">☰</span>بخش‌های پنل</button>
  <nav id="w1a-side-nav" className="w1a-side-links" aria-label="یازده بخش مصوب پنل">
   {SIDE_MENU.map(([icon,label,href],i)=>
    href?<a key={label} className={"w1a-side-link"+(i===3?" w1a-active":"")} aria-current={i===3?"page":undefined} href={href}>
      <span aria-hidden="true" className="w1a-side-icon">{icon}</span><span>{label}</span></a>
     :<span key={label} className="w1a-side-link w1a-not-linked" aria-disabled="true">
      <span aria-hidden="true" className="w1a-side-icon">{icon}</span><span>{label}</span></span>)}
  </nav>
  <div className="w1a-sidebar-foot">پنل بازبینی · خروج از حساب عملیاتی در این نمونه وجود ندارد</div>
 </aside>;
}
function ReviewTopbar(){
 return <div className="w1a-global-header">
   <div className="w1a-cooperative-switch" aria-label="تعاونی انتخاب‌شده ـ صرفاً نمایشی" aria-disabled="true">
    <span aria-hidden="true" className="w1a-coop-icon">▦</span>
    <span>تعاونی توسعه و عمران شهرستان نمونه</span>
    <span aria-hidden="true">⌄</span>
   </div>
   <div className="w1a-global-user">
    <span className="w1a-header-icon" aria-label="پیام‌ها ـ غیرفعال"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></span>
    <span className="w1a-header-icon w1a-bell" aria-label="اعلان‌ها ـ غیرفعال"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg></span>
    <span className="w1a-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span>
    <div><strong>سهامدار نمونه</strong><small>پنل بازبینی · داده غیرعملیاتی</small></div>
   </div>
 </div>;
}
const PREVIEW_DOC_ROWS=[
 {title:"صورت‌جلسه مجمع سال نمونه",date:"۱۴۰۵/۰۷/۲۰ ـ فرضی"},
 {title:"مصوبات مجمع عمومی فوق‌العاده",date:"۱۴۰۵/۰۸/۰۱ ـ فرضی"},
 {title:"گزارش هیئت‌مدیره (نمونه)",date:"۱۴۰۵/۰۷/۲۰ ـ فرضی"},
 {title:"گزارش بازرس قانونی (نمونه)",date:"۱۴۰۵/۰۸/۰۱ ـ فرضی"}
] as const;
const PREVIEW_NOTICE_ROWS=[
 {title:"دعوت به مجمع عمومی عادی سالیانه (نمونه)",date:"۱۴۰۵/۰۹/۱۵ ـ فرضی"},
 {title:"دستور جلسه مجمع (نمونه)",date:"۱۴۰۵/۰۹/۱۵ ـ فرضی"},
 {title:"فهرست مشروط واجدان شرایط (نمونه)",date:"تأیید نشده"},
 {title:"راهنمای ثبت حضور در مجمع (نمونه)",date:"انتشار رسمی نشده"}
] as const;

const PREVIEW_ELECTION_ROWS=[
 {name:"انتخابات هیئت‌مدیره (نمونه)",state:"ثبت‌نام غیرعملیاتی"},
 {name:"انتخابات بازرس اصلی و علی‌البدل (نمونه)",state:"زمان قانونی تأیید نشده"}
] as const;
const DETAIL_TITLES:Record<OverviewDetail,string>={
 ASSEMBLIES:"جزئیات مجامع نمونه",
 RESULTS:"نتایج و مصوبات نمونه",
 DOCUMENTS:"اسناد و مصوبات نمونه",
 NOTICES:"اطلاعیه‌های نمونه",
 ELECTIONS:"انتخابات نمونه"
};

function ApprovedVisualOverview(){
 const [detailType,setDetailType]=useState<OverviewDetail|null>(null);
 const detailRef=useRef<HTMLElement>(null);
 function openDetails(next:OverviewDetail){
   setDetailType(next);
   requestAnimationFrame(()=>{
     detailRef.current?.focus();
     detailRef.current?.scrollIntoView({block:"nearest"});
   });
 }
 const inv=ASSEMBLY_FIXTURES.filter(item=>item.recordType==="INVITATION");
 const minute=ASSEMBLY_FIXTURES.filter(item=>item.recordType==="MINUTES");
 const elections=ASSEMBLY_FIXTURES.filter(item=>item.recordType==="ELECTION_INFO");
 const outcomes=ASSEMBLY_FIXTURES.filter(item=>item.recordType==="RESULT");
 const showcase=inv[0];
 const detailRows:Record<OverviewDetail,ReadonlyDetailRow[]>={
  DOCUMENTS:PREVIEW_DOC_ROWS.map(row=>({
   title:row.title,subtitle:row.date,
   description:"عنوان سند صرفاً نمونه است؛ هیچ فایل، امضا یا مصوبه رسمی برای دریافت وجود ندارد."
  })),
  NOTICES:PREVIEW_NOTICE_ROWS.map(row=>({
   title:row.title,subtitle:row.date,
   description:"اطلاعیه تمرینی است؛ دعوت رسمی و اهلیت مخاطب تأیید نشده است."
  })),
  ELECTIONS:PREVIEW_ELECTION_ROWS.map(row=>({
   title:row.name,subtitle:row.state,
   description:"فقط پیش‌نمایش؛ ثبت نامزدی، احراز شرایط و رأی‌گیری غیرفعال است."
  })),
  ASSEMBLIES:inv.map(row=>({title:row.title,subtitle:row.scheduledAt,
   description:row.summary+" · محل: "+row.location})),
  RESULTS:[...minute,...outcomes].map(row=>({title:row.title,subtitle:row.scheduledAt,
   description:row.summary+" · محل: "+row.location}))
 };
 return <section className="w1a-approved-overview" aria-label="نمای مصوب مجامع ـ تمام اطلاعات مصنوعی">
  <div className="w1a-next-meeting">
   <div className="w1a-meeting-tile">
    <img src="/nav04-approved-meeting-demo.webp" alt="تصویر سالن مجمع برگرفته از پیش‌نمایش مصوب؛ نمایشی و فاقد سندیت رویداد" width="309" height="220" />
   </div>
   <div className="w1a-meeting-info">
    <div className="w1a-meeting-topline">
      <span className="w1a-next-label">▦ مجمع بعدی من</span>
      <span className="w1a-mock-ribbon">DEMO · نمونه غیررسمی</span>
    </div>
    <div className="w1a-meeting-titleline"><span className="w1a-badge-blue">{showcase.assemblyKind}</span><h2>مجمع عمومی عادی سالیانه (نمونه)</h2><span className="w1a-badge-green">دعوت‌نامه تأیید نشده</span></div>
    <div className="w1a-meeting-meta">
     <span>▦ {showcase.scheduledAt}</span><span>◷ ساعت: اعلام نشده</span><span>⌖ {showcase.location}</span>
    </div>
    <div className="w1a-meeting-controls">
     <div className="w1a-attendance-state">◉ وضعیت من: حضور احراز نشده</div>
     <div className="w1a-meeting-buttons">
      <button type="button" disabled aria-disabled="true" className="w1a-outline-button">اعلام حضور (غیرفعال)</button>
      <button type="button" className="w1a-primary-link" onClick={()=>openDetails("ASSEMBLIES")}
       aria-controls="w1a-public-details" aria-expanded={detailType==="ASSEMBLIES"}>مشاهده جزئیات نمونه ←</button>
     </div>
    </div>
   </div>
   <div className="w1a-countdown"><strong>—</strong><span>روز باقی‌مانده</span><small>زمان رسمی تأیید نشده</small></div>
  </div>

  <div className="w1a-kpi-row">
   <article className="w1a-kpi w1a-kpi-sky"><span className="w1a-kpi-icon">▤</span><div><h3>اسناد و مصوبات جدید</h3><strong>{(minute.length+outcomes.length).toLocaleString("fa-IR")}</strong><small>نمونه صرفاً نمایشی</small></div></article>
   <article className="w1a-kpi w1a-kpi-mint"><span className="w1a-kpi-icon">▣</span><div><h3>انتخابات فعال</h3><strong>{elections.length.toLocaleString("fa-IR")}</strong><small>فقط کارت نمونه؛ فعالیت واقعی نامعلوم</small></div></article>
   <article className="w1a-kpi w1a-kpi-apricot"><span className="w1a-kpi-icon">✓</span><div><h3>اقدامات موردنیاز من</h3><strong>—</strong><small>حق اقدام یا وظیفه احراز نشده</small></div></article>
   <article className="w1a-kpi w1a-kpi-lilac"><span className="w1a-kpi-icon">▣</span><div><h3>مجامع پیش‌رو</h3><strong>{inv.length.toLocaleString("fa-IR")}</strong><small>دعوت‌نامه‌های ساختگی</small></div></article>
  </div>
  <div className="w1a-four-panels">
   <section className="w1a-summary-panel">
    <div className="w1a-panel-heading"><h3>جدیدترین اسناد و مصوبات</h3><button type="button" onClick={()=>openDetails("DOCUMENTS")} aria-controls="w1a-public-details" aria-expanded={detailType==="DOCUMENTS"}>همه اسناد ←</button></div>
    {PREVIEW_DOC_ROWS.map(rec=><div className="w1a-panel-line" key={rec.title}>
      <span className="w1a-file-icon" aria-hidden="true">▤</span>
      <div><strong>{rec.title}</strong><small>{rec.date}</small></div>
      <span className="w1a-pill w1a-pill-pdf">PDF · نمونه</span>
    </div>)}
   </section>
   <section className="w1a-summary-panel">
    <div className="w1a-panel-heading"><h3>آخرین اطلاعیه‌ها</h3><button type="button" onClick={()=>openDetails("NOTICES")} aria-controls="w1a-public-details" aria-expanded={detailType==="NOTICES"}>همه اطلاعیه‌ها ←</button></div>
    {PREVIEW_NOTICE_ROWS.map(rec=><div className="w1a-panel-line" key={rec.title}>
     <span className="w1a-file-icon" aria-hidden="true">▤</span>
     <div><strong>{rec.title}</strong><small>{rec.date}</small></div>
     <span className="w1a-pill w1a-pill-pdf">نمونه</span>
    </div>)}
   </section>
   <section className="w1a-summary-panel">
    <div className="w1a-panel-heading"><h3>انتخابات فعال</h3><button type="button" onClick={()=>openDetails("ELECTIONS")} aria-controls="w1a-public-details" aria-expanded={detailType==="ELECTIONS"}>همه انتخابات ←</button></div>
    {PREVIEW_ELECTION_ROWS.map(rec=><div className="w1a-panel-line w1a-election-row" key={rec.name}>
      <div><span className="w1a-pill w1a-pill-violet">انتخابات فرضی</span>
       <strong>{rec.name}</strong><small>{rec.state}</small></div>
      <span className="w1a-pill w1a-pill-green">فقط پیش‌نمایش</span>
    </div>)}
   </section>
   <section className="w1a-summary-panel">
    <div className="w1a-panel-heading"><h3>مجامع پیش‌رو</h3><button type="button" onClick={()=>openDetails("ASSEMBLIES")} aria-controls="w1a-public-details" aria-expanded={detailType==="ASSEMBLIES"}>همه مجامع ←</button></div>
    {inv.map(rec=><div className="w1a-panel-line w1a-assembly-row" key={rec.id}>
     <div><span className="w1a-pill w1a-pill-blue">{rec.assemblyKind}</span>
      <strong>{rec.title}</strong><small>▦ {rec.scheduledAt}</small>
      <small>⌖ {rec.location}</small></div>
     <span className="w1a-pill w1a-pill-green">نمونه غیررسمی</span>
    </div>)}
   </section>
  </div>

  <div className="w1a-actions-row" aria-label="مسیرهای این ماژول در نسخه طراحی">
   <button type="button" onClick={()=>openDetails("ASSEMBLIES")}
     aria-controls="w1a-public-details" aria-expanded={detailType==="ASSEMBLIES"}
     className="w1a-action w1a-action-blue"><span>▤</span><div><strong>مشاهده مجامع</strong><small>اطلاعات، دستور جلسه و ثبت حضور (نمایشی)</small></div>←</button>
   <span className="w1a-action w1a-action-green w1a-action-disabled" aria-disabled="true"><span>♙</span><div><strong>مدیریت وکالت</strong><small>واگذاری و پیگیری وکالت‌ها · غیرفعال</small></div>—</span>
   <span className="w1a-action w1a-action-orange w1a-action-disabled" aria-disabled="true"><span>♧</span><div><strong>ثبت نامزدی در انتخابات</strong><small>مدارک و پیگیری وضعیت · غیرفعال</small></div>—</span>
   <button type="button" onClick={()=>openDetails("RESULTS")}
     aria-controls="w1a-public-details" aria-expanded={detailType==="RESULTS"}
     className="w1a-action w1a-action-purple"><span>▤</span><div><strong>نتایج و مصوبات</strong><small>صورت‌جلسات، مصوبات و نتایج · نمونه</small></div>←</button>
  </div>
  <section id="w1a-public-details" className="w1a-public-details" aria-label="جزئیات خواندنی نمونه مجامع و مصوبات"
   tabIndex={-1} ref={detailRef} hidden={detailType===null}>
   <div className="w1a-public-details-head">
    <div><span className="w1a-pill w1a-pill-blue">فقط اطلاعات ساختگی</span>
     <h2>{detailType?DETAIL_TITLES[detailType]:"جزئیات نمونه"}</h2>
     <p>اطلاعات این بخش تمرینی است؛ هیچ دعوت، حضور، سند یا نتیجه رسمی تأیید نشده است.</p>
    </div>
    <button type="button" className="w1a-public-close" onClick={()=>setDetailType(null)}>بستن جزئیات ×</button>
   </div>
   <div className="w1a-public-detail-grid">
    {(detailType?detailRows[detailType]:[]).map(rec=><article key={rec.title}
     className="w1a-public-detail-card">
      <strong>{rec.title}</strong><span>{rec.subtitle}</span>
      <p>{rec.description}</p>
      <small>وضعیت حقوقی و انتشار: تأیید نشده · فقط پیش‌نمایش</small>
    </article>)}
   </div>
  </section>
 </section>;
}

export function SyntheticAssemblies(){
 const [mode,setMode]=useState<DemoSourceState>("UNVERIFIED");
 const [showReviewDetails,setShowReviewDetails]=useState(false);
 const [filter,setFilter]=useState<Filter>("ALL");
 const [selectedId,setSelectedId]=useState(ASSEMBLY_FIXTURES[0].id);
 const fake=mode==="DEMO_CONTENT";
 const filtered=ASSEMBLY_FIXTURES.filter(record=>filter==="ALL"||record.recordType===filter);
 const current=filtered.find(record=>record.id===selectedId)??filtered[0];
 function selectFilter(next:Filter){
  setFilter(next);
  setSelectedId((ASSEMBLY_FIXTURES.find(item=>next==="ALL"||item.recordType===next)
   ??ASSEMBLY_FIXTURES[0]).id);
 }
 return <main className="w1a-shell" dir="rtl">
  <ReviewSidebar/><div className="w1a-frame"><ReviewTopbar/>
  <div className="w1a-page-heading"><div><h1>مجامع و انتخابات</h1><p>اطلاع‌رسانی، مشارکت و پیگیری مجامع عمومی، انتخابات و مصوبات تعاونی</p></div><span>نمایش آزمایشی · بدون اتصال عملیاتی</span></div>
  {fake?<ApprovedVisualOverview/>:<section className="w1a-preview-placeholder" aria-label="نمای اصلی بدون منبع معتبر"><strong>مجمع بعدی من</strong><p>اطلاعات مجمع، شمارنده‌ها، اطلاعیه‌ها و اسناد تا تأیید منبع معتبر نمایش داده نمی‌شوند.</p></section>}
  <section className="w1a-review-toolbox" aria-label="ابزار بررسی توسعه‌دهنده">
   <button type="button" className="w1a-review-tools-toggle" aria-expanded={showReviewDetails}
     aria-controls="w1a-review-detail-panels" onClick={()=>setShowReviewDetails(!showReviewDetails)}>
    {showReviewDetails?"بستن ابزارهای بررسی":"ابزار بررسی توسعه‌دهنده"} <span aria-hidden="true">{showReviewDetails?"⌃":"⌄"}</span>
   </button>
   <div id="w1a-review-detail-panels" className="w1a-review-detail-panels" hidden={!showReviewDetails}>
  <section className="w1a-mode-section" aria-label="وضعیت دسترسی به منبع رسمی">
   <h2>وضعیت منبع را برای آزمایش انتخاب کنید</h2>
   <div className="w1a-mode-controls" role="group" aria-label="وضعیت منبع">
    {MODES.map(item=><button key={item.id} type="button"
      className={mode===item.id?"w1a-choice w1a-choice-active":"w1a-choice"}
      aria-pressed={mode===item.id} onClick={()=>setMode(item.id)}>
      {item.label}</button>)}
   </div>
   <p className={"w1a-message"+(fake?" w1a-message-demo":"")} role="status" aria-live="polite">
    {MODES.find(x=>x.id===mode)?.message}
   </p>
  </section>

  <header className="w1a-top">
   <a href="/review/interactive">بازگشت به داشبورد آزمایشی ←</a>
   <span>W1 / NAV-04 · نمایش اطلاع‌رسانی، نه سامانه رأی‌گیری</span>
  </header>
  <section className="w1a-hero">
   <div><span className="w1a-eyebrow">مرجع انتشار رسمی مستقل · وضعیت فعلی: مسدود</span>
    <h2>مجامع عمومی و انتخابات تعاونی</h2>
    <p>دعوت‌نامه‌ها، سوابق مجامع، صورت‌جلسات و اطلاعات انتخابات در یک محیط نمونه بررسی می‌شوند؛ هیچ حق رأی، نصاب، رأی‌دهنده یا نتیجه رسمی تعیین نمی‌شود.</p>
   </div>
   <div className="w1a-demo"><strong>DEMO</strong><span>داده کاملاً مصنوعی؛ فاقد اسناد و اشخاص واقعی</span></div>
  </section>
  <p className="w1a-guard" role="note">
   <strong>قید حقوقی:</strong> صلاحیت دعوت‌کننده، اهلیت شرکت‌کنندگان، میزان حق رأی، اعتبار دعوت، نصاب و نتایج باید برای هر تعاونی توسط مراجع معتبر مستقل تعیین شود. هیچ‌یک در این پیش‌نمایش فرض یا محاسبه نشده است.
  </p>
  {fake?<div className="w1a-content">
   <section id="w1a-records" className="w1a-records" aria-label="فهرست اسناد آزمایشی">
    <div className="w1a-section-head"><h2>فهرست سوابق و اطلاعیه‌های ساختگی</h2>
     <span>۶ نمونه · هیچ انتشار رسمی انجام نشده</span>
    </div>
    <div className="w1a-filters" role="group" aria-label="فیلتر نوع سند">
     {FILTERS.map(tab=><button key={tab.value} type="button"
      aria-pressed={filter===tab.value} onClick={()=>selectFilter(tab.value)}
      className={filter===tab.value?"w1a-filter w1a-filter-selected":"w1a-filter"}>
      {tab.label}</button>)}
    </div>
    <div className="w1a-list" role="group" aria-label="انتخاب سابقه نمایشی">
     {filtered.map(record=><button key={record.id} type="button"
      className={current.id===record.id?"w1a-record w1a-record-selected":"w1a-record"}
      aria-pressed={current.id===record.id} onClick={()=>setSelectedId(record.id)}>
      <small dir="ltr">{record.id}</small>
      <strong>{record.title}</strong>
      <span>{KIND_LABEL[record.recordType]} · فقط نمونه</span>
     </button>)}
    </div>
   </section>
   <section className="w1a-details" aria-label="جزئیات نمونه منتخب">
    <div className="w1a-section-head"><div><span className="w1a-label">پرونده نمونه · بدون اثر قانونی</span>
     <h2>{current.title}</h2></div><span className="w1a-status">تأیید رسمی نشده</span>
    </div>
    <p className="w1a-summary">{current.summary}</p>
    <dl className="w1a-meta">
     <div><dt>نوع مجمع / موضوع</dt><dd>{current.assemblyKind}</dd></div>
     <div><dt>زمان</dt><dd>{current.scheduledAt}</dd></div>
     <div><dt>مکان</dt><dd>{current.location}</dd></div>
     <div><dt>وضعیت انتشار</dt><dd>{current.publicationState}</dd></div>
     <div><dt>مرجع رسمی</dt><dd>{current.sourceAuthority}</dd></div>
     <div><dt>نسخه اطلاعات</dt><dd>{current.version} ـ کاملاً ساختگی</dd></div>
     <div><dt>مصوبه/نتیجه</dt><dd>{current.decisionState}</dd></div>
     <div><dt>سطح دسترسی واقعی</dt><dd>{current.audienceScope}</dd></div>
    </dl>
    <div className="w1a-docs">
     <h3>فهرست پیوست‌ها و اسناد</h3>
     <p>عنوان‌ها فقط الگوی طراحی‌اند؛ هیچ سند، امضا، تصویر یا لینک دانلود واقعی وجود ندارد.</p>
     {current.documents.map(doc=><div key={doc.id} className="w1a-doc">
      <div><strong>{doc.title}</strong><small dir="ltr">{doc.id} · {doc.kind}</small></div>
      <button type="button" disabled aria-disabled="true">دریافت سند (غیرفعال)</button>
     </div>)}
    </div>
    <div className="w1a-vote">
     <h3>انتخابات و حق رأی</h3>
     <p>اهلیت رأی‌دهنده، نوع رأی، نصاب، نامزدها و شمارش آرا: <strong>نامعلوم و تأییدنشده</strong>. وجود نمونه اطلاعات انتخابات هیچ حقی ایجاد نمی‌کند.</p>
     <button type="button" disabled aria-disabled="true">ثبت رأی (غیرفعال)</button>
     <button type="button" disabled aria-disabled="true">تأیید حضور (غیرفعال)</button>
     <button type="button" disabled aria-disabled="true">انتشار نتیجه (غیرفعال)</button>
    </div>
   </section>
  </div>:<section className="w1a-empty" aria-label="منبع بسته">
    <strong>{mode==="UNVERIFIED"?"مرجع رسمی هنوز تأیید نشده":"منبع داده در دسترس نیست"}</strong>
    <p>—</p>
    <span>برای مشاهده نمونه طراحی، گزینه «نمونه کاملاً ساختگی» را انتخاب کنید.</span>
   </section>}
  <section className="w1a-gates">
   <h2>پیش‌نیازهای انتشار مجاز اسناد و نتایج</h2>
   <p>موارد زیر فهرست طراحی و بررسی هستند، نه فهرست قوانین تأییدشده یا مجوز خودکار سامانه.</p>
   <ol>{REFERENCE_REVIEW_GATES.map(item=><li key={item}>{item}</li>)}</ol>
  </section>
  <footer className="w1a-footer">
   این صفحه فقط‌خواندنی و کاملاً ساختگی است. ثبت نامزد، رأی‌گیری، محاسبه حق رأی یا نصاب، حضور و غیاب، ارسال دعوت، بارگذاری یا دانلود اسناد، انتشار رسمی و اعلام نتیجه انجام نمی‌شود.
  </footer>
   </div>
  </section>
 </div></main>;
}
