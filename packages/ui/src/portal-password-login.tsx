"use client";
import {useEffect,useState,type FormEvent} from "react";
type Surface="cooperative"|"shareholder";
export function PortalPasswordLogin({surface,workspaceSlug}:{surface:Surface;workspaceSlug?:string}){
 const [username,setUsername]=useState(""),[password,setPassword]=useState("");
 const [phase,setPhase]=useState<"checking"|"login"|"ready"|"error">("checking");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
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
   if(response.status!==200){setNotice("ورود امن در محیط آزمایش هنوز فعال نشده است؛ ثبت هویت و تنظیمات امنیتی لازم است.");return}
   const d=await response.json() as {authenticated?:boolean;workspaceSlug?:string};
   if(d.authenticated!==true||(workspaceSlug&&d.workspaceSlug!==workspaceSlug)){setNotice("تعاونی انتخابی با مجوز کاربر مطابقت ندارد.");return}
   setPassword("");setPhase("ready");
   window.location.assign(workspaceSlug?"/c/"+encodeURIComponent(workspaceSlug):"/");
  }catch{setNotice("ارتباط با سرویس امن ورود برقرار نشد.")}
  finally{setBusy(false)}
 }
 return <section className="tto-login-card" data-tto-auth-surface={surface} aria-label={"ورود مستقل "+label} dir="rtl">
   <span className="tto-login-mark">TTO</span>
   <p className="tto-login-eyebrow">پلتفرم ملی تعاونی توسعه و عمران</p>
   <h1>ورود {label}</h1>
   <p>ورود مستقل با نام کاربری و رمز عبور؛ حساب باید قبلاً به هویت حقیقی و محدوده مجاز همین تعاونی متصل شده باشد.</p>
   {workspaceSlug?<div className="tto-login-scope">تعاونی انتخاب‌شده: <b dir="ltr">{workspaceSlug}</b></div>:null}
   {phase==="checking"?<p role="status">در حال بررسی نشست…</p>:
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
   {phase==="error"?<p role="alert">سرویس بررسی وضعیت نشست در دسترس نیست.</p>:null}
   <small>آزمایش با اطلاعات واقعی: هیچ پرونده یا سهمی بدون نشست معتبر و احراز اختیار قابل مشاهده نیست.</small>
 </section>;
}
