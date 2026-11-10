"use client";
import {useEffect,useState,type FormEvent,type ReactNode} from "react";
import {CooperativeNavLink} from "./cooperative-nav-link";
import {PortalShell,OtpLogin,AuthFrame} from "@tto/ui";
type Workspace={slug:string;name:string;username:string;credentialsReady:boolean;tenantActive:boolean;staff?:boolean;permissions?:string[]};
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
type WorkspaceAccess={kind:"manager"|"demo";workspace?:Workspace};
const verifiedWorkspaceBySlug=new Map<string,WorkspaceAccess>();
// Browser tab memory provides presentation continuity only. No bearer token,
// authority grant, personal data or cookie is written to storage.
// The commercial owner can view the approved shell, not assume legal manager powers.
function WorkspaceSignIn({slug}:{slug:string}){
 const [accountKind,setAccountKind]=useState<"subscriber"|"manager">("subscriber");
 const [mode,setMode]=useState<"otp"|"password">("otp");
 const [username,setUsername]=useState(""),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function login(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError("");
  try{
   const formal=accountKind==="manager";
   const r=await fetch(formal?"/api/auth/password/login":"/api/commerce/password-login",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(formal?{workspaceSlug:slug,username,password}:{slug,username,password})});
   const d=r.ok?await r.json() as {authenticated?:unknown;slug?:unknown;
    workspaceSlug?:unknown;surface?:unknown;commercialOnly?:unknown}:null;
   const attested=formal?
    d?.authenticated===true&&d.workspaceSlug===slug&&d.surface==="cooperative":
    d?.authenticated===true&&d.slug===slug&&d.commercialOnly===true;
   if(!r.ok||!attested){
    setError(r.status===401?"نام کاربری یا رمز عبور معتبر نیست.":
     r.status===403?"این حساب مجوز ورود ندارد یا محدودیت تلاش ورود فعال است.":
     formal?"ورود مدیر رسمی نیازمند احراز هویت مستقل، نقش معتبر و فعال‌سازی امنیتی در Preview است.":
     "ورود صاحب اشتراک آزمایشی آماده نیست؛ تنظیمات امنیتی Preview را بررسی کنید.");return;
   }
   setPassword("");window.location.replace("/c/"+encodeURIComponent(slug));
  }catch{setError("ارتباط با سرویس ورود برقرار نشد.")}
  finally{setBusy(false)}
 }
 return <AuthFrame surface="cooperative">
  <section className="tto-auth-controls" data-tto-auth-surface="cooperative" aria-label="ورود به فضای اختصاصی تعاونی">
   <p className="tto-login-scope">تعاونی انتخاب‌شده: <b dir="ltr">{slug}.ttoir.ir</b></p>
   <p className="tto-auth-muted-note">حساب صاحب اشتراک آزمایشی و مدیر رسمی تعاونی دارای مجوزهای مستقل هستند.</p>
   <div className="tto-auth-method-tabs" role="tablist" aria-label="نوع حساب">
    <button className="tto-auth-tab" type="button" role="tab" aria-selected={accountKind==="subscriber"}
     onClick={()=>{setAccountKind("subscriber");setMode("otp");setError("");}}>صاحب اشتراک آزمایشی</button>
    <button className="tto-auth-tab" type="button" role="tab" aria-selected={accountKind==="manager"}
     onClick={()=>{setAccountKind("manager");setMode("password");setError("");}}>مدیر رسمی تعاونی</button>
   </div>
   {accountKind==="subscriber"?<div className="tto-auth-method-tabs" role="tablist" aria-label="روش ورود صاحب اشتراک">
    <button className="tto-auth-tab" type="button" role="tab" aria-selected={mode==="otp"} onClick={()=>setMode("otp")}>رمز یک‌بارمصرف</button>
    <button className="tto-auth-tab" type="button" role="tab" aria-selected={mode==="password"} onClick={()=>setMode("password")}>نام کاربری و رمز</button>
   </div>:<p className="tto-auth-muted-note">ورود مستقل مدیر رسمی فقط با اعتبارنامه و نقش تأییدشده انجام می‌شود.</p>}
   {accountKind==="subscriber"&&mode==="otp"?<OtpLogin enabled={true} surface="cooperative" postLoginRedirect={"/c/"+slug}/>:
    <form onSubmit={login} autoComplete="on">
     <label htmlFor="workspace-username">نام کاربری {accountKind==="manager"?"مدیر رسمی تعاونی":"صاحب اشتراک"}</label>
     <input id="workspace-username" required dir="ltr" autoComplete="username" minLength={5} maxLength={64}
      pattern="[a-z][a-z0-9._-]{4,63}" value={username}
      onChange={e=>setUsername(e.target.value.toLowerCase().trim())}/>
     <label htmlFor="workspace-password">رمز عبور</label>
     <input id="workspace-password" required type="password" autoComplete="current-password"
      value={password} onChange={e=>setPassword(e.target.value)}/>
     <button type="submit" disabled={busy}>{busy?"در حال بررسی امن…":accountKind==="manager"?"ورود مدیر رسمی تعاونی":"ورود صاحب اشتراک"}</button>
    </form>}
   {error?<p role="alert" className="tto-login-error">{error}</p>:null}
   <p className="tto-auth-muted-note">ورود صاحب اشتراک، اختیار مدیریت رسمی یا عملیات قانونی سهام ایجاد نمی‌کند.</p>
  </section>
 </AuthFrame>;
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
export function CooperativeEntryGate({slug,manager,moduleId="NAV-01",ownerSettings,settingsSection,nav02Content,memberSection}:
 {slug:string;manager:ReactNode;moduleId?:string;ownerSettings?:ReactNode;settingsSection?:"credentials"|"users"|"collections"|"member-number";nav02Content?:ReactNode;memberSection?:"add"|"shares"|"shareholders"|"list"|"archive"|"collections"|"profile"}){
 const [phase,setPhase]=useState<"checking"|"manager"|"demo"|"login"|"denied"|"unavailable">(
  ()=>verifiedWorkspaceBySlug.get(slug)?.kind??"checking");
 const [workspace,setWorkspace]=useState<Workspace|null>(
  ()=>verifiedWorkspaceBySlug.get(slug)?.workspace??null);
 useEffect(()=>{
  let alive=true;
  async function run(){
   if(!SLUG.test(slug)){verifiedWorkspaceBySlug.delete(slug);if(alive)setPhase("denied");return}
   try{
    const r=await fetch("/api/auth/password/session",{credentials:"same-origin",cache:"no-store"});
    if(r.ok){
     const managerSession=await r.json() as {authenticated?:unknown;workspaceSlug?:unknown};
     if(managerSession.authenticated===true){
      if(managerSession.workspaceSlug===slug){
       verifiedWorkspaceBySlug.set(slug,{kind:"manager"});
       if(alive){setWorkspace(null);setPhase("manager")}
      }else{verifiedWorkspaceBySlug.delete(slug);if(alive)setPhase("denied")}
      return;
     }
    }
    const s=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
    if(!s.ok)throw Error("SESSION_UNAVAILABLE");
    const identity=await s.json() as {authenticated?:unknown};
    if(identity.authenticated!==true){verifiedWorkspaceBySlug.delete(slug);if(alive)setPhase("login");return}
    const result=await fetch("/api/commerce/workspaces",{credentials:"same-origin",cache:"no-store"});
    if(result.status===401){verifiedWorkspaceBySlug.delete(slug);if(alive)setPhase("login");return}
    if(!result.ok)throw Error("WORKSPACES_UNAVAILABLE");
    const data=await result.json() as {items?:unknown};
    if(!Array.isArray(data.items))throw Error("INVALID_RESPONSE");
    const found=data.items.find((x:Workspace)=>x&&x.slug===slug&&x.tenantActive===true) as Workspace|undefined;
    if(!found){verifiedWorkspaceBySlug.delete(slug);if(alive)setPhase("denied");return}
    if(found.staff===true&&(settingsSection!==undefined||
       !Array.isArray(found.permissions)||!found.permissions.includes(moduleId))){
      verifiedWorkspaceBySlug.delete(slug);
      if(alive)setPhase("denied");return;
    }
    verifiedWorkspaceBySlug.set(slug,{kind:"demo",workspace:found});
    if(alive){setWorkspace(found);setPhase("demo")}
   }catch{verifiedWorkspaceBySlug.delete(slug);if(alive)setPhase("unavailable")}
  }
  void run();return()=>{alive=false}
 },[slug,moduleId,settingsSection,memberSection]);
 if(phase==="manager")return <>{manager}</>;
 if(phase==="demo"&&workspace)return <PortalShell surface="cooperative"
  activeId={moduleId} basePath={"/c/"+slug} demoOnly allowedModules={workspace.permissions}
  canManageSettings={workspace.staff!==true} settingsSection={settingsSection}
  memberSection={memberSection}
  NavigationLink={CooperativeNavLink}>
  {moduleId==="NAV-01"&&workspace.staff!==true&&!workspace.credentialsReady?<InlineFirstCredentials workspace={workspace}/>:null}
  {moduleId==="NAV-11"&&workspace.staff!==true&&ownerSettings?ownerSettings:null}
  {moduleId==="NAV-02"&&workspace.staff!==true&&nav02Content?nav02Content:null}
 </PortalShell>;
 if(phase==="login")return <WorkspaceSignIn slug={slug}/>;
 // Checking is transient navigation state, NOT an authentication challenge.
 // Keep the login brand frame exclusively for an actual unauthenticated login.
 if(phase==="checking")return <main className="tto-workspace-transition" dir="rtl" lang="fa"
  role="status" aria-live="polite" aria-label="در حال بارگذاری صفحه مقصد">
  <span className="tto-workspace-transition-spinner" aria-hidden="true"/>
 </main>;
 return <main className="tto-workspace-access-error" dir="rtl" lang="fa">
  <section role={phase==="denied"?"alert":"status"}>
   <h2>{phase==="denied"?"حساب شما مجوز مشاهده این بخش را ندارد":"بررسی دسترسی ممکن نشد"}</h2>
   <p>محدوده تعاونی و مجوزهای حساب باید از سوی سرور تأیید شوند.</p>
   {phase==="unavailable"?<button type="button" onClick={()=>window.location.reload()}>تلاش مجدد</button>:null}
  </section>
 </main>;
}
