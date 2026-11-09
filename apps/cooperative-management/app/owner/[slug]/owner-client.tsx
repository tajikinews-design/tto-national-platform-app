"use client";
import {useEffect,useState} from "react";
type Workspace={slug:string;name:string;username:string;credentialsReady:boolean;tenantActive:boolean};
type Subscription={slug:string;planTitle?:string;remainingDays?:number;status?:string};
export function OwnerDashboard({slug}:{slug:string}){
 const [workspace,setWorkspace]=useState<Workspace|null>(null);
 const [subscription,setSubscription]=useState<Subscription|null>(null);
 const [state,setState]=useState<"checking"|"ready"|"denied"|"unavailable">("checking");
 useEffect(()=>{
  let active=true;
  async function check(){
   try{
    const identity=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
    if(!identity.ok)throw Error("SESSION_SERVICE_UNAVAILABLE");
    const session=await identity.json() as {authenticated?:unknown};
    if(session.authenticated!==true){if(active)window.location.replace("/customer-login?slug="+encodeURIComponent(slug));return}
    const response=await fetch("/api/commerce/workspaces",{credentials:"same-origin",cache:"no-store"});
    if(response.status===401){if(active)setState("denied");return}
    if(!response.ok)throw Error("OWNER_SERVICE_UNAVAILABLE");
    const data=await response.json() as {items?:Workspace[]};
    if(!Array.isArray(data.items))throw Error("INVALID_WORKSPACES");
    const item=data.items.find(x=>x.slug===slug&&x.tenantActive===true);
    if(!item){if(active)setState("denied");return}
    if(item.credentialsReady!==true){if(active)window.location.replace("/setup/"+encodeURIComponent(slug));return}
    if(!active)return;
    setWorkspace(item);setState("ready");
    const res=await fetch("/api/commerce/subscriptions",{credentials:"same-origin",cache:"no-store"});
    if(res.ok){const details=await res.json() as {items?:Subscription[]};
      if(active&&Array.isArray(details.items))setSubscription(details.items.find(x=>x.slug===slug)??null)}
   }catch{if(active)setState("unavailable")}
  }
  void check();return()=>{active=false}
 },[slug]);
 if(state!=="ready"||!workspace)return <main lang="fa" dir="rtl" className="tto-login-page">
  <section className="tto-login-card" role="status"><h1>{state==="checking"?"در حال بررسی دسترسی به فضای اختصاصی…":state==="denied"?"فضای تعاونی به این حساب تعلق ندارد":"سرویس احراز مالکیت در دسترس نیست"}</h1>
   <p>نمایش اطلاعات فقط پس از تأیید نشست و مالکیت فضای آزمایشی انجام می‌شود.</p>
   <a href={"/customer-login?slug="+encodeURIComponent(slug)}>ورود صاحب فضای نمونه</a>
  </section></main>;
 return <main lang="fa" dir="rtl" className="tto-login-page" style={{minHeight:"100svh",padding:"clamp(16px,4vw,55px)"}}>
  <section style={{background:"#fff",borderRadius:22,maxWidth:1000,width:"100%",padding:"clamp(20px,3vw,38px)",boxShadow:"0 18px 55px #173d5b1a"}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:15,flexWrap:"wrap",alignItems:"center"}}>
    <span className="tto-auth-form-tag">TTO · فضای آزمایشی فعال</span>
    <span className="tto-auth-role">پذیرش آزمایشی · بدون عملیات سهام</span>
   </div>
   <h1 style={{fontSize:"clamp(21px,3vw,30px)",margin:"16px 0 7px"}}>فضای اختصاصی {workspace.name}</h1>
   <p style={{color:"#67809a",fontSize:13}}>آدرس اختصاصی: <b dir="ltr">{slug}.ttoir.ir</b></p>
   <div style={{margin:"22px 0",padding:18,background:"#eaf6ff",borderRadius:14,border:"1px solid #d1e8f6"}}>
    <strong style={{color:"#0a5a91"}}>ورود و تعیین رمز با موفقیت انجام شده است.</strong>
    <p style={{fontSize:12,lineHeight:2,margin:"8px 0 0"}}>این داشبورد فقط برای کنترل فضای آزمایشی و اشتراک است. ورود به ماژول‌های رسمی مدیر تعاونی منوط به تخصیص مستقل نقش و مدارک معتبر است.</p>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}>
    <article className="tto-login-scope"><h2 style={{fontSize:16}}>هویت ورود</h2><p>نام کاربری: <b dir="ltr">{workspace.username}</b></p><small>رمز در مرورگر یا پیامک نمایش داده نمی‌شود.</small></article>
    <article className="tto-login-scope"><h2 style={{fontSize:16}}>اشتراک آزمایشی</h2><p>{subscription?.planTitle??"اشتراک نمونه"}</p><small>روزهای باقی‌مانده: {subscription?.remainingDays?.toLocaleString("fa-IR")??"در حال بررسی"}</small></article>
    <article className="tto-login-scope"><h2 style={{fontSize:16}}>مجوزهای رسمی</h2><p>مدیریت قانونی تعاونی: فعال نشده</p><small>صدور دسترسی نیازمند سند اختیار معتبر است.</small></article>
   </div>
   <nav style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:20}}>
    <a className="tto-auth-primary-link" style={{width:"auto",padding:"11px 20px",background:"#1268c8",borderRadius:11,color:"#fff",textDecoration:"none"}} href="/settings/subscription">مشاهده اشتراک و مشخصات ←</a>
    <a style={{display:"inline-flex",alignItems:"center",color:"#1268c8"}} href={"/login?workspace="+encodeURIComponent(slug)}>بازگشت به ورود نقش‌ها</a>
   </nav>
  </section>
 </main>;
}
