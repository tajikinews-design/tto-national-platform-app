"use client";
import {useEffect,useState,type FormEvent} from "react";
type Phase="checking"|"login"|"ready"|"unavailable"|"pending-credential-recovery";
export default function NationalRootLogin(){
 const [mobile,setMobile]=useState("");
 const [otp,setOtp]=useState("");
 const [challengeId,setChallengeId]=useState("");
 const [deadline,setDeadline]=useState(0);
 const [now,setNow]=useState(0);
 const [phase,setPhase]=useState<Phase>("checking");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const remaining=Math.max(0,Math.ceil((deadline-now)/1000));
 useEffect(()=>{
  let active=true;
  async function restore(){
   try{
    const r=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
    if(!r.ok)throw Error("UNAVAILABLE");
    const x=await r.json() as {authenticated?:unknown;nationalRoot?:unknown;mustChangeCredentials?:unknown};
    if(!active)return;
    if(x.authenticated===true&&x.nationalRoot===true)
     setPhase(x.mustChangeCredentials===false?"ready":"pending-credential-recovery");
    else setPhase("login");
   }catch{if(active)setPhase("unavailable")}
  }
  void restore();return()=>{active=false};
 },[]);
 useEffect(()=>{
  if(!deadline)return;
  const tick=()=>setNow(Date.now());
  tick();const id=window.setInterval(tick,250);
  return()=>window.clearInterval(id);
 },[deadline]);
 async function requestCode(e:FormEvent){
  e.preventDefault();if(busy||remaining>0)return;
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/auth/otp/request",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({mobile}),cache:"no-store"});
   if(r.status===429){setNotice("برای درخواست کد جدید بعداً تلاش کنید.");return}
   if(!r.ok)throw Error("REQUEST_FAILED");
   const x=await r.json() as {requestId?:unknown;expiresInSeconds?:unknown};
   if(typeof x.requestId!=="string")throw Error("INVALID_RESPONSE");
   setChallengeId(x.requestId);setOtp("");
   const ttl=typeof x.expiresInSeconds==="number"?Math.max(0,Math.min(60,x.expiresInSeconds)):60;
   setDeadline(Date.now()+ttl*1000);setNow(Date.now());
   setNotice("در صورت تعلق شماره به حساب مجاز، کد پیامکی ارسال می‌شود.");
  }catch{setNotice("ارسال کد تأیید در حال حاضر امکان‌پذیر نیست.")}
  finally{setBusy(false)}
 }
 async function verifyCode(e:FormEvent){
  e.preventDefault();if(busy||remaining<=0||!challengeId)return;
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/auth/otp/verify",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({challengeId,otp}),cache:"no-store"});
   if(!r.ok){setNotice(r.status===503?"سرویس احراز هویت در دسترس نیست.":"کد یا اختیار ورود مدیر ملی تأیید نشد.");return;}
   const s=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
   if(!s.ok)throw Error("SESSION_UNAVAILABLE");
   const data=await s.json() as {authenticated?:unknown;nationalRoot?:unknown;mustChangeCredentials?:unknown};
   if(data.authenticated!==true||data.nationalRoot!==true||data.mustChangeCredentials!==false)
    throw Error("NOT_NATIONAL_ROOT");
   setOtp("");setChallengeId("");setDeadline(0);window.location.replace("/");
  }catch{setNotice("تأیید نشست مدیر ملی کامل نشد.")}
  finally{setBusy(false)}
 }
 async function logout(){
  setBusy(true);
  try{
   const r=await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin",cache:"no-store"});
   if(r.status!==204)throw Error("FAILED");
   setPhase("login");setMobile("");setOtp("");setChallengeId("");setDeadline(0);
  }catch{setNotice("خروج از حساب تأیید نشد.")}
  finally{setBusy(false)}
 }
 return <section className="tto-auth-controls" dir="rtl" lang="fa" aria-label="ورود مدیر ملی با رمز یک‌بارمصرف">
  <h2>ورود مدیر ملی با کد پیامکی</h2>
  {phase==="checking"?<p role="status">در حال بررسی نشست...</p>:
   phase==="unavailable"?<div><p role="alert">سرویس بررسی نشست در دسترس نیست.</p>
    <button type="button" onClick={()=>window.location.reload()}>تلاش مجدد</button></div>:
   phase==="pending-credential-recovery"?<p role="alert">حساب مدیر ملی به تکمیل تأیید هویت و بازیابی خصوصی نیاز دارد؛ ورود جدید فعال نیست.</p>:
   phase==="ready"?<div><p role="status">نشست مدیر ملی تأیید شده است.</p>
    <a href="/" className="tto-auth-primary-link">ورود به پنل ملی</a>
    <button type="button" onClick={()=>void logout()} disabled={busy}>خروج امن</button></div>:
   <div className="otp-forms">
    <form onSubmit={requestCode}>
     <label htmlFor="national-mobile">شماره همراه تأییدشده مدیر ملی</label>
     <input id="national-mobile" type="tel" dir="ltr" inputMode="numeric" autoComplete="tel"
      pattern="09[0-9]{9}" maxLength={11} required disabled={busy} placeholder="09xxxxxxxxx"
      value={mobile} onChange={e=>{setMobile(e.target.value);setChallengeId("");setOtp("");setDeadline(0)}}/>
     <button type="submit" disabled={busy||remaining>0}>{busy?"در حال بررسی…":remaining>0?"در انتظار پایان اعتبار کد":"دریافت کد پیامکی"}</button>
    </form>
    {challengeId?<form onSubmit={verifyCode}>
     <label htmlFor="national-otp">کد پیامکی شش‌رقمی</label>
     <input id="national-otp" dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
      minLength={6} maxLength={6} required disabled={busy||remaining<=0}
      value={otp} onChange={e=>setOtp(e.target.value)}/>
     <p role="timer">زمان باقی‌مانده: {remaining.toLocaleString("fa-IR")} ثانیه</p>
     <button type="submit" disabled={busy||remaining<=0}>تأیید و ورود به پنل ملی</button>
    </form>:null}
   </div>}
  {notice?<p role="status" className="tto-login-error">{notice}</p>:null}
 </section>;
}
