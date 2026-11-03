"use client";
import {useEffect,useState} from "react";
import {CooperativeSourceReadPanel} from "./cooperative-source-read-panel";
type Surface="shareholder"|"cooperative"|"national";
type Candidate={tenantId:string;displayName:string;evidenceStatus:"MEMBERSHIP_EVIDENCE"|"ROLE_AUTHORITY_EVIDENCE"|"JIT_DOCUMENT_REVIEW_ONLY"|"EVIDENCE_PENDING"};
const titles={
 MEMBERSHIP_EVIDENCE:"پیوند هویت و نمای عضویت فعال شناسایی شد؛ حقوق سهامداری هنوز تأیید نشده است",
 ROLE_AUTHORITY_EVIDENCE:"سند اختیار مدیریت نقش شناسایی شد؛ اختیار انجام عملیات تعاونی مستقل بررسی می‌شود",
 JIT_DOCUMENT_REVIEW_ONLY:"مجوز موقت صرفاً برای بررسی اسناد؛ بدون دسترسی نامحدود به تعاونی‌ها",
 EVIDENCE_PENDING:"تأیید ارتباط شخص، سابقه عضویت یا اختیار قانونی کامل نیست"
};
export function TenantScopePicker({surface,moduleId}:{surface:Surface;moduleId?:string}){
 const [items,setItems]=useState<Candidate[]>([]);
 const [selected,setSelected]=useState("");
 const [busy,setBusy]=useState(false);
 const [member,setMember]=useState<{membershipStatus:string;partyKind:string;sourceVersion:number;sourceAsOf:string}|null>(null);
 const [holding,setHolding]=useState<{shareQuantity:string;ledgerVersion:number;ledgerAsOf:string}|null>(null);
 const [scopeVerified,setScopeVerified]=useState(false);
 const [memberUnavailable,setMemberUnavailable]=useState(false);
 const [holdingUnavailable,setHoldingUnavailable]=useState(false);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState("");
 useEffect(()=>{
  const c=new AbortController();
  setLoading(true);setMessage("");setSelected("");setMember(null);setHolding(null);setScopeVerified(false);setMemberUnavailable(false);setHoldingUnavailable(false);
  fetch("/api/me/tenant-options",{credentials:"same-origin",cache:"no-store",signal:c.signal})
   .then(async res=>{if(!res.ok)throw Error("DENY");return res.json() as Promise<{items:Candidate[]}>;})
   .then(data=>{if(!c.signal.aborted){setItems(data.items);setLoading(false);}})
   .catch(()=>{if(!c.signal.aborted){setItems([]);setMessage("بازیابی مجوزهای تعاونی ممکن نیست؛ دسترسی بسته است.");setLoading(false);}});
  return ()=>c.abort();
 },[surface]);
 // A tenant approval is not a permanent grant. Re-confirm when the user returns to
 // a suspended management page or the short-lived scope check expires.
 useEffect(()=>{
  if(surface==="shareholder"||!scopeVerified)return;
  const expire=()=>setScopeVerified(false);
  const onVisible=()=>{if(document.visibilityState==="visible")expire();};
  const timer=window.setTimeout(expire,60000);
  window.addEventListener("focus",expire);
  document.addEventListener("visibilitychange",onVisible);
  return ()=>{window.clearTimeout(timer);window.removeEventListener("focus",expire);
    document.removeEventListener("visibilitychange",onVisible);};
 },[surface,scopeVerified]);
 const current=items.find(x=>x.tenantId===selected);
 async function verify(){
  if(!current||busy)return;
  if(surface==="cooperative"&&current.evidenceStatus!=="ROLE_AUTHORITY_EVIDENCE"){
   setScopeVerified(false);
   setMessage("سند اختیار مورد نیاز برای این پنل تأیید نشده است؛ دسترسی به ماژول بسته است.");
   return;
  }
  if(surface==="national"&&current.evidenceStatus!=="JIT_DOCUMENT_REVIEW_ONLY"){
   setScopeVerified(false);
   setMessage("مجوز موقت بررسی اسناد فعال نیست؛ دسترسی مدیریت ملی بسته است.");
   return;
  }
  setBusy(true);setMessage("");setMember(null);setHolding(null);setScopeVerified(false);
  setMemberUnavailable(false);setHoldingUnavailable(false);
  try{
   const res=await fetch("/api/tenants/"+current.tenantId+"/context",{credentials:"same-origin",cache:"no-store"});
   const data=await res.json() as {tenantContextVerified?:unknown;tenantId?:unknown};
   if(!res.ok||data.tenantContextVerified!==true||data.tenantId!==current.tenantId){
    setMessage("مجوز دسترسی رد شد؛ هیچ داده اختصاصی نمایش داده نمی‌شود.");
    return;
   }
   setScopeVerified(true);
   setMessage(surface==="shareholder"?
    "محدوده تعاونی تأیید شد. داده‌ها فقط پس از تأیید مستقل منبع عضویت و سهام نمایش داده می‌شوند.":
    "محدوده مجاز تأیید شد؛ اجرای عملیات هر بخش مستلزم تصمیم مجوز جداگانه است.");
   if(surface!=="shareholder")return;
   const p="/api/tenants/"+current.tenantId+"/me/";
   const [m,h]=await Promise.all([
    fetch(p+"member-record",{credentials:"same-origin",cache:"no-store"}),
    fetch(p+"shareholding",{credentials:"same-origin",cache:"no-store"})
   ]);
   if(m.ok){
    const body=await m.json() as {available?:unknown;record?:typeof member};
    if(body.available===true&&body.record)setMember(body.record);
    else setMemberUnavailable(true);
   }else setMemberUnavailable(true);
   if(h.ok){
    const body=await h.json() as {available?:unknown;record?:typeof holding};
    if(body.available===true&&body.record)setHolding(body.record);
    else setHoldingUnavailable(true);
   }else setHoldingUnavailable(true);
  }catch{setMember(null);setHolding(null);setScopeVerified(false);
   setMessage("استعلام مجوز یا منبع معتبر برقرار نیست؛ دسترسی مسدود است.");}
  finally{setBusy(false);}
 }
 return <section className="tenant-picker" aria-label="انتخاب تعاونی مجاز">
  <h2>{surface==="national"?"دسترسی موقت مدیریت ملی":"انتخاب تعاونی مجاز"}</h2>
  <p>این فهرست حق مالکیت سهام، عضویت قطعی یا اختیار امضای قانونی ایجاد نمی‌کند.</p>
  {loading?<p role="status">در حال دریافت تعاونی‌های مجاز...</p>:
   items.length===0?<p role="status">{surface==="national"?"مجوز موقت تأییدشده‌ای وجود ندارد؛ گزارش‌های تجمیعی هنوز فعال نیستند.":"تعاونی مجاز با نقش موردنیاز این پنل یافت نشد."}</p>:
   <div>
    <label htmlFor={"tto-select-"+surface}>تعاونی</label>
    <select id={"tto-select-"+surface} value={selected}
     disabled={busy} onChange={e=>{setSelected(e.target.value);setMessage("");setMember(null);setHolding(null);setScopeVerified(false);setMemberUnavailable(false);setHoldingUnavailable(false);}}>
     <option value="">انتخاب تعاونی...</option>
     {items.map(x=><option key={x.tenantId} value={x.tenantId}>{x.displayName}</option>)}
    </select>
    {current?<p role="status">{titles[current.evidenceStatus]}</p>:null}
    <button type="button" disabled={!current||busy} onClick={()=>{void verify();}}>
      {busy?"در حال استعلام...":"بررسی مجوز محدوده"}
    </button>
   </div>}
  {message?<p role="status" aria-live="polite">{message}</p>:null}
  {surface!=="shareholder"&&scopeVerified?<div className="module-status" role="status" aria-label="محدوده تأییدشده و محدودیت عملیات">
    <strong>محدوده بررسی شد؛ عملیات ماژول فعال نیست</strong>
    <span>{moduleId?moduleId+" — ":""}تأیید محدوده جایگزین اختیار حقوقی و تصمیم دسترسی هر عملیات نیست؛ هیچ اطلاعات محرمانه دیگری بارگذاری نمی‌شود.</span>
   </div>:null}
  {surface==="cooperative"&&scopeVerified&&moduleId&&selected?
    <CooperativeSourceReadPanel key={selected+"-"+moduleId} tenantId={selected} moduleId={moduleId}/>:null}
  {surface==="shareholder"&&scopeVerified?<div aria-label="اطلاعات اختصاصی تأییدشده">
   <h3>وضعیت عضویت</h3>
   {member?<p role="status">عضویت: فعال | نوع شخص: {member.partyKind==="PERSON"?"حقیقی":"حقوقی"} | نسخه منبع: {member.sourceVersion}</p>:
    memberUnavailable?<p role="status">اطلاعات عضویت هنوز از منبع مصوب و قابل‌استناد تأیید نشده است.</p>:null}
   <h3>موجودی سهام بر مبنای دفتر معتبر</h3>
   {holding?<p role="status">تعداد سهام: {holding.shareQuantity} | نسخه دفتر: {holding.ledgerVersion}</p>:
    holdingUnavailable?<p role="status">موجودی معتبر سهام هنوز در دسترس نیست؛ نبود رکورد به معنای صفر سهم نیست.</p>:null}
   <p>نمایش فقط‌خواندنی است؛ معامله، انتقال سهام و محاسبه ارزش فعال نیست.</p>
  </div>:null}
 </section>;
}
