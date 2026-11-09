"use client";
import {useEffect,useState,type FormEvent} from "react";
import {AuthFrame} from "@tto/ui";

type Plan={code:string;title:string;durationDays:number;features:string[]};
type OrderResult={domain:string;expiresAt:string;status:string;smsStatus?:string;username?:string;dnsReady?:boolean};
type Step="details"|"confirm"|"done";
const asFa=(n:number)=>n.toLocaleString("fa-IR");

export default function CommercialCheckout(){
 const [plans,setPlans]=useState<Plan[]>([]);
 const [catalogReady,setCatalogReady]=useState(false);
 const [form,setForm]=useState({name:"",slug:"",mobile:"",planCode:"",amountIrr:""});
 const [step,setStep]=useState<Step>("details");
 const [notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[result,setResult]=useState<OrderResult|null>(null);
 const selected=plans.find(p=>p.code===form.planCode);
 useEffect(()=>{
  let alive=true;
  fetch("/api/commerce",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject())
  .then((v:{plans?:Plan[]})=>{
   if(!alive)return;
   if(!Array.isArray(v.plans)||v.plans.length===0)throw Error("CATALOG_EMPTY");
   setPlans(v.plans);
   setForm(p=>({...p,planCode:p.planCode||v.plans?.[0]?.code||""}));
   setCatalogReady(true);
  }).catch(()=>{if(alive){setCatalogReady(false);setNotice("فهرست پلن‌ها در دسترس نیست. لطفاً صفحه را دوباره بارگذاری کنید.")}});
  return()=>{alive=false};
 },[]);

 function next(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setNotice("");
  if(!selected){setNotice("لطفاً ابتدا پلن معتبر را انتخاب کنید.");return}
  setStep("confirm");
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!selected)return;
  setBusy(true);setNotice("");setResult(null);
  try{
   const amount=Number(form.amountIrr);
   if(!Number.isSafeInteger(amount)||amount<1)throw Error("مبلغ واردشده معتبر نیست.");
   const response=await fetch("/api/commerce",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...form,amountIrr:amount})
   });
   const data=await response.json() as {
    code?:string;domain?:string;status?:string;expiresAt?:string;
    smsStatus?:string;username?:string;dnsReady?:boolean;tenantActivated?:boolean
   };
   if(response.status===409)throw Error("این شناسه قبلاً ثبت شده است. به مرحله قبل برگردید و شناسه دیگری انتخاب کنید.");
   if(response.status===401||response.status===403)throw Error("ابتدا با شماره همراه تأییدشده وارد شوید.");
   if(!response.ok||data.status!=="DEMO_AMOUNT_ATTESTED"||!data.domain||
      !data.expiresAt||data.tenantActivated!==true)
    throw Error("تأیید مبلغ آزمایشی انجام نشد. سفارش را ثبت‌شده در نظر نگیرید.");
   setResult({domain:data.domain,status:data.status,expiresAt:data.expiresAt,
    smsStatus:data.smsStatus,username:data.username,dnsReady:data.dnsReady});
   setStep("done");setNotice("");
  }catch(e){setNotice(e instanceof Error?e.message:"ثبت سفارش انجام نشد.")}
  finally{setBusy(false)}
 }

 return <AuthFrame surface="cooperative" mode="order"
  title="ثبت سفارش پلتفرم تعاونی"
  description="مشخصات تعاونی را ثبت و پلن موردنظر را انتخاب کنید. پرداخت در این مرحله صرفاً آزمایشی است.">
  <section className="tto-auth-controls tto-checkout" aria-label="سفارش اشتراک تعاونی">
   <div className="tto-checkout-progress" aria-label="مراحل ثبت سفارش">
    <span className={step==="details"?"active":"complete"}><b>۱</b> مشخصات و پلن</span>
    <span className={step==="confirm"?"active":step==="done"?"complete":""}><b>۲</b> تأیید مبلغ</span>
    <span className={step==="done"?"active":""}><b>۳</b> نتیجه سفارش</span>
   </div>

   {step==="details"?<>
    <p className="tto-checkout-helper">ابتدا <a href="/customer-register">شماره همراه خود را ثبت و تأیید کنید</a>. اگر حساب دارید، <a href="/login">با OTP وارد شوید</a>.</p>
    <form onSubmit={next} className="tto-checkout-form">
     <label htmlFor="order-name">نام پیشنهادی تعاونی</label>
     <input id="order-name" autoComplete="organization" required minLength={5} maxLength={180}
      placeholder="مثلاً تعاونی توسعه و عمران شهرستان..." value={form.name}
      onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
     <label htmlFor="order-slug">شناسه اختصاصی زیردامنه</label>
     <div className="tto-checkout-domain" dir="ltr"><input id="order-slug" dir="ltr" required
      pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" autoCapitalize="none"
      spellCheck={false} placeholder="example-city" value={form.slug}
      onChange={e=>setForm(p=>({...p,slug:e.target.value.toLowerCase().trim()}))}/>
      <span>.ttoir.ir</span></div>
     <label htmlFor="order-mobile">شماره همراه خریدار (تأییدشده با OTP)</label>
     <input id="order-mobile" type="tel" autoComplete="tel" inputMode="numeric" dir="ltr"
      pattern="09[0-9]{9}" maxLength={11} placeholder="09xxxxxxxxx" required
      value={form.mobile} onChange={e=>setForm(p=>({...p,mobile:e.target.value}))}/>
     <label htmlFor="order-plan">پلن اشتراک</label>
     <select id="order-plan" required disabled={!catalogReady} value={form.planCode}
      onChange={e=>setForm(p=>({...p,planCode:e.target.value}))}>
      <option value="">انتخاب پلن</option>
      {plans.map(p=><option key={p.code} value={p.code}>{p.title} — {asFa(p.durationDays)} روز</option>)}
     </select>
     {selected?<div className="tto-checkout-plan" aria-live="polite">
       <div className="tto-checkout-plan-title"><strong>{selected.title}</strong><span>{asFa(selected.durationDays)} روز اعتبار</span></div>
       <p>امکانات پلن: {selected.features.length?selected.features.join(" · "):"مشخصات پلن طبق قرارداد اشتراک"}</p>
      </div>:null}
     <button type="submit" disabled={!selected||busy}>ادامه و بررسی سفارش <span aria-hidden="true">←</span></button>
    </form>
   </>:null}

   {step==="confirm"?<>
    <div className="tto-checkout-review">
     <span className="tto-checkout-review-heading">خلاصه سفارش شما</span>
     <strong>{form.name}</strong>
     <div className="tto-checkout-review-row"><span>زیردامنه پیشنهادی</span><b dir="ltr">{form.slug}.ttoir.ir</b></div>
     <div className="tto-checkout-review-row"><span>پلن انتخابی</span><b>{selected?.title} · {selected?asFa(selected.durationDays):"—"} روز</b></div>
     <div className="tto-checkout-review-row"><span>موبایل خریدار</span><b dir="ltr">{form.mobile}</b></div>
    </div>
    <p className="tto-checkout-warning"><strong>بدون پرداخت بانکی:</strong> مبلغ این فرم فقط برای تأیید آزمایشی است؛ هیچ وجهی دریافت نمی‌شود و مجوز عملیات سهام صادر نخواهد شد.</p>
    <form onSubmit={submit} className="tto-checkout-form">
     <label htmlFor="order-amount">مبلغ اعلامی آزمایشی (ریال)</label>
     <input id="order-amount" type="number" min={1} step={1} required
      placeholder="مبلغ را به ریال وارد کنید" dir="ltr" inputMode="numeric"
      value={form.amountIrr} onChange={e=>setForm(p=>({...p,amountIrr:e.target.value}))}/>
     <div className="tto-checkout-actions">
      <button type="button" className="tto-checkout-secondary" disabled={busy}
       onClick={()=>{setStep("details");setNotice("")}}>ویرایش اطلاعات</button>
      <button type="submit" disabled={busy||!form.amountIrr}>{busy?"در حال ثبت امن…":"ثبت و تأیید مبلغ آزمایشی"}</button>
     </div>
    </form>
   </>:null}

   {step==="done"&&result?<section className="tto-checkout-success" role="status" aria-label="نتیجه ثبت سفارش">
    <div className="tto-checkout-success-icon" aria-hidden="true">✓</div>
    <h2>سفارش آزمایشی ثبت شد</h2>
    <p>فضای تجاری اشتراک ایجاد شده است. فعال‌شدن DNS و اختیارات مدیریتی رسمی جداگانه بررسی می‌شوند.</p>
    <div className="tto-checkout-review-row"><span>نشانی اختصاصی</span><b dir="ltr">{result.domain}</b></div>
    <div className="tto-checkout-review-row"><span>نام کاربری اولیه</span><b dir="ltr">{result.username??"در دسترس نیست"}</b></div>
    <div className="tto-checkout-review-row"><span>تاریخ انقضا</span><b>{new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeZone:"Asia/Tehran"}).format(new Date(result.expiresAt))}</b></div>
    <div className="tto-checkout-review-row"><span>پیامک</span><b>{result.smsStatus==="ACCEPTED"?"پذیرفته‌شده توسط ارائه‌دهنده":result.smsStatus==="FAILED"?"ارسال ناموفق":"در صف ارسال"}</b></div>
    <div className="tto-checkout-review-row"><span>DNS زیردامنه</span><b>{result.dnsReady?"آماده":"هنوز تأیید نشده"}</b></div>
    <div className="tto-auth-inline-links"><a href="/login">ورود با OTP</a><a href="/first-login">تعیین رمز دلخواه</a></div>
   </section>:null}
   {notice?<p className="tto-checkout-notice" role="alert">{notice}</p>:null}
  </section>
 </AuthFrame>;
}
