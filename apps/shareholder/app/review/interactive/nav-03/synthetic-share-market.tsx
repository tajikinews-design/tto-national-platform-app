"use client";

import {useState} from "react";
import {BUY_STEPS,FLOW_INFO,OWNER_LABEL,SALE_MODE,SELL_STEPS,SOURCE_SPEC,type PreviewFlow} from "./market-flow-model";

const SELL_INPUTS=[
 ["نوع درخواست","فروش داوطلبانه — صرفاً مثال"],
 ["تعداد سهم مورد درخواست","۱۲۵ سهم — عدد فرضی"],
 ["شیوه عرضه",SALE_MODE+" — عرضه کامل"],
 ["وضعیت سهم آزاد","— (منبع واقعی تأیید نشده)"],
 ["پذیرش سیاست بازار","فقط نمایش شرط لازم؛ هیچ رضایت واقعی ثبت نشده"],
 ["تاریخ درخواست","— (درخواست واقعی ایجاد نشده)"],
 ["قیمت هر سهم","— (تنها طبق ACTIVE_PRICING_RULE معتبر)"]
] as const;
const BUY_INPUTS=[
 ["آگهی عرضه مرجع","DEMO-OFFER — شناسه غیرواقعی"],
 ["تعداد سهم درخواستی","۱۲۵ سهم — عدد فرضی"],
 ["نوع خریدار","عضو — فقط نمونه، بدون احراز هویت"],
 ["مبنای قیمت","— (قیمت‌گذاری مرجع هنوز تأیید نشده)"],
 ["مبلغ کل و کارمزدها","— (بدون تعرفه مصوب هیچ محاسبه‌ای انجام نمی‌شود)"],
 ["سقف مالکیت","— (از LEGAL_RULE_REGISTRY خوانده می‌شود)"],
 ["حساب بانکی فروشنده","— (تا تأیید ادامه فروشنده محرمانه است)"]
] as const;
const EXCEPTIONS=[
 ["REJECTED","درخواست رد شد"],["CANCELLED","انصراف/لغو طبق مرحله و سیاست معتبر"],
 ["EXPIRED","اعتبار مهلت پایان یافت"],["SUSPENDED","پرونده متوقف شد"],
 ["PAYMENT_DISPUTED","اختلاف پرداخت"],["TRANSFER_DISPUTED","اختلاف انتقال"],
 ["LEGAL_REVIEW_REQUIRED","نیازمند بررسی حقوقی"],["MANUAL_REVIEW_REQUIRED","نیازمند بررسی دستی"]
] as const;

function LegalGuide(){
 return <details className="w1m-legal">
  <summary>⚖ راهنمای قانونی این صفحه</summary>
  <div className="w1m-legal-inner">
   <p>مرجع طراحی: <strong>{SOURCE_SPEC}</strong>. قواعد، مواد قانونی، مصوبات و نسخه‌های معتبر هر تعاونی در محیط واقعی باید مستقلاً احراز شوند؛ این نمایش هیچ تأیید حقوقی ایجاد نمی‌کند.</p>
   <dl>
    <div><dt>ضابطه عرضه و صف</dt><dd>FIFO/ظرفیت/ETA سیاست مصوب تعاونی (<code>COOP_APPROVED_POLICY</code>) هستند، نه حکم قانونی مستقل.</dd></div>
    <div><dt>قیمت عرضه</dt><dd>بر مبنای <code>ACTIVE_PRICING_RULE</code>، گزارش کارشناسی و مرجع تصویب معتبر؛ فروشنده بدون Rule قیمت دلخواه وارد نمی‌کند.</dd></div>
    <div><dt>تأیید مستقل</dt><dd>طبق مشخصات مرجع، تأیید هیئت‌مدیره پرونده جداگانه با مستند جلسه و مصوبه است؛ تأیید کلیک‌محور جایگزین آن نیست.</dd></div>
    <div><dt>انتقال مالکیت</dt><dd>پرداخت یا تأیید وصول انتقال نیست؛ ثبت دفتر سهام و تسویه اتمیک با شروط کامل الزامی است.</dd></div>
    <div><dt>گیت حقوقی تعهد سرمایه</dt><dd><code>LEGAL_GATE-CAPITAL-COMMITMENT-PRICE</code> همچنان بسته است؛ تسویه داوطلبانه تعهد از بازار مستقل است و فرمول بدهی تحمیل نمی‌شود.</dd></div>
    <div><dt>شماره و نسخه Rule جاری</dt><dd>— (در پیش‌نمایش منبع قانونی واقعی بارگذاری نمی‌شود)</dd></div>
   </dl>
   <p>راهنمای حاضر توضیح ساختار مورد انتظار است؛ قانون و مصوبه معتبر هر تعاونی باید در سامانه قانونی با تاریخ و نسخه مشخص ثبت و بررسی شود.</p>
  </div>
 </details>;
}

