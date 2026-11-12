import type {ReactNode} from "react";
import type {Surface} from "./index";
type Profile={hero:string;intro:string;kpis:[string,string,string,string];alerts:string[];
 actions:string[];campaigns:string[];primaryAction:{label:string;href:string};chart:string};
const profiles:Record<Surface,Profile>={
 national:{hero:"مرکز مدیریت ملی تعاونی‌های توسعه و عمران",intro:"پایش وضعیت ثبت تعاونی‌ها، کنترل مدارک و شاخص‌های معتبر شبکه",
  kpis:["تعاونی‌های دارای اعتبار","پرونده‌های در انتظار","بررسی‌های حقوقی","سلامت سامانه"],
  alerts:["آگهی‌های نیازمند بررسی مستقل","پرونده‌های نیازمند تکمیل مدارک","کنترل تفکیک دسترسی به تعاونی‌ها"],
  actions:["فهرست تعاونی‌ها","ایجاد نشانی اختصاصی تعاونی","تکمیل پرونده تعاونی"],
  campaigns:["بررسی پیام‌های قابل انتشار","کنترل اطلاع‌رسانی شبکه"],
  primaryAction:{label:"مشاهده فهرست تعاونی‌ها",href:"/cooperatives"},chart:"روند ثبت و بررسی تعاونی‌ها"},
 cooperative:{hero:"مرکز مدیریت تعاونی توسعه و عمران",intro:"مدیریت یکپارچه اعضا، اسناد، خدمات و عملیات تعاونی",
  kpis:["اعضای فعال","سهامداران ثبت‌شده","معاملات در انتظار","سلامت سامانه"],
  alerts:["آگهی‌های نیازمند تأیید مسئولان","پرونده‌های نیازمند تکمیل","اسناد دارای اختلاف یا ابطال"],
  actions:["مشاهده سوابق رسمی هیئت‌مدیره","بازبینی مستندات مصوبه","بررسی آگهی‌های تعارض‌دار"],
  campaigns:["اطلاعیه‌های آماده انتشار","پیام‌های نیازمند بررسی"],
  primaryAction:{label:"مدیریت اسناد رسمی",href:"/official-records"},chart:"روند فعالیت تعاونی"},
 shareholder:{hero:"پنل هوشمند سهامداران",intro:"دسترسی به سهام، مجامع، اطلاعیه‌ها و خدمات تعاونی با هویت معتبر",
  kpis:["سهام من","ارزش کارشناسی جاری","درخواست‌های باز","سلامت حساب"],
  alerts:["اطلاعیه‌های مجامع مجاز","درخواست‌های نیازمند پیگیری","مدارک هویت و عضویت"],
  actions:["مشاهده رابطه عضویت","پیگیری درخواست‌ها","مشاهده اطلاعیه‌های تعاونی"],
  campaigns:["اطلاعیه‌های مجاز سهامداران","پیشنهادها و خدمات منتشرشده"],
  primaryAction:{label:"مشاهده عضویت و سهام",href:"/modules/nav-02"},chart:"روند ارزش سهام"}
};
const actionHrefs:Record<Surface,[string,string,string]>={
 national:["/cooperatives","/cooperatives/new","/cooperatives/onboarding"],
 cooperative:["/official-records","/share-market/tariffs","/share-market/board-review"],
 shareholder:["/modules/nav-02","/modules/nav-03","/modules/nav-05"]
};
const numeric=(value:string)=> <strong aria-label="داده معتبر دریافت نشده">{value}</strong>;
export function ApprovedDashboardHome({surface,children,demoOnly=false,publicView=false}:{surface:Surface;children?:ReactNode;demoOnly?:boolean;publicView?:boolean}){
 const p=profiles[surface];
 return <>
 <section className="tto-approved-hero" aria-label="بنر اصلی مطابق طرح مصوب">
   <div className="tto-hero-overlay"><small>جایگاه تبلیغات · بدون محتوای تأییدشده</small>
     <h1>{p.hero}</h1><p>{p.intro}</p>{publicView?<span className="tto-state">اطلاعات عمومی پلتفرم · مرور بدون ورود</span>:demoOnly?<span className="tto-state">نیازمند احراز اختیار قانونی</span>:<a href={p.primaryAction.href}>{p.primaryAction.label} ←</a>}
   </div>
 </section>
 <div className="tto-approved-kpis" aria-label="چهار شاخص مطابق مرجع تصویری">
  {p.kpis.map((x,i)=><section className={"tto-approved-kpi kpi-"+i} key={x}>
    <span className="tto-kpi-icon" aria-hidden="true">{["♧","♙","▣","♡"][i]}</span>
    <div><h2>{x}</h2>{numeric("—")}<p>داده معتبر موجود نیست</p></div>
  </section>)}
 </div>
 <div className="tto-approved-grid" aria-label="چیدمان سه ستونی مصوب">
   <section className="tto-widget tto-alerts"><div className="tto-widget-title"><h2>هشدارها و اقدام‌های مهم</h2><span>مرور</span></div>
    {p.alerts.map((x,i)=><div className="tto-widget-row" key={x}><span className={"tto-state state-"+i}>{i===0?"نیازمند بررسی":"بدون داده"}</span><div><strong>{x}</strong><small>اطلاعات پس از دریافت از منبع معتبر ظاهر می‌شود</small></div></div>)}
   </section>
   <section className="tto-widget tto-actions"><div className="tto-widget-title"><h2>اقدام‌های در انتظار</h2><span>گردش کار</span></div>
     {p.actions.map((x,i)=><div className="tto-widget-row" key={x}><span className="tto-state">{publicView?"نمای عمومی":demoOnly?"غیرفعال":"دسترسی مجاز"}</span><div>
       {demoOnly||publicView?<strong>{x}</strong>:<a href={actionHrefs[surface][i]} className="tto-approved-action-link">{x} ←</a>}
       <small>{publicView?"نمایش اطلاعات عمومی؛ اجرای عملیات مدیریتی در دسترس نیست":"فقط پس از احراز نقش و محدوده تعاونی"}</small></div></div>)}
     {children}
   </section>
   <section className="tto-widget tto-chart"><div className="tto-widget-title"><h2>{p.chart}</h2><span>شش ماه گذشته</span></div>
     <div className="tto-no-chart" role="status"><span>—</span><strong>نمودار بدون داده تأییدشده</strong><small>عدد یا روند آزمایشی به‌جای داده واقعی نمایش داده نمی‌شود.</small></div>
   </section>
   <section className="tto-widget tto-campaigns"><div className="tto-widget-title"><h2>کمپین‌های ارتباطی</h2><span>اطلاعات معتبر</span></div>
     {p.campaigns.map(x=><div className="tto-widget-row" key={x}><span className="tto-state">بدون داده</span><div><strong>{x}</strong><small>فقط محتوای منتشرشده توسط مرجع مجاز</small></div></div>)}
   </section>
   <section className="tto-widget tto-ads"><div className="tto-widget-title"><h2>تبلیغات فعال</h2><span>نمایش</span></div>
      <div className="tto-ad-slots"><div>جایگاه تبلیغات شماره ۱<br/><small>تبلیغ تأییدشده موجود نیست</small></div><div>جایگاه تبلیغات شماره ۲<br/><small>محتوای جدید نیازمند بررسی است</small></div></div>
   </section>
   <section className="tto-widget tto-mini"><div className="tto-widget-title"><h2>شاخص‌های مدیریتی</h2><span>آخرین وضعیت</span></div>
     <div className="tto-mini-grid">{["کیفیت داده‌ها","تکمیل فرایندها","پیگیری درخواست‌ها"].map(x=><div key={x}><strong>{x}</strong><span>—</span><small>منبع قابل استناد موجود نیست</small></div>)}</div>
   </section>
 </div>
 </>;
}
