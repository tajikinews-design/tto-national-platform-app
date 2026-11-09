"use client";
import {useEffect,useState,type ReactNode} from "react";

/**
 * Route OTP-authenticated commercial owner to mandatory credential setup.
 * This cannot grant a COOPERATIVE_MANAGER role. Only an independently
 * approved manager/password session can render the real management portal.
 */
type Workspace={slug?:unknown;credentialsReady?:unknown;tenantActive?:unknown};
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export function CooperativeEntryGate({slug,manager}:{slug:string;manager:ReactNode}){
 const [phase,setPhase]=useState<"checking"|"manager"|"unavailable"|"denied">("checking");
 useEffect(()=>{
  let alive=true;
  async function run(){
   if(!SLUG.test(slug)){if(alive)setPhase("denied");return}
   try{
    // Path 1: independently authorized official manager.
    const managerResult=await fetch("/api/auth/password/session",{credentials:"same-origin",cache:"no-store"});
    if(managerResult.ok){
     const managerSession=await managerResult.json() as {authenticated?:unknown;workspaceSlug?:unknown};
     if(managerSession.authenticated===true){
      if(managerSession.workspaceSlug===slug){if(alive)setPhase("manager")}
      else if(alive)setPhase("denied");
      return;
     }
    }
    // Manager password auth may deliberately be unavailable in isolated Preview.
    // Commercial onboarding remains independently controlled by OTP + ownership.
    // Path 2: commerce/demo owner. An OTP session never confers manager privileges.
    const session=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
    if(!session.ok)throw Error("SESSION_UNAVAILABLE");
    const identity=await session.json() as {authenticated?:unknown};
    if(identity.authenticated!==true){
     if(alive)window.location.replace("/login?workspace="+encodeURIComponent(slug));
     return;
    }
    const workspaces=await fetch("/api/commerce/workspaces",{credentials:"same-origin",cache:"no-store"});
    if(workspaces.status===401){if(alive)setPhase("denied");return}
    if(!workspaces.ok)throw Error("OWNER_SCOPE_UNAVAILABLE");
    const data=await workspaces.json() as {items?:unknown};
    if(!Array.isArray(data.items))throw Error("OWNER_SCOPE_INVALID");
    const found=data.items.find((x:Workspace)=>x&&x.slug===slug&&x.tenantActive===true) as Workspace|undefined;
    if(!found){if(alive)setPhase("denied");return}
    if(alive)window.location.replace(found.credentialsReady===true?
     "/owner/"+encodeURIComponent(slug):"/setup/"+encodeURIComponent(slug));
   }catch{if(alive)setPhase("unavailable")}
  }
  void run();return()=>{alive=false}
 },[slug]);
 if(phase==="manager")return <>{manager}</>;
 return <main lang="fa" dir="rtl" className="tto-login-page">
  <section role="status" className="tto-login-card">
   <h1>{phase==="checking"?"در حال بررسی دسترسی و آماده‌سازی ورود…":
    phase==="denied"?"دسترسی به این تعاونی تأیید نشد":"ارتباط با کنترل دسترسی برقرار نشد"}</h1>
   <p>{phase==="checking"?"فضای اختصاصی فقط پس از تأیید هویت و تطبیق شناسه باز می‌شود.":
    "برای حفظ امنیت، بدون تأیید مالکیت یا نقش مدیریتی هیچ داده‌ای نمایش داده نمی‌شود."}</p>
   {phase!=="checking"?<a href={"/login?workspace="+encodeURIComponent(slug)}>بازگشت به ورود</a>:null}
  </section>
 </main>;
}
