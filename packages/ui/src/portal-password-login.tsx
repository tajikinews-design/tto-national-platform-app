"use client";
import {useEffect,useState,type FormEvent} from "react";
import {OtpLogin} from "./otp-login";
type Surface="cooperative"|"shareholder";
export function PortalPasswordLogin({surface,workspaceSlug}:{surface:Surface;workspaceSlug?:string}){
 const [username,setUsername]=useState(""),[password,setPassword]=useState("");
 const [phase,setPhase]=useState<"checking"|"login"|"ready"|"error">("checking");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [method,setMethod]=useState<"password"|"otp">("otp");
 const [selectedWorkspace,setSelectedWorkspace]=useState(workspaceSlug??"");
 const validSelectedWorkspace=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(selectedWorkspace);
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
   if(response.status!==200){setNotice("حساب مستقل این پنل به هویت تأییدشده، نقش معتبر و تنظیمات امنیتی Preview نیاز دارد. ورود صاحب اشتراک آزمایشی مسیر جداگانه‌ای دارد.");return}
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
   {surface==="cooperative"?<div className="tto-auth-inline-links">
     <label htmlFor="preview-workspace-slug">برای ورود صاحب اشتراک آزمایشی، شناسه تعاونی را مشخص کنید:</label>
     <input id="preview-workspace-slug" type="text" dir="ltr" inputMode="text"
      autoCapitalize="none" autoComplete="off" spellCheck={false}
      pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
      value={selectedWorkspace} onChange={e=>setSelectedWorkspace(e.target.value.toLowerCase().trim())}
      placeholder="شناسه تعاونی ثبت‌شده"/>
     {validSelectedWorkspace?<a href={"/c/"+encodeURIComponent(selectedWorkspace)}>
       ورود صاحب اشتراک در فضای انتخاب‌شده</a>:<span>پس از واردکردن شناسه صحیح، مسیر ورود جداگانه فعال می‌شود.</span>}
    </div>:null}
   {phase==="error"?<p role="alert">سرویس بررسی وضعیت نشست در دسترس نیست.</p>:null}
   <p className="tto-auth-muted-note">ورود، به‌تنهایی مجوز دسترسی به سهام یا اطلاعات سایر تعاونی‌ها نیست.</p>
 </section>;
}
