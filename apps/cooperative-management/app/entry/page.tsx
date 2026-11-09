"use client";
import {useEffect,useState} from "react";
import {AuthFrame} from "@tto/ui";
type Item={slug:string;name:string;tenantActive:boolean;credentialsReady:boolean};
export default function WorkspaceEntry(){
 const [state,setState]=useState<"loading"|"choose"|"empty"|"denied"|"error">("loading");
 const [items,setItems]=useState<Item[]>([]);
 useEffect(()=>{
  let alive=true;
  async function begin(){
   try{
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
 return <AuthFrame surface="cooperative" title="ورود به فضای تعاونی" description="هویت شما تأیید شده است. سامانه فضای مجاز را از پایگاه داده بررسی می‌کند.">
  <section className="tto-auth-controls" aria-label="انتخاب فضای آزمایشی تأییدشده">
   {state==="loading"?<p role="status">در حال شناسایی فضای اختصاصی و بررسی مجوزها…</p>:null}
   {state==="choose"?<>
    <p className="tto-auth-muted-note">بیش از یک فضای آزمایشی دارید. تعاونی موردنظر را انتخاب کنید:</p>
    {items.map(w=><p key={w.slug}><a className="tto-auth-primary-link" href={"/c/"+encodeURIComponent(w.slug)}>{w.name} — {w.slug}.ttoir.ir ←</a></p>)}
   </>:null}
   {state==="empty"?<p role="status">حساب شما تأیید شده، اما فضای آزمایشی متعلق به این حساب پیدا نشد. ابتدا از صفحه آزمون، یک تعاونی نمونه ثبت کنید. این وضعیت مجوز مدیر قانونی ایجاد نمی‌کند.</p>:null}
   {state==="denied"?<p role="alert">مجوز بررسی فضاهای آزمایشی برای این نشست وجود ندارد.</p>:null}
   {state==="error"?<p role="alert">سرویس بررسی فضای اختصاصی در دسترس نیست؛ هیچ فضای ناشناخته‌ای باز نمی‌شود.</p>:null}
   {state==="empty"?<a className="tto-auth-primary-link" href="/subscribe">ثبت فضای آزمایشی ←</a>:null}
  </section>
 </AuthFrame>;
}
