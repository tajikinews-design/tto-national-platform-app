import type {ReactNode} from "react";

export type AuthSurface="national"|"cooperative"|"shareholder";
export type AuthMode="login"|"register"|"order";

const variants={
 national:{
  pill:"مرکز راهبری",
  title:"مدیریت ملی",
  heading:"ورود مدیر ملی",
  tagline:"دسترسی امن به راهبری و تنظیمات پلتفرم",
  highlights:["نظارت بر فضاهای اختصاصی","مدیریت خدمات و اشتراک‌ها","کنترل دسترسی متمرکز"]
 },
 cooperative:{
  pill:"پنل اختصاصی",
  title:"مدیریت تعاونی",
  heading:"ورود مدیر تعاونی",
  tagline:"مدیریت سازمان‌یافته خدمات و اطلاعات تعاونی",
  highlights:["فضای اختصاصی هر تعاونی","خدمات و گزارش‌های مدیریتی","امنیت اطلاعات و تفکیک نقش‌ها"]
 },
 shareholder:{
  pill:"خدمات سهامداران",
  title:"درگاه سهامدار",
  heading:"ورود سهامدار",
  tagline:"مسیر امن مشاهده خدمات و اطلاعات شخصی",
  highlights:["مشاهده اطلاعات مجاز","پیگیری درخواست‌ها","حفاظت از حریم خصوصی"]
 }
} as const;

export function AuthFrame({
 surface,mode="login",title,description,children
}:{surface:AuthSurface;mode?:AuthMode;title?:string;description?:string;children:ReactNode}){
 const v=variants[surface];
 const heading=title??(mode==="register"?"ایجاد حساب مشتری":mode==="order"?"ثبت سفارش پلتفرم تعاونی":v.heading);
 const subtitle=description??(mode==="register"
  ?"شماره همراه خود را تأیید کنید و سپس پلن مناسب را انتخاب کنید."
  :mode==="order"?"پلن و شناسه اختصاصی تعاونی را انتخاب و سفارش آزمایشی خود را ثبت کنید.":v.tagline);
 return <main className={"tto-auth-page"+(mode==="order"?" tto-auth-order-page":"")} data-tto-auth-surface={surface} lang="fa" dir="rtl">
  <div className="tto-auth-layout">
   <aside className="tto-auth-brand" aria-label="معرفی پلتفرم TTO">
    <div className="tto-auth-brand-top">
     <div className="tto-auth-logo" aria-hidden="true"><span>TTO</span><i>◇</i></div>
     <div><strong>پلتفرم ملی توسعه و عمران</strong><small>سامانه یکپارچه مدیریت تعاونی‌ها</small></div>
    </div>
    <div className="tto-auth-brand-content">
     <div className="tto-auth-brand-badge"><span aria-hidden="true">✦</span> {v.pill}</div>
     <h2>یک درگاه.<br/><span>دسترسی مطمئن.</span></h2>
     <p>تجربه‌ای ساده و یکپارچه برای ورود به خدمات TTO، با حفظ مرزهای دسترسی هر نقش.</p>
     <div className="tto-auth-orbit" aria-hidden="true">
      <div className="tto-auth-orbit-ring tto-auth-orbit-one"/>
      <div className="tto-auth-orbit-ring tto-auth-orbit-two"/>
      <div className="tto-auth-orbit-center"><span>◈</span><small>TTO</small></div>
      <span className="tto-auth-orbit-node node-a">✓</span>
      <span className="tto-auth-orbit-node node-b">◈</span>
      <span className="tto-auth-orbit-node node-c">●</span>
     </div>
    </div>
    <div className="tto-auth-brand-bottom">
     <div className="tto-auth-brand-highlights">
      {v.highlights.map(item=><div key={item}><span aria-hidden="true">✓</span>{item}</div>)}
     </div>
     <p>نسخه آزمایشی TTO · ورود و داده‌ها تابع مجوزهای معتبر هستند.</p>
    </div>
   </aside>
   <section className="tto-auth-form-panel" aria-label={heading}>
    <div className="tto-auth-mobile-brand"><span className="tto-auth-mobile-logo">TTO</span><strong>پلتفرم ملی توسعه و عمران</strong></div>
    <div className="tto-auth-form-inner">
     <div className="tto-auth-form-top"><span className="tto-auth-form-tag"><span aria-hidden="true">●</span> {mode==="register"?"ثبت‌نام امن":mode==="order"?"سفارش اشتراک":"ورود امن"}</span><span className="tto-auth-role">{v.title}</span></div>
     <h1>{heading}</h1>
     <p className="tto-auth-description">{subtitle}</p>
     {children}
    </div>
    <footer className="tto-auth-footer"><span aria-hidden="true">♢</span> {mode==="order"?"پرداخت واقعی غیرفعال · تأیید مبلغ صرفاً آزمایشی است":"ارتباط امن · کد یک‌بارمصرف حداکثر ۶۰ ثانیه اعتبار دارد"} <span className="tto-auth-footer-brand">TTO</span></footer>
   </section>
  </div>
 </main>;
}
