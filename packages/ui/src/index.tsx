import type { ReactNode, ComponentType } from "react";
import {shareholderNavigation} from "./shareholder-navigation";
import {PortalModuleWorkbench} from "./portal-module-workbench";
import {ApprovedDashboardHome} from "./approved-dashboard";
export {shareholderNavigation} from "./shareholder-navigation";
export {shareholderSectionId} from "./shareholder-section-config";

export const NAV_IDS = Array.from({ length: 11 }, (_, i) => `NAV-${String(i + 1).padStart(2, "0")}`);
export type Surface = "shareholder" | "cooperative" | "national";
export type NavId = string;

export const managementNavigation = [
  "داشبورد", "اعضا و سهام", "بازار و سرمایه", "حاکمیت و مجامع",
  "ارتباط با سهامداران", "عملیات و خدمات", "کسب‌وکار و بازار",
  "پروژه و توسعه", "ریسک و شفافیت", "گزارش و هوشمندی", "تنظیمات"
] as const;

const nationalNavigation = ["داشبورد", "تعاونی‌ها", ...managementNavigation.slice(2)] as const;

/** Source-aligned NAV-01 .. NAV-11.  No number is ever inferred from the DB. */
const surfaces: Record<Surface, {
  title: string; description: string; chips: readonly string[];
  navigation: readonly string[]; sectionDescriptions: readonly string[];
  boundary: string;
}> = {
  shareholder: {
    title: "پنل سهامداران",
    description: "سهام، عضویت، خدمات و اطلاعیه‌های تعاونی",
    chips: ["سهام من", "درخواست‌های من", "مجامع", "پیام‌های من"],
    navigation: shareholderNavigation,
    sectionDescriptions: [
      "نمای کلی خدمات مربوط به سهامدار، بدون نمایش عدد یا سند تأییدنشده.",
      "مشاهده عضویت و سهام فقط پس از اتصال به دفتر معتبر و تأیید ارتباط شخص با تعاونی.",
      "پایش درخواست خرید و فروش سهم بر اساس مراحل قانونی؛ بدون کیف پول داخلی یا انتقال فوری مالکیت.",
      "اطلاع‌رسانی جلسات، انتخابات و حقوق مشارکت بدون جایگزینی سامانه رسمی مجمع و رأی‌گیری.",
      "مطالعه اطلاعیه‌ها و مکاتبات منتشرشده برای سهامداران مجاز.",
      "درخواست‌ها و خدمات وابسته به عضویت، پس از احراز صلاحیت و تعیین تعاونی.",
      "معرفی فرصت‌ها و خدمات مجاز؛ هیچ تراکنش یا سفارش واقعی در این پیش‌نمایش انجام نمی‌شود.",
      "اطلاع از پروژه‌های قابل انتشار تعاونی و پیشرفت‌های تأییدشده.",
      "دسترسی به صورت‌های مالی منتشرشده و اسناد مجاز؛ نه حسابداری داخلی شرکت.",
      "نمایش سوابق و گزارش‌های شخصی فقط پس از تأیید هویت و محدوده دسترسی.",
      "تنظیمات هویت، نشست‌ها و ارتباطات با کنترل نقش و حفظ محرمانگی."
    ],
    boundary: "ورود موفق به‌تنهایی اثبات عضویت یا مالکیت سهام نیست."
  },
  cooperative: {
    title: "مدیریت تعاونی",
    description: "مدیریت اعضا، اسناد، سهام و فرایندهای تعاونی",
    chips: ["اعضای فعال", "درخواست‌های باز", "مدارک", "وضعیت عملیات"],
    navigation: managementNavigation,
    sectionDescriptions: [
      "مرور عملیات و شاخص‌های تعاونی پس از بررسی نقش و محدوده مجاز.",
      "مدیریت فهرست اعضا و وضعیت سهام صرفاً بر اساس مرجع قانونی و سوابق قابل استناد.",
      "کنترل فرایندهای درخواست سهم و شواهد پرداخت مستقیم خریدار به فروشنده؛ بدون دفتر حسابداری عمومی.",
      "گردش تصویب، اطلاع‌رسانی و مستندات مجامع مطابق احکام و حدود اختیارات.",
      "ارسال اعلان و پاسخ به مکاتبات سهامداران واجد شرایط با ثبت شواهد.",
      "رسیدگی به خدمات و درخواست‌ها با بررسی وضعیت تعاونی و تفکیک وظایف.",
      "پایش خدمات و فرصت‌های مورد تأیید تعاونی، نه مدیریت مالی عمومی آن.",
      "پایش پروژه‌های تعاونی با اطلاعات مصوب و قابل انتشار.",
      "کنترل ریسک، اسناد و افشای مجاز با رعایت طبقه‌بندی محرمانگی.",
      "گزارش‌های مجاز برای مدیران دارای اختیار و فقط در محدوده همان تعاونی.",
      "مدیریت دسترسی‌ها و تنظیمات مجاز با نیاز به مجوز معتبر و ثبت حسابرسی."
    ],
    boundary: "نقش مدیریتی در یک تعاونی به سایر تعاونی‌ها دسترسی نمی‌دهد."
  },
  national: {
    title: "مرکز مدیریت ملی",
    description: "پایش شاخص‌های تجمیعی و سلامت شبکه تعاونی‌ها",
    chips: ["تعاونی‌های فعال", "گیت‌های حقوقی", "سلامت سامانه", "گزارش‌های تجمیعی"],
    navigation: nationalNavigation,
    sectionDescriptions: [
      "نمای شبکه‌ای و شاخص‌های تجمیعی پس از اعمال قواعد دسترسی ملی.",
      "پایش وضعیت تعاونی‌ها و داده‌های تجمیعی مجاز؛ بدون دسترسی پیش‌فرض به هویت و سهام اشخاص.",
      "رصد فرایندهای کلان و رعایت قرارداد بازار سهم، نه معامله یا مالکیت متمرکز.",
      "پایش انطباق حاکمیت و مجامع با منابع حقوقی؛ بدون جایگزینی مراجع رسمی.",
      "پایش کیفیت اطلاع‌رسانی در سطح شبکه بدون مشاهده مکاتبات خصوصی.",
      "بررسی عملکرد تجمیعی خدمات تعاونی‌ها، نه ورود به پرونده اعضای آن‌ها.",
      "پایش شاخص‌های کلان فرصت‌ها و خدمات مجاز با تفکیک تعاونی‌ها.",
      "شاخص‌های پیشرفت پروژه‌ها فقط در سطح تجمیعی و قابل انتشار.",
      "پایش گیت‌های ریسک، سلامت کنترل‌ها و تخلفات؛ نه دسترسی نامحدود به اسناد محرمانه.",
      "گزارش‌های تجمیعی با حداقل داده و کنترل محرمانگی و حداقل تعداد نمونه.",
      "تنظیمات سطح پلتفرم فقط با اختیار رسمی، کنترل تفکیک وظایف و ثبت حسابرسی."
    ],
    boundary: "مدیریت ملی، مدیر ارشد داده‌های خصوصی همه تعاونی‌ها نیست."
  }
};

