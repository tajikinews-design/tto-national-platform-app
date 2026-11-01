"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
export default function Pcs011ManagerReview(){
 const params=useParams<{tenantId:string}>();
 const tenantId=params.tenantId;
 const [count,setCount]=useState<number|null>(null);
 const [message,setMessage]=useState("در حال بررسی نشست و دسترسی...");
 const [busy,setBusy]=useState(false);
 const [events,setEvents]=useState<Array<{id:string;fixtureRef:string;status:string;recordedAt:string}>>([]);
 const endpoint="/api/pcs011/tenants/"+encodeURIComponent(tenantId)+"/reviews";
 async function refresh(){
  try{const r=await fetch(endpoint,{cache:"no-store",credentials:"same-origin"});if(!r.ok){setCount(null);setEvents([]);setMessage("دسترسی تأیید نشده یا سرویس آزمایشی غیرفعال است");return}
    const data=await r.json();if(data.kind!=="SYNTHETIC_ONLY"||data.official!==false)throw Error("unsafe source");
    setCount(data.items);setEvents(Array.isArray(data.events)?data.events:[]);setMessage("آماده بررسی اطلاعات ساختگی");
  }catch{setCount(null);setEvents([]);setMessage("در حال حاضر اطلاعات در دسترس نیست")}
 }
 useEffect(()=>{void refresh()},[tenantId]);
 async function approve(){
  setBusy(true);
  try{const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({fixtureRef:"PCS010-FAKE-MANAGER-0001"})});
   if(!r.ok){setMessage(r.status===409?"این تأیید قبلاً ثبت شده است":"تأیید مجاز نیست");return}
   setMessage("تأیید ساختگی در PostgreSQL ثبت شد");await refresh();
  }catch{setMessage("خطا در ثبت آزمایشی")}finally{setBusy(false)}
 }
 return <main dir="rtl" lang="fa" style={{maxWidth:800,margin:"auto",padding:24,lineHeight:2}}>
  <h1>مدیریت تعاونی — بررسی آزمایشی PCS-011</h1>
  <p role="note">صرفاً داده فرضی؛ این صفحه سند مالکیت، ثبت عضویت رسمی یا مجوز معامله نیست.</p>
  <p aria-live="polite" role="status">{message}</p>
  <section aria-label="سوابق ساختگی">
    <h2>تاریخچه تأییدها</h2>
    <p>تعداد رویدادهای ساختگی ثبت‌شده: {count===null?"نامشخص":count}</p>
    <ul aria-label="فهرست رویدادهای تأیید آزمایشی">{events.map(e=><li key={e.id}><strong>{e.fixtureRef}</strong> — تأیید ساختگی — <time dateTime={e.recordedAt}>{new Date(e.recordedAt).toLocaleString("fa-IR")}</time></li>)}</ul>
    <button type="button" disabled={busy||count===null} onClick={()=>void approve()}>تأیید پرونده ساختگی</button>
    <button type="button" onClick={()=>void refresh()}>بارگذاری مجدد تاریخچه</button>
  </section>
  <p>خریدوفروش و انتقال سهام در این محیط غیرفعال است.</p>
 </main>;
}
