"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {TenantScopePicker} from "./tenant-scope-picker";
import {ShareholderWorkspace,type ShareholderView} from "./shareholder-workspace";
import type {ShareholderSectionId} from "./shareholder-section-config";
/** OTP UI never holds API.ir credentials; form is unavailable until a protected backend is configured. */
export function OtpLogin({enabled,surface,initialShareholderView="overview",initialShareholderSectionId,initialManagementModuleId}:{enabled:boolean;surface:"shareholder"|"cooperative"|"national";initialShareholderView?:ShareholderView;initialShareholderSectionId?:ShareholderSectionId;initialManagementModuleId?:string}){
 const [mobile,setMobile]=useState("");
 const [code,setCode]=useState("");
 const [requestId,setRequestId]=useState("");
 const [otpDeadline,setOtpDeadline]=useState<number|null>(null);
 const [timerNow,setTimerNow]=useState(()=>Date.now());
 const remainingSeconds=otpDeadline===null?0:Math.max(0,Math.ceil((otpDeadline-timerNow)/1000));
 useEffect(()=>{
  if(otpDeadline===null)return;
  const tick=()=>setTimerNow(Date.now());
  tick();
  const interval=window.setInterval(tick,250);
  document.addEventListener("visibilitychange",tick);
  window.addEventListener("focus",tick);
  return()=>{window.clearInterval(interval);document.removeEventListener("visibilitychange",tick);window.removeEventListener("focus",tick)};
 },[otpDeadline]);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [verified,setVerified]=useState(false);
 const [checking,setChecking]=useState(enabled);
 const [checkFailed,setCheckFailed]=useState(false);
 const [checkAttempt,setCheckAttempt]=useState(0);
 // A 401 from a private BFF read invalidates the authenticated UI on every portal.
 // Unmounting the workspace discards scoped authorization/read-model state from React.
 const invalidateSession=useCallback(()=>{
  setVerified(false);setCheckFailed(false);setRequestId("");setCode("");
  setMessage("نشست شما معتبر نیست؛ برای مشاهده داده‌های شخصی دوباره وارد شوید.");
 },[]);
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
 // Verification at login time is not a permanent grant. Reconfirm a revocable
 // PG-backed session on resume and periodically while the private UI is visible.
 // Unavailable verification closes the UI; it must never be interpreted as a logout.
 useEffect(()=>{
  if(!enabled||!verified)return;
  let active=true;
  let inFlight=false;
  let controller:AbortController|null=null;
  async function revalidate(){
   if(!active||inFlight||document.visibilityState!=="visible")return;
   inFlight=true;
   const next=new AbortController();
   controller=next;
   try{
    const response=await fetch("/api/auth/session",{
     method:"GET",credentials:"same-origin",cache:"no-store",signal:next.signal
    });
    if(!response.ok)throw Error("SESSION_CHECK_UNAVAILABLE");
    const data:unknown=await response.json();
    if(!data||typeof data!=="object"||Array.isArray(data)||
       typeof (data as {authenticated?:unknown}).authenticated!=="boolean")
     throw Error("BAD_SESSION_STATUS");
    if(!active||next.signal.aborted)return;
    if((data as {authenticated:boolean}).authenticated!==true)invalidateSession();
   }catch{
    if(active&&!next.signal.aborted){
     setVerified(false);setCheckFailed(true);
     setMessage("اعتبار نشست قابل بررسی نیست؛ نمایش داده‌های شخصی متوقف شد.");
    }
   }finally{inFlight=false;if(controller===next)controller=null;}
  }
  const onVisible=()=>{if(document.visibilityState==="visible")void revalidate();};
  const onFocus=()=>{void revalidate();};
  const periodic=window.setInterval(()=>{void revalidate();},60000);
  window.addEventListener("focus",onFocus);
  document.addEventListener("visibilitychange",onVisible);
  void revalidate();
  return ()=>{
   active=false;controller?.abort();window.clearInterval(periodic);
   window.removeEventListener("focus",onFocus);
   document.removeEventListener("visibilitychange",onVisible);
  };
 },[enabled,verified,surface,invalidateSession]);
 async function issue(e:FormEvent){
  e.preventDefault();if(!enabled||busy||remainingSeconds>0)return;
  setBusy(true);setMessage("");
  try{
   const resp=await fetch("/api/auth/otp/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mobile}),cache:"no-store"});
   const data=await resp.json() as {requestId?:unknown;expiresInSeconds?:unknown};
   if(!resp.ok||typeof data.requestId!=="string")throw Error("درخواست پیامک انجام نشد.");
   const ttl=typeof data.expiresInSeconds==="number"&&Number.isInteger(data.expiresInSeconds)?
      Math.max(0,Math.min(60,data.expiresInSeconds)):60;
   setRequestId(data.requestId);setCode("");setTimerNow(Date.now());setOtpDeadline(Date.now()+ttl*1000);
   setMessage("درخواست کد تأیید ثبت شد. کد حداکثر ۶۰ ثانیه اعتبار دارد.");
  }catch{setMessage("امکان درخواست کد وجود ندارد؛ لطفاً بعداً تلاش کنید.");}
  finally{setBusy(false);}
 }
 async function verify(e:FormEvent){
  e.preventDefault();if(!enabled||busy||!requestId||remainingSeconds<=0)return;
  setBusy(true);setMessage("");
  try{
   const resp=await fetch("/api/auth/otp/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:requestId,otp:code}),cache:"no-store"});
   if(!resp.ok)throw Error("INVALID");
   setVerified(true);setOtpDeadline(null);setRequestId("");setCode("");setMessage("کد تأیید شد. دسترسی به خدمات تابع نقش و محدوده تعاونی شماست.");
  }catch{setMessage("کد معتبر نیست یا مهلت آن پایان یافته است.");}
  finally{setBusy(false);}
 }
 async function logout(){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/auth/logout",{method:"POST",cache:"no-store"});
   if(res.status!==204)throw Error("LOGOUT_NOT_CONFIRMED");
   setVerified(false);setRequestId("");setOtpDeadline(null);setMobile("");setCode("");
   setMessage("خروج از حساب تأیید شد.");
  }catch{
   setMessage("لغو نشست در سرور تأیید نشد. لطفاً مجدداً برای خروج تلاش کنید.");
  }finally{setBusy(false);}
 }
 return <section className="otp-panel" aria-label="ورود با پیامک">
  <h2>تأیید شماره همراه</h2>
  <p>شماره موبایل ثبت‌شده را وارد کنید؛ کد تأیید از مسیر امن سرور ارسال می‌شود.</p>
  {!enabled?<p className="otp-unavailable">در این نسخه پیش‌نمایش، پایگاه داده و سرویس ورود متصل نیست. ارسال پیامک واقعی غیرفعال است.</p>:
  checking?<p role="status">در حال بررسی نشست ورود...</p>:
  checkFailed?<div><p role="alert">بررسی نشست ممکن نیست. برای حفظ امنیت، ورود جدید تا ارتباط با سرور غیرفعال است.</p><button type="button" onClick={()=>setCheckAttempt(n=>n+1)}>تلاش مجدد</button></div>:
  verified?<div><p role="status">{message}</p>{surface==="shareholder"?<ShareholderWorkspace initialView={initialShareholderView} initialSectionId={initialShareholderSectionId} onSessionInvalidated={invalidateSession}/>:<TenantScopePicker surface={surface} moduleId={initialManagementModuleId}/>}<button type="button" disabled={busy} onClick={logout}>خروج از حساب</button></div>:
   <div className="otp-forms">
    <form onSubmit={issue}>
     <label htmlFor="tto-mobile">شماره موبایل ثبت‌شده</label>
     <input id="tto-mobile" type="tel" dir="ltr" autoComplete="tel" inputMode="numeric" maxLength={11}
      placeholder="09xxxxxxxxx" value={mobile} onChange={e=>{setMobile(e.target.value);if(requestId){setRequestId("");setOtpDeadline(null);setCode("");}}}
      pattern="09[0-9]{9}" required disabled={busy}/>
     <button type="submit" disabled={busy||remainingSeconds>0}>{remainingSeconds>0?"در انتظار پایان اعتبار کد":requestId?"دریافت مجدد کد":"دریافت کد"}</button>
    </form>
    {requestId?<form onSubmit={verify} className="tto-auth-code-form">
     {remainingSeconds>0?<p role="timer" aria-live="off">زمان باقی‌مانده: <strong style={{fontVariantNumeric:"tabular-nums"}}>{remainingSeconds.toLocaleString("fa-IR")} ثانیه</strong></p>:
      <p role="status">اعتبار کد پایان یافته است. برای دریافت کد جدید، «دریافت مجدد کد» را انتخاب کنید.</p>}
     <label htmlFor="tto-code">کد یک‌بارمصرف</label>
     <input id="tto-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code"
       minLength={6} maxLength={6} pattern="[0-9]{6}" value={code}
       onChange={e=>setCode(e.target.value)} required disabled={busy||remainingSeconds<=0}/>
     <button type="submit" disabled={busy||remainingSeconds<=0}>تأیید کد</button>
    </form>:null}
   </div>}
  {enabled&&!verified&&!checkFailed&&message?<p role="status" aria-live="polite">{message}</p>:null}
 </section>;
}
