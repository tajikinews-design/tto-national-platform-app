"use client";

import {useState} from "react";

type DomainState="blocked"|"loading"|"missing"|"denied"|"unavailable"|"expired"|"verified";
type Domain="CHILD06_MEMBERSHIP"|"CHILD07_HOLDINGS";
type PreviewField={label:string;value:string};
type CardProps={
 domain:Domain;
 title:string;
 purpose:string;
 state:DomainState;
 onStateChange:(value:DomainState)=>void;
 fields:readonly PreviewField[];
 sourceLabel:string;
 versionLabel:string;
 asOfLabel:string;
};

const STATES:readonly {id:DomainState;label:string;message:string}[]=[
 {id:"blocked",label:"منبع تأیید نشده",message:"مرجع رسمی و مجوز قانونی هنوز تأیید نشده‌اند؛ نتیجه درباره عضویت یا سهم نامعلوم است."},
 {id:"loading",label:"در حال بارگذاری",message:"فقط شبیه‌سازی نمای بارگذاری است؛ درخواست شبکه‌ای یا استعلام واقعی انجام نمی‌شود."},
 {id:"missing",label:"اطلاعات موجود نیست",message:"هیچ رکورد قابل استنادی در این نمونه در دسترس نیست؛ این وضعیت معادل عدم عضویت یا صفر سهم نیست."},
 {id:"denied",label:"دسترسی تأیید نشد",message:"صلاحیت نمایش اطلاعات این منبع مستقل تأیید نشده است."},
 {id:"unavailable",label:"ارتباط با منبع قطع است",message:"مرجع داده در دسترس نیست؛ هیچ مقدار جایگزین یا محاسبه‌ای ساخته نمی‌شود."},
 {id:"expired",label:"اعتبار منقضی شده",message:"اعتبار نشست یا مجوز منبع پایان یافته؛ اطلاعات قبلی باید از نمایش حذف شوند."},
 {id:"verified",label:"نمونه تأییدشده ساختگی",message:"تمام اطلاعات زیر ساختگی هستند و فقط قالب نمایش یک پاسخ فرضیِ معتبر را نشان می‌دهند."}
];

const MEMBER_FIELDS:readonly PreviewField[]=[
 {label:"وضعیت عضویت",value:"فعال — فقط نمونه"},
 {label:"نوع عضو",value:"شخص حقیقی — صرفاً نمونه"},
 {label:"تاریخ ثبت عضویت",value:"۱۴۰۵/۰۶/۱۵ — تاریخ فرضی"},
 {label:"مرجع ثبت",value:"دفتر عضویت ساختگی تعاونی نمونه"}
];
const HOLDING_FIELDS:readonly PreviewField[]=[
 {label:"تعداد سهام",value:"۱۲۵ سهم — عدد کاملاً فرضی"},
 {label:"وضعیت دارایی",value:"ثبت‌شده در دفتر آزمایشی — فقط نمونه"},
 {label:"تاریخ آخرین تأیید دفتر",value:"۱۴۰۵/۰۷/۰۱ — تاریخ فرضی"},
 {label:"مرجع دفتر سهام",value:"دفتر سهام ساختگی تعاونی نمونه"}
];

function DataSection({
 domain,title,purpose,state,onStateChange,fields,sourceLabel,versionLabel,asOfLabel
}:CardProps){
 const isMock=state==="verified";
 const chosen=STATES.find(x=>x.id===state);
 return <section className="w1n-domain" aria-labelledby={"w1n-"+domain}>
  <header className="w1n-domain-head">
   <div><span className="w1n-code">{domain}</span>
    <h2 id={"w1n-"+domain}>{title}</h2>
    <p>{purpose}</p>
   </div>
   <span className="w1n-boundary">قرارداد منبع مستقل</span>
  </header>
  <div className="w1n-controls" role="group" aria-label={"انتخاب حالت "+title}>
   {STATES.map(option=><button
    key={option.id} type="button" aria-pressed={state===option.id}
    className={"w1n-option"+(state===option.id?" w1n-selected":"")}
    onClick={()=>onStateChange(option.id)}>{option.label}</button>)}
  </div>
  <div className={"w1n-status w1n-status-"+state} role="status" aria-live="polite">
   <strong>{chosen?.label}</strong>
   <span>{chosen?.message}</span>
  </div>
  <div className={"w1n-details"+(isMock?" w1n-details-mock":"")} aria-label={"جزئیات "+title}>
   {fields.map(field=><div className="w1n-detail" key={field.label}>
    <dt>{field.label}</dt><dd>{isMock?field.value:"—"}</dd>
   </div>)}
  </div>
  <div className="w1n-provenance" aria-label={"منشأ داده "+title}>
   <h3>مرجع و اعتبار اطلاعات</h3>
   <dl>
    <div><dt>شناسه مرجع</dt><dd>{isMock?sourceLabel:"—"}</dd></div>
    <div><dt>نسخه ثبت منبع</dt><dd>{isMock?versionLabel:"—"}</dd></div>
    <div><dt>تاریخ اعتبار داده</dt><dd>{isMock?asOfLabel:"—"}</dd></div>
    <div><dt>مبنای مجوز واقعی</dt><dd>در انتظار تأیید مستقل قانونی</dd></div>
   </dl>
  </div>
  <p className="w1n-domain-note">{isMock?
   "صرفاً Fixture آزمایشی؛ وجود این داده نشان‌دهنده عضویت، مالکیت یا تأیید منبع در دنیای واقعی نیست.":
   "مقدار نامعلوم به معنی صفر، عضویت نامعتبر یا نبود سابقه نیست."}
  </p>
 </section>;
}

