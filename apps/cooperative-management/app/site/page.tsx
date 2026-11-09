import type {Metadata} from "next";
import PublicPlans from "./plan-list";
import "./site.css";

export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"پلتفرم ملی توسعه و عمران | TTO",
 description:"آشنایی با پلتفرم ملی توسعه و عمران؛ مدیریت اشتراک و فضای اختصاصی تعاونی‌ها، ثبت‌نام با پیامک و بررسی خدمات به‌صورت آزمایشی.",
 robots:{index:false,follow:false} // Preview only. SEO/public release requires separate approval.
};

const services=[
 {icon:"▦",title:"فضای مستقل هر تعاونی",detail:"نشانی اختصاصی برای هر تعاونی؛ ورود و دسترسی بر اساس شناسه و نقش تأییدشده."},
 {icon:"♧",title:"مدیریت اشتراک",detail:"مشاهده مدت اعتبار و امکانات پلن در پنل صاحب اشتراک تجاری."},
 {icon:"◈",title:"احراز هویت امن",detail:"ورود با رمز یا کد یک‌بارمصرف پیامکی با اعتبار ۶۰ ثانیه."},
 {icon:"≋",title:"ساختار توسعه‌پذیر",detail:"ماژول‌های خدماتی، مدیریتی و سهامداری با مرزهای مستقل دسترسی."}
];

const phases=[
 {number:"۰۱",title:"ثبت شماره همراه",text:"با رمز یک‌بارمصرف، شماره تلفن خود را تأیید کنید."},
 {number:"۰۲",title:"انتخاب پلن و شناسه",text:"نام تعاونی و نشانی اختصاصی پیشنهادی را وارد کنید."},
 {number:"۰۳",title:"ثبت سفارش آزمایشی",text:"مبلغ نمایشی را تأیید و وضعیت اشتراک را پیگیری کنید."}
];

