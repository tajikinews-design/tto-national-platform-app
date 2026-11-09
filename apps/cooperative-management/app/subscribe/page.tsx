"use client";
import {useEffect,useState,type FormEvent} from "react";
import {AuthFrame} from "@tto/ui";

type Plan={code:string;title:string;durationDays:number;features:string[]};
type OrderResult={domain:string;slug:string;expiresAt:string;status:string;smsStatus?:string;username?:string;dnsReady?:boolean};
type Step="details"|"confirm"|"done";
const asFa=(n:number)=>n.toLocaleString("fa-IR");

export default function CommercialCheckout(){
 const [plans,setPlans]=useState<Plan[]>([]);
 const [catalogReady,setCatalogReady]=useState(false);
 const [authenticated,setAuthenticated]=useState<boolean|null>(null);
 const [form,setForm]=useState({name:"",planCode:""});
 const [step,setStep]=useState<Step>("details");
 const [notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[result,setResult]=useState<OrderResult|null>(null);
 const selected=plans.find(p=>p.code===form.planCode);
 useEffect(()=>{
  let alive=true;
  void fetch("/api/auth/session",{cache:"no-store",credentials:"same-origin"})
   .then(r=>r.ok?r.json():Promise.reject())
   .then((s:{authenticated?:boolean})=>{if(alive)setAuthenticated(s.authenticated===true)})
   .catch(()=>{if(alive){setAuthenticated(null);setNotice("بررسی نشست انجام نشد. اتصال سامانه را بررسی کنید.")}});
  void fetch("/api/commerce",{cache:"no-store",credentials:"same-origin"})
   .then(r=>r.ok?r.json():Promise.reject())
   .then((v:{plans?:Plan[];realPaymentEnabled?:boolean})=>{
    if(!alive)return;
    if(v.realPaymentEnabled!==false||!Array.isArray(v.plans)||v.plans.length===0)throw Error("CATALOG_EMPTY");
    const safe=v.plans.filter(p=>p&&typeof p.code==="string"&&/^demo-[a-z-]{2,30}$/.test(p.code)&&
     typeof p.title==="string"&&Number.isInteger(p.durationDays)&&p.durationDays>0&&Array.isArray(p.features));
    if(!safe.length)throw Error("CATALOG_INVALID");
    setPlans(safe);setForm(p=>({...p,planCode:p.planCode||safe[0].code}));setCatalogReady(true);
   })
   .catch(()=>{if(alive){setCatalogReady(false);setNotice("دریافت پلن‌های آزمایشی از سرور ممکن نشد. صفحه را بازخوانی کنید.")}});
  return()=>{alive=false};
 },[]);
 function next(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setNotice("");
  if(authenticated!==true){setNotice("پیش از ایجاد فضای نمونه، با شماره همراه خود وارد شوید و OTP را تأیید کنید.");return}
  if(!selected){setNotice("لطفاً ابتدا پلن معتبر را انتخاب کنید.");return}
  if(form.name.trim().length<5){setNotice("نام تعاونی باید حداقل پنج نویسه داشته باشد.");return}
  setStep("confirm");
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!selected)return;
  setBusy(true);setNotice("");setResult(null);
  try{
   const response=await fetch("/api/commerce",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name:form.name.trim(),planCode:form.planCode})
   });
   const data=await response.json() as {
    code?:string;domain?:string;slug?:string;status?:string;expiresAt?:string;
    smsStatus?:string;username?:string;dnsReady?:boolean;tenantActivated?:boolean
   };
   if(response.status===401)throw Error("نشست شما پایان یافته است. ابتدا دوباره با OTP وارد شوید.");
   if(response.status===403)throw Error("ابتدا شماره همراه خود را با OTP تأیید کنید.");
   if(response.status===409)throw Error("تداخل نادر در شناسه ایجادشده؛ دوباره روی ثبت فضای آزمایشی بزنید.");
   if(response.status===503)throw Error("سرویس ثبت آزمایشی در دسترس نیست. چند لحظه بعد دوباره تلاش کنید.");
   if(!response.ok||data.status!=="DEMO_AMOUNT_ATTESTED"||!data.domain||
      !data.slug||!data.expiresAt||data.tenantActivated!==true||
      !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(data.slug)||
      data.domain!==data.slug+".ttoir.ir")
    throw Error("تأیید ثبت فضای نمونه انجام نشد؛ سفارش را موفق در نظر نگیرید.");
   setResult({domain:data.domain,slug:data.slug,status:data.status,expiresAt:data.expiresAt,
    smsStatus:data.smsStatus,username:data.username,dnsReady:data.dnsReady});
   setStep("done");
  }catch(e){setNotice(e instanceof Error?e.message:"ثبت فضای آزمایشی انجام نشد.")}
  finally{setBusy(false)}
 }
 return <AuthFrame surface="cooperative" mode="order"
  title="ایجاد فضای آزمایشی تعاونی"
  description="نام دلخواه تعاونی را بنویسید؛ سامانه نشانی اختصاصی و یکتا را به‌صورت خودکار ایجاد می‌کند. هیچ پرداختی انجام نمی‌شود.">
  <section className="tto-auth-controls tto-checkout" aria-label="ایجاد فضای نمونه تعاونی">
   <div className="tto-checkout-progress" aria-label="مراحل ایجاد فضای نمونه">
    <span className={step==="details"?"active":"complete"}><b>۱</b> نام و پلن</span>
    <span className={step==="confirm"?"active":step==="done"?"complete":""}><b>۲</b> تأیید آزمایش</span>
    <span className={step==="done"?"active":""}><b>۳</b> نتیجه</span>
   </div>
   {step==="details"?<>
    {authenticated!==true?<p className="tto-checkout-helper" role="status">
      {authenticated===false?"برای ایجاد فضای آزمایشی، ابتدا با شماره همراه و OTP وارد شوید.":"در حال بررسی ورود به سامانه…"}{" "}
      <a href="/customer-register">ثبت‌نام با OTP</a> · <a href="/login">ورود با OTP</a>
    </p>:<p className="tto-checkout-helper" role="status">شماره همراه شما تأیید شده است. نیازی به واردکردن مجدد شماره نیست.</p>}
    <form onSubmit={next} className="tto-checkout-form">
     <label htmlFor="order-name">نام دلخواه تعاونی نمونه</label>
     <input id="order-name" autoComplete="organization" required minLength={5} maxLength={180}
      placeholder="مثلاً تعاونی توسعه و عمران طرقبه" value={form.name}
      onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
     <p className="tto-auth-muted-note">شناسه لاتین و نشانی اختصاصی با همین نام در سرور تولید می‌شود؛ لازم نیست شناسه‌ای انتخاب یا از قبل رزرو کنید.</p>
     <label htmlFor="order-plan">پلن آزمایشی</label>
     <select id="order-plan" required disabled={!catalogReady} value={form.planCode}
      onChange={e=>setForm(p=>({...p,planCode:e.target.value}))}>
      <option value="">انتخاب پلن</option>
      {plans.map(p=><option key={p.code} value={p.code}>{p.title} — {asFa(p.durationDays)} روز</option>)}
     </select>
     {selected?<div className="tto-checkout-plan" aria-live="polite">
       <div className="tto-checkout-plan-title"><strong>{selected.title}</strong><span>{asFa(selected.durationDays)} روز اعتبار</span></div>
       <p>امکانات پلن: {selected.features.length?selected.features.join(" · "):"مشخصات پلن طبق قرارداد آزمایشی"}</p>
      </div>:null}
     <button type="submit" disabled={!selected||busy||authenticated!==true}>ادامه و بررسی اطلاعات <span aria-hidden="true">←</span></button>
    </form>
   </>:null}
   {step==="confirm"?<>
    <div className="tto-checkout-review">
     <span className="tto-checkout-review-heading">خلاصه فضای آزمایشی</span>
     <strong>{form.name}</strong>
     <div className="tto-checkout-review-row"><span>شناسه زیردامنه</span><b>ساخت خودکار و یکتا پس از تأیید</b></div>
     <div className="tto-checkout-review-row"><span>پلن انتخابی</span><b>{selected?.title} · {selected?asFa(selected.durationDays):"—"} روز</b></div>
     <div className="tto-checkout-review-row"><span>مالک فضای نمونه</span><b>همین حساب با شماره تأییدشده</b></div>
    </div>
    <p className="tto-checkout-warning"><strong>بدون پرداخت بانکی:</strong> این عملیات فقط برای آزمون توسعه است؛ هیچ وجهی دریافت نمی‌شود و اختیار رسمی مدیریت تعاونی یا عملیات سهام ایجاد نخواهد شد.</p>
    <form onSubmit={submit} className="tto-checkout-form">
     <div className="tto-checkout-actions">
      <button type="button" className="tto-checkout-secondary" disabled={busy}
       onClick={()=>{setStep("details");setNotice("")}}>ویرایش اطلاعات</button>
      <button type="submit" disabled={busy}>{busy?"در حال ایجاد فضای امن…":"ایجاد فضای آزمایشی"}</button>
     </div>
    </form>
   </>:null}
   {step==="done"&&result?<section className="tto-checkout-success" role="status" aria-label="نتیجه ثبت فضای آزمایشی">
    <div className="tto-checkout-success-icon" aria-hidden="true">✓</div>
    <h2>فضای آزمایشی ایجاد شد</h2>
    <p>نام و زیردامنه توسط سامانه ثبت شده‌اند؛ برای نخستین ورود باید OTP و سپس نام کاربری و رمز اختصاصی را تأیید کنید.</p>
    <div className="tto-checkout-review-row"><span>نشانی خودکار</span><b dir="ltr">{result.domain}</b></div>
    <div className="tto-checkout-review-row"><span>نام کاربری اولیه</span><b dir="ltr">{result.username??"در اولین ورود تعیین می‌شود"}</b></div>
    <div className="tto-checkout-review-row"><span>تاریخ انقضا</span><b>{new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeZone:"Asia/Tehran"}).format(new Date(result.expiresAt))}</b></div>
    <div className="tto-checkout-review-row"><span>پیامک لینک</span><b>{result.smsStatus==="ACCEPTED"?"پذیرفته‌شده توسط ارائه‌دهنده":result.smsStatus==="FAILED"?"ارسال ناموفق":"هنوز تحویل تأیید نشده؛ از لینک زیر استفاده کنید"}</b></div>
    <div className="tto-auth-inline-links">
     <a className="tto-auth-primary-link" href={"https://"+result.domain+"/login"}>ورود به فضای اختصاصی ←</a>
     <a href={"/c/"+encodeURIComponent(result.slug)}>آزمون ورود در نسخه Preview</a>
    </div>
   </section>:null}
   {notice?<p className="tto-checkout-notice" role="alert">{notice}</p>:null}
  </section>
 </AuthFrame>;
}
