"use client";
import {useEffect,useState} from "react";
type Item={slug:string;name:string;tenantActive:boolean;credentialsReady:boolean};
export default function WorkspaceEntry(){
 const [state,setState]=useState<"loading"|"choose"|"empty"|"denied"|"error">("loading");
 const [items,setItems]=useState<Item[]>([]);
 useEffect(()=>{
  let alive=true;
  async function begin(){
   try{
    // An already authorized manager must enter the real cooperative dashboard
    // rather than being incorrectly treated as a commercial/demo subscriber.
    const manager=await fetch("/api/auth/password/session",{credentials:"same-origin",cache:"no-store"});
    if(manager.ok){
     const evidence=await manager.json() as {authenticated?:unknown;workspaceSlug?:unknown};
     if(evidence.authenticated===true){
      if(typeof evidence.workspaceSlug==="string"&&
         /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(evidence.workspaceSlug)){
       if(alive)window.location.replace("/c/"+encodeURIComponent(evidence.workspaceSlug));
      }else if(alive)setState("denied");
      return;
     }
    }
    const response=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw Error("SESSION_ERROR");
    const session=await response.json() as {authenticated?:unknown};
    if(session.authenticated!==true){if(alive)window.location.replace("/login");return}
    const result=await fetch("/api/commerce/workspaces",{credentials:"same-origin",cache:"no-store"});
    if(result.status===401){if(alive)setState("denied");return}
    if(!result.ok)throw Error("WORKSPACES_UNAVAILABLE");
    const data=await result.json() as {items?:Item[]};
    if(!Array.isArray(data.items))throw Error("BAD_WORKSPACES");
    const eligible=data.items.filter(x=>/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(x.slug)&&x.tenantActive===true);
    if(!alive)return;
    setItems(eligible);
    if(eligible.length===1){
     window.location.replace("/c/"+encodeURIComponent(eligible[0].slug));
     return;
    }
    setState(eligible.length>1?"choose":"empty");
   }catch{if(alive)setState("error")}
  }
  void begin();return()=>{alive=false}
 },[]);
 return <AuthFrame surface="coopera // Pure routing resolver: never present another login design.
 // Single scoped workspace automatically opens the approved dashboard.
 return <main dir="rtl" lang="fa" className="tto-workspace-resolver" style={{padding:24,maxWidth:650,margin:"auto"}}>
  {state==="loading"?<p role="status" aria-live="polite">در حال شناسایی فضای اختصاصی و انتقال به داشبورد…</p>:null}
  {state==="choose"?<section aria-label="انتخاب فضای مجاز">
    <h1>انتخاب تعاونی</h1><p>چند فضای مجاز برای این حساب وجود دارد. تعاونی موردنظر را انتخاب کنید:</p>
    {items.map(w=><p key={w.slug}><a href={"/c/"+encodeURIComponent(w.slug)}>{w.name} — {w.slug}.ttoir.ir</a></p>)}
  </section>:null}
  {state==="empty"?<p role="status">فضای فعال متعلق به این حساب پیدا نشد. <a href="/subscribe">ثبت فضای آزمایشی</a></p>:null}
  {state==="denied"?<p role="alert">دسترسی به فضای انتخابی مجاز نیست. <a href="/login">بازگشت به ورود</a></p>:null}
  {state==="error"?<p role="alert">سرویس تشخیص فضای مجاز پاسخ نداد. <a href="/login">بازگشت به ورود</a></p>:null}
 </main>;