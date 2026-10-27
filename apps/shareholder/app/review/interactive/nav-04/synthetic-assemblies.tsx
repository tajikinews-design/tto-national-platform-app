"use client";
import {useState} from "react";
import {ASSEMBLY_FIXTURES,KIND_LABEL,REFERENCE_REVIEW_GATES,
 type RecordType,type DemoSourceState} from "./assembly-fixtures";

type Filter="ALL"|RecordType;
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
 ["▢","اخبار و ارتباط با شرکت",""],
 ["⚙","خدمات من",""],
 ["▣","فروشگاه و فرصت‌ها",""],
 ["▤","پروژه‌های شرکت",""],
 ["◇","شفافیت و اسناد شرکت",""],
 ["▥","گزارش‌های من",""],
 ["⚙","تنظیمات حساب",""]
] as const;
function ReviewSidebar(){
 return <aside className="w1a-sidebar" aria-label="منوی پنل سهامدار">
  <div className="w1a-brand"><span className="w1a-brand-mark" aria-hidden="true">✦</span>
   <div><strong>پلتفرم ملی تعاونی توسعه و عمران</strong><small>شبکه هوشمند خدمات و راهبری تعاونی‌ها</small></div>
  </div>
  <nav className="w1a-side-links" aria-label="یازده بخش مصوب پنل">
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
  <div className="w1a-global-search" aria-label="جست‌وجوی غیرفعال در نسخه بازبینی">
   <span aria-hidden="true">⌕</span> جستجوی اطلاعیه‌ها، مجامع، سهام و خدمات (غیرفعال)
  </div>
  <div className="w1a-global-user"><span className="w1a-notice-icon" aria-hidden="true">♧</span><span className="w1a-avatar" aria-hidden="true">س</span>
   <div><strong>سهامدار</strong><small>پنل شخصی · نمونه غیرعملیاتی</small></div></div>
 </div>;
}
function ApprovedVisualOverview(){
 const inv=ASSEMBLY_FIXTURES.filter(item=>item.recordType==="INVITATION");
 const minute=ASSEMBLY_FIXTURES.filter(item=>item.recordType==="MINUTES");
 const elections=ASSEMBLY_FIXTURES.filter(item=>item.recordType==="ELECTION_INFO");
 const outcomes=ASSEMBLY_FIXTURES.filter(item=>item.recordType==="RESULT");
 const showcase=inv[0];
 return <section className="w1a-approved-overview" aria-label="نمای مصوب مجامع ـ تمام اطلاعات مصنوعی">
  <div className="w1a-next-meeting">
   <div className="w1a-meeting-tile" aria-hidden="true"><div className="w1a-room-graphic"><span>مجامع عمومی</span><i/><i/><i/></div></div>
   <div className="w1a-meeting-info">
    <span className="w1a-mock-ribbon">پیش‌نمایش تصویری · DEMO · انتشار رسمی نشده</span>
    <h2>مجمع بعدی من <span className="w1a-badge-blue">نمونه فرضی</span></h2>
    <h3>{showcase.title}</h3>
    <div className="w1a-meeting-meta"><span>◷ {showcase.scheduledAt}</span><span>⌖ {showcase.location}</span></div>
    <p>هیچ دعوت‌نامه واقعی ارسال نشده و حضور یا حق رأی هیچ شخصی تأیید نشده است.</p>
    <a className="w1a-primary-link" href="#w1a-records">مشاهده جزئیات نمونه ←</a>
   </div>
   <div className="w1a-countdown"><strong>—</strong><span>زمان باقیمانده</span><small>قابل محاسبه فقط با تاریخ رسمی</small></div>
  </div>
  <div className="w1a-kpi-row">
   <article className="w1a-kpi w1a-kpi-sky"><span className="w1a-kpi-icon">▤</span><div><h3>اسناد و مصوبات جدید</h3><strong>{(minute.length+outcomes.length).toLocaleString("fa-IR")}</strong><small>نمونه صرفاً نمایشی</small></div></article>
   <article className="w1a-kpi w1a-kpi-mint"><span className="w1a-kpi-icon">▣</span><div><h3>انتخابات فعال</h3><strong>{elections.length.toLocaleString("fa-IR")}</strong><small>فقط کارت نمونه؛ فعالیت واقعی نامعلوم</small></div></article>
   <article className="w1a-kpi w1a-kpi-apricot"><span className="w1a-kpi-icon">✓</span><div><h3>اقدامات موردنیاز من</h3><strong>—</strong><small>حق اقدام یا وظیفه احراز نشده</small></div></article>
   <article className="w1a-kpi w1a-kpi-lilac"><span className="w1a-kpi-icon">▣</span><div><h3>مجامع پیش‌رو</h3><strong>{inv.length.toLocaleString("fa-IR")}</strong><small>دعوت‌نامه‌های ساختگی</small></div></article>
  </div>
  <div className="w1a-four-panels">
   <section className="w1a-summary-panel">
    <div className="w1a-panel-heading"><h3>جدیدترین اسناد و مصوبات</h3><span>۳ عنوان نمایشی</span></div>
    {[...minute,...outcomes].map(rec=><div className="w1a-panel-line" key={rec.id}>
     <span className="w1a-file-icon" aria-hidden="true">▤</span><div><strong>{rec.title}</strong><small>دریافت سند غیرفعال · فاقد نسخه معتبر</small></div><span className="w1a-pill">نمونه</span>
    </div>)}
   </section>
   <section className="w1a-summary-panel">
    <div className="w1a-panel-heading"><h3>آخرین اطلاعیه‌ها</h3><span>۲ عنوان فرضی</span></div>
    {inv.map(rec=><div className="w1a-panel-line" key={rec.id}>
     <span className="w1a-file-icon" aria-hidden="true">♧</span><div><strong>{rec.title}</strong><small>انتشار رسمی انجام نشده</small></div><span className="w1a-pill w1a-pill-blue">DEMO</span>
    </div>)}
    <div className="w1a-panel-tip">اعلان درون‌برنامه‌ای جایگزین آگهی قانونی نیست.</div>
   </section>
   <section className="w1a-summary-panel">
    <div className="w1a-panel-heading"><h3>انتخابات فعال</h3><span>اطلاعات انتخابات</span></div>
    {elections.map(rec=><div className="w1a-panel-line" key={rec.id}>
     <span className="w1a-file-icon" aria-hidden="true">♟</span><div><strong>{rec.title}</strong><small>نامزد و زمان واقعی مشخص نیست</small></div><span className="w1a-pill w1a-pill-orange">غیررسمی</span>
    </div>)}
    <div className="w1a-panel-tip">ثبت نامزدی و رأی‌گیری در این نسخه غیرفعال است.</div>
   </section>
   <section className="w1a-summary-panel">
    <div className="w1a-panel-heading"><h3>مجامع پیش‌رو</h3><span>دعوت‌نامه‌های نمونه</span></div>
    {inv.map(rec=><div className="w1a-panel-line" key={rec.id}>
     <span className="w1a-file-icon" aria-hidden="true">▦</span><div><strong>{rec.assemblyKind}</strong><small>{rec.scheduledAt}</small></div><span className="w1a-pill">نمونه</span>
    </div>)}
   </section>
  </div>
  <div className="w1a-actions-row" aria-label="مسیرهای این ماژول در نسخه طراحی">
   <a href="#w1a-records" className="w1a-action w1a-action-blue"><span>▤</span><div><strong>مشاهده مجامع</strong><small>اطلاعات، دستور جلسه و سوابق نمونه</small></div>←</a>
   <span className="w1a-action w1a-action-green w1a-action-disabled" aria-disabled="true"><span>♙</span><div><strong>مدیریت وکالت</strong><small>به اتصال مرجع معتبر نیاز دارد</small></div>—</span>
   <span className="w1a-action w1a-action-orange w1a-action-disabled" aria-disabled="true"><span>♧</span><div><strong>ثبت نامزدی در انتخابات</strong><small>در نسخه نمایشی عملیاتی نیست</small></div>—</span>
   <a href="#w1a-records" className="w1a-action w1a-action-purple"><span>▤</span><div><strong>نتایج و مصوبات</strong><small>مرور عنوان‌های ساختگی</small></div>←</a>
  </div>
 </section>;
}

