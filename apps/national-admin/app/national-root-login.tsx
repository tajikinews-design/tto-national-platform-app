"use client";
import {useEffect,useState,type FormEvent} from "react";
export default function NationalRootLogin(){
 const [username,setUsername]=useState("");
 const [password,setPassword]=useState("");
 const [state,setState]=useState<"checking"|"logged_in"|"login"|"unavailable">("checking");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 async function verifySession(){
  try{
   const response=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
   if(!response.ok)throw Error("UNAVAILABLE");
   const x=await response.json() as {authenticated?:unknown;nationalRoot?:unknown};
   setState(x.authenticated===true&&x.nationalRoot===true?"logged_in":"login");
  }catch{setState("unavailable")}
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
   await verifySession();
  }catch{setNotice("ارتباط با سرویس ورود برقرار نشد.")}
  finally{setBusy(false);}
 }
 async function logout(){
  setBusy(true);
  try{
   const r=await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin",cache:"no-store"});
   if(r.status!==204)throw Error("LOGOUT_UNAVAILABLE");
   setState("login");setUsername("");setPassword("");setNotice("از حساب مدیر ملی خارج شدید.");
  }catch{setNotice("خروج از حساب در سرور تأیید نشد.")}
  finally{setBusy(false);}
 }
 return <section dir="rtl" lang="fa" aria-label="ورود مدیر اصلی پلتفرم ملی"
  style={{background:"#fff",borderRadius:14,border:"1px solid #c8d7e5",padding:24,maxWidth:570,margin:"22px auto",fontFamily:"Tahoma,Arial,sans-serif"}}>
  <h2>ورود مدیر ملی</h2>
  <p style={{lineHeight:2}}>این بخش فقط برای مدیر اصلی پلتفرم است. ورود مدیران تعاونی و سهامداران همچنان از طریق رمز یک‌بارمصرف پیامکی انجام می‌شود.</p>
  {state==="checking"?<p role="status">در حال بررسی اعتبار نشست...</p>:
   state==="unavailable"?<div><p role="alert">بررسی نشست فعلاً ممکن نیست.</p><button type="button" onClick={()=>void verifySession()}>تلاش مجدد</button></div>:
   state==="logged_in"?<div><p role="status">ورود مدیر ملی تأیید شد.</p>
    <a style={{display:"inline-block",padding:"12px 18px",color:"#fff",background:"#075b88",borderRadius:8,textDecoration:"none"}} href="/cooperatives/new">ایجاد نشانی اختصاصی تعاونی</a>
    <button type="button" onClick={()=>void logout()} disabled={busy} style={{margin:12,padding:10}}>خروج امن</button>
   </div>:
   <form onSubmit={login}>
    <label htmlFor="national-username" style={{display:"block",margin:"14px 0 6px"}}>نام کاربری مدیر اصلی</label>
    <input id="national-username" dir="ltr" autoComplete="username" type="text" value={username}
      onChange={e=>setUsername(e.target.value)} minLength={2} maxLength={64} required disabled={busy}
      style={{display:"block",padding:12,width:"100%",boxSizing:"border-box",border:"1px solid #9bb6cb",borderRadius:8,fontSize:17}}/>
    <label htmlFor="national-password" style={{display:"block",margin:"16px 0 6px"}}>رمز عبور</label>
    <input id="national-password" dir="ltr" type="password" autoComplete="current-password" value={password}
      onChange={e=>setPassword(e.target.value)} minLength={1} maxLength={128} required disabled={busy}
      style={{display:"block",padding:12,width:"100%",boxSizing:"border-box",border:"1px solid #9bb6cb",borderRadius:8,fontSize:17}}/>
    <button type="submit" disabled={busy} style={{marginTop:16,padding:"12px 25px",background:"#075b88",border:0,borderRadius:9,color:"#fff",fontWeight:700}}>{busy?"در حال بررسی…":"ورود به پنل ملی"}</button>
   </form>}
  {notice?<p role="status" style={{lineHeight:2,color:"#7d341a"}}>{notice}</p>:null}
 </section>;
}
