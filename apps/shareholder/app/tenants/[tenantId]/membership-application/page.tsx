"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";

type Case={applicationId:string;status:"PENDING"|"APPROVED"|"REJECTED";version:number;
 submittedAt?:string;decidedAt?:string|null};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const button={minHeight:44,padding:"8px 18px",font:"inherit",cursor:"pointer",borderRadius:8};
const input={width:"100%",maxWidth:520,minHeight:44,padding:"8px 12px",font:"inherit",boxSizing:"border-box" as const};
const labels:Record<Case["status"],string>={PENDING:"در انتظار بررسی",APPROVED:"درخواست تأیید شده؛ عضویت هنوز فعال نشده است",REJECTED:"درخواست رد شده است"};

export default function MembershipApplicationPage(){
 const {tenantId}=useParams<{tenantId:string}>();
 const [partyId,setPartyId]=useState("");
 const [evidenceId,setEvidenceId]=useState("");
 const [record,setRecord]=useState<Case|null>(null);
 const [recordTenant,setRecordTenant]=useState("");
 const [message,setMessage]=useState("برای ثبت درخواست، مرجع هویت تأییدشده و سند منتشرشده در همان تعاونی لازم است.");
 const [busy,setBusy]=useState(false);
 const read=useRef<AbortController|null>(null);
 const visible=recordTenant===tenantId?record:null;
 useEffect(()=>{
  read.current?.abort();
  setRecord(null);setRecordTenant("");setPartyId("");setEvidenceId("");setBusy(false);
  setMessage("شناسه‌های مرجع باید از پرونده تأییدشده CF02 و سند معتبر CF03 دریافت شوند.");
  return ()=>read.current?.abort();
 },[tenantId]);

 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(busy)return;
  if(!UUID.test(tenantId)||!UUID.test(partyId)||!UUID.test(evidenceId)){
   setMessage("شناسه تعاونی، مرجع هویت و سند باید شناسه معتبر باشند.");return;
  }
  const submittedTenant=tenantId;
  setBusy(true);setMessage("در حال ثبت درخواست؛ تأیید آن به معنی فعال‌شدن عضویت نیست.");
  setRecord(null);setRecordTenant("");
  try{
   const res=await fetch("/api/tenants/"+tenantId+"/me/membership-applications",{
    method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({partyId,evidenceId})
   });
   if(res.status===401){setMessage("نشست معتبر نیست؛ ابتدا از پنل سهامدار وارد شوید.");return;}
   if(res.status!==201){setMessage(res.status===403?
    "درخواست پذیرفته نشد؛ پیوند هویت، سند یا رابطه عضویت باید بررسی شود.":
    "ثبت درخواست تأیید نشد؛ پیش از ارسال دوباره وضعیت پرونده را بررسی کنید.");return;}
   const v:unknown=await res.json();
   if(!v||typeof v!=="object"||Array.isArray(v)){setMessage("پاسخ ثبت قابل اعتماد نیست.");return;}
   const x=v as Record<string,unknown>;
   if(!UUID.test(String(x.applicationId))||x.status!=="PENDING"||x.version!==1){
    setMessage("پاسخ ثبت قابل اعتماد نیست؛ وضعیت درخواست باید از سرور استعلام شود.");return;
   }
   setRecord({applicationId:String(x.applicationId),status:"PENDING",version:1});
   setRecordTenant(submittedTenant);
   setMessage("درخواست ثبت شد؛ در صف بررسی مدیر تعاونی است. هنوز هیچ عضویت یا سهمی فعال نشده است.");
  }catch{setMessage("پاسخ سرور نامشخص است؛ از ارسال تکراری خودداری و وضعیت را پیگیری کنید.");}
  finally{setBusy(false);}
 }

 async function refresh(){
  if(!visible||busy)return;
  read.current?.abort();
  const controller=new AbortController();read.current=controller;
  setBusy(true);setMessage("در حال استعلام وضعیت از مرجع معتبر.");
  try{
   const res=await fetch("/api/tenants/"+tenantId+"/me/membership-applications/"+visible.applicationId,{
    method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal:controller.signal
   });
   if(controller.signal.aborted)return;
   if(res.status!==200){
    setRecord(null);setRecordTenant("");
    setMessage(res.status===401?"نشست معتبر نیست؛ مجدداً وارد شوید.":"دسترسی به وضعیت پرونده تأیید نشد.");
    return;
   }
   const body:unknown=await res.json();
   const r=body&&typeof body==="object"&&!Array.isArray(body)?
     (body as {record?:unknown}).record:null;
   if(!r||typeof r!=="object"||Array.isArray(r)){setMessage("پاسخ نامعتبر است.");return;}
   const x=r as Record<string,unknown>;
   if(x.applicationId!==visible.applicationId||
      !["PENDING","APPROVED","REJECTED"].includes(String(x.status))||
      !Number.isSafeInteger(x.version)||Number(x.version)<1){
    setMessage("پاسخ وضعیت معتبر نیست.");return;
   }
   setRecord({applicationId:visible.applicationId,status:x.status as Case["status"],
    version:Number(x.version),submittedAt:String(x.submittedAt??""),
    decidedAt:typeof x.decidedAt==="string"?x.decidedAt:null});
   setRecordTenant(tenantId);setMessage("وضعیت پرونده از سرور دریافت شد.");
  }catch{if(!controller.signal.aborted)setMessage("استعلام وضعیت در دسترس نیست؛ نتیجه قبلی ملاک تأیید جدید نیست.");}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }

 return <main dir="rtl" lang="fa" style={{maxWidth:830,margin:"0 auto",padding:"24px",lineHeight:1.9}}>
  <nav aria-label="مسیر بازگشت"><Link href="/">پنل سهامدار</Link></nav>
  <h1>درخواست عضویت در تعاونی</h1>
  <p>این فرم در همان پنل سهامدار به گردش‌کار Child06 متصل است. ورود یا پیوند هویت به‌تنهایی عضویت ایجاد نمی‌کند.</p>
  <p>مرجع Party و شناسه سند باید قبلاً در CF02 و CF03 تأیید و به تعاونی انتخاب‌شده مرتبط شده باشند.
   این مرحله برای آزمون گردش‌کار است؛ شناسه‌ها را با اطلاعات هویتی اشخاص جایگزین نکنید.</p>
  <form onSubmit={e=>void submit(e)} aria-label="ثبت درخواست عضویت" style={{display:"grid",gap:14,maxWidth:620}}>
   <label htmlFor="member-party-ref">شناسه مرجع هویت تأییدشده (Party)</label>
   <input id="member-party-ref" dir="ltr" autoComplete="off" required pattern="[0-9a-fA-F-]{36}"
    value={partyId} onChange={e=>setPartyId(e.target.value.toLowerCase())}
    disabled={busy} style={input} aria-describedby="member-party-help"/>
   <small id="member-party-help">فقط شناسه مرجع CF02؛ از واردکردن کد ملی، نام یا اطلاعات خصوصی خودداری کنید.</small>
   <label htmlFor="member-evidence-ref">شناسه سند و شاهد معتبر</label>
   <input id="member-evidence-ref" dir="ltr" autoComplete="off" required pattern="[0-9a-fA-F-]{36}"
    value={evidenceId} onChange={e=>setEvidenceId(e.target.value.toLowerCase())}
    disabled={busy} style={input}/>
   <button type="submit" disabled={busy||!UUID.test(tenantId)} style={button}>
    {busy?"در حال پردازش...":"ثبت درخواست برای بررسی"}</button>
  </form>
  <p role="status" aria-live="polite">{message}</p>
  {visible&&<section aria-label="وضعیت پرونده عضویت" style={{marginTop:24,padding:18,border:"1px solid #b8ccd8",borderRadius:12}}>
   <h2>پیگیری درخواست</h2>
   <p>شناسه پرونده: <b dir="ltr" style={{unicodeBidi:"isolate"}}>{visible.applicationId}</b></p>
   <p>وضعیت: {labels[visible.status]}</p>
   <p>نسخه پرونده: {visible.version}</p>
   {visible.submittedAt?<p>تاریخ ثبت: {visible.submittedAt}</p>:null}
   <button type="button" onClick={()=>void refresh()} disabled={busy} style={button}>استعلام وضعیت جدید</button>
  </section>}
  <p>تأیید درخواست، فعال‌سازی عضویت، اعطای رأی یا ایجاد حساب و مالکیت سهام نیست.</p>
 </main>;
}
