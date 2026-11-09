"use client";
import {useEffect,useState,type FormEvent} from "react";
import {SettingsPageFrame,SettingsCard,SettingsNotice} from "./settings-shell";

type Workspace={slug:string;username:string;tenantActive:boolean;staff?:boolean};
export function CredentialsSettings({slug}:{slug:string}){
 const [loading,setLoading]=useState(true),[allowed,setAllowed]=useState(false);
 const [current,setCurrent]=useState(""),[username,setUsername]=useState("");
 const [password,setPassword]=useState(""),[repeat,setRepeat]=useState("");
 const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[messageType,setMessageType]=useState<"error"|"success">("error");
 const [mobile,setMobile]=useState(""),[challenge,setChallenge]=useState(""),[otp,setOtp]=useState("");
 const [seconds,setSeconds]=useState(0),[otpReady,setOtpReady]=useState(false);
 const [otpBusy,setOtpBusy]=useState(false);
 useEffect(()=>{
  let alive=true;
  async function load(){
   try{
    const r=await fetch("/api/commerce/workspaces",{cache:"no-store",credentials:"same-origin"});
    if(!r.ok)throw Error("SESSION");
    const data=await r.json() as {items?:Workspace[]};
    const owner=data.items?.find(x=>x.slug===slug&&x.tenantActive===true&&x.staff!==true);
    if(!owner)throw Error("OWNER_REQUIRED");
    if(alive){setCurrent(owner.username);setUsername(owner.username);setAllowed(true)}
   }catch{if(alive){setAllowed(false);setMessage("دسترسی به تنظیمات امنیتی فقط برای مالک تأییدشده این تعاونی فعال است.")}}
   finally{if(alive)setLoading(false)}
  }
  void load();return()=>{alive=false};
 },[slug]);
 useEffect(()=>{if(seconds<=0)return;
  const t=window.setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000);
  return()=>window.clearInterval(t);
 },[seconds>0]);
 const strength=[password.length>=14,/[a-z]/i.test(password),/[0-9]/.test(password),/[^a-z0-9]/i.test(password)].filter(Boolean).length;
 async function requestOtp(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(otpBusy||!allowed||seconds>0)return;
  if(!/^09\d{9}$/.test(mobile)){setMessage("شماره همراه باید با ۰۹ آغاز شود و ۱۱ رقم داشته باشد.");return}
  setOtpBusy(true);setMessage("");setOtpReady(false);
  try{
   const r=await fetch("/api/auth/otp/request",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({mobile}),cache:"no-store"});
   const j=await r.json() as {requestId?:unknown;expiresInSeconds?:unknown};
   if(!r.ok||typeof j.requestId!=="string")throw Error("OTP_REQUEST_FAILED");
   setChallenge(j.requestId);setOtp("");
   setSeconds(typeof j.expiresInSeconds==="number"?Math.min(60,Math.max(1,j.expiresInSeconds)):60);
   setMessageType("success");setMessage("کد یک‌بارمصرف درخواست شد. پس از دریافت، کد را در همین صفحه وارد کنید.");
  }catch{setMessageType("error");setMessage("درخواست کد تأیید انجام نشد. لطفاً دوباره تلاش کنید.")}
  finally{setOtpBusy(false)}
 }
 async function confirmOtp(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(otpBusy||!challenge||seconds===0)return;
  setOtpBusy(true);setMessage("");
  try{
   const r=await fetch("/api/auth/otp/verify",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:challenge,otp}),cache:"no-store"});
   if(!r.ok)throw Error("INVALID_OTP");
   setOtpReady(true);setOtp("");setChallenge("");setSeconds(0);
   setMessageType("success");setMessage("تأیید هویت انجام شد؛ اکنون می‌توانید مشخصات ورود را تغییر دهید.");
  }catch{setOtpReady(false);setMessageType("error");setMessage("کد معتبر نیست یا اعتبار آن تمام شده است. کد تازه درخواست کنید.")}
  finally{setOtpBusy(false)}
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!allowed||!otpReady)return;
  if(password.length<14||password!==repeat){
   setMessageType("error");setMessage("رمز جدید باید حداقل ۱۴ نویسه و با تکرار آن یکسان باشد.");return;
  }
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/commerce/workspaces",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,username,password}),cache:"no-store"});
   const j=r.ok?await r.json() as {changed?:boolean;slug?:string}:null;
   if(!r.ok||j?.changed!==true||j.slug!==slug){
    if(r.status===403){setOtpReady(false);throw Error("نشست تأیید پیامکی معتبر نیست؛ کد تازه دریافت کنید.")}
    throw Error(r.status===409?"این نام کاربری قبلاً استفاده شده است.":"تغییر مشخصات ورود تأیید نشد.");
   }
   // The backend rotates credentials and revokes old sessions. No silent auto-login.
   setPassword("");setRepeat("");setOtpReady(false);
   window.location.replace("/c/"+encodeURIComponent(slug));
  }catch(e){
   setMessageType("error");
   setMessage(e instanceof Error?e.message:"سرویس تغییر رمز در دسترس نیست.");
  }finally{setBusy(false)}
 }
 return <SettingsPageFrame slug={slug} section="credentials">
  <div className="tto-settings-grid">
   <SettingsCard title="تغییر مشخصات حساب" subtitle="نام کاربری و رمز جدید، پس از تأیید دوباره شماره همراه شما ثبت می‌شود." icon="♢">
    {loading?<p role="status">در حال بررسی مالکیت و اعتبار نشست…</p>:
     !allowed?<SettingsNotice type="error">برای ورود به تنظیمات از حساب مالک همین تعاونی استفاده کنید.</SettingsNotice>:
     <>
      <div className="tto-settings-pill positive">✓ مالک فضای اختصاصی تأیید شد</div>
      <div className="tto-settings-section-line"/>
      <form onSubmit={save}>
       <div className="tto-settings-fields">
        <label className="tto-settings-field wide" htmlFor="credential-current">
         <span>نام کاربری فعلی</span>
         <input id="credential-current" value={current} readOnly dir="ltr" aria-readonly="true" style={{background:"#f1f6fa"}}/>
        </label>
        <label className="tto-settings-field wide" htmlFor="credential-new-user">
         <span>نام کاربری جدید</span>
         <input id="credential-new-user" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().trim())}
          required autoComplete="username" pattern="[a-z][a-z0-9._-]{4,63}" minLength={5} maxLength={64} dir="ltr"/>
         <span className="tto-settings-help">حداقل ۵ نویسه انگلیسی؛ می‌توانید نام کاربری فعلی را نگه دارید.</span>
        </label>
        <div className="tto-settings-field">
         <label htmlFor="credential-new-password">رمز عبور جدید</label>
         <div className="tto-settings-input-wrap">
          <input id="credential-new-password" type={visible?"text":"password"} value={password}
           onChange={e=>setPassword(e.target.value)} minLength={14} maxLength={128} required autoComplete="new-password" dir="ltr"/>
          <button type="button" className="tto-settings-eye" onClick={()=>setVisible(v=>!v)}
           aria-label={visible?"پنهان‌کردن رمز":"نمایش رمز"}>{visible?"پنهان":"نمایش"}</button>
         </div>
         <div className="tto-settings-strength" aria-label={"استحکام رمز: "+strength+" از چهار"}>
          {[0,1,2,3].map(n=><span key={n} className={n<strength?"on":""}/>)}
         </div>
         <span className="tto-settings-help">حداقل ۱۴ نویسه و ترجیحاً ترکیب حروف، عدد و نماد.</span>
        </div>
        <label className="tto-settings-field" htmlFor="credential-repeat">
         <span>تکرار رمز عبور جدید</span>
         <input id="credential-repeat" type={visible?"text":"password"} value={repeat}
          onChange={e=>setRepeat(e.target.value)} minLength={14} maxLength={128} required autoComplete="new-password" dir="ltr"/>
         {repeat?<span className="tto-settings-help">{repeat===password?"✓ تکرار رمز مطابقت دارد":"رمزهای واردشده یکسان نیستند."}</span>:null}
        </label>
       </div>
       <div className="tto-settings-button-row">
        <button className="tto-settings-btn" type="submit" disabled={!otpReady||busy||password!==repeat||password.length<14}>
         {busy?"در حال ثبت امن…":"ذخیره نام کاربری و رمز جدید"}
        </button>
        {!otpReady?<span className="tto-settings-pill warning">◷ تأیید مجدد شماره همراه لازم است</span>:
         <span className="tto-settings-pill positive">✓ آماده ثبت تغییرات</span>}
       </div>
      </form>
     </>}
    {message?<div style={{marginTop:16}}><SettingsNotice type={messageType}>{message}</SettingsNotice></div>:null}
   </SettingsCard>
   <div style={{display:"grid",gap:18}}>
    <SettingsCard title="تأیید هویت دو مرحله‌ای" subtitle="برای تغییر اطلاعات حساس، کد پیامکی جدید دریافت کنید." icon="◈">
     <div className={"tto-settings-pill "+(otpReady?"positive":"warning")}>
      {otpReady?"✓ شماره همراه تأیید شده است":"◷ منتظر تأیید شماره همراه"}
     </div>
     {!otpReady?<div style={{display:"grid",gap:14,marginTop:15}}>
      <form onSubmit={requestOtp}>
       <label className="tto-settings-field" htmlFor="credential-mobile">
        <span>شماره همراه ثبت‌شده مالک</span>
        <input id="credential-mobile" dir="ltr" inputMode="tel" maxLength={11} pattern="09[0-9]{9}"
         placeholder="09123456789" value={mobile} onChange={e=>setMobile(e.target.value.replace(/[^0-9]/g,""))} required/>
       </label>
       <div className="tto-settings-button-row">
        <button className="tto-settings-btn secondary" disabled={!allowed||otpBusy||seconds>0} type="submit">
         {otpBusy?"در حال بررسی…":seconds>0?"ارسال مجدد پس از "+seconds+" ثانیه":"دریافت کد پیامکی"}
        </button>
       </div>
      </form>
      {challenge&&seconds>0?<form onSubmit={confirmOtp}>
       <label className="tto-settings-field" htmlFor="credential-otp">
        <span>کد یک‌بارمصرف</span>
        <input id="credential-otp" dir="ltr" inputMode="numeric" autoComplete="one-time-code"
         value={otp} onChange={e=>setOtp(e.target.value.replace(/[^0-9]/g,""))}
         maxLength={8} required placeholder="کد پیامکی"/>
       </label>
       <div className="tto-settings-button-row">
        <button className="tto-settings-btn" type="submit" disabled={otpBusy||otp.length<4}>تأیید کد</button>
       </div>
       <span className="tto-settings-help">اعتبار کد: {seconds.toLocaleString("fa-IR")} ثانیه</span>
      </form>:null}
     </div>:<p>می‌توانید نام کاربری و رمز جدید را ثبت کنید. با تغییر رمز، نشست‌های قبلی شما باطل می‌شوند.</p>}
    </SettingsCard>
    <SettingsCard title="چند نکته امنیتی" subtitle="حفظ امنیت حساب مدیر تعاونی" icon="♧">
     <div className="tto-settings-tip"><span>✓</span><div><strong>رمز اختصاصی و غیرتکراری</strong><small>رمزی متفاوت از حساب‌های شخصی خود انتخاب کنید.</small></div></div>
     <div className="tto-settings-tip"><span>♢</span><div><strong>حفاظت از نشست‌ها</strong><small>پس از تغییر رمز، ورود قبلی باطل و ورود تازه لازم می‌شود.</small></div></div>
     <div className="tto-settings-tip"><span>⌁</span><div><strong>مرزبندی تعاونی</strong><small>این تنظیمات فقط به حساب مالک فضای همین تعاونی مربوط است.</small></div></div>
    </SettingsCard>
   </div>
  </div>
 </SettingsPageFrame>;
}
