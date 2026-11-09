"use client";
import {useEffect,useState,type FormEvent,type ReactNode} from "react";
import {PortalShell,OtpLogin,AuthFrame} from "@tto/ui";
type Workspace={slug:string;name:string;username:string;credentialsReady:boolean;tenantActive:boolean;staff?:boolean;permissions?:string[]};
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

// The commercial owner can view the approved shell, not assume legal manager powers.
function WorkspaceSignIn({slug}:{slug:string}){
 const [mode,setMode]=useState<"otp"|"password">("otp");
 const [username,setUsername]=useState(""),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function login(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError("");
  try{
   const r=await fetch("/api/commerce/password-login",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,username,password})});
   const data=r.ok?await r.json() as {authenticated?:unknown;slug?:unknown}:null;
   if(!r.ok||data?.authenticated!==true||data.slug!==slug){
    setError(r.status===401?"نام کاربری یا رمز عبور نامعتبر است.":"سرویس ورود در دسترس نیست.");return;
   }
   setPassword("");window.location.replace("/c/"+encodeURIComponent(slug));
  }catch{setError("ارتباط با سرویس ورود برقرار نشد.")}
  finally{setBusy(f return <AuthFrame surface="cooperative">
  <section className="tto-auth-controls" data-tto-auth-surface="cooperative" aria-label="ورود مدیر تعاونی">
   <p className="tto-auth-muted-note">روش ورود دلخواه را انتخاب کنید. دسترسی به فضای همین تعاونی محدود است.</p>
   <p className="tto-login-scope">تعاونی انتخاب‌شده: <b dir="ltr">{slug}.ttoir.ir</b></p>
   <div className="tto-auth-method-tabs" role="tablist" aria-label="انتخاب روش ورود">
    <button className="tto-auth-tab" type="button" role="tab" aria-selected={mode==="otp"} onClick={()=>setMode("otp")}>رمز یک‌بارمصرف</button>
    <button className="tto-auth-tab" type="button" role="tab" aria-selected={mode==="password"} onClick={()=>setMode("password")}>نام کاربری و رمز</button>
   </div>
   {mode==="otp"?<OtpLogin enabled={true} surface="cooperative" postLoginRedirect={"/c/"+slug}/>:
    <form onSubmit={login} autoComplete="on">
     <label htmlFor="workspace-username">نام کاربری مدیر تعاونی</label>
     <input id="workspace-username" required dir="ltr" autoComplete="username" minLength={5} maxLength={64}
      pattern="[a-z][a-z0-9._-]{4,63}" value={username}
      onChange={e=>setUsername(e.target.value.toLowerCase().trim())}/>
     <label htmlFor="workspace-password">رمز عبور</label>
     <input id="workspace-password" required type="password" autoComplete="current-password"
      value={password} onChange={e=>setPassword(e.target.value)}/>
     <button type="submit" disabled={busy}>{busy?"در حال بررسی امن…":"ورود به پنل مدیر تعاونی"}</button>
    </form>}
   {error?<p role="alert" className="tto-login-error">{error}</p>:null}
   <p className="tto-auth-muted-note">ورود به‌تنهایی اختیار قانونی یا مجوز عملیات سهام ایجاد نمی‌کند.</p>
  </section>
 </AuthFrame>;n></main>;
}
function InlineFirstCredentials({workspace}:{workspace:Workspace}){
 const [username,setUsername]=useState(workspace.username);
 const [password,setPassword]=useState(""),[repeat,setRepeat]=useState("");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  if(password.length<14||password!==repeat){setNotice("رمز عبور باید حداقل ۱۴ نویسه و برابر با تکرار آن باشد.");return}
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/commerce/workspaces",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({slug:workspace.slug,username,password})});
   const result=r.ok?await r.json() as {changed?:unknown;slug?:unknown}:null;
   if(!r.ok||result?.changed!==true||result.slug!==workspace.slug){
    setNotice(r.status===403?"برای تنظیم رمز، ورود تازه با OTP لازم است.":"مشخصات ثبت نشد.");return;
   }
   // Credential activation revokes the previous session. Stay on the same URL.
   setPassword("");setRepeat("");window.location.replace("/c/"+encodeURIComponent(workspace.slug));
  }catch{setNotice("سرویس تنظیم مشخصات در دسترس نیست.")}
  finally{setBusy(false)}
 }
 return <div className="tto-checkout-plan" aria-label="تکمیل ورود نخست در داشبورد">
  <h2>تکمیل مشخصات ورود در همین داشبورد</h2>
  <p>نام کاربری و رمز اختصاصی تعیین کنید. پس از ثبت، نشست قبلی باطل می‌شود و می‌توانید در همین نشانی دوباره وارد شوید.</p>
  <form onSubmit={save} className="tto-checkout-form">
   <label htmlFor="inline-setup-user">نام کاربری</label>
   <input id="inline-setup-user" required dir="ltr" minLength={5} maxLength={64}
    pattern="[a-z][a-z0-9._-]{4,63}" value={username}
    onChange={e=>setUsername(e.target.value.toLowerCase().trim())}/>
   <label htmlFor="inline-setup-pass">رمز عبور (حداقل ۱۴ نویسه)</label>
   <input id="inline-setup-pass" required type="password" autoComplete="new-password"
    minLength={14} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/>
   <label htmlFor="inline-setup-repeat">تکرار رمز عبور</label>
   <input id="inline-setup-repeat" required type="password" autoComplete="new-password"
    minLength={14} value={repeat} onChange={e=>setRepeat(e.target.value)}/>
   <button type="submit" disabled={busy}>{busy?"در حال ذخیره…":"ذخیره مشخصات ورود"}</button>
  </form>{notice?<p role="alert">{notice}</p>:null}
 </div>;
}
export function CooperativeEntryGate({slug,manager,moduleId="NAV-01",ownerSettings}:
 {slug:string;manager:ReactNode;moduleId?:string;ownerSettings?:ReactNode}){
 const [phase,setPhase]=useState<"checking"|"manager"|"demo"|"login"|"denied"|"unavailable">("checking");
 const [workspace,setWorkspace]=useState<Workspace|null>(null);
 useEffect(()=>{
  let alive=true;
  async function run(){
   if(!SLUG.test(slug)){if(alive)setPhase("denied");return}
   try{
    const r=await fetch("/api/auth/password/session",{credentials:"same-origin",cache:"no-store"});
    if(r.ok){
     const managerSession=await r.json() as {authenticated?:unknown;workspaceSlug?:unknown};
     if(managerSession.authenticated===true){
      if(alive)setPhase(managerSession.workspaceSlug===slug?"manager":"denied");
      return;
     }
    }
    const s=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
    if(!s.ok)throw Error("SESSION_UNAVAILABLE");
    const identity=await s.json() as {authenticated?:unknown};
    if(identity.authenticated!==true){if(alive)setPhase("login");return}
    const result=await fetch("/api/commerce/workspaces",{credentials:"same-origin",cache:"no-store"});
    if(result.status===401){if(alive)setPhase("login");return}
    if(!result.ok)throw Error("WORKSPACES_UNAVAILABLE");
    const data=await result.json() as {items?:unknown};
    if(!Array.isArray(data.items))throw Error("INVALID_RESPONSE");
    const found=data.items.find((x:Workspace)=>x&&x.slug===slug&&x.tenantActive===true) as Workspace|undefined;
    if(!found){if(alive)setPhase("denied");return}
    if(found.staff===true&&(!Array.isArray(found.permissions)||!found.permissions.includes(moduleId))){
      if(alive)setPhase("denied");return;
    }
    if(alive){setWorkspace(found);setPhase("demo")}
   }catch{if(alive)setPhase("unavailable")}
  }
  void run();return()=>{alive=false}
 },[slug]);
 if(phase==="manager")return <>{manager}</>;
 if(phase==="demo"&&workspace)return <PortalShell surface="cooperative"
  activeId={moduleId} basePath={"/c/"+slug} demoOnly allowedModules={workspace.permissions}>
  {moduleId==="NAV-01"&&workspace.staff!==true&&!workspace.credentialsReady?<InlineFirstCredentials workspace={workspace}/>:null}
  {moduleId==="NAV-11"&&workspace.staff!==true&&ownerSettings?ownerSettings:null}
 </PortalShell>;
 if(phase==="login")return <WorkspaceSignIn slug={slug}/>;
 return <main className="tto-login-page" lang="fa" dir="rtl"><section className="tto-login-card" role="status">
  <h1>{phase==="checking"?"در حال بازکردن مدیریت تعاونی…":
   phase==="denied"?"حساب شما مجوز مشاهده این تعاونی را ندارد":"ارتباط با سرویس احراز دسترسی برقرار نشد"}</h1>
  <p>نشست و مالکیت همان زیردامنه باید توسط سرور تأیید شوند.</p>
 </section></main>;
}
