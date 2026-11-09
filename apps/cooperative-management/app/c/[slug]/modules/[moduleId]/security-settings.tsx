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
 const [mobile,setMobile]=useState(""),[code,setCode]=useState(""),[challenge,setChallenge]=useState("");
 const [deadline,setDeadline]=useState(0),[timeNow,setTimeNow]=useState(()=>Date.now());
 const remaining=Math.max(0,Math.ceil((deadline-timeNow)/1000));
 useEffect(()=>{if(!deadline)return;const id=window.setInterval(()=>setTimeNow(Date.now()),400);return()=>clearInterval(id)},[deadline]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");

 const [rightsMap,setRightsMap]=useState<Record<string,Right[]>>({"NAV-01":["view"]});
 const [staffName,setStaffName]=useState(""),[staffUser,setStaffUser]=useState(""),[staffPassword,setStaffPassword]=useState("");
 const [members,setMembers]=useState<{id:string;username:string;displayName:string;permissions:string[];state:string}[]>([]);
 const [teamStatus,setTeamStatus]=useState("");
 async function loadTeam(){
  try{const res=await fetch("/api/commerce/team?slug="+encodeURIComponent(slug),{cache:"no-store",credentials:"same-origin"});
   if(!res.ok)throw Error("UNAVAILABLE");
   const j=await res.json() as {items?:typeof members};
   if(!Array.isArray(j.items))throw Error("INVALID");
   setMembers(j.items);
  }catch{setTeamStatus("دریافت فهرست کاربران در دسترس نیست.")}
 }
 useEffect(()=>{void loadTeam()},[slug]);
 async function createStaff(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  if(staffPassword.length<14){setTeamStatus("رمز موقت باید حداقل ۱۴ نویسه باشد.");return}
  setBusy(true);setTeamStatus("");
  try{
   const permissions=modules.filter(([id])=>id==="NAV-01"||(rightsMap[id]??[]).includes("view")).map(([id])=>id);
   const res=await fetch("/api/commerce/team",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({
     action:"create",slug,displayName:staffName.trim(),username:staffUser.trim().toLowerCase(),
     password:staffPassword,permissions})});
   if(!res.ok)throw Error(res.status===409?"این نام کاربری قبلاً ثبت شده است.":
    res.status===403?"فقط مالک این فضای آزمایشی اجازه ایجاد کاربر دارد.":"ایجاد کاربر تأیید نشد.");
   setStaffPassword("");setStaffName("");setStaffUser("");setTeamStatus("کاربر آزمایشی ایجاد شد؛ فقط ماژول‌های انتخاب‌شده قابل مشاهده خواهند بود.");
   await loadTeam();
  }catch(e){setTeamStatus(e instanceof Error?e.message:"ثبت کاربر انجام نشد.")}
  finally{setBusy(false)}
 }
 async function updateStaff(member:typeof members[number],state:string,permissions:string[]){
  setBusy(true);setTeamStatus("");
  try{
   const res=await fetch("/api/commerce/team",{method:"POST",credentials:"same-origin",
     headers:{"Content-Type":"application/json"},body:JSON.stringify({
      action:"update",slug,id:member.id,state,permissions})});
   if(!res.ok)throw Error("ثبت تغییرات دسترسی انجام نشد.");
   setTeamStatus("مجوزها ذخیره و نشست‌های قبلی کاربر باطل شدند.");
   await loadTeam();
  }catch(e){setTeamStatus(e instanceof Error?e.message:"ثبت انجام نشد.")}
  finally{setBusy(false)}
 }

 useEffect(()=>{let mounted=true;
  void Promise.all([fetch("/api/auth/session",{cache:"no-store"}),fetch("/api/commerce/workspaces",{cache:"no-store"})])
   .then(async ([s,r])=>{
    if(!s.ok||!r.ok)throw Error("UNAVAILABLE");
    const a=await s.json() as {authenticated?:boolean};
    const data=await r.json() as {items?:{slug:string;username:string;tenantActive:boolean}[]};
    const owner=data.items?.find(x=>x.slug===slug&&x.tenantActive===true);
    if(!owner)throw Error("NO_SCOPE");
    if(mounted){setScopeReady(true);setOtpSession(false);setCurrent(owner.username);setUsername(owner.username)}
   }).catch(()=>{if(mounted)setMessage("برای تنظیم امنیت، نشست معتبر و مالکیت تعاونی باید دوباره تأیید شوند.")});
  return()=>{mounted=false};
 },[slug]);
 async function requestOtp(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||remaining>0)return;setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/auth/otp/request",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({mobile})});
   const d=r.ok?await r.json() as {requestId?:string;expiresInSeconds?:number}:null;
   if(!r.ok||!d?.requestId)throw Error("دریافت کد تأیید ممکن نشد.");
   setChallenge(d.requestId);setCode("");
   setDeadline(Date.now()+Math.min(d.expiresInSeconds??60,60)*1000);
   setMessage("کد پیامکی ارسال شد؛ آن را در همین صفحه وارد کنید.");
  }catch(e){setMessage(e instanceof Error?e.message:"دریافت کد انجام نشد.")}
  finally{setBusy(false)}
 }
 async function verifyOtp(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||remaining<=0)return;setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/auth/otp/verify",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:challenge,otp:code})});
   const d=r.ok?await r.json() as {verified?:boolean}:null;
   if(!r.ok||d?.verified!==true)throw Error("کد معتبر نیست یا منقضی شده است.");
   setOtpSession(true);setChallenge("");setCode("");setDeadline(0);
   setMessage("هویت با OTP تازه تأیید شد؛ اکنون نام کاربری و رمز را ذخیره کنید.");
  }catch(e){setMessage(e instanceof Error?e.message:"تأیید انجام نشد.")}
  finally{setBusy(false)}
 }
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
   {scopeReady&&!otpSession?<div style={{display:"grid",gap:12,maxWidth:460}}>
    <form onSubmit={requestOtp} style={{display:"grid",gap:8}}>
     <label htmlFor="credential-otp-mobile">شماره همراه تأییدشده مدیر</label>
     <input id="credential-otp-mobile" dir="ltr" inputMode="numeric" pattern="09[0-9]{9}"
      maxLength={11} required value={mobile} onChange={e=>setMobile(e.target.value)}/>
     <button disabled={busy||remaining>0}>{remaining>0?"اعتبار کد: "+remaining.toLocaleString("fa-IR")+" ثانیه":"دریافت کد تأیید تازه"}</button>
    </form>
    {challenge?<form onSubmit={verifyOtp} style={{display:"grid",gap:8}}>
     <label htmlFor="credential-otp-code">کد شش‌رقمی</label>
     <input id="credential-otp-code" dir="ltr" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6}
      required value={code} onChange={e=>setCode(e.target.value)}/>
     <button disabled={busy||remaining<=0}>تأیید OTP</button>
    </form>:null}
   </div>:null}
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
   <p>برای کاربر جدید نام کاربری با پیشوند <b dir="ltr">staff_</b> انتخاب کنید. مجوزهای این بخش فقط دسترسی مشاهده در فضای آزمایشی است؛ ایجاد، ویرایش، تأیید و مدیریت رسمی تا تصویب حقوقی غیرفعال هستند.</p>
   <form onSubmit={createStaff} style={{display:"grid",gap:12}}>
    <label htmlFor="team-name">نام و نام خانوادگی</label>
    <input id="team-name" required minLength={3} maxLength={120} value={staffName} onChange={e=>setStaffName(e.target.value)}/>
    <label htmlFor="team-user">نام کاربری زیرمجموعه (با staff_)</label>
    <input id="team-user" dir="ltr" required pattern="staff_[a-z][a-z0-9._-]{4,58}"
     value={staffUser} onChange={e=>setStaffUser(e.target.value.toLowerCase().trim())}/>
    <label htmlFor="team-pass">رمز ورود اولیه (حداقل ۱۴ نویسه)</label>
    <input id="team-pass" type="password" autoComplete="new-password" required minLength={14} maxLength={128}
     value={staffPassword} onChange={e=>setStaffPassword(e.target.value)}/>
    <div style={{overflowX:"auto"}}>
     <table style={{width:"100%",borderCollapse:"collapse",textAlign:"center"}}>
      <thead><tr><th scope="col">ماژول</th>{rights.map(([_,title])=><th scope="col" key={title}>{title}</th>)}</tr></thead>
      <tbody>{modules.map(([id,name])=><tr key={id}><th scope="row" style={{textAlign:"right",padding:8}}>{name}</th>
       {rights.map(([right,title])=><td key={right} style={{padding:8}}>
        <input type="checkbox" aria-label={title+" "+name} disabled={right!=="view"||id==="NAV-01"}
         checked={right==="view"&&(id==="NAV-01"||(rightsMap[id]??[]).includes("view"))}
         onChange={()=>toggle(id,right)}/>
       </td>)}</tr>)}</tbody>
     </table>
    </div>
    <button type="submit" disabled={!scopeReady||busy}>{busy?"در حال ذخیره…":"ایجاد کاربر با مجوزهای انتخاب‌شده"}</button>
   </form>
   <h3>کاربران تعریف‌شده</h3>
   {members.length===0?<p>هنوز کاربری برای این تعاونی ثبت نشده است.</p>:
     members.map(member=><article key={member.id} className="tto-login-scope" style={{marginBottom:10,padding:12}}>
      <strong>{member.displayName}</strong> — <b dir="ltr">{member.username}</b>
      <p>وضعیت: {member.state==="ACTIVE"?"فعال":"غیرفعال"} · ماژول‌ها: {member.permissions.join("، ")}</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
       <button type="button" disabled={busy} onClick={()=>updateStaff(member,
        member.state==="ACTIVE"?"DISABLED":"ACTIVE",member.permissions)}>
        {member.state==="ACTIVE"?"غیرفعال‌کردن کاربر":"فعال‌کردن کاربر"}</button>
       <button type="button" disabled={busy} onClick={()=>updateStaff(member,member.state,
        modules.filter(([id])=>id==="NAV-01"||(rightsMap[id]??[]).includes("view")).map(([id])=>id))}>
        اعمال مجوزهای انتخاب‌شده</button>
      </div>
     </article>)}
   {teamStatus?<p role="status">{teamStatus}</p>:null}
  </section>
 </div>;
}
