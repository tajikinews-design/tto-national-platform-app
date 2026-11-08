"use client";
import {useEffect,useState,type ReactNode} from "react";
type Surface="national"|"cooperative"|"shareholder";
export function PortalSessionGate({surface,children}:{surface:Surface;children:ReactNode}){
 const [state,setState]=useState<"checking"|"ready"|"no_access"|"unavailable">("checking");
 useEffect(()=>{
  let alive=true;
  async function check(){
   try{
    const response=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw new Error("SESSION_UNAVAILABLE");
    const status=await response.json() as {authenticated?:unknown;nationalRoot?:unknown;mustChangeCredentials?:unknown};
    if(status.authenticated!==true||(surface==="national"&&
       (status.nationalRoot!==true||status.mustChangeCredentials!==false))){
       if(alive)window.location.replace("/login");return;
    }
    if(surface!=="national"){
      const scoped=await fetch("/api/me/tenant-options",{credentials:"same-origin",cache:"no-store"});
      if(scoped.status===401){if(alive)window.location.replace("/login");return;}
      if(!scoped.ok)throw new Error("TENANT_ROLES_UNAVAILABLE");
      const options=await scoped.json() as {items?:unknown};
      if(!Array.isArray(options.items)){throw new Error("INVALID_SCOPE")}
      if(options.items.length===0){if(alive)setState("no_access");return;}
    }
    if(alive)setState("ready");
   }catch{if(alive)setState("unavailable")}
  }
  void check();return()=>{alive=false};
 },[surface]);
 if(state!=="ready")return <main className="tto-login-page" lang="fa" dir="rtl">
  <section className="tto-login-card" role="status"><h1>{state==="checking"?"در حال بررسی دسترسی…":
    state==="no_access"?"دسترسی به تعاونی هنوز فعال نشده":"اتصال به سرویس تأیید هویت برقرار نشد"}</h1>
   <p>{state==="no_access"?"داشتن حساب یا نشانی ثبت‌شده، جایگزین تأیید رابطه عضویت یا اختیار مدیریت نمی‌شود.":"سامانه به‌صورت ایمن متوقف شده و اطلاعات محرمانه را نمایش نمی‌دهد."}</p>
   <a href="/login">رفتن به صفحه ورود مستقل</a>
  </section></main>;
 return <>{children}</>;
}
