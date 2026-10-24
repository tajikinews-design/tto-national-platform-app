"use client";

import {useState} from "react";
import {NAV_IDS,shareholderNavigation} from "@tto/ui";

type ReviewTab="overview"|"journey"|"access";
type Section={
  intro:string;
  feature:string[];
  steps:string[];
  legal:string;
  status:string;
};
const SECTIONS:Section[]=[
 {
  intro:"نقطه شروع سهامدار برای دیدن بخش‌های مرتبط با عضویت، سهام، درخواست‌ها و خدمات تعاونی.",
  feature:["کارت معرفی بخش‌های پنل","میان‌بر به ۱۰ بخش دیگر","وضعیت شفاف اتصال داده‌های معتبر"],
  steps:["انتخاب بخش از منوی کناری","مشاهده طراحی و شرح قابلیت","ثبت بازخورد طراحی خارج از این پیش‌نمایش"],
  legal:"داشبورد شخصی پس از ورود معتبر و تعیین تعاونی، فقط داده مستند نشان خواهد داد.",
  status:"ساختار و پیمایش نمایشی قابل بررسی است."
 },
 {
  intro:"محل آینده نمایش رابطه عضویت و موجودی سهام با اتکا به دو مرجع قانونی مستقل.",
  feature:["شناسنامه رابطه عضویت","صورت وضعیت سهم بر پایه دفتر رسمی","تاریخ و نسخه آخرین تأیید منبع"],
  steps:["احراز هویت سهامدار","انتخاب تعاونی دارای مجوز","استعلام مستقل عضویت و دفتر سهام"],
  legal:"ورود به سامانه اثبات عضویت نیست؛ داده ناموجود معادل صفر سهم نیست.",
  status:"نمایش اطلاعات شخصی نیازمند نشست معتبر و منابع Child06/Child07 است."
 },
 {
  intro:"مرور مسیر مصوب درخواست خرید یا فروش سهام بدون ایجاد سفارش یا تغییر مالکیت.",
  feature:["ثبت درخواست فروش یا خرید پس از تصویب","پیگیری مراحل بررسی اهلیت و قواعد تعاونی","سوابق پرونده، شواهد و وضعیت انتقال"],
  steps:["بررسی شرایط قانونی و اهلیت سهامدار","ثبت درخواست در مرجع مجاز","بررسی و تصویب در مسیر مسئولیت‌های قانونی","پرداخت مستقیم خریدار به فروشنده مطابق قرارداد","تأیید مستقل انتقال و ثبت دفتر سهام"],
  legal:"در این پیش‌نمایش هیچ سفارش، پرداخت، رزرو وجه یا انتقال سهمی اجرا نمی‌شود.",
  status:"فرآیند مطالعه‌شدنی است؛ ثبت و پیگیری معاملات غیرفعال است."
 },
 {
  intro:"مرور اطلاع‌رسانی مجامع، دستورجلسات، مصوبات و فرایندهای مشارکت سهامدار.",
  feature:["فهرست جلسات و دعوت‌نامه‌های مجاز","دستورجلسه و مستندات منتشرشده","پیگیری رویدادهای انتخاباتی در محدوده حقوق قانونی"],
  steps:["انتشار دعوت‌نامه توسط مرجع مجاز","تشخیص حقوق و مخاطبان جلسه","مشاهده اسناد قابل انتشار","ثبت نتایج معتبر پس از تصمیم قانونی"],
  legal:"این صفحه جایگزین سازوکار رسمی دعوت، رأی‌گیری یا ثبت صورت‌جلسه نمی‌شود.",
  status:"چیدمان قابل بررسی است؛ مجمع و رأی‌گیری واقعی در دسترس نیست."
 },
 {
  intro:"مرکز اطلاعیه‌ها، اخبار و مکاتبات منتشرشده برای مخاطبان مجاز تعاونی.",
  feature:["اطلاعیه‌های رسمی قابل انتشار","خبرها و پیام‌های تعاونی","تفکیک وضعیت تحویل، مطالعه و تأیید دریافت"],
  steps:["تنظیم متن توسط ناشر دارای اختیار","تصویب مخاطب و سطح انتشار","انتشار نسخه مصوب","ثبت مستندات ابلاغ در صورت الزام"],
  legal:"ارسال پیام به معنی مطالعه یا تأیید دریافت نیست. هیچ اطلاعیه تأییدنشده‌ای منتشر نمی‌شود.",
  status:"نسخه Child09 و حقوق مخاطبان هنوز منتظر تأیید مستقل است."
 },
 {
  intro:"مرجع آینده درخواست و پیگیری خدمات مجاز تعاونی برای هر سهامدار.",
  feature:["دسته‌بندی خدمات مجاز","فرم درخواست بر اساس نوع خدمت","سوابق و وضعیت پاسخگویی"],
  steps:["انتخاب خدمت تعریف‌شده","بررسی شرایط دریافت خدمت","ارسال درخواست به مسئول مجاز","مشاهده نتیجه قابل استناد"],
  legal:"نوع خدمت و سطح دسترسی باید در مقررات همان تعاونی مشخص شود.",
  status:"فهرست خدمات، فرم‌های عملیاتی و منبع رسمی متصل نیستند."
 },
 {
  intro:"نمایش فرصت‌ها و فعالیت‌های مجاز قابل معرفی به سهامداران تعاونی.",
  feature:["فهرست فرصت‌های مصوب","شرایط و محدوده هر فرصت","ارتباط با واحد مربوط، بدون ثبت معامله در پیش‌نمایش"],
  steps:["ثبت و تصویب فرصت توسط تعاونی","انتشار مشخصات قابل اطلاع‌رسانی","مشاهده شرایط توسط سهامدار","ورود به فرایند رسمی مستقل در صورت تصویب"],
  legal:"این بخش کیف پول، فروشگاه تراکنشی یا تعهد سرمایه‌گذاری ایجاد نمی‌کند.",
  status:"کاتالوگ و جریان ثبت درخواست واقعی هنوز فعال نیست."
 },
 {
  intro:"اطلاع‌رسانی درباره پروژه‌های توسعه عمرانی تعاونی و مراحل انتشار مصوب آنها.",
  feature:["معرفی پروژه‌ها","گزارش پیشرفت قابل انتشار","اسناد و فرصت‌های مرتبط با پروژه"],
  steps:["ثبت پروژه در مرجع تعاونی","تأیید گزارش مجاز","انتشار نسخه به‌روز","مشاهده اطلاعات متناسب با حق دسترسی"],
  legal:"درصد پیشرفت، بودجه و سایر اعداد بدون منبع مصوب نمایش داده نمی‌شوند.",
  status:"هیچ پروژه یا پیشرفتی در این پیش‌نمایش به‌عنوان واقعیت ثبت نشده است."
 },
 {
  intro:"مرکز شفافیت برای اسناد ثبتی، اطلاعات حقوقی و صورت‌های مالی منتشرشده شرکت.",
  feature:["اسناد قانونی قابل انتشار","صورت‌های مالی صرفاً برای اطلاع سهامدار","طبقه‌بندی و تاریخ نسخه اسناد"],
  steps:["ثبت مرجع و نسخه سند","بررسی طبقه‌بندی و اختیار انتشار","عرضه به مخاطب مجاز","حفظ شواهد و سوابق نسخه"],
  legal:"پلتفرم حسابداری عمومی و گردش مالی داخلی تعاونی را اجرا نمی‌کند.",
  status:"مدیریت انتشار اسناد و دسترسی به منابع مصوب هنوز فعال نیست."
 },
 {
  intro:"گزارش‌های شخصی سهامدار در محدوده حقوق و اطلاعات احراز‌شده.",
  feature:["مرور وضعیت عضویت و سهام مستند","خلاصه درخواست‌های مجاز","خروجی‌های قابل استناد با تاریخ منبع"],
  steps:["احراز نشست و محدوده تعاونی","تأیید سطح دسترسی","دریافت رکوردهای رسمی","ایجاد خروجی فقط از داده‌های مجاز"],
  legal:"در این صفحه هیچ گزارش عددی فرضی، تعداد سهم یا سابقه جعلی تولید نمی‌شود.",
  status:"داشبورد تحلیلی شخصی نیازمند قرارداد داده و تأیید دسترسی است."
 },
 {
  intro:"محل آینده تنظیم ترجیحات مجاز حساب، اطلاع‌رسانی و مدیریت نشست‌ها.",
  feature:["نمایش روش‌های ارتباط مجاز","تنظیم ترجیحات اعلان پس از اتصال","خروج امن و مدیریت نشست معتبر"],
  steps:["ورود از طریق سامانه احراز هویت","تأیید تغییرات مجاز","ثبت رخداد امنیتی","اعمال تغییر در سرویس عملیاتی"],
  legal:"این پیش‌نمایش هیچ مشخصات هویتی، شماره تماس یا رمز عبوری دریافت و ذخیره نمی‌کند.",
  status:"تنظیمات واقعی فقط در پنل احراز هویت‌شده قابل فعال‌سازی خواهد بود."
 }
];