export function SyntheticAssemblies(){
 const [mode,setMode]=useState<DemoSourceState>("UNVERIFIED");
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
  <header className="w1a-top">
   <a href="/review/interactive">بازگشت به داشبورد آزمایشی ←</a>
   <span>W1 / NAV-04 · نمایش اطلاع‌رسانی، نه سامانه رأی‌گیری</span>
  </header>
  <section className="w1a-hero">
   <div><span className="w1a-eyebrow">مرجع انتشار رسمی مستقل · وضعیت فعلی: مسدود</span>
    <h1>مجامع عمومی و انتخابات تعاونی</h1>
    <p>دعوت‌نامه‌ها، سوابق مجامع، صورت‌جلسات و اطلاعات انتخابات در یک محیط نمونه بررسی می‌شوند؛ هیچ حق رأی، نصاب، رأی‌دهنده یا نتیجه رسمی تعیین نمی‌شود.</p>
   </div>
   <div className="w1a-demo"><strong>DEMO</strong><span>داده کاملاً مصنوعی؛ فاقد اسناد و اشخاص واقعی</span></div>
  </section>
  <p className="w1a-guard" role="note">
   <strong>قید حقوقی:</strong> صلاحیت دعوت‌کننده، اهلیت شرکت‌کنندگان، میزان حق رأی، اعتبار دعوت، نصاب و نتایج باید برای هر تعاونی توسط مراجع معتبر مستقل تعیین شود. هیچ‌یک در این پیش‌نمایش فرض یا محاسبه نشده است.
  </p>
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
  {fake?<ApprovedVisualOverview/>:<section className="w1a-preview-placeholder" aria-label="نمای اصلی بدون منبع معتبر"><strong>مجمع بعدی من</strong><p>اطلاعات مجمع، شمارنده‌ها، اطلاعیه‌ها و اسناد تا تأیید منبع معتبر نمایش داده نمی‌شوند.</p></section>}
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
 </div></main>;
}
