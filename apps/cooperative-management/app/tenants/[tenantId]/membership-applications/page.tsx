"use client";
import {useCallback,useEffect,useParams,useRef,useState} from "react";
import Link from "next/link";
type Item={applicationId:string;partyId:string;version:number;submittedAt:string};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const button={minHeight:44,padding:"8px 16px",font:"inherit",cursor:"pointer",borderRadius:8};
export default function MembershipReviewQueue(){
 const {tenantId}=useParams<{tenantId:string}>();
 const [items,setItems]=useState<Item[]>([]);
 const [loadedTenant,setLoadedTenant]=useState("");
 const [evidence,setEvidence]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState("");
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState("");
 const active=useRef<AbortController|null>(null);
 const visible=loadedTenant===tenantId?items:[];
 const refresh=useCallback(async()=>{
  active.current?.abort();
  const controller=new AbortController();active.current=controller;
  setLoading(true);setLoadedTenant("");setItems([]);setEvidence({});
  setMessage("در حال استعلام مجوز مدیریت و دریافت درخواست‌های در انتظار.");
  if(!UUID.test(tenantId)){setLoading(false);setMessage("محدوده تعاونی نامعتبر است.");return;}
  try{
   const res=await fetch("/api/tenants/"+tenantId+"/membership-applications/pending",{
    credentials:"same-origin",cache:"no-store",redirect:"error",signal:controller.signal});
   if(controller.signal.aborted)return;
   if(res.status!==200){
    setMessage(res.status===401?"نشست معتبر نیست؛ وارد پنل مدیریت شوید.":
     "مجوز بررسی درخواست‌های این تعاونی تأیید نشده یا خدمت در دسترس نیست.");
    return;
   }
   const data:unknown=await res.json();
   const arr=data&&typeof data==="object"&&!Array.isArray(data)?
    (data as {items?:unknown}).items:null;
   if(!Array.isArray(arr)||arr.length>30||!arr.every((x:unknown)=>{
    if(!x||typeof x!=="object"||Array.isArray(x))return false;
    const r=x as Record<string,unknown>;
    return typeof r.applicationId==="string"&&UUID.test(r.applicationId)&&
     typeof r.partyId==="string"&&UUID.test(r.partyId)&&
     Number.isSafeInteger(r.version)&&Number(r.version)>0&&
     typeof r.submittedAt==="string"&&Number.isFinite(Date.parse(r.submittedAt));
   })){setMessage("پاسخ سرور قابل اعتماد نیست.");return;}
   setItems(arr as Item[]);setLoadedTenant(tenantId);
   setMessage(arr.length===0?"درخواست مجازِ در انتظار بررسی وجود ندارد.":"درخواست‌های مجاز و دارای نسخه معتبر دریافت شدند.");
  }catch{if(!controller.signal.aborted)setMessage("دریافت صف ممکن نیست؛ هیچ درخواستی مجاز فرض نمی‌شود.");}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[tenantId]);
 useEffect(()=>{void refresh();return ()=>active.current?.abort()},[refresh]);
 async function decide(item:Item,approve:boolean){
  if(busy||loading||loadedTenant!==tenantId)return;
  const id=evidence[item.applicationId]?.trim().toLowerCase()??"";
  if(!UUID.test(id)){setMessage("برای تصمیم، شناسه سند مستقل بررسی را وارد کنید.");return;}
  if(!window.confirm((approve?"تأیید":"رد")+" درخواست با نسخه "+item.version+
    " ثبت شود؟ این تصمیم عضویت را فعال نمی‌کند."))return;
  setBusy(item.applicationId);
  setMessage("در حال ثبت تصمیم مستند؛ هیچ فعال‌سازی خودکاری انجام نمی‌شود.");
  try{
   const res=await fetch("/api/tenants/"+tenantId+"/membership-applications/"+
    item.applicationId+"/decision",{
     method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({approve,expectedVersion:item.version,decisionEvidenceId:id})
    });
   if(res.status===201){
    const data:unknown=await res.json();
    if(!data||typeof data!=="object"||(data as {recorded?:unknown}).recorded!==true)
     throw Error("UNEXPECTED_RESPONSE");
    setMessage("تصمیم ثبت شد؛ این نتیجه عضویت یا سهام را فعال نمی‌کند.");
   }else{
    setMessage(res.status===409?"نسخه پرونده تغییر کرده؛ صف باید دوباره دریافت شود.":
     res.status===401?"نشست منقضی شده؛ دسترسی لغو شد.":
     "تصمیم رد شد؛ مجوز، سند، نسخه یا شرایط پرونده معتبر نیست.");
   }
  }catch{setMessage("نتیجه ثبت تصمیم نامشخص است؛ پیش از اقدام دوباره نسخه پرونده را استعلام کنید.");}
  finally{
   setBusy("");
   // Fail closed even after success: no optimistic removal; reload authorization and version.
   void refresh();
  }
 }
 return <main dir="rtl" lang="fa" style={{maxWidth:1000,margin:"0 auto",padding:"24px",lineHeight:1.9}}>
  <nav aria-label="مسیر بازگشت"><Link href="/">پنل مدیریت تعاونی</Link></nav>
  <h1>بررسی درخواست‌های عضویت</h1>
  <p>صرف نقش مدیر مجوز تصمیم‌گیری نیست. فهرست و ثبت تصمیم فقط بعد از بررسی مستقل
   مجوز مدیر، قواعد و شواهد مربوط به همین تعاونی انجام می‌شود.</p>
  <button type="button" onClick={()=>void refresh()} disabled={loading||Boolean(busy)} style={button}>
   {loading?"در حال دریافت...":"به‌روزرسانی صف بررسی"}</button>
  <p role="status" aria-live="polite">{message}</p>
  {visible.length>0?<section aria-labelledby="member-review-list">
   <h2 id="member-review-list">پرونده‌های در انتظار تصمیم</h2>
   <ol style={{display:"grid",gap:16,paddingInlineStart:25}}>
    {visible.map(item=><li key={item.applicationId} style={{border:"1px solid #b8ccd8",borderRadius:12,padding:18}}>
     <p>شناسه درخواست: <b dir="ltr" style={{unicodeBidi:"isolate"}}>{item.applicationId}</b></p>
     <p>مرجع Party تأییدشده: <span dir="ltr" style={{unicodeBidi:"isolate"}}>{item.partyId}</span></p>
     <p>نسخه مورد انتظار: {item.version}</p><p>زمان ثبت: {item.submittedAt}</p>
     <label htmlFor={"decision-evidence-"+item.applicationId}>شناسه سند مستقل تصمیم مدیر</label>
     <input id={"decision-evidence-"+item.applicationId} required dir="ltr" autoComplete="off"
      placeholder="UUID شاهد مستقل CF03" value={evidence[item.applicationId]??""}
      disabled={Boolean(busy)||loading} onChange={e=>setEvidence(v=>({...v,[item.applicationId]:e.target.value}))}
      style={{display:"block",minHeight:44,padding:10,font:"inherit",width:"100%",maxWidth:500,boxSizing:"border-box"}}/>
     <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:12}}>
      <button type="button" disabled={Boolean(busy)||loading} onClick={()=>void decide(item,true)} style={button}>تأیید درخواست</button>
      <button type="button" disabled={Boolean(busy)||loading} onClick={()=>void decide(item,false)} style={button}>رد درخواست</button>
     </div>
    </li>)}
   </ol>
  </section>:null}
  <p>ثبت تصمیم، دستور مستقل ActivateRelationship نیست؛ بدون آن هیچ نقش MEMBER، حساب سهامداری یا حق رأی ایجاد نمی‌شود.</p>
 </main>;
}
