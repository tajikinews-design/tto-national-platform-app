"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
type Notice={noticeId:string;sourceType:string;noticeKind:string;sourceNoticeNumber:string|null;
 resolutionOn:string;publishedOn:string|null;provenance:string};
type Transition={transitionId:string;targetNoticeId:string;replacementNoticeId:string|null;
 action:string;effectiveOn:string;publishedOn:string|null;sourceReference:string};
type Catalog={available:true;verified:false;notices:Notice[];transitions:Transition[]};
const field={padding:"8px 10px",border:"1px solid #b5c9d1",borderRadius:7,width:"100%",
 boxSizing:"border-box" as const,font:"inherit"};
const row={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12};
const label=(n:Notice)=>[n.sourceType==="OFFICIAL_GAZETTE"?"روزنامه رسمی":"ثبت شرکت‌ها",
 n.sourceNoticeNumber||"بدون شماره منبع",n.resolutionOn,n.noticeId.slice(0,8)].join(" | ");
export default function NoticeTransitionManager({tenantId}:{tenantId:string}){
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [loadError,setLoadError]=useState("");
 const [action,setAction]=useState<"CORRECTED"|"REVOKED">("CORRECTED");
 const [target,setTarget]=useState("");
 const [replacement,setReplacement]=useState("");
 const [effective,setEffective]=useState("");
 const [published,setPublished]=useState("");
 const [reference,setReference]=useState("");
 const [requestKey,setRequestKey]=useState("");
 const [pending,setPending]=useState(false);
 const [message,setMessage]=useState("");
 const load=useCallback(async()=>{
  setCatalog(null);setLoadError("");
  if(!tenantId)return;
  try{
   const r=await fetch("/api/tenants/"+encodeURIComponent(tenantId)+"/notice-transitions",
    {credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error("SOURCE_UNAVAILABLE");
   const data=await r.json() as Catalog;
   if(data.available!==true||data.verified!==false||!Array.isArray(data.notices)||
     !Array.isArray(data.transitions))throw Error("UNSAFE_SOURCE");
   setCatalog(data);
   setTarget(prev=>data.notices.some(x=>x.noticeId===prev)?prev:data.notices[0]?.noticeId??"");
   setReplacement(prev=>data.notices.some(x=>x.noticeId===prev)?prev:"");
  }catch{setLoadError("فهرست آگهی‌ها در دسترس نیست؛ ثبت اصلاحیه یا ابطال تا دریافت منبع معتبر متوقف است.");}
 },[tenantId]);
 useEffect(()=>{void load();setRequestKey("");},[load]);
 const resetKey=()=>setRequestKey("");
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!tenantId||pending||!catalog||!target)return;
  const key=requestKey||crypto.randomUUID();setRequestKey(key);
  setMessage("");setPending(true);
  try{
   const payload={requestKey:key,targetNoticeId:target,
      replacementNoticeId:action==="CORRECTED"?replacement:null,
      action,effectiveOn:effective,publishedOn:published||null,sourceReference:reference};
   const r=await fetch("/api/tenants/"+encodeURIComponent(tenantId)+"/notice-transitions",{
    method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
    body:JSON.stringify(payload),cache:"no-store"});
   if(!r.ok){setMessage("ثبت انجام نشد ("+r.status+"). تغییر اطلاعات یا تلاش دوباره با همان شناسه درخواست امکان‌پذیر است.");return;}
   const result=await r.json() as {transitionId?:string;state?:string;verified?:boolean};
   if(result.state!=="USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED"||
      result.verified!==false||!result.transitionId)throw Error("UNSAFE_RECEIPT");
   setMessage("رویداد با شناسه "+result.transitionId+
    " ثبت شد؛ منبع هنوز اصالت‌سنجی نشده و هیچ حق امضایی اعطا نمی‌شود.");
   setRequestKey("");setReference("");setEffective("");setPublished("");
   await load();
  }catch{setMessage("وضعیت ثبت نامشخص است. برای جلوگیری از تکرار، همین فرم و شناسه درخواست را حفظ کنید.");}
  finally{setPending(false);}
 }
 return <section dir="rtl" aria-labelledby="transition-title" style={{marginTop:28,
   border:"1px solid #d2e2e8",padding:18,borderRadius:12,background:"#fff"}}>
  <h2 id="transition-title">مدیریت اصلاحیه‌ها و ابطال آگهی‌ها</h2>
  <p>این ثبت، رویدادی جدید و غیرقابل‌ویرایش به تاریخچه اضافه می‌کند؛ آگهی اصلی
   حذف نمی‌شود. ابتدا آگهی جدید را در فرم بالا ثبت کنید، سپس به‌عنوان جانشین انتخاب کنید.</p>
  <aside role="note" style={{background:"#fff5dc",padding:12,borderRadius:8}}>
   هم‌زمانی چند اصلاحیه، زنجیره دوری و ابهام تاریخ انتشار در موتور بازسازی
   با وضعیت تعارض یا HOLD گزارش می‌شود. این فرم هیچ اختیار قانونی امضا ایجاد نمی‌کند.
  </aside>
  <button type="button" onClick={()=>void load()} disabled={pending||!tenantId}
   style={{margin:"14px 0"}}>بازخوانی فهرست و تاریخچه</button>
  {loadError&&<p role="alert">{loadError}</p>}
  {catalog&&<>
   <form onSubmit={e=>void submit(e)} style={{display:"grid",gap:12,marginTop:14}}>
    <div style={row}>
     <label>نوع رویداد<select value={action} style={field} onChange={e=>{
       setAction(e.target.value as "CORRECTED"|"REVOKED");resetKey();}}>
      <option value="CORRECTED">اصلاح آگهی</option><option value="REVOKED">ابطال آگهی</option>
     </select></label>
     <label>آگهی پیشین / هدف<select required value={target} style={field}
       onChange={e=>{setTarget(e.target.value);resetKey();}}>
       <option value="">انتخاب آگهی</option>
       {catalog.notices.map(n=><option key={n.noticeId} value={n.noticeId}>{label(n)}</option>)}
     </select></label>
     {action==="CORRECTED"&&<label>آگهی جانشین (قبلاً ثبت‌شده)
      <select required value={replacement} style={field}
       onChange={e=>{setReplacement(e.target.value);resetKey();}}>
       <option value="">انتخاب آگهی جانشین</option>
       {catalog.notices.filter(n=>n.noticeId!==target).map(n=>
        <option key={n.noticeId} value={n.noticeId}>{label(n)}</option>)}
      </select></label>}
     <label>تاریخ اثر ادعاشده<input required style={field} placeholder="1404/10/10"
       pattern="14[0-9]{2}/[0-1][0-9]/[0-3][0-9]"
       value={effective} onChange={e=>{setEffective(e.target.value);resetKey();}}/></label>
     <label>تاریخ انتشار مستند<input style={field} placeholder="1404/10/11"
       pattern="14[0-9]{2}/[0-1][0-9]/[0-3][0-9]"
       value={published} onChange={e=>{setPublished(e.target.value);resetKey();}}/></label>
    </div>
    <label>مرجع و توضیح اصلاحیه/ابطال (بدون شناسه ملی اشخاص حقیقی)
     <textarea required minLength={10} maxLength={300} rows={3} style={field}
      value={reference} onChange={e=>{setReference(e.target.value);resetKey();}}/>
    </label>
    <button type="submit" disabled={pending||!target||
      (action==="CORRECTED"&&(!replacement||replacement===target))}
      style={{padding:"10px 18px",background:"#146b77",color:"#fff",borderRadius:8}}>
      {pending?"در حال ثبت…":"ثبت رویداد بدون حذف سابقه"}
    </button>
   </form>
   {message&&<p role="status" aria-live="polite">{message}</p>}
   <h3>سوابق اصلاحیه و ابطال ({catalog.transitions.length})</h3>
   {catalog.transitions.length===0?<p>هنوز رویدادی ثبت نشده است.</p>:
    <ul>{catalog.transitions.map(t=><li key={t.transitionId}>
      <strong>{t.action==="CORRECTED"?"اصلاح":"ابطال"}</strong> ـ هدف:
      {" "+t.targetNoticeId.slice(0,8)} ـ جانشین:
      {" "+(t.replacementNoticeId?.slice(0,8)??"ندارد")} ـ تاریخ اثر:
      {" "+t.effectiveOn} ـ انتشار: {t.publishedOn??"نامشخص"}
      <div><small>{t.sourceReference} — اصالت بررسی نشده</small></div>
     </li>)}</ul>}
  </>}
 </section>;
}
