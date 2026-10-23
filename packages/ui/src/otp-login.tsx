"use client";
import { useEffect, useState, type FormEvent } from "react";
import {TenantScopePicker} from "./tenant-scope-picker";
import {ShareholderWorkspace,type ShareholderView} from "./shareholder-workspace";
/** OTP UI never holds API.ir credentials; form is unavailable until a protected backend is configured. */
export function OtpLogin({enabled,surface,initialShareholderView="overview"}:{enabled:boolean;surface:"shareholder"|"cooperative"|"national";initialShareholderView?:ShareholderView}){
 const [mobile,setMobile]=useState("");
 const [code,setCode]=useState("");
 const [requestId,setRequestId]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [verified,setVerified]=useState(false);
 const [checking,setChecking]=useState(enabled);
 const [checkFailed,setCheckFailed]=useState(false);
 const [checkAttempt,setCheckAttempt]=useState(0);
 useEffect(()=>{
  if(!enabled)return;
  let active=true;
  setChecking(true);setCheckFailed(false);
  async function restore(){
   try{
    const response=await fetch("/api/auth/session",{method:"GET",credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw Error("SESSION_STATUS_UNAVAILABLE");
    const data=await response.json() as {authenticated?:unknown};
    if(typeof data.authenticated!=="boolean")throw Error("BAD_SESSION_STATUS");
    if(active){
     setVerified(data.authenticated);
     setMessage(data.authenticated?"نشست ورود شما تأیید شد. دسترسی به خدمات تابع نقش و محدوده تعاونی است.":"");
    }
   }catch{
    if(active){setCheckFailed(true);setMessage("");}
   }finally{if(active)setChecking(false);}
  }
  void restore();
  return ()=>{active=false;};
 },[enabled,checkAttempt]);
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
 async function logout(){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/auth/logout",{method:"POST",cache:"no-store"});
   if(res.status!==204)throw Error("LOGOUT_NOT_CONFIRMED");
   setVerified(false);setRequestId("");setMobile("");setCode("");
   setMessage("خروج از حساب تأیید شد.");
  }catch{
   setMessage("لغو نشست در سرور تأیید نشد. لطفاً مجدداً برای خروج تلاش کنید.");
  }finally{setBusy(false);}
 }
 return <section className="otp-panel" aria-label="ورود با پیامک">
  <h2>ورود با رمز یک‌بارمصرف</h2>
  <p>ارسال و تأیید کد از مسیر امن سمت سرور انجام می‌شود.</p>
  {!enabled?<p className="otp-unavailable">در این نسخه پیش‌نمایش، پایگاه داده و سرویس ورود متصل نیست. ارسال پیامک واقعی غیرفعال است.</p>:
  checking?<p role="status">در حال بررسی نشست ورود...</p>:
  checkFailed?<div><p role="alert">بررسی نشست ممکن نیست. برای حفظ امنیت، ورود جدید تا ارتباط با سرور غیرفعال است.</p><button type="button" onClick={()=>setCheckAttempt(n=>n+1)}>تلاش مجدد</button></div>:
  verified?<div><p role="status">{message}</p>{surface==="shareholder"?<ShareholderWorkspace initialView={initialShareholderView}/>:<TenantScopePicker surface={surface}/>}<button type="button" disabled={busy} onClick={logout}>خروج از حساب</button></div>:
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
  {enabled&&!verified&&!checkFailed&&message?<p role="status" aria-live="polite">{message}</p>:null}
 </section>;
}
