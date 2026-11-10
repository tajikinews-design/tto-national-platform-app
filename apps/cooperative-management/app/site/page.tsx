import type {Metadata} from "next";
import "./site.css";

export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"پلتفرم ملی تعاونی توسعه و عمران | پیشخوان خدمات",
 description:"پیشخوان ورود، ثبت اطلاعات تعاونی، عضویت و مدیریت خدمات تحت کنترل دسترسی و قوانین تعاونی‌ها.",
 robots:{index:false,follow:false,noarchive:true}
};

const stages=[
 {num:"۰۱",tag:"هویت و دسترسی",title:"احراز هویت و ورود امن",text:"ورود با حساب مجاز، OTP یا نام کاربری و رمز عبور؛ دسترسی هر شخص تنها به تعاونی و نقش تأییدشده او محدود است.",href:"/login",link:"ورود به سامانه",status:"ورود امن"},
 {num:"۰۲",tag:"درخواست خدمات",title:"درخواست فضای اختصاصی تعاونی",text:"ثبت درخواست و انتخاب شناسه اختصاصی تعاونی؛ تکمیل قرارداد و پرداخت فقط از مسیر تأییدشده انجام می‌شود.",href:"/subscribe",link:"فرم درخواست",status:"ثبت درخواست"},
 {num:"۰۳",tag:"مدیریت اعضا",title:"پرونده عضویت و مجموعه‌ها",text:"ثبت متقاضی، تطبیق هویت با مرجع مجاز، شماره عضویت و اطلاعات مجموعه در پنل همان تعاونی.",href:"/login",link:"ورود به مدیریت اعضا",status:"نیازمند مجوز تعاونی"},
 {num:"۰۴",tag:"خدمات سهام",title:"مشاهده پرونده سهام",text:"ثبت و مشاهده اطلاعات سهام با تفکیک درخواست عضویت، مالکیت قانونی و حق رأی. عملیات مالی با قرارداد مستقل انجام می‌شود.",href:"/login",link:"ورود به خدمات سهام",status:"وابسته به حقوق قانونی"}
];
const conditions=[
 "هرگونه ثبت و پردازش اطلاعات شخصی باید دارای هدف مشخص، مجوز قانونی و دسترسی محدود باشد.",
 "شماره عضویت، وضعیت قانونی عضویت و حق رأی سه موضوع مستقل با سوابق قابل رسیدگی‌اند.",
 "تغییر مالکیت سهام فقط با گردش‌کار قانونی و کنترل دفتر رسمی مالکیت معتبر خواهد بود.",
 "اطلاعات ثبت‌شده باید قابل اصلاح و پیگیری باشند و سوابق قانونی در موعد مقرر نگهداری شوند."
];

export default function CooperativePortal(){
 return <main className="tto-testsite" lang="fa" dir="rtl">
  <div className="tto-testsite-banner" role="status">پیشخوان ملی تعاونی‌های توسعه و عمران · ورود و خدمات بر اساس مجوز و نقش هر کاربر</div>
  <header className="tto-testsite-header"><div className="tto-testsite-wrap tto-testsite-header-row">
   <a href="/" className="tto-testsite-mark"><span className="tto-testsite-logo" aria-hidden="true">TTO</span><span><strong>پلتفرم ملی تعاونی توسعه و عمران</strong><small>پیشخوان خدمات تعاونی‌ها</small></span></a>
   <span className="tto-testsite-env"><span aria-hidden="true">●</span> ورود امن · دسترسی نقش‌محور</span>
  </div></header>
  <section className="tto-testsite-hero"><div className="tto-testsite-wrap tto-testsite-hero-grid">
   <div>
    <span className="tto-testsite-eyebrow">دسترسی یکپارچه به خدمات تعاونی‌ها</span>
    <h1>پیشخوان خدمات<br/><em>پلتفرم TTO</em></h1>
    <p>ثبت اطلاعات واقعی و دسترسی به پرونده‌های تعاونی از مسیر احراز هویت، کنترل مجوز نقش و رعایت ضوابط حفاظت اطلاعات انجام می‌شود. عضویت و سهامداری در سامانه مستقل از یکدیگر بررسی می‌شوند.</p>
    <div className="tto-testsite-actions">
      <a className="tto-testsite-button primary" href="#stages">مشاهده خدمات <span aria-hidden="true">←</span></a>
      <a className="tto-testsite-button secondary" href="/login">ورود به سامانه</a>
    </div>
    <div className="tto-testsite-restriction"><span aria-hidden="true">◇</span> حفظ محرمانگی اطلاعات · ثبت سوابق · تفکیک حقوق عضویت و سهام</div>
   </div>
   <aside className="tto-testsite-overview" aria-label="معرفی مسیرهای خدمات">
    <div className="tto-testsite-overview-head"><span className="tto-testsite-overview-badge">TTO</span><strong>خدمات قابل دسترسی</strong><small>۴ مسیر اصلی</small></div>
    <div className="tto-testsite-timeline">
      <div><b>۱</b><span>هویت و ورود</span><small>۶۰ ثانیه</small></div>
      <div><b>۲</b><span>درخواست فضای تعاونی</span><small>ثبت درخواست</small></div>
      <div><b>۳</b><span>دسترسی نقش‌محور</span><small>کنترل نشست</small></div>
      <div><b>۴</b><span>پرونده اعضا و سهام</span><small>کنترل حقوق قانونی</small></div>
    </div>
    <p>دسترسی به خدمات هر تعاونی تنها پس از ورود معتبر و بررسی حقوق ثبت‌شده همان نقش امکان‌پذیر است.</p>
   </aside>
  </div></section>
  <section className="tto-testsite-section" id="stages"><div className="tto-testsite-wrap">
   <div className="tto-testsite-section-heading"><div><span className="tto-testsite-eyebrow">خدمات سامانه</span><h2>مسیرهای اصلی</h2></div><p>هر بخش دارای مجوزهای اختصاصی است؛ ثبت درخواست به‌تنهایی جایگزین تأیید قانونی عضویت یا انتقال سهام نیست.</p></div>
   <div className="tto-testsite-cards">{stages.map(s=><article className="tto-testsite-card" key={s.num}>
    <div className="tto-testsite-card-top"><span>{s.num}</span><small>{s.tag}</small></div>
    <h3>{s.title}</h3><p>{s.text}</p>
    <div className="tto-testsite-card-foot"><span>{s.status}</span><a href={s.href}>{s.link} ←</a></div>
   </article>)}</div>
  </div></section>
  <section className="tto-testsite-policies"><div className="tto-testsite-wrap">
    <div className="tto-testsite-policies-box"><div><span className="tto-testsite-eyebrow">اصول قانونی و امنیتی</span><h2>قواعد حفاظت و اعتبار اطلاعات</h2></div>
    <ul>{conditions.map(x=><li key={x}><span aria-hidden="true">✓</span>{x}</li>)}</ul></div>
  </div></section>
  <footer className="tto-testsite-footer"><div className="tto-testsite-wrap"><span>TTO · پیشخوان ملی</span><span>اجرای هر عملیات مطابق قوانین، صلاحیت نقش‌ها و سوابق قابل رسیدگی انجام می‌شود.</span></div></footer>
 </main>;
}
