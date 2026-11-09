"use client";
import {useEffect,useState} from "react";
type Plan={code:string;title:string;durationDays:number;features:string[]};
export default function PublicPlans(){
 const [plans,setPlans]=useState<Plan[]>([]);
 const [state,setState]=useState<"loading"|"ready"|"offline">("loading");
 useEffect(()=>{
  let live=true;
  void fetch("/api/commerce",{cache:"no-store"})
   .then(async response=>{if(!response.ok)throw new Error("UNAVAILABLE");return response.json() as Promise<{plans?:unknown;realPaymentEnabled?:unknown}>})
   .then(data=>{
    if(!live)return;
    if(!Array.isArray(data.plans)||data.realPaymentEnabled!==false)throw new Error("INVALID_DEMO_CATALOG");
    const safe=data.plans.filter((v):v is Plan=>{
     if(!v||typeof v!=="object")return false;
     const p=v as Partial<Plan>;
     return typeof p.code==="string"&&/^demo-[a-z-]{2,30}$/.test(p.code)&&
       typeof p.title==="string"&&p.title.length>0&&p.title.length<90&&
       Number.isInteger(p.durationDays)&&Number(p.durationDays)>0&&
       Array.isArray(p.features)&&p.features.length<=20&&
       p.features.every(i=>typeof i==="string"&&i.length<250);
    });
    setPlans(safe.slice(0,6));setState("ready");
   })
   .catch(()=>{if(live)setState("offline")});
  return()=>{live=false};
 },[]);
 return <div className="tto-site-plans" aria-live="polite">
  {state==="loading"?<p className="tto-site-plan-message" role="status">در حال دریافت پلن‌های قابل انتخاب…</p>:
   state==="offline"?<p className="tto-site-plan-message" role="status">فهرست پلن‌های آزمایشی موقتاً در دسترس نیست؛ می‌توانید راهنمای خدمات را مشاهده کنید.</p>:
   plans.length===0?<p className="tto-site-plan-message">در حال حاضر پلن قابل ثبت در محیط آزمایشی موجود نیست.</p>:
   plans.map((p,i)=><article className={"tto-site-plan"+(i===1?" tto-site-plan-highlight":"")} key={p.code}>
    <div className="tto-site-plan-head"><span className="tto-site-plan-icon" aria-hidden="true">◈</span><span className="tto-site-plan-pill">محیط آزمایشی</span></div>
    <h3>{p.title}</h3>
    <p className="tto-site-plan-days"><strong>{p.durationDays.toLocaleString("fa-IR")}</strong> روز اعتبار نمایشی</p>
    <div className="tto-site-plan-rule"/>
    <ul>{p.features.length?p.features.map((f,j)=><li key={j}><span aria-hidden="true">✓</span>{f}</li>):<li>امکانات بر اساس پلن انتخابی در فرم سفارش مشخص می‌شود.</li>}</ul>
    <a href="/customer-register" className="tto-site-plan-cta">شروع ثبت‌نام <span aria-hidden="true">←</span></a>
   </article>)}
 </div>;
}
