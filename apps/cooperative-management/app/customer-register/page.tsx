"use client";
import {useState,type FormEvent} from "react";
export default function CommercialRegister(){
 const [mobile,setMobile]=useState(""),[code,setCode]=useState(""),[challenge,setChallenge]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function request(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setNotice("");
  try{const r=await fetch("/api/commerce/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mobile})});
   if(!r.ok)throw Error("ارسال کد فعلاً در دسترس نیست؛ تنظیمات پیامک و ثبت‌نام باید فعال شوند.");
   const d=await r.json() as {requestId?:string};
   if(!d.requestId)throw Error("پاسخ ثبت‌نام معتبر نیست.");
   setChallenge(d.requestId);setNotice("اگر شماره شما واجد شرایط ثبت‌نام باشد، کد ارسال می‌شود.");
  }catch(e){setNotice(e instanceof Error?e.message:"ثبت‌نام در دسترس نیست.")}finally{setBusy(false)}
 }
 async function verify(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setNotice("");
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
  <form onSubmit={request}><label>شماره موبایل <input dir="ltr" inputMode="numeric" pattern="09[0-9]{9}" maxLength={11} required value={mobile} onChange={e=>setMobile(e.target.value)} /></label><button disabled={busy} type="submit">دریافت کد ثبت‌نام</button></form>
  {challenge?<form onSubmit={verify}><label>کد پیامکی <input dir="ltr" inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={e=>setCode(e.target.value)} /></label><button disabled={busy} type="submit">تأیید و ادامه خرید</button></form>:null}
  {notice?<p role="status">{notice}</p>:null}
 </main>;
}
