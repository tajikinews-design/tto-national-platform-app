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
  <header className="w1a-top">
   <a href="/review/interactive">بازگشت به داشبورد آزمایشی ←</a>
   <span>W1 / NAV-04 · نمایش اطلاع‌رسانی، نه سامانه رأی‌گیری</span>
  </header>
  <section className="w1a-hero">
   <div><span className="w1a-eyebrow">مرجع انتشار رسمی مستقل · وضعیت فعلی: مسدود</span>
    <h1>مجامع عمومی و انتخابات تعاونی</h1>
    <p>دعوت‌نامه‌ها، سوابق مجامع، صورت‌جلسات و اطلاعات انتخابات در یک محیط نمونه بررسی می‌شوند؛ هیچ حق رأی، نصاب، رأی‌دهنده یا نتیجه رسمی تعیین نمی‌شود.</p>
   </div>
   <div className="w1a-demo"><strong>DEMO</strong><span>فاقد اسناد و اشخاص واقعی</span></div>
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
  {fake?<div className="w1a-content">
   <section className="w1a-records" aria-label="فهرست اسناد آزمایشی">
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
 </main>;
}
