"use client";
import {useEffect,useState,type FormEvent} from "react";
import {AuthFrame} from "@tto/ui";

type Workspace={slug:string;name:string;username:string;credentialsReady:boolean;tenantActive:boolean};
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export function SetupCredentials({slug}:{slug:string}){
 const [workspace,setWorkspace]=useState<Workspace|null>(null);
 const [state,setState]=useState<"checking"|"ready"|"denied"|"error"|"saving">("checking");
 const [username,setUsername]=useState("");
 const [password,setPassword]=useState(""),[confirm,setConfirm]=useState("");
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  let active=true;
  async function load(){
   if(!SLUG.test(slug)){if(active)setState("denied");return}
   try{
    const session=await fetch("/api/auth/session",{cache:"no-store",credentials:"same-origin"});
    const status=session.ok?await session.json() as {authenticated?:unknown}:null;
    if(status?.authenticated!==true){if(active)window.location.replace("/login?workspace="+encodeURIComponent(slug));return}
    const response=await fetch("/api/commerce/workspaces",{cache:"no-store",credentials:"same-origin"});
    if(response.status===401){if(active)setState("denied");return}
    if(!response.ok)throw Error("UNAVAILABLE");
    const data=await response.json() as {items?:Workspace[]};
    if(!Array.isArray(data.items))throw Error("INVALID_RESPONSE");
    const found=data.items.find(x=>x.slug===slug&&x.tenantActive===true);
    if(!found){if(active)setState("denied");return}
    if(found.credentialsReady===true){if(active)window.location.replace("/owner/"+encodeURIComponent(slug));return}
    if(active){setWorkspace(found);setUsername(found.username);setState("ready")}
   }catch{if(active)setState("error")}
  }
  void load();return()=>{active=false}
 },[slug]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(state!=="ready"||!workspace)return;
  if(password.length<14||password!==confirm){setNotice("رمز باید حداقل ۱۴ نویسه داشته باشد و با تکرار آن مطابقت کند.");return}
  setState("saving");setNotice("");
  try{
   const response=await fetch("/api/commerce/workspaces",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({slug,username,password}),cache:"no-store"
   });
   const data=await response.json() as {changed?:unknown;slug?:unknown};
   if(response.status===403){setNotice("برای تعیین مشخصات ورود، تأیید تازه شماره همراه با OTP لازم است.");setState("ready");return}
   if(!response.ok||data.changed!==true||data.slug!==slug)throw Error("ذخیره مشخصات ورود تأیید نشد.");
   setPassword("");setConfirm("");
   // The backend revokes old sessions after first credential setup.
   window.location.replace("/customer-login?slug="+encodeURIComponent(slug));
  }catch(e){setNotice(e instanceof Error?e.message:"خطای ذخیره مشخصات");setState("ready")}
 }
 return <AuthFrame surface="cooperative" title="فعال‌سازی ورود اختصاصی" description="اولین ورود با OTP تأیید شد. پیش از استفاده از فضای تعاونی، نام کاربری و رمز عبور اختصاصی تعیین کنید.">
  <section className="tto-auth-controls" aria-label="تعیین اجباری نام کاربری و رمز برای فضای آزمایشی">
   <div className="tto-login-scope">فضای آزمایشی: <strong dir="ltr">{slug}.ttoir.ir</strong></div>
   {state==="checking"||state==="saving"?<p role="status">{state==="checking"?"در حال بررسی مالکیت فضای تعاونی…":"در حال ذخیره امن مشخصات…"} </p>:null}
   {state==="denied"?<p role="alert">این فضا به حساب تأییدشده شما تعلق ندارد. هیچ دسترسی مدیریتی واگذار نشده است.</p>:null}
   {state==="error"?<p role="alert">بررسی اطلاعات فضای تعاونی برقرار نشد. دسترسی به فرم بسته است.</p>:null}
   {workspace&&["ready","saving"].includes(state)?<form onSubmit={submit}>
    <label htmlFor="setup-username">نام کاربری اختصاصی</label>
    <input id="setup-username" type="text" autoComplete="username" dir="ltr"
     minLength={5} maxLength={64} pattern="[a-z][a-z0-9._-]{4,63}"
     required disabled={state==="saving"} value={username}
     onChange={e=>setUsername(e.target.value.toLowerCase().trim())}/>
    <label htmlFor="setup-password">رمز عبور (حداقل ۱۴ نویسه)</label>
    <input id="setup-password" type="password" autoComplete="new-password" minLength={14}
     maxLength={128} required disabled={state==="saving"} value={password}
     onChange={e=>setPassword(e.target.value)}/>
    <label htmlFor="setup-repeat">تکرار رمز عبور</label>
    <input id="setup-repeat" type="password" autoComplete="new-password" minLength={14}
     maxLength={128} required disabled={state==="saving"} value={confirm}
     onChange={e=>setConfirm(e.target.value)}/>
    <button type="submit" disabled={state==="saving"}>ذخیره مشخصات و ادامه ورود ←</button>
   </form>:null}
   {notice?<p role="alert">{notice}</p>:null}
   <p className="tto-auth-muted-note">این حساب فقط مالک فضای آزمایشی است؛ اختیار حقوقی مدیریت تعاونی و عملیات سهام مستقل بررسی می‌شود. رمز عبور پیامک نمی‌شود.</p>
  </section>
 </AuthFrame>;
}
