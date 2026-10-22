"use client";
import {useEffect,useState} from "react";
type Surface="shareholder"|"cooperative"|"national";
type Candidate={tenantId:string;displayName:string;evidenceStatus:"MEMBERSHIP_EVIDENCE"|"ROLE_AUTHORITY_EVIDENCE"|"JIT_DOCUMENT_REVIEW_ONLY"|"EVIDENCE_PENDING"};
const titles={
 MEMBERSHIP_EVIDENCE:"پیوند هویت و نمای عضویت فعال شناسایی شد؛ حقوق سهامداری هنوز تأیید نشده است",
 ROLE_AUTHORITY_EVIDENCE:"سند اختیار مدیریت نقش شناسایی شد؛ اختیار انجام عملیات تعاونی مستقل بررسی می‌شود",
 JIT_DOCUMENT_REVIEW_ONLY:"مجوز موقت صرفاً برای بررسی اسناد؛ بدون دسترسی نامحدود به تعاونی‌ها",
 EVIDENCE_PENDING:"تأیید ارتباط شخص، سابقه عضویت یا اختیار قانونی کامل نیست"
};
export function TenantScopePicker({surface}:{surface:Surface}){
 const [items,setItems]=useState<Candidate[]>([]);
 const [selected,setSelected]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState("");
 useEffect(()=>{
  const c=new AbortController();
  setLoading(true);setMessage("");setSelected("");
  fetch("/api/me/tenant-options",{credentials:"same-origin",cache:"no-store",signal:c.signal})
   .then(async res=>{if(!res.ok)throw Error("DENY");return res.json() as Promise<{items:Candidate[]}>;})
   .then(data=>{if(!c.signal.aborted){setItems(data.items);setLoading(false);}})
   .catch(()=>{if(!c.signal.aborted){setItems([]);setMessage("بازیابی مجوزهای تعاونی ممکن نیست؛ دسترسی بسته است.");setLoading(false);}});
  return ()=>c.abort();
 },[surface]);
 const current=items.find(x=>x.tenantId===selected);
 async function verify(){
  if(!current||busy)return;
  setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/tenants/"+current.tenantId+"/context",{credentials:"same-origin",cache:"no-store"});
   const data=await res.json() as {tenantContextVerified?:unknown;tenantId?:unknown};
   setMessage(res.ok&&data.tenantContextVerified===true&&data.tenantId===current.tenantId?
    "محدوده تعاونی تأیید شد. اطلاعات اختصاصی و عملیات تا تکمیل مجوز دامنه غیرفعال است.":
    "مجوز دسترسی رد شد؛ هیچ داده اختصاصی نمایش داده نمی‌شود.");
  }catch{setMessage("استعلام مجوز برقرار نیست؛ دسترسی مسدود است.");}
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
     onChange={e=>{setSelected(e.target.value);setMessage("");}}>
     <option value="">انتخاب تعاونی...</option>
     {items.map(x=><option key={x.tenantId} value={x.tenantId}>{x.displayName}</option>)}
    </select>
    {current?<p role="status">{titles[current.evidenceStatus]}</p>:null}
    <button type="button" disabled={!current||busy} onClick={()=>{void verify();}}>
      {busy?"در حال استعلام...":"بررسی مجوز محدوده"}
    </button>
   </div>}
  {message?<p role="status" aria-live="polite">{message}</p>:null}
 </section>;
}
