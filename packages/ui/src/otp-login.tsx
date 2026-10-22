"use client";
import { useState, type FormEvent } from "react";
/** OTP UI never holds API.ir credentials; form is unavailable until a protected backend is configured. */
export function OtpLogin({enabled}:{enabled:boolean}){
 const [mobile,setMobile]=useState("");
 const [code,setCode]=useState("");
 const [requestId,setRequestId]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [verified,setVerified]=useState(false);
 async function issue(e:FormEvent){
  e.preventDefault();if(!enabled||busy)return;
  setBusy(true);setMessage("");
  try{
   const resp=await fetch("/api/auth/otp/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mobile}),cache:"no-store"});
   const data=await resp.json();
   if(!resp.ok||typeof data.requestId!=="string")throw Error("درخواست پیامک انجام نشد.");
   setRequestId(data.requestId);setMessage("در صورت وجود حساب معتبر، کد برای شماره ثبت‌شده ارسال می‌شود.");
  }catch{setMessage("امکان درخواست کد وجود ندارد؛ لطفاً بعداً تلاش کنید.");}
  finally{setBusy(false);}
 }
 async function verify(e:FormEvent){
  e.preventDefault();if(!enabled||busy||!requestId)return;
  setBusy(true);setMessage("");
  try{
   const resp=await fetch("/api/auth/otp/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:requestId,otp:code}),cache:"no-store"});
   if(!resp.ok)throw Error("INVALID");
   setVerified(true);setMessage("کد تأیید شد. دسترسی به خدمات تابع نقش و محدوده تعاونی شماست.");
  }catch{setMessage("کد معتبر نیست یا مهلت آن پایان یافته است.");}
  finally{setBusy(false);}
 }
 return <section className="otp-panel" aria-label="ورود با پیامک">
  <h2>ورود با رمز یک‌بارمصرف</h2>
  <p>ارسال و تأیید کد از مسیر امن سمت سرور انجام می‌شود.</p>
  {!enabled?<p className="otp-unavailable">در این نسخه پیش‌نمایش، پایگاه داده و سرویس ورود متصل نیست. ارسال پیامک واقعی غیرفعال است.</p>:verified?<p role="status">{message}</p>:
   <div className="otp-forms">
    <form onSubmit={issue}>
     <label htmlFor="tto-mobile">شماره موبایل ثبت‌شده</label>
     <input id="tto-mobile" dir="ltr" autoComplete="tel" inputMode="tel" maxLength={11}
      placeholder="09xxxxxxxxx" value={mobile} onChange={e=>setMobile(e.target.value)}
      pattern="09[0-9]{9}" required disabled={busy}/>
     <button type="submit" disabled={busy}>دریافت کد</button>
    </form>
    {requestId?<form onSubmit={verify}>
     <label htmlFor="tto-code">کد یک‌بارمصرف</label>
     <input id="tto-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code"
       minLength={6} maxLength={10} pattern="[0-9]{6,10}" value={code}
       onChange={e=>setCode(e.target.value)} required disabled={busy}/>
     <button type="submit" disabled={busy}>تأیید کد</button>
    </form>:null}
   </div>}
  {enabled&&message?<p role="status" aria-live="polite">{message}</p>:null}
 </section>;
}
