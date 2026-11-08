"use client";
import {useEffect,useState,type FormEvent} from "react";
type Phase="checking"|"login"|"change"|"ready"|"unavailable";
const field={display:"block",padding:12,width:"100%",boxSizing:"border-box" as const,border:"1px solid #9bb6cb",borderRadius:8,fontSize:17};
const button={marginTop:16,padding:"12px 25px",background:"#075b88",border:0,borderRadius:9,color:"#fff",fontWeight:700,cursor:"pointer"};
export default function NationalRootLogin(){
 const [username,setUsername]=useState("");
 const [password,setPassword]=useState("");
 const [phase,setPhase]=useState<Phase>("checking");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [currentPassword,setCurrentPassword]=useState("");
 const [nextUsername,setNextUsername]=useState("");
 const [nextPassword,setNextPassword]=useState("");
 const [confirmPassword,setConfirmPassword]=useState("");
 async function verifySession(redirectOnSuccess=false){
  try{
   const response=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
   if(!response.ok)throw Error("UNAVAILABLE");
   const x=await response.json() as {authenticated?:unknown;nationalRoot?:unknown;mustChangeCredentials?:unknown};
   if(x.authenticated===true&&x.nationalRoot===true){
    if(x.mustChangeCredentials===true)setPhase("change");
    else if(x.mustChangeCredentials===false){
     if(redirectOnSuccess)window.location.replace("/");
     else setPhase("ready");
    }
    else setPhase("unavailable");
   }else setPhase("login");
  }catch{setPhase("unavailable")}
 }
 useEffect(()=>{void verifySession()},[]);
 async function login(e:FormEvent){
  e.preventDefault();if(busy)return;
  setBusy(true);setNotice("");
  try{
   const response=await fetch("/api/national-login",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})
   });
   if(response.status===429){setNotice("تعداد تلاش‌ها بیش از حد مجاز است؛ بعداً دوباره تلاش کنید.");return;}
   if(response.status===401){setNotice("نام کاربری یا رمز عبور معتبر نیست.");return;}
   if(response.status!==200){setNotice("سرویس ورود مدیر ملی در دسترس نیست.");return;}
   setPassword("");
   await verifySession(true);
  }catch{setNotice("ارتباط با سرویس ورود برقرار نشد.");}
  finally{setBusy(false);}
 }
 async function changeCredentials(e:FormEvent){
  e.preventDefault();if(busy||phase!=="change")return;
  if(!/^[A-Za-z0-9._-]{5,64}$/.test(nextUsername)){
   setNotice("نام کاربری جدید باید ۵ تا ۶۴ نویسه انگلیسی، عدد یا نقطه و خط تیره داشته باشد.");return;
  }
  if(nextPassword.length<14||nextPassword.length>128||/^\d+$/.test(nextPassword)){
   setNotice("رمز جدید باید حداقل ۱۴ کاراکتر باشد و صرفاً عددی نباشد.");return;
  }
  if(nextPassword!==confirmPassword){setNotice("تکرار رمز عبور جدید مطابقت ندارد.");return;}
  if(username&&username===nextUsername){setNotice("نام کاربری جدید باید متفاوت باشد.");return;}
  setBusy(true);setNotice("");
  try{
   const response=await fetch("/api/national-change-credentials",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({currentPassword,newUsername:nextUsername,newPassword:nextPassword})
   });
   if(response.status===401){setNotice("رمز فعلی معتبر نیست.");return;}
   if(response.status===400){setNotice("نام کاربری و رمز جدید باید متفاوت و مطابق قواعد امنیتی باشند.");return;}
   if(response.status!==200){setNotice("تغییر اطلاعات در پایگاه داده تأیید نشد؛ دسترسی مدیریتی همچنان قفل است.");return;}
   const payload=await response.json() as {changed?:unknown;loginRequired?:unknown};
   if(payload.changed!==true||payload.loginRequired!==true){setNotice("پاسخ تأیید تغییرات معتبر نیست.");return;}
   setUsername(nextUsername);setPassword("");
   setCurrentPassword("");setNextUsername("");setNextPassword("");setConfirmPassword("");
   setPhase("login");
   setNotice("نام کاربری و رمز عبور تغییر کرد. تمام نشست‌های قبلی باطل شدند؛ اکنون با مشخصات جدید وارد شوید.");
  }catch{setNotice("تغییر اطلاعات ثبت نشد؛ مجوز مدیریتی هنوز قفل است.");}
  finally{setBusy(false);}
 }
 async function logout(){
  setBusy(true);
  try{
   const r=await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin",cache:"no-store"});
   if(r.status!==204)throw Error("LOGOUT_UNAVAILABLE");
   setPhase("login");setUsername("");setPassword("");setNotice("از حساب مدیر ملی خارج شدید.");
  }catch{setNotice("خروج از حساب در سرور تأیید نشد.");}
  finally{setBusy(false);}
 }
 return <section dir="rtl" lang="fa" aria-label="ورود مدیر اصلی پلتفرم ملی"
  style={{background:"#fff",borderRadius:14,border:"1px solid #c8d7e5",padding:24,maxWidth:570,margin:"22px auto",fontFamily:"Tahoma,Arial,sans-serif"}}>
  <h2>ورود مدیر ملی</h2>
  <p style={{lineHeight:2}}>ورود مدیر اصلی با نام کاربری و رمز عبور اختصاصی است؛ ورود مدیران تعاونی و سهامداران با پیامک انجام می‌شود.</p>
  {phase==="checking"?<p role="status">در حال بررسی اعتبار نشست...</p>:
   phase==="unavailable"?<div><p role="alert">بررسی نشست ممکن نیست؛ هیچ عملیات مدیریتی فعال نیست.</p><button type="button" onClick={()=>void verifySession()}>تلاش مجدد</button></div>:
   phase==="ready"?<div><p role="status">ورود مدیر ملی تأیید شده است. برای مشاهده ماژول‌ها وارد صفحه اصلی پلتفرم شوید.</p>
    <a style={{display:"inline-block",padding:"12px 18px",color:"#fff",background:"#075b88",borderRadius:8,textDecoration:"none"}} href="/">ورود به صفحه اصلی پلتفرم</a>
    <button type="button" onClick={()=>void logout()} disabled={busy} style={{margin:12,padding:10}}>خروج امن</button>
   </div>:
   phase==="change"?<div>
    <h3>تغییر اجباری اطلاعات ورود</h3>
    <p role="alert" style={{lineHeight:2,background:"#fff5dd",padding:12,borderRadius:9}}>این اولین ورود شماست. تا زمان تغییر هم‌زمان نام کاربری و رمز عبور، بخش‌های مدیریتی قفل هستند.</p>
    <form onSubmit={changeCredentials}>
     <label htmlFor="national-current-password" style={{display:"block",margin:"14px 0 6px"}}>رمز عبور فعلی</label>
     <input id="national-current-password" type="password" autoComplete="current-password" value={currentPassword}
      onChange={e=>setCurrentPassword(e.target.value)} maxLength={128} required disabled={busy} style={field}/>
     <label htmlFor="national-next-username" style={{display:"block",margin:"14px 0 6px"}}>نام کاربری جدید</label>
     <input id="national-next-username" dir="ltr" autoComplete="username" value={nextUsername}
      onChange={e=>setNextUsername(e.target.value)} minLength={5} maxLength={64} required disabled={busy} style={field}/>
     <label htmlFor="national-next-password" style={{display:"block",margin:"14px 0 6px"}}>رمز عبور جدید (حداقل ۱۴ کاراکتر)</label>
     <input id="national-next-password" type="password" autoComplete="new-password" value={nextPassword}
      onChange={e=>setNextPassword(e.target.value)} minLength={14} maxLength={128} required disabled={busy} style={field}/>
     <label htmlFor="national-confirm-password" style={{display:"block",margin:"14px 0 6px"}}>تکرار رمز عبور جدید</label>
     <input id="national-confirm-password" type="password" autoComplete="new-password" value={confirmPassword}
      onChange={e=>setConfirmPassword(e.target.value)} minLength={14} maxLength={128} required disabled={busy} style={field}/>
     <button type="submit" disabled={busy} style={button}>{busy?"در حال ثبت امن…":"ثبت نام کاربری و رمز جدید"}</button>
    </form>
   </div>:
   <form onSubmit={login}>
    <label htmlFor="national-username" style={{display:"block",margin:"14px 0 6px"}}>نام کاربری مدیر اصلی</label>
    <input id="national-username" dir="ltr" autoComplete="username" type="text" value={username}
     onChange={e=>setUsername(e.target.value)} minLength={2} maxLength={64} required disabled={busy} style={field}/>
    <label htmlFor="national-password" style={{display:"block",margin:"16px 0 6px"}}>رمز عبور</label>
    <input id="national-password" dir="ltr" type="password" autoComplete="current-password" value={password}
     onChange={e=>setPassword(e.target.value)} minLength={1} maxLength={128} required disabled={busy} style={field}/>
    <button type="submit" disabled={busy} style={button}>{busy?"در حال بررسی…":"ورود به پنل ملی"}</button>
   </form>}
  {notice?<p role="status" style={{lineHeight:2,color:"#7d341a"}}>{notice}</p>:null}
 </section>;
}
