import type {Metadata} from "next";
import "./site.css";

export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"آزمایشگاه توسعه TTO | محیط آزمایشی",
 description:"درگاه آزمایش مراحل توسعه TTO، احراز هویت پیامکی، فضای نمونه تعاونی و کنترل مرزهای دسترسی.",
 robots:{index:false,follow:false,noarchive:true}
};

const stages=[
 {num:"۰۱",tag:"هویت و OTP",title:"آزمون ثبت شماره همراه",text:"صدور و تأیید کد یک‌بارمصرف ۶۰ثانیه‌ای از API.ir، فقط با شماره مجاز آزمایش‌کننده.",href:"/customer-register",link:"اجرای آزمون OTP",status:"قابل آزمایش"},
 {num:"۰۲",tag:"اشتراک نمونه",title:"آزمون ایجاد فضای تعاونی",text:"فرم شبیه‌ساز ثبت سفارش، انتخاب پلن نمایشی و رزرو شناسه نمونه؛ هیچ پرداختی انجام نمی‌شود.",href:"/subscribe",link:"فرم شبیه‌سازی",status:"بدون پرداخت واقعی"},
 {num:"۰۳",tag:"ورود اختصاصی",title:"آزمون ورود به فضای تعاونی",text:"ورود با OTP یا رمز، با حفظ جداسازی دسترسی‌ها و کنترل مطابقت شناسه تعاونی با نشست.",href:"/login",link:"تست فرم ورود",status:"نیازمند حساب مجاز"},
 {num:"۰۴",tag:"وضعیت اشتراک",title:"آزمون مشاهده اعتبار و امکانات",text:"کنترل نمایش اطلاعات اشتراک آزمایشی پس از احراز هویت؛ بدون اعطای حق مدیریت سهام.",href:"/settings/subscription",link:"بررسی اشتراک نمونه",status:"نیازمند ورود"}
];
const conditions=[
 "داده‌ها و حساب‌های آزمایشی پس از پایان تست باید پاک‌سازی شوند.",
 "هیچ مشتری واقعی، قرارداد فروش یا پرداخت بانکی در این مرحله ثبت نمی‌شود.",
 "ثبت زیردامنه به‌تنهایی به معنی تأیید رسمی تعاونی یا اختیار عملیات سهام نیست.",
 "تغییر در الگوی مصوب صفحات ورود و ثبت سفارش TTO-AUTH-UI-V1 مجاز نیست."
];

export default function TestPortal(){
 return <main className="tto-testsite" lang="fa" dir="rtl">
  <div className="tto-testsite-banner" role="status">محیط آزمایشی توسعه TTO · این سامانه برای پذیرش مشتری یا فروش عمومی فعال نشده است.</div>
  <header className="tto-testsite-header"><div className="tto-testsite-wrap tto-testsite-header-row">
   <a href="/" className="tto-testsite-mark"><span className="tto-testsite-logo" aria-hidden="true">TTO</span><span><strong>مرکز آزمون توسعه TTO</strong><small>پلتفرم ملی توسعه و عمران · پیش‌نمایش</small></span></a>
   <span className="tto-testsite-env"><span aria-hidden="true">●</span> PREVIEW / TEST ONLY</span>
  </div></header>
  <section className="tto-testsite-hero"><div className="tto-testsite-wrap tto-testsite-hero-grid">
   <div>
    <span className="tto-testsite-eyebrow">محیط کنترل و آزمون سامانه</span>
    <h1>آزمون گام‌به‌گام<br/><em>پلتفرم TTO</em></h1>
    <p>در این مرحله فقط مسیرهای فنی را بررسی می‌کنیم: OTP، ایجاد فضای نمونه، تعیین زیردامنه و کنترل دسترسی نقش‌ها. تمام داده‌های مورد استفاده باید آزمایشی باشند.</p>
    <div className="tto-testsite-actions">
      <a className="tto-testsite-button primary" href="#stages">مشاهده مراحل آزمون <span aria-hidden="true">←</span></a>
      <a className="tto-testsite-button secondary" href="/login">آزمایش صفحه ورود</a>
    </div>
    <div className="tto-testsite-restriction"><span aria-hidden="true">◇</span> بدون ثبت تجاری · بدون پرداخت واقعی · بدون تغییر نقش‌های قانونی</div>
   </div>
   <aside className="tto-testsite-overview" aria-label="مرزهای آزمون توسعه">
    <div className="tto-testsite-overview-head"><span className="tto-testsite-overview-badge">TTO</span><strong>محدوده آزمایش</strong><small>۴ مسیر فنی مستقل</small></div>
    <div className="tto-testsite-timeline">
      <div><b>۱</b><span>ثبت شماره و OTP</span><small>۶۰ ثانیه</small></div>
      <div><b>۲</b><span>ساخت فضای نمونه</span><small>بدون وجه</small></div>
      <div><b>۳</b><span>ورود بر اساس نقش</span><small>کنترل نشست</small></div>
      <div><b>۴</b><span>بررسی اشتراک</span><small>داده آزمایشی</small></div>
    </div>
    <p>فقط موفقیت آزمون‌های مشخص‌شده می‌تواند GREEN اعلام شود؛ این صفحه تأیید آمادگی عملیاتی نیست.</p>
   </aside>
  </div></section>
  <section className="tto-testsite-section" id="stages"><div className="tto-testsite-wrap">
   <div className="tto-testsite-section-heading"><div><span className="tto-testsite-eyebrow">سناریوهای توسعه</span><h2>مسیرهای قابل بررسی</h2></div><p>هر سناریو مستقل اجرا می‌شود و هیچ‌کدام مجوز عملیات واقعی سهام ایجاد نمی‌کند.</p></div>
   <div className="tto-testsite-cards">{stages.map(s=><article className="tto-testsite-card" key={s.num}>
    <div className="tto-testsite-card-top"><span>{s.num}</span><small>{s.tag}</small></div>
    <h3>{s.title}</h3><p>{s.text}</p>
    <div className="tto-testsite-card-foot"><span>{s.status}</span><a href={s.href}>{s.link} ←</a></div>
   </article>)}</div>
  </div></section>
  <section className="tto-testsite-policies"><div className="tto-testsite-wrap">
    <div className="tto-testsite-policies-box"><div><span className="tto-testsite-eyebrow">قواعد محیط آزمایشی</span><h2>کنترل‌های ضروری پیش از ثبت داده</h2></div>
    <ul>{conditions.map(x=><li key={x}><span aria-hidden="true">✓</span>{x}</li>)}</ul></div>
  </div></section>
  <footer className="tto-testsite-footer"><div className="tto-testsite-wrap"><span>TTO · نسخه آزمایشی</span><span>همه مسیرهای عملیاتی، مالی و حقوقی خارج از محدوده تأیید فعلی هستند.</span></div></footer>
 </main>;
}
