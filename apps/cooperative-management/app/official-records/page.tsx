"use client";
import {useEffect,useState} from "react";
type Tenant={tenantId:string;displayName:string;evidenceStatus:string};
type Form={
 personFullName:string;officeType:string;signingMode:string;authorityScope:string;
 gazetteIssueNumber:string;gazettePublicationDate:string;gazetteAnnouncementNumber:string;
 effectiveFrom:string;effectiveUntil:string;officialReferenceUrl:string;supersedesClaimId:string;
};
type HistoryRow=Form & {
 claimId:string;status:"SELF_REPORTED_PENDING_REVIEW";createdAt:string;
 hasCorrection:boolean;supersedesClaimId:string|null;effectiveFrom:string|null;
 effectiveUntil:string|null;officialReferenceUrl:string|null;
};
const EMPTY:Form={personFullName:"",officeType:"BOARD_MEMBER",signingMode:"NONE",
 authorityScope:"",gazetteIssueNumber:"",gazettePublicationDate:"",
 gazetteAnnouncementNumber:"",effectiveFrom:"",effectiveUntil:"",
 officialReferenceUrl:"",supersedesClaimId:""};
const OFFICES:[string,string][]=[
 ["BOARD_CHAIR","رئیس هیئت‌مدیره"],["BOARD_VICE_CHAIR","نایب‌رئیس هیئت‌مدیره"],
 ["BOARD_MEMBER","عضو هیئت‌مدیره"],["CEO","مدیرعامل"],
 ["AUTHORIZED_SIGNATORY","صاحب امضای مجاز"],["INSPECTOR","بازرس"],["OTHER","سایر"]
];
const SIGNING:[string,string][]=[
 ["NONE","فاقد حق امضای مستقل"],["INDIVIDUAL","امضای انفرادی"],
 ["JOINT","امضای مشترک"],["BOARD_RESOLUTION","طبق مصوبه هیئت‌مدیره"],
 ["OTHER_SPECIFIED","سایر شرایط مندرج در آگهی"]
];
const fieldStyle={width:"100%",boxSizing:"border-box" as const,border:"1px solid #b4c8ce",
 borderRadius:9,padding:"11px 12px",font:"inherit",background:"#fff",color:"#19323a"};
