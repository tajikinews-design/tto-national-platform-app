"use client";
import {useEffect,useState} from "react";
type Attachment={id:string;subject:string;filename:string;mime:string;size:number;createdAt:string;state:string};
export function MemberAttachmentList({slug,draftId}:{slug:string;draftId:string}){
 const [items,setItems]=useState<Attachment[]>([]),[error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const url="/api/commerce/nav02/attachments?slug="+encodeURIComponent(slug)+
  "&draftId="+encodeURIComponent(draftId);
 async function refresh(){
  setBusy(true);setError("");
  try{
   const r=await fetch(url,{credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error("مجوز دریافت یا وضعیت ضمائم آماده نیست.");
   const o=await r.json() as {items?:Attachment[]};
   if(!Array.isArray(o.items))throw Error("پاسخ ضمائم معتبر نیست.");
   setItems(o.items);
  }catch(e){setError(e instanceof Error?e.message:"خطای دریافت ضمائم");}
  finally{setBusy(false);}
 }
 useEffect(()=>{void refresh();},[slug,draftId]);
 return <section className="tto-nav02-card" aria-label="ضمائم ذخیره‌شده عضو">
  <h2>ضمائم خصوصی اسکن‌شده این عضو</h2>
  <button type="button" disabled={busy} onClick={()=>void refresh()}>
   {busy?"در حال دریافت…":"تازه‌سازی ضمائم"}</button>
  {items.length===0?<p>فایل تأییدشده‌ای ثبت نشده است.</p>:
   <ul>{items.map(x=><li key={x.id}>
    {x.subject} — {x.filename} ({(x.size/1024).toLocaleString("fa-IR",{maximumFractionDigits:1})} کیلوبایت)
    <a href={"/api/commerce/nav02/attachments/download?slug="+encodeURIComponent(slug)+
     "&draftId="+encodeURIComponent(draftId)+"&id="+encodeURIComponent(x.id)}
     download={x.filename}>دریافت خصوصی فایل</a>
   </li>)}</ul>}
  {error?<p role="alert">{error}</p>:null}
  <small>دسترسی فقط به مالک مجاز همان تعاونی داده می‌شود؛ فایل‌های تأییدنشده قابل دانلود نیستند.</small>
 </section>;
}
