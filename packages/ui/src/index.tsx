import type { ReactNode } from "react";

export const NAV_IDS = Array.from({ length: 11 }, (_, i) => `NAV-${String(i + 1).padStart(2, "0")}`);
export type Surface = "shareholder" | "cooperative" | "national";
export type NavId = string;

export const managementNavigation = [
  "داشبورد", "اعضا و سهام", "بازار و سرمایه", "حاکمیت و مجامع",
  "ارتباط با سهامداران", "عملیات و خدمات", "کسب‌وکار و بازار",
  "پروژه و توسعه", "ریسک و شفافیت", "گزارش و هوشمندی", "تنظیمات"
] as const;
export const shareholderNavigation = [
  "داشبورد", "سهام و عضویت من", "خرید و فروش سهام", "مجامع و انتخابات",
  "اخبار و ارتباط با شرکت", "خدمات من", "فروشگاه و فرصت‌ها",
  "پروژه‌های شرکت", "شفافیت و اسناد شرکت", "گزارش‌های من", "تنظیمات حساب"
] as const;

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
    navigation: managementNavigation,
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

function navHref(i: number) {
  return i === 0 ? "/" : `/modules/${NAV_IDS[i].toLowerCase()}`;
}

export function PortalShell({
  surface, children, activeId = "NAV-01", suppressStaticKpis = false
}: { surface: Surface; children?: ReactNode; activeId?: NavId; suppressStaticKpis?: boolean }) {
  const cfg = surfaces[surface];
  const active = NAV_IDS.indexOf(activeId);
  const home = active === 0;
  const selection = active < 0 ? 0 : active;
  const currentTitle = home ? cfg.title : cfg.navigation[selection];
  return <div className="shell" dir="rtl">
    <aside className="nav-area">
      <a className="logo" href="/" aria-label="بازگشت به داشبورد پلتفرم ملی">TTO <span>پلتفرم ملی تعاونی توسعه و عمران</span></a>
      <nav aria-label="منوی اصلی">
        {cfg.navigation.map((name, i) =>
          <a href={navHref(i)} aria-current={selection === i ? "page" : undefined}
            className={selection === i ? "nav-link current" : "nav-link"} key={NAV_IDS[i]}>
            <span aria-hidden="true">◈</span><span>{name}</span><small>{NAV_IDS[i]}</small>
          </a>)}
      </nav>
    </aside>
    <main className="main-content" id="main-content">
      <div className="topbar"><strong>{cfg.title}</strong><span className="preview-tag">پیش‌نمایش داخلی · داده واقعی نمایش داده نمی‌شود</span></div>
      {!home && <div className="breadcrumb"><a href="/">داشبورد</a><span aria-hidden="true">‹</span><span>{currentTitle}</span></div>}
      <section className="hero">
        <h1>{currentTitle}</h1><p>{home ? cfg.description : cfg.sectionDescriptions[selection]}</p>
        <p className="hint">نمایش داده‌های مرتبط با کاربر تنها پس از تأیید نشست، نقش قانونی، محدوده تعاونی و سطح مجوز امکان‌پذیر است.</p>
      </section>
      {home && !suppressStaticKpis && <div className="kpi-grid">{cfg.chips.map(label =>
        <section className="metric" key={label}>
          <span>{label}</span><strong aria-label="داده موجود نیست">—</strong><small>داده تأییدشده در دسترس نیست</small>
        </section>)}</div>}
      <section className="panel">
        {home ? <>
          <h2>اقدامات و اطلاعیه‌ها</h2>
          <p>امکانات نمایش اطلاعات شخصی و اقدام‌های عملیاتی فقط پس از تأیید مجوزهای قانونی و اتصال به منبع داده معتبر فعال خواهند شد.</p>
          {children}
          <h2 className="module-heading">بخش‌های سامانه</h2>
          <div className="module-grid" aria-label="فهرست بخش‌های سامانه">
            {cfg.navigation.slice(1).map((name, i) =>
              <a href={navHref(i + 1)} className="module-card" key={NAV_IDS[i + 1]}>
                <span className="module-card-code">{NAV_IDS[i + 1]}</span>
                <strong>{name}</strong>
                <span>{cfg.sectionDescriptions[i + 1]}</span>
                <small>مشاهده ساختار بخش ←</small>
              </a>)}
          </div>
        </> : children ? <>
          {children}
          <a className="return-link" href="/">بازگشت به داشبورد</a>
        </> : <>
          <div className="module-status" role="status">
            <strong>ساختار این بخش آماده بررسی است</strong>
            <span>فعال‌سازی داده و عملیات: در انتظار پیاده‌سازی قرارداد دامنه و تأیید مجوزها</span>
          </div>
          <h2>دامنه عملکرد</h2>
          <p>{cfg.sectionDescriptions[selection]}</p>
          <h2>شرط دسترسی</h2>
          <p>{cfg.boundary} احراز هویت به‌تنهایی مجوز مشاهده اطلاعات تعاونی یا اجرای عملیات نیست.</p>
          <div className="module-empty" aria-label="اطلاعات محرمانه و عملیاتی هنوز بارگذاری نشده‌اند">
            <strong>—</strong><span>هیچ داده، مانده سهام یا وضعیت پرونده‌ای بدون استعلام معتبر نمایش داده نمی‌شود.</span>
          </div>
          <a className="return-link" href="/">بازگشت به داشبورد</a>
        </>}
      </section>
      <footer>{surface==="shareholder"&&children?
        "پیش‌نمایش محافظت‌شده سهامدار · استعلام فقط‌خواندنی با گیت‌های مستقل منبع و مجوز · ثبت معامله و داده واقعی غیرفعال":
        "پیش‌نمایش محافظت‌شده Next.js · داده واقعی نمایش داده نمی‌شود؛ عملیات دامنه نیازمند مجوز مستقل است"}</footer>
    </main>
  </div>;
}

export function PortalModulePreview({surface,moduleId}:{surface:Surface;moduleId:NavId}){
  return <PortalShell surface={surface} activeId={moduleId}/>;
}

export { OtpLogin } from "./otp-login";
export { ShareholderWorkspace } from "./shareholder-workspace";