const labelStyle={display:"grid",gap:6,fontSize:14,fontWeight:650 as const};
export default function OfficialRecordsPage(){
 const [tenants,setTenants]=useState<Tenant[]>([]);
 const [tenantId,setTenantId]=useState("");
 const [form,setForm]=useState<Form>({...EMPTY});
 const [requestKey,setRequestKey]=useState("");
 const [busy,setBusy]=useState(false);
 const [phase,setPhase]=useState<"loading"|"ready"|"denied"|"unavailable">("loading");
 const [message,setMessage]=useState("");
 const [recordId,setRecordId]=useState("");
 const [history,setHistory]=useState<HistoryRow[]>([]);
 const [historyError,setHistoryError]=useState("");
 const [historyMore,setHistoryMore]=useState(false);
 const [historyVersion,setHistoryVersion]=useState(0);
 useEffect(()=>{
  let alive=true;
  void fetch("/api/me/tenant-options",{credentials:"same-origin",cache:"no-store"})
   .then(async r=>{
    if(!alive)return;
    if(r.status===401||r.status===403){setPhase("denied");return;}
    if(!r.ok){setPhase("unavailable");return;}
    const body=await r.json() as {items?:Tenant[]};
    const allowed=Array.isArray(body.items)?body.items.filter(
      x=>x.evidenceStatus==="ROLE_AUTHORITY_EVIDENCE"):[];
    setTenants(allowed);
    setTenantId(allowed[0]?.tenantId??"");
    setPhase("ready");
   }).catch(()=>{if(alive)setPhase("unavailable")});
  return()=>{alive=false;};
 },[]);
 useEffect(()=>{
  if(phase!=="ready"||!tenantId){setHistory([]);setHistoryError("");return;}
  const abort=new AbortController();
  setHistory([]);
  setHistoryError("");
  void fetch("/api/tenants/"+encodeURIComponent(tenantId)+"/official-notices",{
   credentials:"same-origin",cache:"no-store",signal:abort.signal
  }).then(async r=>{
   if(!r.ok)throw Error("AUTHORITY_OR_HISTORY_UNAVAILABLE");
   const data=await r.json() as {
    items?:HistoryRow[];hasMore?:boolean;selfReportedOnly?:boolean;
    officiallyVerified?:boolean;legalApproval?:boolean;roleGranted?:boolean
   };
   if(!Array.isArray(data.items)||data.items.length>100||
      data.selfReportedOnly!==true||data.officiallyVerified!==false||
      data.legalApproval!==false||data.roleGranted!==false)
    throw Error("UNSAFE_HISTORY_RESPONSE");
   if(!abort.signal.aborted){setHistory(data.items);setHistoryMore(data.hasMore===true);}
  }).catch(()=>{
   if(!abort.signal.aborted){setHistory([]);setHistoryError(
    "سوابق قابل بازیابی نیستند؛ هیچ اطلاعاتی بدون مجوز نمایش داده نمی‌شود.");}
  });
  return()=>abort.abort();
 },[phase,tenantId,historyVersion]);
 const correctClaim=(row:HistoryRow)=>{
  if(row.hasCorrection||busy)return;
  setForm({
   personFullName:row.personFullName,officeType:row.officeType,
   signingMode:row.signingMode,authorityScope:row.authorityScope,
   gazetteIssueNumber:"",gazettePublicationDate:"",gazetteAnnouncementNumber:"",
   effectiveFrom:row.effectiveFrom??"",effectiveUntil:row.effectiveUntil??"",
   officialReferenceUrl:"",supersedesClaimId:row.claimId
  });
  setRequestKey("");setRecordId("");
  setMessage("نسخه اصلاحی ایجاد شد. مشخصات آگهی جدید را وارد کنید؛ سابقه قبلی حفظ می‌شود.");
  window.scrollTo({top:0,behavior:"smooth"});
 };
 const change=(key:keyof Form,value:string)=>{
  setForm(old=>({...old,[key]:value}));setRequestKey("");setRecordId("");setMessage("");
 };
 async function submit(e:React.FormEvent){
  e.preventDefault();
  if(phase!=="ready"||!tenantId||busy)return;
  setBusy(true);setMessage("");
  const key=requestKey||crypto.randomUUID();
  if(!requestKey)setRequestKey(key);
  try{
   const response=await fetch("/api/tenants/"+encodeURIComponent(tenantId)+"/official-notices",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...form,requestKey:key})
   });
   if(response.status===401||response.status===403){
    setPhase("denied");setMessage("نشست یا اختیار قانونی مدیریت تعاونی تأیید نشد.");return;
   }
   if(!response.ok){
    setMessage("ثبت اطلاعات انجام نشد؛ شماره روزنامه، تاریخ، شماره آگهی و حدود اختیارات را بررسی کنید.");return;
   }
   const receipt=await response.json() as{
    claimId?:string;status?:string;roleGranted?:boolean;officiallyVerified?:boolean;
   };
   if(!receipt.claimId||receipt.status!=="SELF_REPORTED_PENDING_REVIEW"||
      receipt.roleGranted!==false||receipt.officiallyVerified!==false)
    throw Error("INVALID_RECEIPT");
   setRecordId(receipt.claimId);
   setHistoryVersion(v=>v+1);
   setMessage("اطلاعات به عنوان اظهار مدیریت ثبت شد و در انتظار بررسی حقوقی است؛ هیچ سمت یا اختیار اجرایی تأیید نشده است.");
   setRequestKey("");
  }catch{setMessage("نتیجه ثبت نامشخص است؛ بدون تغییر اطلاعات می‌توانید با همان شناسه درخواست دوباره تلاش کنید.");}
  finally{setBusy(false);}
 }
 return <main dir="rtl" style={{fontFamily:"var(--tto-font),sans-serif",
   padding:"clamp(16px,4vw,40px)",maxWidth:1040,margin:"0 auto",color:"#19323a"}}>
  <nav><a href="/" style={{color:"#166778"}}>بازگشت به پنل مدیریت تعاونی</a></nav>
  <h1 style={{fontSize:"clamp(22px,3vw,32px)",marginTop:24}}>
   ثبت دستی آخرین اطلاعات آگهی‌های رسمی تعاونی
  </h1>
  <p style={{lineHeight:2,color:"#42636d"}}>
   ثبت اطلاعات هیئت‌مدیره، مدیرعامل و صاحبان امضا براساس آگهی‌های روزنامه رسمی.
   برای هر سمت و هر دامنه اختیار باید شماره روزنامه رسمی، تاریخ انتشار و شماره آگهی درج شود.
  </p>
  <aside role="note" style={{background:"#fff8e6",border:"1px solid #d7bd78",
    padding:16,borderRadius:12,lineHeight:2,marginBottom:22}}>
   این فرم فقط «اظهار مدیریت» را ثبت می‌کند. شماره آگهی و بارگذاری اطلاعات به‌تنهایی
   به معنی احراز اصالت سند، تأیید سمت، اعطای حق امضا، تغییر نقش سامانه یا انتشار برای سهامداران نیست.
   بررسی حقوقی مستقل الزامی است. هیچ استعلام پولی رسمیو انجام نمی‌شود.
  </aside>
  {phase==="loading"?<p role="status">در حال بررسی نشست و تعاونی‌های مجاز…</p>:null}
  {phase==="denied"?<p role="alert">دسترسی مجاز مدیریت تعاونی احراز نشد؛ ابتدا از طریق پنل وارد شوید.</p>:null}
  {phase==="unavailable"?<p role="alert">خدمات ثبت اسناد حقوقی فعلاً در دسترس نیست.</p>:null}
  {phase==="ready"&&tenants.length===0?<p role="status">تعاونی فعال با اختیار مدیریتی تأییدشده یافت نشد.</p>:null}
  {phase==="ready"&&tenants.length>0?<form onSubmit={e=>void submit(e)}
    style={{display:"grid",gap:20,background:"#f6fafb",borderRadius:14,padding:22}}>
   <label style={labelStyle}>تعاونی مجاز
    <select required value={tenantId} onChange={e=>{setTenantId(e.target.value);setRequestKey("");}}
     style={fieldStyle}>{tenants.map(t=><option key={t.tenantId} value={t.tenantId}>{t.displayName}</option>)}</select>
   </label>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:16}}>
    <label style={labelStyle}>نام و نام خانوادگی شخص
     <input required maxLength={160} minLength={3} value={form.personFullName}
      onChange={e=>change("personFullName",e.target.value)} style={fieldStyle}/></label>
    <label style={labelStyle}>عنوان سمت
     <select value={form.officeType} onChange={e=>change("officeType",e.target.value)}
      style={fieldStyle}>{OFFICES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label style={labelStyle}>نوع حق امضا
     <select value={form.signingMode} onChange={e=>change("signingMode",e.target.value)}
      style={fieldStyle}>{SIGNING.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   </div>
   <label style={labelStyle}>شرح دامنه اختیارات و شرایط امضا طبق آگهی
    <textarea required minLength={10} maxLength={1500} rows={4}
     value={form.authorityScope} onChange={e=>change("authorityScope",e.target.value)}
     style={fieldStyle} placeholder="برای امضای مشترک، اشخاص و محدودیت‌های مندرج در آگهی را دقیق بنویسید."/></label>
   <fieldset style={{border:"1px solid #b4c8ce",borderRadius:10,padding:16}}>
    <legend style={{fontWeight:700}}>استناد الزامی به روزنامه رسمی کشور</legend>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:16}}>
     <label style={labelStyle}>شماره روزنامه رسمی
      <input required inputMode="numeric" pattern="[0-9]{1,20}" maxLength={20}
       value={form.gazetteIssueNumber} onChange={e=>change("gazetteIssueNumber",e.target.value)}
       style={fieldStyle}/></label>
     <label style={labelStyle}>تاریخ انتشار روزنامه رسمی
      <input required type="date" value={form.gazettePublicationDate}
       onChange={e=>change("gazettePublicationDate",e.target.value)} style={fieldStyle}/></label>
     <label style={labelStyle}>شماره آگهی روزنامه رسمی
      <input required maxLength={40} pattern="[0-9A-Za-z-]{1,40}"
       value={form.gazetteAnnouncementNumber}
       onChange={e=>change("gazetteAnnouncementNumber",e.target.value)} style={fieldStyle}/></label>
    </div>
    <p style={{fontSize:12,color:"#46666e"}}>شماره روزنامه رسمی و شماره آگهی دو شناسه متفاوت هستند. تاریخ به شکل استاندارد ذخیره می‌شود.</p>
   </fieldset>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>
    <label style={labelStyle}>شروع اعتبار سمت (در صورت ذکر در آگهی)
     <input type="date" value={form.effectiveFrom}
      onChange={e=>change("effectiveFrom",e.target.value)} style={fieldStyle}/></label>
    <label style={labelStyle}>پایان اعتبار سمت (در صورت ذکر در آگهی)
     <input type="date" value={form.effectiveUntil}
      onChange={e=>change("effectiveUntil",e.target.value)} style={fieldStyle}/></label>
    <label style={labelStyle}>پیوند سند در منبع رسمی (اختیاری)
     <input type="url" maxLength={400} placeholder="https://..."
      value={form.officialReferenceUrl} onChange={e=>change("officialReferenceUrl",e.target.value)}
      style={fieldStyle}/></label>
    <label style={labelStyle}>شناسه سابقه قبلی برای اصلاح (اختیاری)
     <input readOnly maxLength={36} placeholder="از فهرست سوابق انتخاب کنید"
      value={form.supersedesClaimId} style={{...fieldStyle,background:"#edf4f5"}}/></label>
   </div>
   <button type="submit" disabled={busy} style={{padding:13,border:0,borderRadius:8,
     background:"#145d69",color:"#fff",font:"inherit",cursor:"pointer"}}>
     {busy?"در حال ثبت…":"ثبت اظهار مدیریت و ارجاع به بررسی حقوقی"}
   </button>
   {message?<p role="status" aria-live="polite">{message}</p>:null}
   {recordId?<p>شناسه ثبت برای پیگیری: <code dir="ltr">{recordId}</code></p>:null}
  </form>:null}
  {phase==="ready"&&tenantId?<section aria-labelledby="gazette-history-title"
    style={{marginTop:28,border:"1px solid #c4d6db",borderRadius:12,padding:20}}>
   <h2 id="gazette-history-title">سوابق ثبت‌شده آگهی‌ها و اصلاحات</h2>
   <p style={{lineHeight:2}}>این سوابق فقط اظهار مدیریت هستند و تأیید سمت یا حق امضا محسوب نمی‌شوند.
    اصلاح هر سابقه با یک رکورد جدید و شماره آگهی مستقل ثبت می‌شود.</p>
   {historyError?<p role="alert">{historyError}</p>:null}
   {!historyError&&history.length===0?<p role="status">سابقه‌ای برای این تعاونی ثبت نشده است.</p>:null}
   {history.map(row=><article key={row.claimId}
     style={{border:"1px solid #dce8eb",borderRadius:8,padding:15,marginBottom:12}}>
    <h3 style={{marginTop:0}}>{row.personFullName} — {
      OFFICES.find(x=>x[0]===row.officeType)?.[1]??"سمت اظهارشده"}</h3>
    <p>روزنامه رسمی شماره <b dir="ltr">{row.gazetteIssueNumber}</b>،
     تاریخ انتشار <time dir="ltr">{row.gazettePublicationDate}</time>،
     شماره آگهی <b dir="ltr">{row.gazetteAnnouncementNumber}</b></p>
    <p>نوع حق امضا: {SIGNING.find(x=>x[0]===row.signingMode)?.[1]??"اظهار مدیریت"}</p>
    <p style={{whiteSpace:"pre-wrap"}}>دامنه اختیار اظهارشده: {row.authorityScope}</p>
    <p style={{color:"#7a5721"}}>وضعیت: در انتظار بررسی حقوقی مستقل</p>
    {row.hasCorrection?<p>برای این سابقه، اصلاحیه جدید ثبت شده است.</p>:
      <button type="button" onClick={()=>correctClaim(row)} disabled={busy}
       style={{padding:"8px 12px",border:"1px solid #8da7ad",borderRadius:6,
        background:"#f1f8fa",cursor:"pointer"}}>
       ثبت اصلاحیه جدید با حفظ سابقه
      </button>}
    <p style={{fontSize:12,overflowWrap:"anywhere"}}>شناسه سابقه: <code dir="ltr">{row.claimId}</code></p>
   </article>)}
   {historyMore?<p role="status">فقط ۱۰۰ سابقه جدید نمایش داده شده است؛ بازیابی سوابق قدیمی‌تر
    نیازمند صفحه‌بندی و کنترل مجوز مجدد است.</p>:null}
  </section>:null}
 </main>;
}
