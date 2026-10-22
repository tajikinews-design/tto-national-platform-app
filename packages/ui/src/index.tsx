import type { ReactNode } from "react";

export const NAV_IDS = Array.from({ length: 11 }, (_, i) => `NAV-${String(i + 1).padStart(2, '0')}`);
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

type Surface = "shareholder" | "cooperative" | "national";
const surfaces: Record<Surface, { title: string; description: string; chips: readonly string[] }> = {
  shareholder: {
    title: "پنل سهامداران", description: "سهام، عضویت، خدمات و اطلاعیه‌های تعاونی",
    chips: ["سهام من", "درخواست‌های من", "مجامع", "پیام‌های من"]
  },
  cooperative: {
    title: "مدیریت تعاونی", description: "مدیریت اعضا، اسناد، سهام و فرایندهای تعاونی",
    chips: ["اعضای فعال", "درخواست‌های باز", "مدارک", "وضعیت عملیات"]
  },
  national: {
    title: "مرکز مدیریت ملی", description: "پایش شاخص‌های تجمیعی و سلامت شبکه تعاونی‌ها",
    chips: ["تعاونی‌های فعال", "گیت‌های حقوقی", "سلامت سامانه", "گزارش‌های تجمیعی"]
  }
};
export function PortalShell({ surface, children }: { surface: Surface; children?: ReactNode }) {
  const cfg = surfaces[surface];
  const labels = surface === "shareholder" ? shareholderNavigation : managementNavigation;
  return <div className="shell" dir="rtl">
    <aside className="nav-area"><div className="logo">TTO <span>پلتفرم ملی تعاونی توسعه و عمران</span></div>
      <nav aria-label="منوی اصلی">{labels.map((name, i) =>
        <div className={i === 0 ? "nav-link current" : "nav-link"} key={NAV_IDS[i]}>
          <span aria-hidden="true">◈</span><span>{name}</span><small>{NAV_IDS[i]}</small>
        </div>)}</nav>
    </aside>
    <main className="main-content">
      <div className="topbar"><strong>{cfg.title}</strong><span className="preview-tag">نمونه اولیه · بدون اطلاعات واقعی</span></div>
      <section className="hero"><h1>{cfg.title}</h1><p>{cfg.description}</p>
        <p className="hint">این محیط هنوز ورود کاربر یا عملیات تجاری ندارد؛ تمام داده‌های عملیاتی ناموجود ثبت شده‌اند.</p></section>
      <div className="kpi-grid">{cfg.chips.map(label =>
        <section className="metric" key={label}><span>{label}</span><strong aria-label="داده ناموجود">—</strong><small>داده‌ای موجود نیست</small></section>)}</div>
      <section className="panel"><h2>اقدامات و اطلاعیه‌ها</h2><p>پس از تکمیل احراز هویت و داده‌های آزمایشیِ مجاز نمایش داده می‌شوند.</p>{children}</section>
      <footer>نسخه Next.js — پوسته اجرایی بدون دسترسی به اطلاعات سهامداران · اطلاعات آزمایشی و غیرعملیاتی</footer>
    </main>
  </div>;
}

export { OtpLogin } from "./otp-login";
