"use client";
import {useState,type FormEvent} from "react";
export default function NationalRegistration(){
 const [mobile,setMobile]=useState("");
 const [challenge,setChallenge]=useState("");
 const [otp,setOtp]=useState("");
 const [busy,setBusy]=useState(false);
 const [registered,setRegistered]=useState(false);
 const [notice,setNotice]=useState("");
 async function requestCode(e:FormEvent){
  e.preventDefault();if(busy)return;
  setBusy(true);setNotice("");
  try{
   const res=await fetch("/api/auth/register/request",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({mobile}),cache:"no-store"});
   if(res.status!==202)throw Error("REQUEST_UNAVAILABLE");
   const out=await res.json() as {requestId?:unknown};
   if(typeof out.requestId!=="string")throw Error("INVALID_RESPONSE");
   setChallenge(out.requestId);
   setNotice("در صورت امکان ثبت‌نام، کد تأیید برای شماره واردشده ارسال شده است. اعتبار کد ۴ دقیقه است.");
  }catch{setNotice("درخواست کد انجام نشد. اتصال و تنظیمات پیامک را بررسی کنید.");}
  finally{setBusy(false);}
 }
 async function verifyCode(e:FormEvent){
  e.preventDefault();if(busy||!challenge)return;
  setBusy(true);setNotice("");
  try{
   const res=await fetch("/api/auth/register/verify",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:challenge,otp}),cache:"no-store"});
   if(!res.ok)throw Error("INVALID_OR_EXPIRED_CODE");
   const out=await res.json() as {registered?:unknown;nationalOperator?:unknown};
   if(out.registered!==true||out.nationalOperator!==false)throw Error("INVALID_RESPONSE");
   setRegistered(true);
   setOtp("");
   setNotice("شماره موبایل تأیید شد و حساب عادی شما ایجاد شد. دسترسی مدیر ملی هنوز نیازمند تأیید و صدور مجوز مستقل است.");
  }catch{setNotice("کد تأیید پذیرفته نشد؛ احتمالاً اشتباه است یا منقضی شده است.");}
  finally{setBusy(false);}
 }
 const input={font:"inherit",fontSize:17,padding:12,border:"1px solid #a4b5c6",borderRadius:10,width:"100%",boxSizing:"border-box" as const};
 const button={font:"inherit",fontWeight:700,padding:"12px 22px",borderRadius:9,background:"#075b88",color:"white",border:0,cursor:"pointer"};
 return <main lang="fa" dir="rtl" style={{minHeight:"100vh",background:"#f4f7fb",padding:"32px 18px",color:"#173954",fontFamily:"Tahoma,Arial,sans-serif"}}>
 <article style={{maxWidth:630,margin:"auto",background:"#fff",borderRadius:18,padding:26,boxShadow:"0 5px 20px #1234"}}>
 <a href="/" style={{color:"#00649a"}}>← بازگشت به پنل ملی</a>
 <h1>ثبت‌نام با شماره موبایل</h1>
 <p style={{lineHeight:2}}>این فرم برای ایجاد حساب کاربری جدید است. شماره موبایل خود را وارد کنید و کد پیامکی را در همین صفحه تأیید کنید. برای حساب‌های قبلاً ثبت‌شده، از بخش «ورود» استفاده کنید.</p>
 {registered?<div role="status"><h2>ثبت‌نام تأیید شد</h2><p style={{lineHeight:2}}>حساب شما ایجاد شده است، اما هیچ نقش مدیر ملی یا مدیر تعاونی به آن داده نشده است. صدور مجوز مدیر ملی مرحله‌ای جداگانه دارد.</p><a href="/" style={{color:"#00649a"}}>بازگشت به پنل ملی</a></div>:
 <>
 <form onSubmit={requestCode}>
  <label htmlFor="registration-mobile" style={{display:"block",margin:"12px 0"}}>شماره موبایل</label>
  <input id="registration-mobile" type="tel" dir="ltr" autoComplete="tel" inputMode="tel"
   maxLength={11} pattern="09[0-9]{9}" value={mobile} onChange={e=>{setMobile(e.target.value);setChallenge("");setOtp("");}}
   placeholder="09xxxxxxxxx" required disabled={busy||Boolean(challenge)} style={input}/>
  <div style={{marginTop:15}}><button type="submit" style={button} disabled={busy||Boolean(challenge)}>{busy?"در حال ارسال…":"دریافت کد تأیید"}</button></div>
 </form>
 {challenge?<form onSubmit={verifyCode}>
  <label htmlFor="registration-code" style={{display:"block",margin:"18px 0 10px"}}>کد یک‌بارمصرف پیامکی</label>
  <input id="registration-code" type="text" dir="ltr" autoComplete="one-time-code" inputMode="numeric"
   minLength={6} maxLength={6} pattern="[0-9]{6}" value={otp} onChange={e=>setOtp(e.target.value)}
   required disabled={busy} style={input}/>
  <div style={{marginTop:15,display:"flex",gap:12,flexWrap:"wrap"}}><button type="submit" style={button} disabled={busy}>تأیید کد و ایجاد حساب</button>
   <button type="button" disabled={busy} onClick={()=>{setChallenge("");setOtp("");setNotice("");}}
    style={{...button,background:"#e8eff6",color:"#123d60"}}>درخواست مجدد کد</button></div>
 </form>:null}
 </>}
 {notice?<p role="status" aria-live="polite" style={{background:"#eef6ff",padding:12,borderRadius:10,lineHeight:2}}>{notice}</p>:null}
 <p style={{lineHeight:2,color:"#5b7185",fontSize:13,marginTop:26}}>تأیید شماره موبایل فقط مالکیت شماره را اثبات می‌کند؛ به معنی احراز سمت قانونی یا اعطای دسترسی مدیریتی نیست.</p>
 </article></main>;
}
