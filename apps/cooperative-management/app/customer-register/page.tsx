"use client";
import {useEffect,useState,type FormEvent} from "react";
export default function CommercialRegister(){
 const [mobile,setMobile]=useState(""),[code,setCode]=useState(""),[challenge,setChallenge]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [deadline,setDeadline]=useState<number|null>(null),[now,setNow]=useState(()=>Date.now());
 const remaining=deadline===null?0:Math.max(0,Math.ceil((deadline-now)/1000));
 useEffect(()=>{
  if(deadline===null)return;
  const update=()=>setNow(Date.now());
  update();
  const interval=window.setInterval(update,250);
  window.addEventListener("focus",update);
  document.addEventListener("visibilitychange",update);
  return()=>{window.clearInterval(interval);window.removeEventListener("focus",update);document.removeEventListener("visibilitychange",update)};
 },[deadline]);

 async function request(e:FormEvent){e.preventDefault();if(busy||remaining>0)return;setBusy(true);setNotice("");
  try{const r=await fetch("/api/commerce/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mobile})});
   if(!r.ok)throw Error("ارسال کد فعلاً در دسترس نیست؛ تنظیمات پیامک و ثبت‌نام باید فعال شوند.");
   const d=await r.json() as {requestId?:string;expiresInSeconds?:number};
   if(!d.requestId)throw Error("پاسخ ثبت‌نام معتبر نیست.");
   const ttl=Number.isInteger(d.expiresInSeconds)&&d.expiresInSeconds!==undefined?
    Math.max(0,Math.min(60,d.expiresInSeconds)):60;
   setChallenge(d.requestId);setCode("");setNow(Date.now());setDeadline(Date.now()+ttl*1000);
   setNotice("درخواست ارسال کد تأیید ثبت شد. کد فقط ۶۰ ثانیه اعتبار دارد. لطفاً پیامک خود را بررسی کنید.");
  }catch(e){setNotice(e instanceof Error?e.message:"ثبت‌نام در دسترس نیست.")}finally{setBusy(false)}
 }
 async function verify(e:FormEvent){e.preventDefault();if(busy||remaining<=0)return;setBusy(true);setNotice("");
  try{const r=await fetch("/api/commerce/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:challenge,otp:code})});
   if(!r.ok)throw Error("کد منقضی شده یا معتبر نیست.");
   const d=await r.json() as {verified?:boolean};
   if(d.verified!==true)throw Error("تأیید شماره کامل نشد.");
   window.location.assign("/subscribe");
  }catch(e){setNotice(e instanceof Error?e.message:"تأیید انجام نشد.")}finally{setBusy(false)}
 }
 return <main lang="fa" dir="rtl" style={{padding:24,maxWidth:690,margin:"auto",fontFamily:"Tahoma,Arial"}}>
  <h1>ثبت‌نام مشتری TTO</h1>
  <p style={{lineHeight:2}}>برای خرید اشتراک آزمایشی ابتدا مالکیت شماره همراه را با رمز یک‌بارمصرف تأیید کنید. اگر قبلاً حساب دارید، از ورود با OTP استفاده کنید.</p>
  <p><a href="/login">ورود با OTP</a> · <a href="/subscribe">مشاهده پلن‌ها</a></p>
  <form onSubmit={request}><label>شماره موبایل <input dir="ltr" inputMode="numeric" pattern="09[0-9]{9}" maxLength={11} required value={mobile} onChange={e=>{setMobile(e.target.value);if(challenge){setChallenge("");setDeadline(null);setCode("");}}} /></label><button disabled={busy||remaining>0} type="submit">{remaining>0?"در انتظار پایان اعتبار کد":challenge?"دریافت مجدد کد":"دریافت کد ثبت‌نام"}</button></form>
  {challenge?<section aria-label="اعتبار کد پیامکی" style={{marginTop:14,padding:14,background:"#f2f6fc",borderRadius:9}}>
   {remaining>0?<p role="timer" aria-live="off">زمان باقی‌مانده: <strong dir="ltr" style={{fontVariantNumeric:"tabular-nums"}}>{remaining.toLocaleString("fa-IR")} ثانیه</strong></p>:
    <p role="status">مهلت ۶۰ ثانیه‌ای کد پایان یافت. برای دریافت کد جدید، دکمه «دریافت مجدد کد» را بزنید.</p>}
   <form onSubmit={verify}><label>کد پیامکی <input dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} disabled={busy||remaining<=0} /></label><button disabled={busy||remaining<=0} type="submit">تأیید و ادامه خرید</button></form>
  </section>:null}
  {notice?<p role="status">{notice}</p>:null}
 </main>;
}
