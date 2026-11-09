"use client";
import {useEffect,useState} from "react";
type Item={slug:string;name:string;planCode:string;planTitle:string;features:string[];confirmedAt:string;expiresAt:string;remainingDays:number;status:string;realPayment:false;tenantActivated:false};
export default function SubscriptionSettings(){
 const [items,setItems]=useState<Item[]>([]),[state,setState]=useState<"loading"|"ready"|"error"|"denied">("loading");
 useEffect(()=>{let active=true;void fetch("/api/commerce/subscriptions",{cache:"no-store",credentials:"same-origin"})
  .then(async r=>{if(r.status===401){if(active)setState("denied");return;}if(!r.ok)throw Error("unavailable");const d=await r.json() as {items?:Item[]};if(!Array.isArray(d.items))throw Error("invalid");if(active){setItems(d.items);setState("ready")}})
  .catch(()=>{if(active)setState("error")});return()=>{active=false}},[]);
 const date=(v:string)=>new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeZone:"Asia/Tehran"}).format(new Date(v));
 return <main lang="fa" dir="rtl" style={{background:"#f3f7fa",fontFamily:"Tahoma,Arial",padding:24,minHeight:"100vh"}}>
 <section style={{background:"#fff",maxWidth:890,margin:"auto",padding:24,borderRadius:14}}>
 <a href="/">داشبورد</a><h1>تنظیمات اشتراک خریداری‌شده</h1>
 <p style={{lineHeight:2}}>این صفحه فعلاً فقط اشتراک‌های آزمایشی ثبت‌شده را نمایش می‌دهد. روزهای باقیمانده از تاریخ انقضای ذخیره‌شده و زمان جاری سرور محاسبه می‌شوند؛ تأیید مبلغ آزمایشی، خرید واقعی یا فعال‌شدن پنل نیست.</p>
 {state==="loading"?<p role="status">در حال دریافت اشتراک…</p>:state==="denied"?<p role="alert">برای دیدن اشتراک‌ها وارد شوید. <a href="/login">ورود</a></p>:state==="error"?<p role="alert">اطلاعات اشتراک در دسترس نیست.</p>:
 items.length===0?<p role="status">اشتراک آزمایشی برای این حساب ثبت نشده است. <a href="/subscribe">ثبت سفارش نمایشی</a></p>:
 items.map(x=><article key={x.slug} style={{padding:16,marginBottom:13,border:"1px solid #dae4ed",borderRadius:12}}>
 <h2>{x.name}</h2><p>زیردامنه: <b dir="ltr">{x.slug}.ttoir.ir</b></p>
 <p>پلن: <strong>{x.planTitle}</strong> | اعتبار تا: <strong>{date(x.expiresAt)}</strong></p>
 <p>روزهای باقی‌مانده: <strong>{Math.max(0,x.remainingDays).toLocaleString("fa-IR")} روز</strong></p>
 <p>وضعیت: {x.status==="DEMO_ACTIVE"?"دوره آزمایشی":"دوره نمایشی منقضی‌شده"}</p>
 <p>امکانات: {x.features.join("، ")}</p><small>بدون پرداخت واقعی، بدون اعطای دسترسی مدیریتی یا ثبت تراکنش بانکی</small>
 </article>)}
 </section></main>;
}
