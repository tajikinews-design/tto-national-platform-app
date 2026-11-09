"use client";
import {useEffect,useState,type FormEvent} from "react";
const modules=[
 ["NAV-01","داشبورد"],["NAV-02","اعضا و سهام"],["NAV-03","بازار و سرمایه"],
 ["NAV-04","حاکمیت و مجامع"],["NAV-05","ارتباط با سهامداران"],
 ["NAV-06","عملیات و خدمات"],["NAV-07","کسب‌وکار و بازار"],
 ["NAV-08","پروژه و توسعه"],["NAV-09","ریسک و شفافیت"],
 ["NAV-10","گزارش و هوشمندی"],["NAV-11","تنظیمات"]
] as const;
type Right="view"|"create"|"edit"|"approve"|"manage";
const rights:[Right,string][]=[["view","مشاهده"],["create","ثبت"],["edit","ویرایش"],["approve","تأیید"],["manage","مدیریت"]];
export function CooperativeSecuritySettings({slug}:{slug:string}){
 const [current,setCurrent]=useState(""),[username,setUsername]=useState(""),[password,setPassword]=useState(""),[again,setAgain]=useState("");
 const [scopeReady,setScopeReady]=useState(false),[otpSession,setOtpSession]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [rightsMap,setRightsMap]=useState<Record<string,Right[]>>({});
 useEffect(()=>{let mounted=true;
  void Promise.all([fetch("/api/auth/session",{cache:"no-store"}),fetch("/api/commerce/workspaces",{cache:"no-store"})])
   .then(async ([s,r])=>{
    if(!s.ok||!r.ok)throw Error("UNAVAILABLE");
    const a=await s.json() as {authenticated?:boolean};
    const data=await r.json() as {items?:{slug:string;username:string;tenantActive:boolean}[]};
    const owner=data.items?.find(x=>x.slug===slug&&x.tenantActive===true);
    if(!owner)throw Error("NO_SCOPE");
    if(mounted){setScopeReady(true);setOtpSession(a.authenticated===true);setCurrent(owner.username);setUsername(owner.username)}
   }).catch(()=>{if(mounted)setMessage("برای تنظیم امنیت، نشست معتبر و مالکیت تعاونی باید دوباره تأیید شوند.")});
  return()=>{mounted=false};
 },[slug]);
 async function saveCredentials(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!scopeReady||!otpSession)return;
  if(password.length<14||password!==again){setMessage("رمز عبور حداقل ۱۴ نویسه داشته باشد و با تکرار آن برابر باشد.");return}
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/commerce/workspaces",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,username,password})});
   const data=r.ok?await r.json() as {changed?:boolean}:null;
   if(!r.ok||data?.changed!==true){setMessage(r.status===403?"تأیید تازه پیامکی لازم است؛ دوباره با OTP وارد شوید.":r.status===409?"نام کاربری قبلاً استفاده شده است.":"ثبت امن مشخصات تأیید نشد.");return}
   setPassword("");setAgain("");window.location.replace("/c/"+encodeURIComponent(slug));
  }catch{setMessage("سرویس تنظیم مشخصات ورود در دسترس نیست.")}finally{setBusy(false)}
 }
 function toggle(id:string,r:Right){
  setRightsMap(previous=>{
   const current=previous[id]??[];
   return {...previous,[id]:current.includes(r)?current.filter(x=>x!==r):[...current,r]};
  });
 }
 return <div lang="fa" dir="rtl" style={{display:"grid",gap:28}}>
  <section aria-label="تغییر نام کاربری و رمز مدیر" style={{padding:20,border:"1px solid #d4e0ed",borderRadius:14}}>
   <h2>تغییر نام کاربری و رمز عبور مدیر</h2>
   <p>برای ثبت تغییر، تأیید تازه شماره همراه با OTP الزامی است. پس از ذخیره، نشست‌های قدیمی باطل می‌شوند.</p>
   {scopeReady?<form onSubmit={saveCredentials} style={{display:"grid",gap:12,maxWidth:460}}>
    <label>نام کاربری فعلی <strong dir="ltr">{current}</strong></label>
    <label htmlFor="settings-username">نام کاربری جدید</label>
    <input id="settings-username" type="text" dir="ltr" required minLength={5} maxLength={64}
     pattern="[a-z][a-z0-9._-]{4,63}" autoComplete="username"
     value={username} onChange={e=>setUsername(e.target.value.toLowerCase().trim())}/>
    <label htmlFor="settings-password">رمز عبور جدید (حداقل ۱۴ نویسه)</label>
    <input id="settings-password" type="password" required minLength={14} maxLength={128}
     autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/>
    <label htmlFor="settings-repeat">تکرار رمز عبور جدید</label>
    <input id="settings-repeat" type="password" required minLength={14}
     autoComplete="new-password" value={again} onChange={e=>setAgain(e.target.value)}/>
    <button type="submit" disabled={!otpSession||busy}>{busy?"در حال ثبت…":"ثبت تغییرات ورود"}</button>
    {!otpSession?<p role="status">برای تغییر مشخصات باید با OTP وارد شوید؛ نشست رمز عبور به‌تنهایی کافی نیست.</p>:null}
   </form>:<p role="status">در حال تأیید مجوز تنظیمات حساب…</p>}
   {message?<p role="alert">{message}</p>:null}
  </section>
  <section aria-label="تعریف کاربران و دسترسی ماژول‌ها" style={{padding:20,border:"1px solid #d4e0ed",borderRadius:14}}>
   <h2>تعریف کاربر جدید و مدیریت دسترسی‌ها</h2>
   <p>فهرست ۱۱ ماژول و سطوح دسترسی آماده تعیین است. تا اتصال کنترل‌های مجوزدهی و ثبت حسابرسی به پایگاه داده، ایجاد حساب و اعمال مجوز غیرفعال می‌ماند.</p>
   <fieldset disabled style={{border:0,padding:0,display:"grid",gap:12}}>
    <label>نام و نام خانوادگی <input aria-label="نام و نام خانوادگی کاربر جدید"/></label>
    <label>نام کاربری جدید <input dir="ltr" aria-label="نام کاربری جدید"/></label>
    <label>شماره همراه <input dir="ltr" aria-label="شماره همراه کاربر جدید"/></label>
    <div style={{overflowX:"auto"}}>
     <table style={{width:"100%",borderCollapse:"collapse",textAlign:"center"}}>
      <thead><tr><th scope="col">ماژول</th>{rights.map(([_,title])=><th scope="col" key={title}>{title}</th>)}</tr></thead>
      <tbody>{modules.map(([id,name])=><tr key={id}><th scope="row" style={{textAlign:"right",padding:8}}>{name}</th>
       {rights.map(([right,title])=><td key={right} style={{padding:8}}>
        <input type="checkbox" aria-label={title+" "+name}
         checked={(rightsMap[id]??[]).includes(right)} onChange={()=>toggle(id,right)}/>
       </td>)}</tr>)}</tbody>
     </table>
    </div>
    <button disabled>ایجاد کاربر و ثبت دسترسی‌ها</button>
   </fieldset>
   <p role="status">وضعیت: تعریف کاربر هنوز عملیاتی نیست؛ هیچ کاربر یا مجوزی با این فرم ایجاد نمی‌شود.</p>
  </section>
 </div>;
}