export function parsePortalModuleId(raw: string): NavId | null {
  const id = raw.toUpperCase();
  return id !== "NAV-01" && NAV_IDS.includes(id) && raw === id.toLowerCase() ? id : null;
}

function navHref(i: number, basePath = "") {
  return i === 0 ? (basePath||"/") : basePath+`/modules/${NAV_IDS[i].toLowerCase()}`;
}

export function PortalShell({
  surface, children, activeId = "NAV-01", suppressStaticKpis = false, basePath = "", demoOnly = false, allowedModules, canManageSettings = false, settingsSection, memberSection, NavigationLink
}: {surface:Surface;children?:ReactNode;activeId?:NavId;suppressStaticKpis?:boolean;basePath?:string;demoOnly?:boolean;allowedModules?:string[];canManageSettings?:boolean;settingsSection?:"credentials"|"users";memberSection?:"add"|"shares"|"shareholders";NavigationLink?:ComponentType<{href:string;children:ReactNode;className?:string;"aria-current"?: "page";"aria-label"?:string}>}) {
 const cfg=surfaces[surface],selection=Math.max(NAV_IDS.indexOf(activeId),0);
 const InternalLink=NavigationLink??"a";
 const home=selection===0,currentTitle=settingsSection==="credentials"?"تغییر نام کاربری و رمز عبور":
  settingsSection==="users"?"کاربران و سطح دسترسی":memberSection==="add"?"افزودن اعضا":memberSection==="shares"?"اطلاعات اولیه سهام":memberSection==="shareholders"?"سهامداران":home?cfg.title:cfg.navigation[selection];
 return <div className="shell tto-approved-shell" lang="fa" dir="rtl" data-tto-demo-only={demoOnly?"true":undefined}>
   <a className="skip-to-content" href="#main-content">رفتن به محتوای اصلی</a>
   <aside className="nav-area">
     <InternalLink className="logo" href={basePath||"/"} aria-label="پلتفرم ملی تعاونی توسعه و عمران"><span className="tto-brand-mark">❖</span><strong>پلتفرم ملی تعاونی توسعه و عمران</strong><span>شبکه هوشمند خدمات و راهبری تعاونی‌ها</span></InternalLink>
     <nav aria-label={"منوی "+cfg.title}>
      {cfg.navigation.map((name,i)=>{
       if(allowedModules&&!allowedModules.includes(NAV_IDS[i]))return null;
       const active=i===selection;
       if(surface==="cooperative"&&i===1&&basePath.startsWith("/c/")){
        return <details key="cooperative-members" className="tto-settings-tree" open={active}>
         <summary className={active?"nav-link current":"nav-link"} aria-label="بازکردن زیرمنوی اعضا و سهام">
          <span aria-hidden="true" className="tto-nav-symbol">♙</span><span>{name}</span>
          <span className="tto-settings-chevron" aria-hidden="true">⌄</span>
         </summary>
         <div className="tto-settings-submenu" aria-label="زیرمنوهای اعضا و سهام">
          <InternalLink className={memberSection==="add"?"tto-settings-sublink selected":"tto-settings-sublink"}
           href={basePath+"/members/add"} aria-current={memberSection==="add"?"page":undefined}>
           <span aria-hidden="true">♙</span> افزودن اعضا
          </InternalLink>
          <InternalLink className={memberSection==="shares"?"tto-settings-sublink selected":"tto-settings-sublink"}
           href={basePath+"/members/shares"} aria-current={memberSection==="shares"?"page":undefined}>
           <span aria-hidden="true">▥</span> اطلاعات سهام
          </InternalLink>
          <InternalLink className={memberSection==="shareholders"?"tto-settings-sublink selected":"tto-settings-sublink"}
           href={basePath+"/members/shareholders"} aria-current={memberSection==="shareholders"?"page":undefined}>
           <span aria-hidden="true">♧</span> سهامداران
          </InternalLink>
         </div>
        </details>;
       }
       if(surface==="cooperative"&&i===10&&basePath.startsWith("/c/")&&canManageSettings){
        return <details key="cooperative-settings" className="tto-settings-tree" open={active}>
         <summary className={active?"nav-link current":"nav-link"} aria-label="بازکردن زیرمنوی تنظیمات">
          <span aria-hidden="true" className="tto-nav-symbol">⚙</span><span>{name}</span>
          <span className="tto-settings-chevron" aria-hidden="true">⌄</span>
         </summary>
         <div className="tto-settings-submenu" aria-label="زیرمنوهای تنظیمات">
          <InternalLink className={settingsSection==="credentials"?"tto-settings-sublink selected":"tto-settings-sublink"}
           href={basePath+"/settings/credentials"} aria-current={settingsSection==="credentials"?"page":undefined}>
            <span aria-hidden="true">◇</span> تغییر نام کاربری و رمز عبور
          </InternalLink>
          <InternalLink className={settingsSection==="users"?"tto-settings-sublink selected":"tto-settings-sublink"}
           href={basePath+"/settings/users"} aria-current={settingsSection==="users"?"page":undefined}>
            <span aria-hidden="true">♧</span> کاربران و سطح دسترسی
          </InternalLink>
         </div>
        </details>;
       }
       return <InternalLink href={navHref(i,basePath)} key={NAV_IDS[i]}
        aria-current={i===selection?"page":undefined} className={active?"nav-link current":"nav-link"}>
        <span aria-hidden="true" className="tto-nav-symbol">{["▦","♙","▥","♜","♧","⚙","▤","▥","♢","▥","⚙"][i]}</span>
        <span>{name}</span></InternalLink>;
      })}
     </nav>
     <a className="tto-logout-link" href={basePath||"/login"}>ورود / خروج از حساب ↗</a>
   </aside>
   <main className="main-content" id="main-content">
      <div className="topbar">
       <div className="tto-top-search"><span aria-hidden="true">⌕</span><span>جست‌وجوی پرونده‌ها، گزارش‌ها، خدمات و ...</span></div>
       <div className="tto-top-meta"><span>اعلان‌ها ♧</span><strong>{demoOnly?"پیش‌نمایش مدیریت تعاونی":cfg.title}</strong></div>
      </div>
      {demoOnly&&memberSection!=="add"?<section className="tto-login-scope" role="status" style={{marginBottom:16}}>پیش‌نمایش مدیریت تعاونی · عملیات رسمی و مالی تا احراز اختیار قانونی مدیر غیرفعال است.</section>:null}
      {!home&&<div className="breadcrumb"><InternalLink href={basePath||"/"}>داشبورد</InternalLink><span>‹</span><span>{currentTitle}</span></div>}
      {home?<ApprovedDashboardHome surface={surface} demoOnly={demoOnly}>{children}</ApprovedDashboardHome>:
      <>
       {!settingsSection&&!memberSection?<section className="hero"><h1>{currentTitle}</h1><p>{cfg.sectionDescriptions[selection]}</p></section>:null}
       <section className={(settingsSection||memberSection)?"panel tto-module-content tto-settings-module":"panel tto-module-content"}>
         {children??<><div className="module-status" role="status">
           <strong>اطلاعات این بخش در انتظار اتصال معتبر است</strong>
           <span>برای اجرای واقعی باید نشست مجاز، دسترسی محدود به تعاونی و API تأیید شده وجود داشته باشد.</span>
          </div><p>{cfg.boundary}</p></>}
         {!settingsSection&&!memberSection?<InternalLink className="return-link" href={basePath||"/"}>بازگشت به داشبورد</InternalLink>:null}
       </section>
      </>}
      <footer>محیط آزمایش TTO · ثبت اطلاعات واقعی فقط با دسترسی مجاز و کنترل حفاظت داده · بدون ایجاد اثر حقوقی یا عملیات مالی</footer>
   </main>
 </div>;
}

export function PortalModulePreview({surface,moduleId}:{surface:Surface;moduleId:NavId}){
  return <PortalShell surface={surface} activeId={moduleId}/>;
}

export { OtpLogin } from "./otp-login";
export { TenantScopePicker } from "./tenant-scope-picker";
export { ShareholderWorkspace } from "./shareholder-workspace";

export {PortalModuleWorkbench} from "./portal-module-workbench";

export {PortalPasswordLogin} from "./portal-password-login";
export {PortalSessionGate} from "./portal-session-gate";

export {AuthFrame} from "./auth-frame";
