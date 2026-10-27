"use client";

import {useState} from "react";
import {
 GOVERNANCE_FIXTURES,GOVERNANCE_SOURCE_GATES,STATUS_LABEL,UNKNOWN,
 type AssemblyKind,type GovernanceFixture
} from "./governance-fixtures";

type Mode="BLOCKED"|"DEMO";
const CATEGORIES:readonly {id:AssemblyKind;label:string;meaning:string}[]=[
 {id:"ASSEMBLY",label:"مجامع عمومی",meaning:"دعوت‌نامه، دستور جلسه، صورت‌جلسه و سوابق انتشار"},
 {id:"ELECTION",label:"انتخابات تعاونی",meaning:"اطلاع‌رسانی فرایند، سابقه و مرجع اعلام نتیجه"}
];
function PairList({entries}:{entries:readonly (readonly [string,string])[]}){
 return <dl className="w1a-pairs">{entries.map(([term,value])=><div key={term}>
  <dt>{term}</dt><dd>{value}</dd>
 </div>)}</dl>;
}
function GovernanceDetails({item}:{item:GovernanceFixture}){
 return <section className="w1a-details" aria-labelledby="w1a-detail-title">
  <div className="w1a-detail-header">
   <div><span className="w1a-status">{STATUS_LABEL[item.status]} · فقط نمونه</span>
    <h2 id="w1a-detail-title">{item.title}</h2><p>{item.headline}</p>
   </div>
   <span className="w1a-data-stamp">DEMO / فاقد اعتبار قانونی</span>
  </div>
  <div className="w1a-panels">
   <article className="w1a-panel">
    <h3>شناسنامه و زمان‌بندی نمایشی</h3>
    <PairList entries={[
     ["شناسه رکورد",item.id],
     ["نوع رویداد",item.classification],
     ["برگزارکننده",item.organizer],
     ["تاریخ فرضی",item.at],
     ["مکان فرضی",item.place],
     ["مرجع انتشار",item.decisionAuthority],
     ["اعتبار انتشار واقعی","— (مرجع مستقل تأیید نشده)"]
    ]}/>
   </article>
   <article className="w1a-panel">
    <h3>دستور جلسه و موضوعات</h3>
    <ol className="w1a-agenda">
     {item.agenda.map((subject,index)=><li key={index}>{subject}</li>)}
    </ol>
    <h3>صورت‌جلسه، مصوبات و نتایج</h3>
    <p className="w1a-result">{item.results}</p>
    <p className="w1a-warning">متن و اسامی واقعی، امضا، شماره ثبت مصوبه و صورت‌جلسه قانونی در این پیش‌نمایش موجود نیست.</p>
   </article>
  </div>
  <section className="w1a-documents" aria-label="مدارک نمایشی">
   <h3>فهرست مدارک و سوابق نمونه</h3>
   <p>فقط نوع سند و وضعیت آن نمایش داده می‌شود؛ فایل، لینک دانلود، امضا یا مرجع قانونی بارگذاری نشده است.</p>
   <div className="w1a-doc-list">{item.documents.map(doc=><article key={doc.code} className="w1a-doc">
    <div><strong>{doc.title}</strong><small>{doc.kind}</small><code dir="ltr">{doc.code}</code></div>
    <div><span>{doc.status}</span><small>{doc.version}</small></div>
    <button type="button" disabled aria-disabled="true">مشاهده فایل (غیرفعال)</button>
   </article>)}</div>
  </section>
  <div className="w1a-auth">
   <strong>حدود اختیار و حق رأی</strong>
   <p>مرجع احراز اعضا و صاحبان حق رأی، نصاب، روش رأی‌گیری و نتیجه معتبر در این نمونه تعریف یا محاسبه نشده است. عضویت Child06 یا تعداد سهم Child07 به‌تنهایی مجوز رأی‌دادن یا تعیین وزن رأی ایجاد نمی‌کند.</p>
   <PairList entries={[
    ["وضعیت مجازبودن مخاطب",UNKNOWN],
    ["صلاحیت رأی و حق رأی",UNKNOWN],
    ["نصاب قانونی جلسه",UNKNOWN],
    ["اعتبار صورت‌جلسه و نتیجه",UNKNOWN],
    ["امکان ثبت‌نام، نامزدی یا رأی‌دادن","غیرفعال؛ فقط راهنمای بصری"]
   ]}/>
  </div>
 </section>;
}
export function SyntheticAssembliesAndElections(){
 const [mode,setMode]=useState<Mode>("BLOCKED");
 const [kind,setKind]=useState<AssemblyKind>("ASSEMBLY");
 const [activeId,setActiveId]=useState<string>("DEMO-ASM-INVITE-01");
 const all=GOVERNANCE_FIXTURES.filter(record=>record.kind===kind);
 const active=all.find(record=>record.id===activeId)??all[0];
 function changeKind(newKind:AssemblyKind){
  setKind(newKind);
  const first=GOVERNANCE_FIXTURES.find(record=>record.kind===newKind);
  if(first)setActiveId(first.id);
 }
 return <main className="w1a-shell" dir="rtl">
  <header className="w1a-top">
   <a href="/review/interactive">بازگشت به داشبورد آزمایشی ←</a>
   <span>W1 / NAV-04 · مجامع و انتخابات · پیش‌نمایش اطلاعاتی</span>
  </header>
  <section className="w1a-hero">
   <div><span className="w1a-tag">هیچ دعوت‌نامه، رأی یا صورت‌جلسه رسمی منتشر نشده</span>
    <h1>مجامع عمومی و انتخابات تعاونی</h1>
    <p>نمونه طراحی فهرست مجامع، دعوت‌نامه‌ها، دستور جلسه، سوابق صورت‌جلسات و اطلاع‌رسانی انتخاباتی. اطلاعات ساختگی هستند و هیچ حق رأی یا تصمیم حقوقی ایجاد نمی‌کنند.</p>
   </div>
   <strong className="w1a-demo">DEMO<small>پیش‌نمایش ساختگی</small></strong>
  </section>
  <section className="w1a-access" aria-label="وضعیت منبع اطلاعات مجامع">
   <h2>وضعیت دسترسی به منابع رسمی</h2>
   <p>منابع رسمی دعوت‌نامه‌ها، صورت‌جلسات، نتایج انتخابات و حقوق مخاطبان هنوز تأیید نشده‌اند. حالت پیش‌فرض، نمایش امن و بدون داده است.</p>
   <div className="w1a-mode-controls" role="group" aria-label="انتخاب حالت نمایش داده‌ها">
    <button type="button" aria-pressed={mode==="BLOCKED"} className={mode==="BLOCKED"?"w1a-mode w1a-mode-on":"w1a-mode"} onClick={()=>setMode("BLOCKED")}>منبع مسدود</button>
    <button type="button" aria-pressed={mode==="DEMO"} className={mode==="DEMO"?"w1a-mode w1a-mode-on":"w1a-mode"} onClick={()=>setMode("DEMO")}>نمایش نمونه‌های کاملاً ساختگی</button>
   </div>
   <p className="w1a-source-status" role="status" aria-live="polite">
    {mode==="BLOCKED"?
     "انتشار مصوب، صلاحیت دسترسی، مرجع سند و حق رأی تأیید نشده است؛ هیچ رکورد یا نتیجه واقعی نمایش داده نمی‌شود.":
     "حالت نمونه فعال است؛ تمام رکوردها DEMO، بدون اطلاعات شخصی، سند معتبر یا اثر حقوقی هستند."}
   </p>
  </section>
  <nav className="w1a-tabs" aria-label="انتخاب بخش مجامع و انتخابات">
   {CATEGORIES.map(option=><button type="button" key={option.id}
    onClick={()=>changeKind(option.id)}
    aria-pressed={kind===option.id}
    className={kind===option.id?"w1a-tab w1a-tab-active":"w1a-tab"}>
    <strong>{option.label}</strong><span>{option.meaning}</span>
   </button>)}
  </nav>
  {mode==="DEMO"?
   <div className="w1a-layout">
    <aside className="w1a-sidebar" aria-label="فهرست نمونه‌های آزمایشی">
     <h2>{kind==="ASSEMBLY"?"نمونه‌های مجامع":"نمونه‌های انتخابات"}</h2>
     <p>انتخاب هر پرونده فقط محتوای آموزشی سمت مرورگر را تغییر می‌دهد.</p>
     <div className="w1a-items" role="group" aria-label="انتخاب پرونده ساختگی">
      {all.map(item=><button type="button" key={item.id}
       aria-pressed={active.id===item.id}
       className={active.id===item.id?"w1a-item w1a-item-selected":"w1a-item"}
       onClick={()=>setActiveId(item.id)}>
       <small dir="ltr">{item.id}</small><strong>{item.title}</strong>
       <span>{STATUS_LABEL[item.status]}</span>
      </button>)}
     </div>
    </aside>
    <GovernanceDetails key={active.id} item={active}/>
   </div>:
   <div className="w1a-empty" role="status">
    <strong>اطلاعات رسمی هنوز قابل نمایش نیست</strong>
    <p>وضعیت نامشخص مجمع به معنی برگزارنشدن جلسه، نبود صورت‌جلسه، لغو انتخابات یا نداشتن حق رأی نیست.</p>
    <span>برای بررسی صرفاً بصری، دکمه «نمایش نمونه‌های کاملاً ساختگی» را انتخاب کنید.</span>
   </div>}
  <section className="w1a-rules">
   <h2>شرط‌های مستقل انتشار و اعتبار</h2>
   <dl>{Object.entries(GOVERNANCE_SOURCE_GATES).map(([name,status])=>
    <div key={name}><dt dir="ltr">{name}</dt><dd dir="ltr">{status}</dd></div>)}</dl>
   <p>در نسخه عملیاتی، اعلام رسمی مجمع، تشخیص حق رأی و اعتبار نتایج باید از مراجع قانونی مستقل و اطلاعات مجاز همان تعاونی تأیید شود؛ این صفحه سامانه رأی‌گیری یا رسیدگی به انتخابات نیست.</p>
  </section>
  <footer className="w1a-footer">فاقد ارتباط API، بارگذاری فایل، ارسال پیامک، ثبت‌نام نامزد، ثبت رأی، شمارش آرا، انتشار رسمی، محاسبه حق رأی یا تغییر دفتر سهام. هیچ داده واقعی تعاونی در این صفحه استفاده نمی‌شود.</footer>
 </main>;
}
