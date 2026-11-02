"use client";

import {useEffect,useState} from "react";

type Tenant={tenantId:string;displayName:string;evidenceStatus:"MEMBERSHIP_EVIDENCE"|"EVIDENCE_PENDING"};
type Context="loading"|"unauthenticated"|"unavailable"|"ready";
type RecordState="idle"|"loading"|"ready"|"unauthenticated"|"restricted"|"unavailable";
type Member={membershipStatus:"ACTIVE";partyKind:"PERSON"|"ORGANIZATION";sourceVersion:number;sourceAsOf:string};
type Holding={shareQuantity:string;ledgerVersion:number;ledgerAsOf:string};
type Resource<T>={state:RecordState;record:T|null};
const empty=<T,>(state:RecordState):Resource<T>=>({state,record:null});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const QUANTITY=/^(0|[1-9][0-9]{0,18})$/;
const statusLabel:Record<RecordState,string>={
 idle:"تعاونی را انتخاب کنید",loading:"در حال استعلام از مرجع مجاز",
 ready:"داده دارای پاسخ معتبرِ منبع",unauthenticated:"نشست معتبر نیست",
 restricted:"مجوز نمایش یا منبع تأیید نشده است",unavailable:"اطلاعات در حال حاضر در دسترس نیست"
};
function validMember(input:unknown):input is Member{
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 const x=input as Record<string,unknown>;
 return x.membershipStatus==="ACTIVE"&&(x.partyKind==="PERSON"||x.partyKind==="ORGANIZATION")&&
 Number.isSafeInteger(x.sourceVersion)&&Number(x.sourceVersion)>0&&
 typeof x.sourceAsOf==="string"&&Number.isFinite(Date.parse(x.sourceAsOf));
}
function validHolding(input:unknown):input is Holding{
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 const x=input as Record<string,unknown>;
 return typeof x.shareQuantity==="string"&&QUANTITY.test(x.shareQuantity)&&
 Number.isSafeInteger(x.ledgerVersion)&&Number(x.ledgerVersion)>0&&
 typeof x.ledgerAsOf==="string"&&Number.isFinite(Date.parse(x.ledgerAsOf));
}
async function read<T>(url:string,signal:AbortSignal,validate:(v:unknown)=>v is T):Promise<Resource<T>>{
 try{
  const res=await fetch(url,{credentials:"same-origin",cache:"no-store",redirect:"error",signal});
  if(res.status===401)return empty("unauthenticated");
  if(res.status===403||res.status===404)return empty("restricted");
  if(res.status!==200)return empty("unavailable");
  const body=await res.json() as {available?:unknown;record?:unknown};
  if(body?.available!==true||!validate(body.record))return empty("unavailable");
  return {state:"ready",record:body.record};
 }catch{return empty("unavailable");}
}
function Provenance({version,date}:{version:number;date:string}){
 return <p className="tto-record-provenance">نسخه مرجع: <b dir="ltr">{version}</b> · زمان ثبت: <time dir="ltr">{date}</time></p>;
}
function ReadCard({title,state,children}:{title:string;state:RecordState;children?:React.ReactNode}){
 return <section className="tto-record-card" aria-label={title}>
  <h2>{title}</h2>
  <p className={"tto-record-state tto-record-"+state} role="status" aria-live="polite">{statusLabel[state]}</p>
  {state==="ready"?children:<p>هیچ عدد یا وضعیت واقعی از داده‌های ناموجود استنباط نمی‌شود.</p>}
 </section>;
}
export function MemberHoldingsReadOnly(){
 const [context,setContext]=useState<Context>("loading");
 const [tenants,setTenants]=useState<Tenant[]>([]);
 const [selected,setSelected]=useState("");
 const [member,setMember]=useState<Resource<Member>>(empty("idle"));
 const [holding,setHolding]=useState<Resource<Holding>>(empty("idle"));
 useEffect(()=>{
  const controller=new AbortController();
  async function discover(){
   try{
    const res=await fetch("/api/me/tenant-options",{credentials:"same-origin",cache:"no-store",redirect:"error",signal:controller.signal});
    if(res.status===401){if(!controller.signal.aborted)setContext("unauthenticated");return;}
    if(!res.ok)throw Error("UNAVAILABLE");
    const body=await res.json() as {items?:unknown};
    if(!Array.isArray(body?.items)||body.items.length>50)throw Error("UNAVAILABLE");
    const candidates:Tenant[]=[];
    for(const raw of body.items){
     if(!raw||typeof raw!=="object")throw Error("UNAVAILABLE");
     const x=raw as Record<string,unknown>;
     if(typeof x.tenantId!=="string"||!UUID.test(x.tenantId)||
       typeof x.displayName!=="string"||x.displayName.length<1||x.displayName.length>300||
       (x.evidenceStatus!=="EVIDENCE_PENDING"&&x.evidenceStatus!=="MEMBERSHIP_EVIDENCE"))throw Error("UNAVAILABLE");
     if(candidates.some(t=>t.tenantId===x.tenantId))throw Error("UNAVAILABLE");
     candidates.push(x as Tenant);
    }
    if(!controller.signal.aborted){setTenants(candidates);setContext("ready");}
   }catch{if(!controller.signal.aborted){setContext("unavailable");setTenants([]);}}
  }
  void discover();
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  // A tenant can only originate in the authenticated server-returned options list.
  if(context!=="ready"||!selected||!tenants.some(t=>t.tenantId===selected)){
   setMember(empty("idle"));setHolding(empty("idle"));return ()=>controller.abort();
  }
  setMember(empty("loading"));setHolding(empty("loading"));
  const base="/api/tenants/"+encodeURIComponent(selected)+"/me/";
  async function load(){
   const [m,h]=await Promise.all([
    read(base+"member-record",controller.signal,validMember),
    read(base+"shareholding",controller.signal,validHolding)
   ]);
   if(controller.signal.aborted)return; // abort old tenant requests, no stale result leak
   if(m.state==="unauthenticated"||h.state==="unauthenticated"){
    setMember(empty("unauthenticated"));setHolding(empty("unauthenticated"));
    setSelected("");setTenants([]);setContext("unauthenticated");return;
   }
   setMember(m);setHolding(h); // Independent gates; one cannot unlock the other.
  }
  void load();
  return ()=>controller.abort();
 },[selected,context,tenants]);
 return <main className="tto-record-shell" dir="rtl">
  <header className="tto-record-head">
   <a href="/" className="tto-record-return">بازگشت به پنل سهامداران</a>
   <span className="tto-record-badge">نمای آزمایشی قابلیت · فقط‌خواندنی · بدون تراکنش</span>
  </header>
  <h1>عضویت و سهام من</h1>
  <p>عضویت تعاونی (Child06) و موجودی سهام (Child07) از دو مرجع مستقل دریافت می‌شوند. نمایش اطلاعات فقط پس از احراز نشست، مجوز دسترسی و تأیید منبع در سرور امکان‌پذیر است.</p>
  {context==="loading"&&<p role="status">در حال بررسی نشست و تعاونی‌های مجاز…</p>}
  {context==="unauthenticated"&&<p role="alert">نشست شما معتبر نیست. از صفحه اصلی دوباره وارد شوید.</p>}
  {context==="unavailable"&&<p role="alert">مرجع شناسایی تعاونی‌ها در دسترس نیست؛ هیچ داده‌ای نمایش داده نمی‌شود.</p>}
  {context==="ready"&&<div className="tto-record-select">
   <label htmlFor="tto-my-tenant">تعاونی مجاز</label>
   <select id="tto-my-tenant" value={selected} onChange={e=>setSelected(e.target.value)}>
    <option value="">یک تعاونی انتخاب کنید</option>
    {tenants.map(t=><option key={t.tenantId} value={t.tenantId}>{t.displayName}{t.evidenceStatus==="EVIDENCE_PENDING"?" — مدارک در انتظار تأیید":""}</option>)}
   </select>
   {tenants.length===0&&<p>هیچ تعاونی دارای زمینه دسترسی معتبر برای نمایش یافت نشد.</p>}
  </div>}
  <div className="tto-record-grid">
   <ReadCard title="وضعیت عضویت" state={member.state}>
    {member.record&&<div>
     <p>وضعیت: <strong>فعال (طبق منبع تأییدشده)</strong></p>
     <p>نوع شخصیت: <strong>{member.record.partyKind==="PERSON"?"حقیقی":"حقوقی"}</strong></p>
     <Provenance version={member.record.sourceVersion} date={member.record.sourceAsOf}/>
    </div>}
   </ReadCard>
   <ReadCard title="موجودی سهام" state={holding.state}>
    {holding.record&&<div>
     <p>تعداد سهام: <strong className="tto-record-quantity" dir="ltr">{holding.record.shareQuantity}</strong></p>
     <Provenance version={holding.record.ledgerVersion} date={holding.record.ledgerAsOf}/>
     <p className="tto-record-caveat">این فقط نمایش نسخه ثبت‌شده است و اجازه خرید، فروش یا انتقال ایجاد نمی‌کند.</p>
    </div>}
   </ReadCard>
  </div>
  <footer className="tto-record-disclosure">
   <strong>محدودیت نسخه آزمایشی:</strong> بدون اتصال و تأیید منابع رسمی، اطلاعات در حالت ناموجود باقی می‌ماند؛ ناموجود مساوی صفر سهم یا عدم عضویت نیست. این صفحه فاقد امکان ثبت، خرید، فروش، پرداخت، انتقال و رأی‌گیری است. داده‌های ساختگی فقط در آزمون‌های CI استفاده می‌شوند.
  </footer>
 </main>;
}