export function SyntheticShareMarket(){
 const [flow,setFlow]=useState<PreviewFlow>("SELL");
 const [saleStage,setSaleStage]=useState(0);
 const [purchaseStage,setPurchaseStage]=useState(0);
 const stages=flow==="SELL"?SELL_STEPS:BUY_STEPS;
 const active=flow==="SELL"?saleStage:purchaseStage;
 const choose=flow==="SELL"?setSaleStage:setPurchaseStage;
 const current=stages[active]??stages[0];
 const inputs=flow==="SELL"?SELL_INPUTS:BUY_INPUTS;
 const completion=flow==="BUY"&&current.code==="COMPLETED";
 return <main dir="rtl" className="w1m-shell">
  <header className="w1m-top">
   <a href="/review/interactive/nav-02">بازگشت به «سهام و عضویت من» ←</a>
   <span>W1 / NAV-03 · فقط پیش‌نمایش طراحی</span>
  </header>
  <div className="w1m-intro">
   <div><span className="w1m-eyebrow">دو مسیر مستقل، منطبق با Specification v3.0</span>
    <h1>خرید و فروش سهام</h1>
    <p>مراحل قانونی و اجرایی درخواست فروش و درخواست خرید را بدون ایجاد معامله، رزرو، بلوکه سهم، پرداخت یا انتقال دفتر سهام بررسی کنید.</p>
   </div>
   <div className="w1m-watermark"><strong>DEMO</strong><span>همه اطلاعات ساختگی‌اند</span></div>
  </div>
  <p className="w1m-safety" role="note">
   <strong>فعال‌سازی غیرفعال:</strong> هیچ درخواست واقعی ثبت نمی‌شود، وضعیت‌ها را فقط برای مطالعه انتخاب می‌کنید و حتی نمایش «تکمیل‌شده» به معنی مالکیت نیست. هرگونه عملیات واقعی به تأیید مستقل منابع رسمی، اختیارات هیئت‌مدیره و قواعد بالادستی وابسته است.
  </p>
  <LegalGuide/>
  <div className="w1m-tabs" role="group" aria-label="گردش‌کار آزمایشی">
   <button type="button" aria-pressed={flow==="SELL"} className={flow==="SELL"?"w1m-tab w1m-tab-on":"w1m-tab"} onClick={()=>setFlow("SELL")}>
    <strong>درخواست فروش سهام</strong><span>فروشنده → کنترل صلاحیت → صف و تابلو</span>
   </button>
   <button type="button" aria-pressed={flow==="BUY"} className={flow==="BUY"?"w1m-tab w1m-tab-on":"w1m-tab"} onClick={()=>setFlow("BUY")}>
    <strong>درخواست خرید سهام</strong><span>خریدار → تأییدها → پرداخت و انتقال رسمی</span>
   </button>
  </div>
  <div className="w1m-flow-note" role="status" aria-live="polite">
   <strong>{flow==="SELL"?"فروش داوطلبانه، بدون درج قیمت دلخواه":"درخواست خرید، نه خرید قطعی"}</strong>
   <span>{FLOW_INFO[flow]}</span>
  </div>
  <section className="w1m-form-panel" aria-label={flow==="SELL"?"اطلاعات موردنیاز درخواست فروش":"اطلاعات موردنیاز درخواست خرید"}>
   <div className="w1m-panel-heading">
    <div><h2>{flow==="SELL"?"مشخصات درخواست فروش":"مشخصات درخواست خرید"}</h2><p>نمونه داده برای مطالعه فرم؛ بدون دریافت ورودی، ذخیره یا اعتبارسنجی واقعی</p></div>
    <span>فقط نمونه · بدون ثبت</span>
   </div>
   <dl className="w1m-fields">
    {inputs.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
   </dl>
   <div className="w1m-submit-preview">
    <button type="button" disabled aria-disabled="true">{flow==="SELL"?"ثبت درخواست فروش":"ثبت درخواست خرید"}</button>
    <p>دکمه عمداً غیرفعال است؛ هیچ رویداد مالی، حقوقی یا ارسال درخواست به سرور انجام نمی‌دهد.</p>
   </div>
  </section>
  <section className="w1m-journey" aria-label="مراحل گردش‌کار">
   <div className="w1m-panel-heading">
    <div><h2>مراحل و وضعیت‌های پرونده</h2><p>روی هر مرحله بزنید تا شرح، اقدام بعدی و مدارک لازم نمایش داده شود.</p></div>
    <span>{String(active+1)} از {String(stages.length)} مرحله</span>
   </div>
   <div className="w1m-journey-grid">
    <nav className="w1m-steps" aria-label={"مراحل "+(flow==="SELL"?"فروش":"خرید")}>
     {stages.map((stage,index)=><button key={stage.code} type="button"
       className={index===active?"w1m-step w1m-step-selected":"w1m-step"}
       aria-current={index===active?"step":undefined}
       onClick={()=>choose(index)}>
       <span className="w1m-step-no">{String(index+1).padStart(2,"0")}</span>
       <span className="w1m-step-copy"><strong>{stage.title}</strong><small dir="ltr">{stage.code}</small></span>
     </button>)}
    </nav>
    <article className="w1m-step-detail" aria-live="polite">
     <span className="w1m-step-pill">مرحله انتخابی · نمایش فرضی</span>
     <h3>{current.title}</h3>
     <p className="w1m-step-code" dir="ltr">{current.code}</p>
     <p className="w1m-stage-desc">{current.detail}</p>
     <dl className="w1m-meta">
      <div><dt>مسئول اقدام بعدی در گردش‌کار واقعی</dt><dd>{OWNER_LABEL[current.owner]}</dd></div>
      <div><dt>اطلاعات و مستندات موردنیاز</dt><dd>{current.evidence}</dd></div>
      <div><dt>وضعیت اثر حقوقی این پیش‌نمایش</dt><dd>{completion?"تکمیل فقط در سناریوی فرضی؛ هیچ انتقال واقعی رخ نداده":"مالکیت منتقل نشده؛ صرفاً مشاهده مرحله"}</dd></div>
      <div><dt>نسخه مقررات معتبر تعاونی</dt><dd>— (نیازمند تأیید مستقل)</dd></div>
     </dl>
     <p className="w1m-next">هیچ یک از دکمه‌های انتخاب مرحله، تأییدیه، رزرو یا رویداد قابل استناد ایجاد نمی‌کنند.</p>
    </article>
   </div>
  </section>
  <section className="w1m-exceptions">
   <h2>استثناها، اختلاف‌ها و توقف فرایند</h2>
   <p>این وضعیت‌ها در مدل عملیاتی، ادامه معامله و Finalization را مشروط یا مسدود می‌کنند. در این پیش‌نمایش صرفاً راهنما هستند.</p>
   <div>{EXCEPTIONS.map(([code,label])=><span key={code} className="w1m-exception"><strong>{label}</strong><small dir="ltr">{code}</small></span>)}</div>
   <p>قبل از رزرو، لغو عرضه تابع سیاست معتبر بازار است؛ پس از رزرو، درخواست لغو و بعد از پرداخت بررسی اختلاف لازم می‌شود. توقف زمانی هیچ‌گاه به معنی تأیید خودکار وصول یا انتقال نیست.</p>
  </section>
  <footer className="w1m-footer">
   <strong>مرزبندی قطعی:</strong> ثمن در نسخه عملیاتی صرفاً به‌صورت مستقیم خریدار ← فروشنده پرداخت می‌شود؛ کارمزدهای مصوب جداگانه به مرجع مجاز تعاونی می‌روند. پلتفرم کیف پول، امانی وجه یا حسابداری عمومی تعاونی نیست. تغییر دفتر رسمی سهم فقط با شروط قانونی و تراکنش اتمیک Backend مجاز است.
  </footer>
 </main>;
}