export function SyntheticMembershipHoldings(){
 // Two independent state machines: neither authorizes or overwrites the other.
 const [membershipState,setMembershipState]=useState<DomainState>("blocked");
 const [holdingState,setHoldingState]=useState<DomainState>("blocked");
 return <main className="w1n-shell" dir="rtl">
  <header className="w1n-top">
   <a href="/review/interactive" className="w1n-return">بازگشت به داشبورد آزمایشی ←</a>
   <span>W1 / NAV-02 · پیش‌نمایش بدون داده واقعی</span>
  </header>
  <section className="w1n-hero">
   <div><span className="w1n-tag">نمایش آزمایشی · بدون درخواست شبکه‌ای</span>
    <h1>سهام و عضویت من</h1>
    <p>منبع عضویت (Child06) و دفتر رسمی سهام (Child07) دو مرجع مستقل هستند. وضعیت هر کدام را جداگانه انتخاب کنید؛ تأیید یکی، به معنی تأیید دیگری نیست.</p>
   </div>
   <div className="w1n-demo-mark"><strong>DEMO</strong><span>اطلاعات کاملاً ساختگی</span></div>
  </section>
  <div className="w1n-disclosure" role="note">
   هیچ کاربر، تعاونی، شماره عضویت یا دارایی واقعی در این صفحه استعلام نمی‌شود. حتی گزینه «نمونه تأییدشده ساختگی» فقط نمایش آزمایشی است و مجوز قانونی ایجاد نمی‌کند.
  </div>
  <div className="w1n-grid">
   <DataSection domain="CHILD06_MEMBERSHIP" title="اطلاعات عضویت"
    purpose="نمایش وضعیت و سابقه عضویت فقط از دفتر عضویت دارای مجوز مستقل"
    state={membershipState} onStateChange={setMembershipState}
    fields={MEMBER_FIELDS} sourceLabel="TEST-ONLY-CHILD06"
    versionLabel="نسخه ۳ — ساختگی" asOfLabel="۱۴۰۵/۰۷/۰۱ — نمونه"/>
   <DataSection domain="CHILD07_HOLDINGS" title="اطلاعات سهام"
    purpose="نمایش تعداد و وضعیت سهام فقط از دفتر رسمی سهام دارای مجوز مستقل"
    state={holdingState} onStateChange={setHoldingState}
    fields={HOLDING_FIELDS} sourceLabel="TEST-ONLY-CHILD07"
    versionLabel="نسخه ۵ — ساختگی" asOfLabel="۱۴۰۵/۰۷/۰۱ — نمونه"/>
  </div>
  <section className="w1n-safeguards">
   <h2>مرز دسترسی و مسئولیت اطلاعات</h2>
   <p>صدور نشست، وجود نقش سهامدار یا وضعیت عضویت، هیچ‌کدام به‌تنهایی موجودی سهام را اثبات نمی‌کنند. تأیید واقعی عضویت مستلزم تکمیل ۹ کنترل Child06 و تأیید دفتر سهام مستلزم تکمیل ۱۰ کنترل مستقل Child07 است.</p>
   <p>این پیش‌نمایش فقط‌خواندنی است و هیچ امکان ثبت درخواست خرید، فروش، انتقال، پرداخت، انتشار اطلاعیه یا بارگذاری سند واقعی ندارد.</p>
  </section>
 </main>;
}
