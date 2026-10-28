"use client";

import {useState} from "react";
import {NAV_IDS,shareholderNavigation} from "@tto/ui";

type PreviewState="blocked"|"unavailable"|"synthetic"|"expired";
type PreviewCard={
 label:string;
 officialMeaning:string;
 demoValue:string;
 authority:string;
};

const VIEW_STATES:readonly {id:PreviewState;label:string;description:string}[]=[
 {id:"blocked",label:"منبع تأیید نشده",description:"هیچ مجوز منبع یا مقدار سهمی فرض نمی‌شود."},
 {id:"unavailable",label:"منبع در دسترس نیست",description:"اختلال ارتباط به معنای نبود عضویت یا صفر سهم نیست."},
 {id:"synthetic",label:"نمونه کاملاً ساختگی",description:"فقط نمونه رابط است؛ هیچ شخص یا تعاونی واقعی وجود ندارد."},
 {id:"expired",label:"نشست یا اختیار منقضی",description:"دسترسی خصوصی باید بسته شود؛ محتوای قبلی نمایش داده نمی‌شود."}
];
const MOCK_CARDS:readonly PreviewCard[]=[
 {label:"وضعیت عضویت",officialMeaning:"منبع مستقل Child06",
  demoValue:"فعال — صرفاً نمونه",authority:"ثبت عضویت با منبع قانونی جداگانه"},
 {label:"دارایی سهام",officialMeaning:"دفتر مستقل Child07",
  demoValue:"۱۲۵ سهم — عدد ساختگی",authority:"عدد واقعی فقط از دفتر سهامِ تأییدشده"},
 {label:"درخواست‌های خریدوفروش",officialMeaning:"پرونده‌های Child07",
  demoValue:"۲ پرونده آزمایشی",authority:"فقط نمایش؛ نه سفارش، پرداخت یا انتقال"},
 {label:"اطلاعیه‌ها",officialMeaning:"انتشار مجاز Child09",
  demoValue:"۱ اطلاعیه فرضی",authority:"هیچ محتوایی بدون مجوز ناشر منتشر نمی‌شود"}
];
const SUMMARY:Record<PreviewState,string>={
 blocked:"منابع هنوز پذیرش قانونی نشده‌اند. نبود داده، تأییدِ صفر سهم یا نبود درخواست نیست.",
 unavailable:"ارتباط با منبع قابل استناد برقرار نیست. هیچ عدد یا سابقه جایگزین ساخته نمی‌شود.",
 synthetic:"تمام مقادیر این صفحه ثابت، ساختگی و فقط برای آزمایش چیدمان هستند؛ هیچ درخواست شبکه‌ای ارسال نمی‌شود.",
 expired:"نشست یا اختیار معتبر وجود ندارد. تمام اطلاعات شخصی باید از صفحه اصلی پنهان بماند."
};

function navPath(index:number){
 return index===0?"/review":index===3?"/review/interactive/nav-04":index===4?"/review/interactive/nav-05":index===5?"/review/interactive/nav-06":index===6?"/review/interactive/nav-07":index===7?"/review/interactive/nav-08":"/review/"+NAV_IDS[index].toLowerCase();
}

export function SyntheticDashboard(){
 const [state,setState]=useState<PreviewState>("blocked");
 const sample=state==="synthetic";
 return <main className="w1-shell" dir="rtl">
  <header className="w1-header">
   <a className="w1-back" href="/review">بازگشت به ۱۱ بخش پنل ←</a>
   <span className="w1-label">W1 / NAV-01 · فقط آزمایش رابط</span>
  </header>
  <section className="w1-hero" aria-labelledby="w1-title">
   <div>
    <span className="w1-tag">پیش‌نمایش تعاملی · بدون اتصال به سامانه عملیاتی</span>
    <h1 id="w1-title">داشبورد سهامدار</h1>
    <p>نسخه آزمایشی برای مشاهده حالت‌های واقعی رابط کاربری؛ بدون حساب، مدرک، پیامک، معامله یا داده سهامدار حقیقی.</p>
   </div>
   <div className="w1-badge" aria-label="محدود به داده مصنوعی">
    <strong>DEMO</strong><span>داده کاملاً مصنوعی</span>
   </div>
  </section>
  <p className="w1-navigation-next">
   <a href="/review/interactive/nav-02">مشاهده صفحه تعاملی «سهام و عضویت من» با دو منبع مستقل ←</a>
   <span>فقط اطلاعات ساختگی · بدون اتصال دفتر رسمی سهام</span>
  </p>
  <section className="w1-controls" aria-label="انتخاب حالت آزمایش">
   <h2>حالت صفحه را انتخاب کنید</h2>
   <p>دکمه‌ها فقط وضعیت نمایش را در حافظه موقت همین صفحه تغییر می‌دهند.</p>
   <div className="w1-options" role="group" aria-label="حالت آزمایشی">
    {VIEW_STATES.map(option=><button key={option.id} type="button"
     className={"w1-option"+(state===option.id?" w1-selected":"")}
     aria-pressed={state===option.id} onClick={()=>setState(option.id)}>
     {option.label}
    </button>)}
   </div>
  </section>
  <div className={"w1-status w1-status-"+state} role="status" aria-live="polite">
   <strong>{VIEW_STATES.find(x=>x.id===state)?.label}</strong>
   <span>{SUMMARY[state]}</span>
  </div>
  <section className="w1-cards" aria-label="کارت‌های وضعیت پنل">
   {MOCK_CARDS.map(card=><article className="w1-card" key={card.label}>
    <div className="w1-card-head"><h2>{card.label}</h2><small>{card.officialMeaning}</small></div>
    <p className={"w1-card-value"+(sample?" w1-demo-value":"")}>
     {sample?card.demoValue:"—"}
    </p>
    <p className="w1-card-policy">{card.authority}</p>
    <div className="w1-card-footer">
     {sample?<span>فقط Fixture ثابت · نه سند رسمی</span>:<span>هیچ داده تأییدشده‌ای دریافت نشده</span>}
    </div>
   </article>)}
  </section>
  <section className="w1-navigation" aria-label="پیمایش بخش‌های طراحی">
   <div className="w1-section-heading">
    <h2>بخش‌های پنل سهامدار</h2>
    <p>این پیوندها فقط نسخه بازبینی طراحی را باز می‌کنند.</p>
   </div>
   <div className="w1-nav-grid">
    {shareholderNavigation.map((name,index)=><a key={NAV_IDS[index]}
      href={navPath(index)} className="w1-nav-card">
      <span className="w1-nav-index">{String(index+1).padStart(2,"0")}</span>
      <span>{name}</span><span aria-hidden="true">←</span>
    </a>)}
   </div>
  </section>
  <footer className="w1-footnote">
   <strong>مرز حقوقی و امنیتی:</strong> این صفحه هیچ داده یا هویت واقعی را دریافت، ذخیره یا منتشر نمی‌کند.
   ورود کاربر، مالکیت سهم، سفارش خریدوفروش، پرداخت، انتقال سهم و انتشار رسمی در این پیش‌نمایش فعال نیستند.
   حالت «نمونه کاملاً ساختگی» صرفاً برای کنترل چیدمان و خوانایی است؛ عدد نمایش‌داده‌شده هیچ ارزش حقوقی ندارد.
  </footer>
 </main>;
}
