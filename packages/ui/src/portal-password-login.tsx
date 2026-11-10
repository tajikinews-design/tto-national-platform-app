"use client";
import {useEffect,useState,type FormEvent} from "react";
import {OtpLogin} from "./otp-login";
type Surface="cooperative"|"shareholder";
export function PortalPasswordLogin({surface,workspaceSlug}:{surface:Surface;workspaceSlug?:string}){
 const [username,setUsername]=useState(""),[password,setPassword]=useState("");
 const [phase,setPhase]=useState<"checking"|"login"|"ready"|"error">("checking");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [method,setMethod]=useState<"password"|"otp">("otp");
 const label=surface==="cooperative"?"مدیر تعاونی":"سهامدار";
 useEffect(()=>{
  let alive=true;
  fetch("/api/auth/password/session",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json()).then(d=>{
   if(alive)setPhase(d.authenticated===true?"ready":"login");
  }).catch(()=>{if(alive)setPhase("error")});
  return()=>{alive=false};
 },[surface]);
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;
  setBusy(true);setNotice("");
  try{
   const response=await fetch("/api/auth/password/login",{method:"POST",
     credentials:"same-origin",cache:"no-store",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({username,password,...(workspaceSlug?{workspaceSlug}:{})})
   });
   if(response.status===401){setNotice("نام کاربری یا رمز عبور معتبر نیست یا نیاز به فعال‌سازی مجدد دارد.");return}
   if(response.status===403){setNotice("اختیار دسترسی به این تعاونی تأیید نشد یا دفعات ورود بیش از حد است.");return}
   if(response.status!==200){
    const info=await response.json().catch(()=>null) as {code?:unknown}|null;
    const code=typeof info?.code==="string"?info.code:"";
    const message=code==="PORTAL_STAGING_NOT_ENABLED"?
      "ورود با رمز در محیط آزمایش هنوز توسط مسئول امنیت فعال نشده است. ابتدا API هم‌نسخه و مجوز انتشار احراز هویت باید آماده شوند.":
      code==="PORTAL_SECURITY_CONFIG_MISSING"?
      "پیکربندی امنیتی ورود در API آزمایشی ناقص است؛ کلید کنترل تلاش‌های ورود و مجوزهای هویتی باید در محیط امن تنظیم شوند.":
      code==="SECURE_API_UNAVAILABLE"||code==="PASSWORD_LOGIN_STAGING_NOT_READY"?
      "API تأیید هویت آزمایشی آماده یا هم‌نسخه نیست؛ وضعیت اتصال پنل به API بررسی شود.":
      "ورود امن برقرار نشد؛ وضعیت سرویس احراز هویت را بررسی کنید.";
    setNotice(message);return;
   }
   const d=await response.json() as {authenticated?:boolean;workspaceSlug?:string};
   if(d.authenticated!==true||(workspaceSlug&&d.workspaceSlug!==workspaceSlug)){setNotice("تعاونی انتخابی با مجوز کاربر مطابقت ندارد.");return}
   setPassword("");setPhase("ready");
   window.location.assign(workspaceSlug?"/c/"+encodeURIComponent(workspaceSlug):"/");
  }catch{setNotice("ارتباط با سرویس امن ورود برقرار نشد.")}
  finally{setBusy(false)}
 }
 return <section className="tto-auth-controls" data-tto-auth-surface={surface} aria-label={"ورود مستقل "+label} dir="rtl">
   <p className="tto-auth-muted-note">روش ورود دلخواه را انتخاب کنید. دسترسی پس از ورود تابع مجوزهای همان حساب است.</p>
   {workspaceSlug?<div className="tto-login-scope">تعاونی انتخاب‌شده: <b dir="ltr">{workspaceSlug}</b></div>:null}
   <div className="tto-auth-method-tabs" role="tablist" aria-label="انتخاب روش ورود">
     <button className="tto-auth-tab" type="button" role="tab" aria-selected={method==="otp"} onClick={()=>{setNotice("");setMethod("otp")}}>رمز یک‌بارمصرف</button>
     <button className="tto-auth-tab" type="button" role="tab" aria-selected={method==="password"} onClick={()=>{setNotice("");setMethod("password")}}>نام کاربری و رمز</button>
   </div>
   {method==="otp"?<OtpLogin enabled={true} surface={surface} postLoginRedirect={workspaceSlug?"/c/"+encodeURIComponent(workspaceSlug):"/"}/>:
   phase==="checking"?<p role="status">در حال بررسی نشست…</p>:
    phase==="ready"?<div className="tto-login-scope"><p>نشست شما معتبر است.</p><a href={workspaceSlug?"/c/"+workspaceSlug:"/"}>ورود به داشبورد ←</a></div>:
    <form onSubmit={submit} autoComplete="on">
      <label htmlFor="portal-user">نام کاربری {label}</label>
      <input id="portal-user" type="text" dir="ltr" autoComplete="username" required
        minLength={5} maxLength={64} pattern="[a-z][a-z0-9._-]{4,63}" value={username}
        onChange={e=>setUsername(e.target.value.trim().toLowerCase())} disabled={busy}/>
      <label htmlFor="portal-pass">رمز عبور</label>
      <input id="portal-pass" type="password" dir="ltr" autoComplete="current-password"
        required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>
      <button disabled={busy} type="submit">{busy?"در حال بررسی امن…":"ورود به پنل "+label}</button>
    </form>}
   {notice?<p role="alert" className="tto-login-error">{notice}</p>:null}
   {surface==="cooperative"?<div className="tto-auth-inline-links"><a href="/customer-login">ورود صاحب اشتراک</a><a href="/first-login">بازیابی مشخصات با OTP</a></div>:null}
   {phase==="error"?<p role="alert">سرویس بررسی وضعیت نشست در دسترس نیست.</p>:null}
   <p className="tto-auth-muted-note">ورود، به‌تنهایی مجوز دسترسی به سهام یا اطلاعات سایر تعاونی‌ها نیست.</p>
 </section>;
}
