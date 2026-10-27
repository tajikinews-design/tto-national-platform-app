"use client";

import {useState,type ReactNode} from "react";
import {OWNER_LABEL,SOURCE_SPEC,type PreviewFlow} from "../market-flow-model";
import {CASES,DISPUTE_REASONS,LEGAL_EFFECT_LABEL,type PreviewCase} from "./case-fixtures";

type Filter="ALL"|PreviewFlow;

function Detail({title,children}:{title:string;children:ReactNode}){
 return <section className="w1t-detail-section">
  <h3>{title}</h3>{children}
 </section>;
}
function DefinitionRows({rows}:{rows:readonly (readonly [string,string])[]}){
 return <dl className="w1t-dl">
  {rows.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
 </dl>;
}
function CaseDetails({item}:{item:PreviewCase}){
 const disputed=item.exceptionCode==="PAYMENT_DISPUTED";
 const pendingCancel=item.exceptionCode==="CANCELLATION_REQUEST";
 const blockedEffect=item.legalEffect!=="SYNTHETIC_COMPLETED";
 return <>
  <div className="w1t-summary" role="status" aria-live="polite">
   <div>
    <span className="w1t-section-label">پرونده نمایشی · فاقد شماره پرونده واقعی</span>
    <h2>{item.title}</h2>
    <p>{item.summary}</p>
   </div>
   <span className="w1t-owner">
    <small>مسئول اقدام بعدی در مدل مرجع</small>
    <strong>{OWNER_LABEL[item.nextActionOwner]}</strong>
   </span>
  </div>
  <div className={"w1t-legal-effect"+(blockedEffect?" w1t-legal-blocked":"")}>
   <strong>وضعیت اثر حقوقی در این سناریو</strong>
   <p>{LEGAL_EFFECT_LABEL[item.legalEffect]}</p>
   <span>در سامانه واقعی: مالکیت فقط بعد از تمام گیت‌ها و Finalization اتمیک منتقل می‌شود. این پیش‌نمایش هیچ مالکیت واقعی ایجاد نمی‌کند.</span>
  </div>
  <div className="w1t-detail-grid">
   <Detail title="شناسنامه و وضعیت پرونده">
    <DefinitionRows rows={[
     ["شناسه پرونده غیرواقعی",item.id],
     ["نوع مسیر",item.flow==="BUY"?"درخواست خرید":"درخواست فروش"],
     ["کد وضعیت مرجع",item.statusCode],
     ["حالت استثنایی",item.exceptionCode??"—"],
     ["زمان ایجاد",item.timestamps.opened],
     ["آخرین تغییر",item.timestamps.lastUpdate],
     ["مرجع مدل",SOURCE_SPEC]
    ]}/>
   </Detail>
   <Detail title="بررسی و مستندات هیئت‌مدیره">
    <DefinitionRows rows={[
     ["وضعیت تصمیم",item.board.state],
     ["ارجاع جلسه",item.board.meetingRef],
     ["ارجاع مصوبه",item.board.decisionRef],
     ["صلاحیت و امضای واقعی","تأیید نشده؛ هیچ سند حقیقی بارگذاری نشده"],
     ["نقش قانونی", "تأیید مستقل هیئت‌مدیره در صورت الزام مقررات معتبر؛ نه با کلیک در صفحه"]
    ]}/>
   </Detail>
   <Detail title="پرداخت و تأیید وصول فروشنده">
    <DefinitionRows rows={[
     ["وضعیت پرداخت",item.payment.state],
     ["اعلام پرداخت خریدار",item.payment.reportedRef],
     ["تأیید وصول فروشنده",item.payment.sellerConfirmationRef],
     ["مبلغ، بانک و رسید معتبر",item.payment.amount],
     ["مسیر وجه","در فرایند مجاز: خریدار ← فروشنده، خارج از کیف پول پلتفرم"],
     ["هشدار","PAYMENT_REPORTED ≠ PAYMENT_CONFIRMED ≠ انتقال مالکیت"]
    ]}/>
   </Detail>
   <Detail title="هزینه‌ها و دفتر رسمی سهام">
    <DefinitionRows rows={[
     ["وضعیت هزینه‌ها",item.fees.state],
     ["نسخه مصوب تعرفه",item.fees.policyRef],
     ["وضعیت ثبت دفتر",item.register.state],
     ["ارجاع دفتر",item.register.registerRef],
     ["شماره صفحه دفتر",item.register.page],
     ["ردیف دفتر",item.register.row],
     ["بازبین ثبت",item.register.verifiedBy],
     ["شرط نهایی","ثبت دفتر، تأیید نهایی و Finalization اتمیک باید جداگانه کامل شوند"]
    ]}/>
   </Detail>
  </div>
  <Detail title="درخواست انصراف، اختلاف و مهلت‌ها">
   <div className="w1t-cancel">
    <p><strong>وضعیت لغو یا انصراف:</strong> {item.cancellation.state}</p>
    <p>{item.cancellation.rule}</p>
    <p>{pendingCancel?
     "این پرونده فقط درخواست بررسی انصراف را نمایش می‌دهد؛ بعد از Reservation لغو مستقیم رخ نداده است.":
     disputed?"پرونده نمونه دارای اختلاف پرداخت باز است؛ هرگونه Finalization باید متوقف بماند.":
     "هیچ لغو یا اختلاف واقعی از این صفحه ثبت نمی‌شود. پایان مهلت تأیید خودکار ایجاد نمی‌کند."}</p>
   </div>
   <details className="w1t-reasons">
    <summary>نمونه کدهای دلیل اختلاف طبق Specification</summary>
    <div>{DISPUTE_REASONS.map(code=><code key={code}>{code}</code>)}</div>
   </details>
   <p className="w1t-dispute-warning">پس از تکمیل واقعی معامله، لغو مستقیم ممنوع است و فقط Correction Case مستقل با بررسی مستند مطرح می‌شود.</p>
  </Detail>
  <Detail title="خط زمانی و سابقه ممیزی نمونه">
   <p className="w1t-audit-note">این تاریخچه صرفاً Fixture ثابت طراحی است، نه Audit دائمی یا قابل استناد. در Runtime آینده، رویداد واقعی باید تغییرناپذیر، tenant-scoped و دارای actor، role، before، after، request_id، timestamp، reason_code و metadata معتبر باشد.</p>
   <ol className="w1t-timeline">
    {item.timeline.map((event,index)=><li key={event.requestId} className="w1t-event">
     <span className="w1t-event-index">{String(index+1).padStart(2,"0")}</span>
     <div>
      <strong>{event.title}</strong>
      <code dir="ltr">{event.step}</code>
      <span>نقش اقدام‌کننده مفروض: {OWNER_LABEL[event.role]} · {event.timestamp}</span>
      <span>شناسه اقدام‌کننده ساختگی: {event.actor}</span>
      <details><summary>جزئیات ممیزی ساختگی</summary>
       <dl>
        <div><dt>before</dt><dd>{event.before}</dd></div>
        <div><dt>after</dt><dd>{event.after}</dd></div>
        <div><dt>request_id</dt><dd>{event.requestId}</dd></div>
        <div><dt>reason_code</dt><dd>{event.reasonCode}</dd></div>
        <div><dt>metadata</dt><dd>{event.metadata}</dd></div>
       </dl>
      </details>
     </div>
    </li>)}
   </ol>
  </Detail>
  <div className="w1t-disabled-actions" role="note">
   <strong>همه اقدامات مسدود هستند</strong>
   <p>ارسال درخواست لغو، تأیید پرداخت، اعلام اختلاف، بارگذاری رسید، تأیید هیئت‌مدیره، ثبت دفتر سهام و تکمیل معامله در این صفحه امکان‌پذیر نیست.</p>
   <button type="button" disabled aria-disabled="true">اقدام بعدی (غیرفعال)</button>
  </div>
 </>;
}

export function SyntheticTradeCaseTracking(){
 const [filter,setFilter]=useState<Filter>("ALL");
 const [selectedId,setSelectedId]=useState(CASES[0].id);
 const filtered=CASES.filter(item=>filter==="ALL"||item.flow===filter);
 const selected=filtered.find(item=>item.id===selectedId)??filtered[0];
 function switchFilter(value:Filter){
  setFilter(value);
  const first=CASES.find(item=>value==="ALL"||item.flow===value);
  if(first)setSelectedId(first.id);
 }
 return <main className="w1t-shell" dir="rtl">
  <header className="w1t-top">
   <a href="/review/interactive/nav-03">بازگشت به گردش‌کارهای خرید و فروش ←</a>
   <span>NAV-03 / جزئیات پرونده · فقط نسخه آموزشی</span>
  </header>
  <div className="w1t-hero">
   <div><span className="w1t-tag">بر اساس {SOURCE_SPEC} · فاقد داده واقعی</span>
    <h1>جزئیات و پیگیری پرونده معامله</h1>
    <p>از میان پرونده‌های ساختگی انتخاب کنید تا مراحل، مسئول بعدی، ثبت دفتر سهام، پرداخت و اختلاف را بررسی کنید.</p>
   </div>
   <strong className="w1t-demo">DEMO<br/><small>داده کاملاً مصنوعی</small></strong>
  </div>
  <p className="w1t-global-guard" role="note">
   هیچ پرونده واقعی خوانده یا ذخیره نمی‌شود. شناسه‌ها و مستندات دارای برچسب DEMO هستند. این صفحه نه مجوز معامله است، نه گواهی مالکیت و نه سامانه پرداخت یا تأیید قانونی.
  </p>
  <section className="w1t-selector" aria-label="انتخاب پرونده نمایشی">
   <h2>پرونده‌های آزمایشی</h2>
   <div className="w1t-filters" role="group" aria-label="فیلتر نوع معامله">
    {([["ALL","همه"],["SELL","فروش"],["BUY","خرید"]] as const).map(([value,label])=>
     <button key={value} type="button" aria-pressed={filter===value}
      className={filter===value?"w1t-filter w1t-filter-active":"w1t-filter"}
      onClick={()=>switchFilter(value)}>{label}</button>)}
   </div>
   <div className="w1t-cases" role="group" aria-label="انتخاب سناریوی پرونده">
    {filtered.map(item=><button type="button" key={item.id}
      onClick={()=>setSelectedId(item.id)} aria-pressed={selected.id===item.id}
      className={selected.id===item.id?"w1t-case w1t-case-selected":"w1t-case"}>
     <small dir="ltr">{item.id}</small><strong>{item.title}</strong>
     <span>{item.exceptionCode??item.statusCode}</span>
    </button>)}
   </div>
  </section>
  <CaseDetails key={selected.id} item={selected}/>
  <footer className="w1t-footer">مرز قطعی این مرحله: بدون API، اطلاعات واقعی سهامداران، SMS، بانک، دریافت سند، ثبت درخواست، تأیید وصول، اصلاح دفتر یا انتقال مالکیت. تمام منابع رسمی همچنان به گیت قانونی مستقل وابسته‌اند.</footer>
 </main>;
}
