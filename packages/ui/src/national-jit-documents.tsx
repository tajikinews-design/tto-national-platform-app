"use client";
import {useEffect,useState} from "react";
type Doc={document_id:string;title:string;classification:string;status:"PUBLISHED"};
export function NationalJitDocuments({tenantId,moduleId}:{tenantId:string;moduleId:string}){
 const [state,setState]=useState<"loading"|"denied"|"unavailable"|"ready">("loading");
 const [docs,setDocs]=useState<Doc[]>([]);
 useEffect(()=>{
  if(moduleId!=="NAV-09"||!tenantId){setState("denied");setDocs([]);return;}
  const c=new AbortController();setState("loading");setDocs([]);
  fetch("/api/tenants/"+tenantId+"/ph10/"+moduleId,{
   credentials:"same-origin",cache:"no-store",signal:c.signal
  }).then(async res=>{
   if(res.status===401||res.status===403||res.status===404){setState("denied");return;}
   if(res.status!==200)throw Error("SOURCE_UNAVAILABLE");
   const d=await res.json() as {available?:unknown;scope?:unknown;officialApproval?:unknown;items?:unknown};
   if(d.available!==true||d.scope!=="JIT_DOCUMENT_REVIEW_ONLY"||
     d.officialApproval!==false||!Array.isArray(d.items))throw Error("INVALID_SCOPE");
   const safe=d.items.filter((x):x is Doc=>Boolean(x)&&typeof x==="object"&&!Array.isArray(x)&&
     (x as Doc).status==="PUBLISHED").slice(0,50);
   if(!c.signal.aborted){setDocs(safe);setState("ready");}
  }).catch(()=>{if(!c.signal.aborted){setDocs([]);setState("unavailable");}});
  return ()=>c.abort();
 },[tenantId,moduleId]);
 if(moduleId!=="NAV-09")return <p role="status">عملیات این ماژول نیازمند مجوز مستقل است.</p>;
 return <section aria-label="بازبینی اسناد با مجوز محدود">
  <h3>بازبینی اطلاعات انتشار اسناد — مجوز موقت</h3>
  <p>این نمای فقط‌خواندنی مخصوص بررسی اسناد تعاونی منتخب است؛ جایگزین تأیید قانونی، رأی‌گیری یا صلاحیت امضا نیست.</p>
  {state==="loading"?<p role="status">در حال کنترل اعتبار مجوز موقت و اسناد…</p>:
   state==="denied"?<p role="alert">مجوز مستقل بررسی سند یا اختیار مدیریت ملی فعال نیست.</p>:
   state==="unavailable"?<p role="alert">منبع اسناد قابل‌استناد در دسترس نیست؛ داده‌ای ساخته نمی‌شود.</p>:
   docs.length===0?<p role="status">سند منتشرشده مجاز برای بررسی در این محدوده یافت نشد.</p>:
   <ul>{docs.map(d=><li key={d.document_id}>{d.title} — {d.classification}</li>)}</ul>}
 </section>;
}