export default function CommerceSite(){
 return <main dir="rtl" lang="fa" className="tto-site">
  <div className="tto-site-topline" role="status">نسخه معرفی و پیش‌نمایش تجاری · ثبت سفارش فعلاً آزمایشی و بدون پرداخت بانکی است.</div>
  <header className="tto-site-header">
   <div className="tto-site-container tto-site-nav">
    <a href="/" className="tto-site-identity" aria-label="TTO، صفحه اصلی">
     <span className="tto-site-logo" aria-hidden="true">TTO</span>
     <span><strong>پلتفرم ملی توسعه و عمران</strong><small>درگاه خدمات تعاونی‌ها</small></span>
    </a>
    <nav className="tto-site-nav-links" aria-label="فهرست وب‌سایت">
     <a href="#services">امکانات</a><a href="#plans">پلن‌ها</a><a href="#steps">مراحل سفارش</a>
    </nav>
    <a className="tto-site-nav-cta" href="/login">ورود به حساب <span aria-hidden="true">←</span></a>
   </div>
  </header>

  <section className="tto-site-hero" aria-labelledby="tto-site-hero-title">
   <div className="tto-site-container tto-site-hero-layout">
    <div className="tto-site-hero-copy">
     <span className="tto-site-eyebrow"><span aria-hidden="true">✦</span> یک راهکار یکپارچه برای تعاونی‌ها</span>
     <h1 id="tto-site-hero-title">مدیریت هوشمند تعاونی،<br/><em>در فضای اختصاصی شما.</em></h1>
     <p>از ثبت درخواست اشتراک تا مدیریت دسترسی‌ها؛ TTO زیرساختی یکپارچه برای خدمات تعاونی‌ها فراهم می‌کند. هر شرکت در نشانی اختصاصی خود فعالیت می‌کند و حریم داده‌ها و اختیار نقش‌ها مستقل باقی می‌ماند.</p>
     <div className="tto-site-hero-actions">
      <a href="/customer-register" className="tto-site-button tto-site-button-primary">شروع ثبت‌نام با پیامک <span aria-hidden="true">←</span></a>
      <a href="#plans" className="tto-site-button tto-site-button-outline">آشنایی با پلن‌ها</a>
     </div>
     <p className="tto-site-hero-disclaimer">ثبت‌نام و سفارش در این نسخه، آزمایشی است؛ خرید اشتراک به معنی تأیید قانونی یا اعطای حق مدیریت سهام نیست.</p>
    </div>
    <div className="tto-site-hero-visual" aria-label="ساختار نشانی اختصاصی تعاونی">
     <div className="tto-site-scene-ring one"/><div className="tto-site-scene-ring two"/>
     <div className="tto-site-scene-card">
      <span className="tto-site-scene-symbol" aria-hidden="true">◈</span>
      <span className="tto-site-scene-card-tag">فضای مستقل تعاونی</span>
      <strong dir="ltr">your-coop.ttoir.ir</strong>
      <p>نشانی اختصاصی · کنترل دسترسی نقش‌محور</p>
      <div className="tto-site-scene-lines"><i/><i/><i/></div>
      <div className="tto-site-scene-status"><span aria-hidden="true">●</span> اتصال امن و احراز هویت مستقل</div>
     </div>
     <div className="tto-site-scene-small a"><span aria-hidden="true">✓</span> هویت تأییدشده</div>
     <div className="tto-site-scene-small b"><span aria-hidden="true">♢</span> اشتراک قابل پیگیری</div>
    </div>
   </div>
  </section>

  <section className="tto-site-intro-strip" aria-label="مزیت‌های زیرساخت">
   <div className="tto-site-container tto-site-intro-grid">
    <p><span aria-hidden="true">◈</span> نشانی اختصاصی هر تعاونی</p>
    <p><span aria-hidden="true">◇</span> تفکیک نقش و سطح دسترسی</p>
    <p><span aria-hidden="true">✓</span> احراز هویت پیامکی</p>
    <p><span aria-hidden="true">▣</span> پیگیری اشتراک و خدمات</p>
   </div>
  </section>

  <section id="services" className="tto-site-section tto-site-services">
   <div className="tto-site-container">
    <span className="tto-site-section-label">امکانات پلتفرم</span>
    <h2>زیرساختی یکپارچه، با مرزهای دسترسی مشخص</h2>
    <p className="tto-site-section-lead">خدمات نمایشی و قابلیت‌های آماده‌شده در چارچوب هر پلن ارائه می‌شوند؛ امکانات نیازمند مجوز، تا تأیید رسمی فعال نخواهند شد.</p>
    <div className="tto-site-service-grid">{services.map(x=><article className="tto-site-service" key={x.title}>
     <span className="tto-site-service-icon" aria-hidden="true">{x.icon}</span>
     <h3>{x.title}</h3><p>{x.detail}</p>
    </article>)}</div>
   </div>
  </section>

  <section id="plans" className="tto-site-section tto-site-plans-section">
   <div className="tto-site-container">
    <div className="tto-site-section-title-row"><div>
     <span className="tto-site-section-label">اشتراک تعاونی</span>
     <h2>پلن‌های قابل بررسی</h2>
     <p className="tto-site-section-lead">فهرست زیر مستقیماً از کاتالوگ آزمایشی سامانه دریافت می‌شود؛ قیمت‌گذاری یا پرداخت واقعی هنوز فعال نشده است.</p>
    </div><a className="tto-site-text-link" href="/subscribe">رفتن به فرم ثبت سفارش ←</a></div>
    <PublicPlans/>
   </div>
  </section>

  <section id="steps" className="tto-site-section tto-site-steps-section">
   <div className="tto-site-container">
    <span className="tto-site-section-label">شروع همکاری</span>
    <h2>سه مرحله تا ثبت درخواست اشتراک</h2>
    <div className="tto-site-steps">{phases.map(x=><article key={x.number}>
      <span>{x.number}</span><h3>{x.title}</h3><p>{x.text}</p>
    </article>)}</div>
    <div className="tto-site-bottom-cta"><div><strong>آماده بررسی خدمات TTO هستید؟</strong><p>با شماره همراه خود ثبت‌نام کنید و مراحل سفارش آزمایشی را مشاهده کنید.</p></div><a href="/customer-register" className="tto-site-button tto-site-button-primary">ثبت‌نام و ادامه <span aria-hidden="true">←</span></a></div>
   </div>
  </section>
  <footer className="tto-site-footer"><div className="tto-site-container tto-site-footer-layout">
   <div><span className="tto-site-footer-logo">TTO</span><strong>پلتفرم ملی توسعه و عمران</strong><p>نسخه آزمایشی · بدون عملیات مالی یا سهام واقعی</p></div>
   <div className="tto-site-footer-links"><a href="/login">ورود به سامانه</a><a href="/customer-register">ثبت‌نام با OTP</a><a href="/subscribe">ثبت سفارش آزمایشی</a></div>
  </div></footer>
 </main>;
}
