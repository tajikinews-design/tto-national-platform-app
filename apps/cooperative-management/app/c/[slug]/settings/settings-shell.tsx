import type {ReactNode} from "react";
export const COOPERATIVE_MODULES=[
 ["NAV-01","داشبورد","نمای کلی و وضعیت عملیات","▦"],
 ["NAV-02","اعضا و سهام","فهرست اعضا و اطلاعات سهام","♙"],
 ["NAV-03","بازار و سرمایه","درخواست‌های خرید و فروش سهام","▥"],
 ["NAV-04","حاکمیت و مجامع","جلسات و مستندات مصوبات","♜"],
 ["NAV-05","ارتباط با سهامداران","اعلان‌ها و مکاتبات","♧"],
 ["NAV-06","عملیات و خدمات","درخواست‌ها و خدمات تعاونی","⚙"],
 ["NAV-07","کسب‌وکار و بازار","خدمات و فرصت‌های کسب‌وکار","▤"],
 ["NAV-08","پروژه و توسعه","پروژه‌ها و گزارش پیشرفت","▥"],
 ["NAV-09","ریسک و شفافیت","مستندات و اطلاع‌رسانی مجاز","♢"],
 ["NAV-10","گزارش و هوشمندی","گزارش‌ها و نماگرهای مدیریتی","▥"],
 ["NAV-11","تنظیمات","تنظیمات مجاز حساب کاربری","⚙"]
] as const;
export type SettingsSection="credentials"|"users";
export function SettingsPageFrame({slug,section,children}:{slug:string;section:SettingsSection;children:ReactNode}){
 const credentials=section==="credentials";
 return <div className="tto-settings-page">
  <header className="tto-settings-hero">
   <div>
    <span className="tto-settings-eyebrow">✦ مرکز مدیریت حساب و دسترسی‌ها</span>
    <h1>{credentials?"امنیت و مشخصات ورود":"کاربران و مدیریت دسترسی‌ها"}</h1>
    <p>{credentials?"نام کاربری و رمز عبور خود را با تأیید دوباره هویت تغییر دهید؛ بدون نیاز به خروج از فضای مدیریت.":
     "برای هر همکار حساب مستقل بسازید و مشخص کنید کدام‌یک از یازده ماژول مدیریت را مشاهده کند."}</p>
   </div>
   <span className="tto-settings-hero-icon" aria-hidden="true">{credentials?"♢":"♧"}</span>
  </header>
  <nav className="tto-settings-switcher" aria-label="صفحات تنظیمات">
   <a href={"/c/"+slug+"/settings/credentials"} aria-current={credentials?"page":undefined}>◇ تغییر نام کاربری و رمز عبور</a>
   <a href={"/c/"+slug+"/settings/users"} aria-current={!credentials?"page":undefined}>♧ کاربران و سطح دسترسی</a>
  </nav>
  {children}
 </div>;
}
export function SettingsCard({title,subtitle,icon,children}:{title:string;subtitle?:string;icon:string;children:ReactNode}){
 return <section className="tto-settings-card">
  <header className="tto-settings-card-head">
   <span className="tto-settings-card-icon" aria-hidden="true">{icon}</span>
   <div><h2>{title}</h2>{subtitle?<p>{subtitle}</p>:null}</div>
  </header>{children}
 </section>;
}
export function SettingsNotice({type="info",children}:{type?:"info"|"error"|"success";children:ReactNode}){
 return <div role={type==="error"?"alert":"status"} className={"tto-settings-note"+(type==="info"?"":" "+type)}>{children}</div>;
}