function pathFor(index:number){
 return index===0?"/review":"/review/"+NAV_IDS[index].toLowerCase();
}
function Icon({name}:{name:"diamond"|"shield"|"arrow"|"eye"|"check"}){
 if(name==="diamond")return <span aria-hidden="true">◆</span>;
 if(name==="shield")return <span aria-hidden="true">◈</span>;
 if(name==="eye")return <span aria-hidden="true">◎</span>;
 if(name==="check")return <span aria-hidden="true">✓</span>;
 return <span aria-hidden="true">←</span>;
}
export function ShareholderReview({activeId="NAV-01"}:{activeId?:string}){
 const index=NAV_IDS.indexOf(activeId);
 const safe=index<0?0:index;
 const item=SECTIONS[safe];
 const [tab,setTab]=useState<ReviewTab>("overview");
 const tabs:readonly {id:ReviewTab;label:string}[]=[
  {id:"overview",label:"طرح صفحه"},
  {id:"journey",label:"مراحل و تعاملات"},
  {id:"access",label:"مجوزها و وضعیت"}
 ];
 return <div className="rv-app" dir="rtl">
  <aside className="rv-sidebar" aria-label="فهرست بخش‌ها">
   <a className="rv-brand" href="/review"><span className="rv-brand-mark">T</span><span><strong>توسعه و عمران</strong><small>پلتفرم ملی تعاونی‌ها</small></span></a>
   <div className="rv-side-title"><span>فضای بازبینی سهامداران</span><span className="rv-mode">نسخه نمایشی</span></div>
   <nav className="rv-navigation" aria-label="۱۱ بخش پنل سهامدار">
    {shareholderNavigation.map((name,i)=><a key={NAV_IDS[i]} href={pathFor(i)}
      aria-current={safe===i?"page":undefined}
      className={"rv-nav-link"+(safe===i?" rv-current":"")}>
      <span className="rv-nav-symbol"><Icon name={i===0?"diamond":"shield"}/></span>
      <span className="rv-nav-name">{name}</span>
      <span className="rv-nav-code">{String(i+1).padStart(2,"0")}</span>
    </a>)}
   </nav>
   <div className="rv-side-footer"><span className="rv-secure-dot"/>بدون داده واقعی یا دسترسی معاملاتی</div>
  </aside>
  <main className="rv-content" id="review-content">
   <header className="rv-topbar">
    <span className="rv-top-label">پنل سهامدار <span> / </span> بازبینی تجربه کاربری</span>
    <div className="rv-top-actions"><span className="rv-protected">پیش‌نمایش داخلی</span><a href="/" className="rv-real-login">ورود به سامانه اصلی <Icon name="arrow"/></a></div>
   </header>
   <section className="rv-hero">
    <div className="rv-hero-copy">
     <span className="rv-eyebrow">فضای اختصاصی تأیید طراحی · نسخه بدون عملیات واقعی</span>
     <h1>{safe===0?"پنل سهامداران":shareholderNavigation[safe]}</h1>
     <p>{item.intro}</p>
     <div className="rv-hero-actions">
      {safe!==0?<a href="/review" className="rv-btn rv-btn-primary">بازگشت به داشبورد <Icon name="arrow"/></a>:<a href={pathFor(1)} className="rv-btn rv-btn-primary">بررسی بخش‌های پنل <Icon name="arrow"/></a>}
      <span className="rv-inactive"><span aria-hidden="true">●</span> هیچ عملیات واقعی فعال نیست</span>
     </div>
    </div>
    <div className="rv-hero-art" aria-hidden="true"><div className="rv-orbit rv-orbit-one"/><div className="rv-orbit rv-orbit-two"/><div className="rv-art-tile"><span>سهامداران</span><strong>۱۱</strong><small>بخش قابل پیمایش</small></div></div>
   </section>
   {safe===0?<section className="rv-overview" aria-label="نمای کلی وضعیت نسخه بازبینی">
    <div className="rv-summary-box"><span className="rv-summary-icon">◈</span><div><strong>۱۱ بخش</strong><span>همگی قابل بازکردن و بازبینی طراحی</span></div></div>
    <div className="rv-summary-box"><span className="rv-summary-icon">◎</span><div><strong>پیش‌نمایش رابط</strong><span>بدون نیاز به حساب سهامداری واقعی</span></div></div>
    <div className="rv-summary-box"><span className="rv-summary-icon">◇</span><div><strong>بدون اطلاعات واقعی</strong><span>معاملات و انتشار رسمی غیرفعال</span></div></div>
   </section>:<div className="rv-breadcrumb"><a href="/review">داشبورد</a><span>›</span><span>{shareholderNavigation[safe]}</span></div>}
   <section className="rv-workspace">
    <div className="rv-section-head"><div><span className="rv-section-kicker">بازبینی ساختار</span><h2>{safe===0?"بخش‌های سامانه سهامداران":shareholderNavigation[safe]}</h2><p>{safe===0?"برای بازکردن هر بخش، روی کارت یا گزینه منوی کناری کلیک کنید.":"این صفحه یک نمونه قابل پیمایش برای بررسی چیدمان و گردش کار است."}</p></div><span className="rv-section-count">{NAV_IDS[safe]}</span></div>
    {safe===0?<div className="rv-module-grid">
     {shareholderNavigation.slice(1).map((name,i)=><a key={NAV_IDS[i+1]} className="rv-module-card" href={pathFor(i+1)}>
      <div className="rv-module-header"><span className="rv-module-num">{String(i+2).padStart(2,"0")}</span><span className="rv-module-arrow"><Icon name="arrow"/></span></div>
      <h3>{name}</h3><p>{SECTIONS[i+1].intro}</p><span className="rv-module-footer">مشاهده صفحه و مراحل <Icon name="arrow"/></span>
     </a>)}
    </div>:<div className="rv-detail">
     <div className="rv-tabs" role="tablist" aria-label="جزئیات بخش">
      {tabs.map(x=><button key={x.id} type="button" role="tab" aria-selected={tab===x.id} className={tab===x.id?"rv-tab rv-tab-active":"rv-tab"} onClick={()=>setTab(x.id)}>{x.label}</button>)}
     </div>
     {tab==="overview"?<div className="rv-detail-body" role="tabpanel">
      <div className="rv-detail-main"><div className="rv-card-heading"><span className="rv-mini-icon">✧</span><h3>امکانات پیش‌بینی‌شده این بخش</h3></div>
       <div className="rv-feature-list">{item.feature.map((feature,i)=><div className="rv-feature" key={feature}><span className="rv-feature-tick"><Icon name="check"/></span><span>{feature}</span><small>{String(i+1).padStart(2,"0")}</small></div>)}</div>
      </div>
      <aside className="rv-detail-aside"><span className="rv-aside-label">وضعیت اتصال</span><strong>در انتظار تأیید منابع</strong><p>{item.status}</p><div className="rv-no-data">—<small>هیچ داده سهامدار بارگذاری نشده است</small></div></aside>
     </div>:null}
     {tab==="journey"?<div className="rv-journey" role="tabpanel"><h3>مراحل در نسخه عملیاتی آینده</h3><p>این موارد فقط شرح فرآیندند؛ هیچ مرحله‌ای اکنون به سرور ارسال نمی‌شود.</p><ol>{item.steps.map((step,i)=><li key={step}><span className="rv-step-number">{String(i+1).padStart(2,"0")}</span><span>{step}</span><span className="rv-step-preview">غیرفعال</span></li>)}</ol></div>:null}
     {tab==="access"?<div className="rv-access" role="tabpanel"><div className="rv-access-symbol">◈</div><div><h3>دسترسی عملیاتی بسته است</h3><p>{item.legal}</p><p>پیش‌نمایش فقط متن‌ها، پیمایش صفحات و طراحی را نمایش می‌دهد؛ مشاهده رکورد، ثبت درخواست یا تغییر اطلاعات شخصی ممکن نیست.</p></div></div>:null}
    </div>}
   </section>
   <section className="rv-next" aria-label="محدوده پیش‌نمایش"><div><span className="rv-next-mark">!</span><div><strong>تفاوت پیش‌نمایش با سامانه عملیاتی</strong><p>در این فضا فقط مسیرها و طرح صفحات کار می‌کنند. ورود واقعی، فهرست سهام، درخواست خرید و فروش، مجامع و اطلاعیه‌های رسمی نیازمند منابع و مجوزهای مستقل هستند.</p></div></div><a href="/review" className="rv-next-link">فهرست همه منوها <Icon name="arrow"/></a></section>
   <footer className="rv-footer"><span>پلتفرم ملی تعاونی توسعه و عمران</span><span>نسخه بازبینی طراحی — بدون اطلاعات یا عملیات واقعی</span></footer>
  </main>
 </div>;
}
