"use client";
import {useEffect,useState,type FormEvent} from "react";
import {JalaliDatePicker,gregorianISOToJalali,jalaliToGregorianISO} from "../members/jalali-birth-picker";
import {OfficerMemberPicker} from "./officer-member-picker";

type OfficerDocument={id:string;subject:string;mime:string;filename:string;size:number;createdAt:string};
type Officer={id:string;version:number;officeCode:string;memberDraftId:string|null;memberName?:string|null;
 externalName:string|null;ceoSource:"MEMBER"|"EXTERNAL";signingAuthorized:boolean;
 signingScope:string;startDate:string;endDate:string;gazetteName:string;
 gazetteDate:string|null;gazetteIssue:string;noticeNumber:string;status:string;
 documents?:OfficerDocument[]};
const offices=[
 ["BOARD_CHAIR","رئیس هیئت‌مدیره"],["BOARD_VICE_CHAIR","نایب‌رئیس هیئت‌مدیره"],
 ["CEO","مدیرعامل"],["BOARD_MEMBER","عضو هیئت‌مدیره"],
 ["BOARD_SECRETARY","منشی هیئت‌مدیره"],["AUDITOR_PRIMARY","بازرس اصلی"],
 ["AUDITOR_ALT1","بازرس علی‌البدل اول"],["AUDITOR_ALT2","بازرس علی‌البدل دوم"]
] as const;
const empty={officeCode:"BOARD_CHAIR",ceoSource:"MEMBER",memberDraftId:"",
 externalName:"",signingAuthorized:false,signingScope:"",startDate:"",
 endDate:"",gazetteName:"",gazetteDate:"",gazetteIssue:"",noticeNumber:""};
function fromApiDate(value:string|null|undefined):string{
 return value?gregorianISOToJalali(value.slice(0,10)):"";
}
function displayJalaliDate(value:string|null|undefined):string{
 const j=fromApiDate(value);
 return j?j.replace(/[0-9]/g,d=>Number(d).toLocaleString("fa-IR")):"—";
}
function Icon({name}:{name:"edit"|"history"|"delete"|"download"}){
 const p={width:17,height:17,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",
  strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true as const};
 return <svg {...p}>
  {name==="edit"?<><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>:null}
  {name==="history"?<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 3M3 3v5h5"/></>:null}
  {name==="delete"?<><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7m4-7v7"/></>:null}
  {name==="download"?<><path d="M12 3v12m0 0-5-5m5 5 5-5M4 17v4h16v-4"/></>:null}
 </svg>;
}
export function OfficersSettings({slug}:{slug:string}){
 const [items,setItems]=useState<Officer[]>([]);
 const [form,setForm]=useState(empty);
 const [memberLabel,setMemberLabel]=useState("");
 const [editTarget,setEditTarget]=useState<{id:string;version:number}|null>(null);
 const [historyId,setHistoryId]=useState("");
 const [history,setHistory]=useState<{versionBefore:number;versionAfter:number;revisedAt:string;
  previous:Record<string,unknown>}[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [officerUnavailable,setOfficerUnavailable]=useState(false);
 const [file,setFile]=useState<File|null>(null),[documentSubject,setDocumentSubject]=useState("آگهی رسمی انتصاب");
 const [archiveTarget,setArchiveTarget]=useState<Officer|null>(null),[archiveConfirmed,setArchiveConfirmed]=useState(false);
 const base="/api/commerce/nav02/officers";
 async function load(){
  const r=await fetch(base+"?slug="+encodeURIComponent(slug),{credentials:"same-origin",cache:"no-store"});
  if(!r.ok){setOfficerUnavailable(true);throw Error(r.status===401?"نشست ورود منقضی شده است.":
   r.status===403?"دسترسی به ثبت سمت‌های این تعاونی مجاز نیست.":
    "خواندن فهرست هیئت‌مدیره از پایگاه داده ناموفق بود.");}
  const d=await r.json() as {items?:Officer[]};
  if(!Array.isArray(d.items))throw Error("پاسخ فهرست هیئت‌مدیره معتبر نیست.");
  setItems(d.items);setOfficerUnavailable(false);
 }
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:"خطای دریافت فهرست"));},[slug]);
 const external=form.officeCode==="CEO"&&form.ceoSource==="EXTERNAL";
 const labelFor=(code:string)=>offices.find(x=>x[0]===code)?.[1]||code;
 function update<K extends keyof typeof empty>(key:K,value:(typeof empty)[K]){
  setForm(old=>({...old,[key]:value}));
 }
 function editItem(o:Officer){
  setEditTarget({id:o.id,version:o.version});
  setMemberLabel(o.memberName||"");
  setForm({officeCode:o.officeCode,ceoSource:o.ceoSource,memberDraftId:o.memberDraftId||"",
   externalName:o.externalName||"",signingAuthorized:o.signingAuthorized,
   signingScope:o.signingScope||"",startDate:fromApiDate(o.startDate),endDate:fromApiDate(o.endDate),
   gazetteName:o.gazetteName||"",gazetteDate:fromApiDate(o.gazetteDate),
   gazetteIssue:o.gazetteIssue||"",noticeNumber:o.noticeNumber||""});
  setFile(null);setError("");setMessage("ویرایش نسخه "+o.version+" پیش‌نویس انتخاب‌شده");
  window.scrollTo({top:0,behavior:"smooth"});
 }
 function reset(){
  setEditTarget(null);setForm(empty);setMemberLabel("");setFile(null);
  setDocumentSubject("آگهی رسمی انتصاب");
 }
 async function showHistory(id:string){
  setHistoryId(id);setHistory([]);setError("");
  try{
   const r=await fetch(base+"/history?slug="+encodeURIComponent(slug)+"&id="+encodeURIComponent(id),
    {credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error("دریافت تاریخچه مجاز نیست.");
   const d=await r.json() as {items?:typeof history};
   if(!Array.isArray(d.items))throw Error("پاسخ تاریخچه معتبر نیست.");
   setHistory(d.items);
  }catch(e){setError(e instanceof Error?e.message:"خطای دریافت تاریخچه")}
 }
 function fileMime(f:File){
  const name=f.name.toLowerCase();
  return name.endsWith(".docx")?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
   name.endsWith(".pdf")?"application/pdf":name.endsWith(".png")?"image/png":
   /\.(jpg|jpeg)$/.test(name)?"image/jpeg":"";
 }
 async function saveDocument(f:File,id:string){
  const mime=fileMime(f);
  if(!mime||f.size<68||f.size>524288)
   throw Error("فقط PDF، Word با پسوند docx، JPG و PNG تا ۵۱۲ کیلوبایت پذیرفته می‌شود.");
  if(documentSubject.trim().length<3||documentSubject.length>160)
   throw Error("موضوع سند باید بین ۳ تا ۱۶۰ نویسه باشد.");
  const bytes=new Uint8Array(await f.arrayBuffer());let binary="";
  for(let i=0;i<bytes.length;i+=8192)
   binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const r=await fetch(base+"/documents",{method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({slug,officeId:id,subject:documentSubject.trim(),
    mime,filename:f.name,dataBase64:btoa(binary)})});
  binary="";
  if(!r.ok)throw Error(r.status===422?"فایل در اسکن امنیتی رد شد.":r.status===403?
   "مجوز بارگذاری این سند وجود ندارد.":"اسکن امنیتی یا ذخیره خصوصی ضمیمه در سرور آماده نیست.");
  const d=await r.json() as {saved?:boolean;status?:string};
  if(d.saved!==true||d.status!=="PRIVATE_READY")
   throw Error("ذخیره و اسکن امن سند تأیید نشد.");
 }
 async function downloadDocument(officeId:string,doc:OfficerDocument){
  setError("");
  try{
   const url=base+"/documents/download?slug="+encodeURIComponent(slug)+
    "&officeId="+encodeURIComponent(officeId)+"&id="+encodeURIComponent(doc.id);
   const r=await fetch(url,{credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error("دریافت سند خصوصی ممکن نیست؛ دسترسی یا سرویس ذخیره‌سازی بررسی شود.");
   if(!r.headers.get("content-type")?.includes("application/octet-stream"))
    throw Error("پاسخ دانلود فایل معتبر نیست.");
   const bytes=await r.blob();
   if(!bytes.size||bytes.size>524288)throw Error("اندازه سند دریافتی نامعتبر است.");
   const u=URL.createObjectURL(bytes),a=document.createElement("a");
   a.href=u;a.download=doc.filename;a.style.display="none";
   document.body.appendChild(a);a.click();a.remove();
   window.setTimeout(()=>URL.revokeObjectURL(u),3000);
  }catch(e){setError(e instanceof Error?e.message:"خطای دریافت سند")}
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  const startDate=jalaliToGregorianISO(form.startDate);
  const endDate=jalaliToGregorianISO(form.endDate);
  const gazetteDate=form.gazetteDate?jalaliToGregorianISO(form.gazetteDate):null;
  if(!startDate||!endDate||endDate<startDate||(form.gazetteDate&&!gazetteDate)){
   setError("تاریخ شمسی شروع یا پایان سمت معتبر نیست یا پایان زودتر از شروع است.");return;
  }
  if(!external&&!form.memberDraftId){
   setError("ابتدا شخص را از باکس جست‌وجوی عضو انتخاب کنید.");return;
  }
  if(form.ceoSource==="EXTERNAL"&&form.officeCode!=="CEO"){
   setError("مدیرعامل می‌تواند خارج از تعاونی باشد؛ سایر سمت‌ها باید از اعضای واجد شرایط انتخاب شوند.");return;
  }
  if(file&&(!fileMime(file)||file.size<68||file.size>524288)){
   setError("فرمت یا حجم سند معتبر نیست. PDF، DOCX، JPG و PNG تا ۵۱۲ کیلوبایت مجازند.");return;
  }
  setBusy(true);setError("");setMessage("");
  let storedId:string|null=null,storedVersion=1;
  try{
   const payload={slug,...form,startDate,endDate,gazetteDate,
    ...(editTarget?{id:editTarget.id,version:editTarget.version}:{}),
    ceoSource:external?"EXTERNAL":"MEMBER",
    memberDraftId:external?null:form.memberDraftId,
    externalName:external?form.externalName:""};
   const r=await fetch(base+(editTarget?"/edit":""),{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   if(!r.ok)throw Error(r.status===409?"پیش‌نویس به‌طور هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.":
    r.status===403?"شخص یا مجوز ثبت در این تعاونی معتبر نیست.":r.status===400?
    "اطلاعات سمت، نوع عضویت یا تاریخ‌ها معتبر نیست.":"ثبت سمت در پایگاه داده ناموفق بود.");
   const data=await r.json() as {saved?:boolean;id?:string;version?:number;status?:string;legalPowerGranted?:boolean};
   if(data.saved!==true||data.status!=="DRAFT_ONLY"||data.legalPowerGranted!==false)
    throw Error("سرور وضعیت غیررسمی پیش‌نویس را تأیید نکرد.");
   storedId=editTarget?.id??data.id??null;
   storedVersion=editTarget?(data.version??editTarget.version+1):1;
   if(!storedId)throw Error("ثبت سمت انجام شد، ولی شناسه پرونده دریافت نشد.");
   if(file){await saveDocument(file,storedId);setFile(null)}
   reset();await load();
   setMessage("پیش‌نویس سمت و ضمیمه انتخاب‌شده (در صورت وجود) ذخیره شدند. اعطای سمت رسمی نیازمند بررسی قانونی است.");
  }catch(e){
   if(storedId){
    setEditTarget({id:storedId,version:storedVersion});
    await load().catch(()=>{});
    setError("سمت ذخیره شد اما ضمیمه یا تکمیل اطلاعات ناموفق بود. همین پرونده را ویرایش کنید؛ ثبت مجددِ سمت جدید لازم نیست. "+(e instanceof Error?e.message:"خطا"));
   }else setError(e instanceof Error?e.message:"خطا در ثبت سمت");
  }finally{setBusy(false)}
 }
 async function archive(){
  if(!archiveTarget||!archiveConfirmed||busy)return;
  setBusy(true);setError("");
  try{
   const r=await fetch(base+"/archive",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({slug,id:archiveTarget.id,version:archiveTarget.version,
     acknowledgement:"ARCHIVE_DRAFT_WITH_AUDIT_ACKNOWLEDGED"})});
   if(!r.ok)throw Error(r.status===409?"رکورد تغییر کرده است؛ فهرست را تازه کنید.":r.status===403?
    "مجوز حذف پیش‌نویس وجود ندارد.":"حذف کنترل‌شده پیش‌نویس موفق نبود.");
   const result=await r.json() as {archived?:boolean};
   if(result.archived!==true)throw Error("تأیید حذف از فهرست دریافت نشد.");
   if(editTarget?.id===archiveTarget.id)reset();
   setArchiveTarget(null);setArchiveConfirmed(false);
   await load();setMessage("پیش‌نویس از فهرست فعال حذف شد؛ سوابق ممیزی حقوقی حفظ شده‌اند.");
  }catch(e){setError(e instanceof Error?e.message:"خطای حذف")}
  finally{setBusy(false)}
 }
 return <section className="tto-settings-page tto-officers-page" dir="rtl">
  <header className="tto-settings-hero"><div>
   <span className="tto-settings-eyebrow">تنظیمات تعاونی · ارکان مدیریتی</span>
   <h1>هیئت‌مدیره، مدیرعامل، بازرسان و صاحبان امضا</h1>
   <p>ثبت پیش‌نویس سمت و مستندات بدون ایجاد اختیار قانونی امضا یا انتصاب</p>
  </div></header>
  <div className="tto-settings-card">
   <h2>{editTarget?"ویرایش پیش‌نویس سمت":"ثبت پیش‌نویس سمت"}</h2>
   <p role="status">انتخاب اشخاص از پایگاه داده همین تعاونی انجام می‌شود و فقط مدیرعامل می‌تواند خارج از اعضای تعاونی معرفی شود.</p>
   {officerUnavailable?<p role="alert" className="tto-officer-source-warning">سرویس ثبت سمت‌ها آماده نیست؛ تا دریافت فهرست معتبر، ثبت سمت غیرفعال است.</p>:null}
   <div className="tto-officer-member-status">
    <span>تعداد پیش‌نویس‌های فعال: {items.length.toLocaleString("fa-IR")}</span>
    <button type="button" disabled={busy} onClick={()=>void load().catch(e=>setError(e instanceof Error?e.message:"خطای تازه‌سازی"))}>↻ تازه‌سازی اطلاعات</button>
   </div>
   <form onSubmit={e=>void submit(e)} className="tto-nav02-form tto-officer-form">
    <h3 className="tto-officer-section-title">۱. سمت و وضعیت عضویت</h3>
    <label>سمت
     <select value={form.officeCode} onChange={e=>{
      const officeCode=e.target.value;
      setForm(x=>({...x,officeCode,ceoSource:officeCode==="CEO"?x.ceoSource:"MEMBER",
       memberDraftId:x.ceoSource==="EXTERNAL"?"":x.memberDraftId}));
     }}>{offices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
    </label>
    <label>وضعیت عضویت
     <select value={form.ceoSource} onChange={e=>{
      const ceoSource=e.target.value;
      setForm(x=>({...x,ceoSource,memberDraftId:ceoSource==="EXTERNAL"?"":x.memberDraftId,
       externalName:ceoSource==="MEMBER"?"":x.externalName}));
      setMemberLabel("");
     }}>
      <option value="MEMBER">عضو شرکت تعاونی</option>
      <option value="EXTERNAL" disabled={form.officeCode!=="CEO"}>خارج از تعاونی (فقط مدیرعامل)</option>
     </select>
    </label>
    {external?<label>نام و نام خانوادگی مدیرعامل خارج از تعاونی
     <input required minLength={3} maxLength={180} value={form.externalName}
      onChange={e=>update("externalName",e.target.value)}/></label>:
     <OfficerMemberPicker slug={slug} value={form.memberDraftId}
      initialLabel={memberLabel} disabled={busy}
      onChange={(id,label)=>{update("memberDraftId",id);setMemberLabel(label)}}/>}
    <h3 className="tto-officer-section-title">۲. حدود امضا و دوره مسئولیت</h3>
    <label>حدود امضا
     <select value={form.signingAuthorized?"yes":"no"}
      onChange={e=>update("signingAuthorized",e.target.value==="yes")}>
      <option value="no">بدون امضای مجاز</option>
      <option value="yes">صاحب امضای مجاز (اظهاری)</option>
     </select>
    </label>
    <label className="tto-officer-wide">شرح حدود اختیارات و ترکیب امضا
     <textarea maxLength={1000} value={form.signingScope} onChange={e=>update("signingScope",e.target.value)} rows={2}/>
    </label>
    <div className="tto-officer-date-field"><span>تاریخ شروع سمت (شمسی) *</span>
     <JalaliDatePicker value={form.startDate} placeholder="انتخاب تاریخ شروع سمت"
      onChange={value=>setForm(x=>({...x,startDate:value,
       endDate:value&&x.endDate&&x.endDate<value?"":x.endDate}))}/>
    </div>
    <div className="tto-officer-date-field"><span>تاریخ پایان سمت (شمسی) *</span>
     <JalaliDatePicker value={form.endDate} minDate={form.startDate}
      placeholder="انتخاب تاریخ پایان سمت" onChange={value=>update("endDate",value)}/>
    </div>
    <h3 className="tto-officer-section-title">۳. مستندات و اطلاعات آگهی</h3>
    <div className="tto-officer-gazette-row">
     <label>روزنامه انتشار آگهی<input maxLength={160} value={form.gazetteName}
      onChange={e=>update("gazetteName",e.target.value)}/></label>
     <div className="tto-officer-date-field"><span>تاریخ انتشار آگهی (شمسی)</span>
      <JalaliDatePicker value={form.gazetteDate} placeholder="تاریخ آگهی"
       onChange={value=>update("gazetteDate",value)}/></div>
     <label>شماره روزنامه<input maxLength={80} value={form.gazetteIssue}
      onChange={e=>update("gazetteIssue",e.target.value)}/></label>
     <label>شماره آگهی<input maxLength={100} value={form.noticeNumber}
      onChange={e=>update("noticeNumber",e.target.value)}/></label>
    </div>
    <div className="tto-officer-document-section">
     <strong>ضمیمه مستندات و آگهی</strong>
     <div className="tto-officer-upload-row">
      <label>موضوع سند<input maxLength={160} value={documentSubject}
       onChange={e=>setDocumentSubject(e.target.value)}/></label>
      <label>انتخاب فایل PDF، Word (docx) یا تصویر
       <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={e=>setFile(e.currentTarget.files?.[0]??null)} disabled={busy}/>
      </label>
      {file?<div className="tto-officer-file-selected">
       <span title={file.name}>{file.name} — {(file.size/1024).toFixed(0)} کیلوبایت</span>
       <button type="button" onClick={()=>setFile(null)} aria-label="حذف فایل انتخاب‌شده">×</button>
      </div>:null}
     </div>
     <small>حداکثر ۵۱۲ کیلوبایت؛ سند فقط پس از اسکن امنیتی و رمزنگاری ذخیره می‌شود. چنانچه سرویس اسکن در محیط آزمایش آماده نباشد، ثبت سند متوقف می‌شود و پیش‌نویس سمت محفوظ می‌ماند.</small>
    </div>
    <div className="tto-nav02-actions tto-officer-actions">
     <button disabled={busy||officerUnavailable||(!external&&!form.memberDraftId)} type="submit">
      {busy?"در حال ذخیره…":editTarget?"ذخیره ویرایش نسخه "+editTarget.version:"ثبت پیش‌نویس سمت"}</button>
     {editTarget?<button type="button" onClick={()=>{reset();setMessage("")}}>انصراف از ویرایش</button>:null}
    </div>
   </form>
   {error?<p role="alert" className="tto-officer-feedback-error">{error}</p>:null}
   {message?<p role="status">{message}</p>:null}
  </div>
  <section className="tto-settings-card">
   <h2>جدول اعضای هیئت‌مدیره و سمت‌های ثبت‌شده</h2>
   <p>فهرست پیش‌نویس‌های همین تعاونی؛ اعتبار حقوقی سمت‌ها منوط به تصویب و بررسی اسناد است.</p>
   <div className="tto-nav02-table-scroll" tabIndex={0} aria-label="جدول افراد و سمت‌های ثبت‌شده">
    <table className="tto-nav02-table tto-officer-table">
     <thead><tr><th>نام و نام خانوادگی</th><th>سمت</th><th>حدود امضا</th>
      <th>تاریخ شروع سمت</th><th>تاریخ پایان سمت</th>
      <th>اسناد و ضمیمه‌ها</th><th>عملیات مدیریتی</th></tr></thead>
     <tbody>{items.length===0?<tr><td colSpan={7}>هنوز پیش‌نویس سمتی ثبت نشده است.</td></tr>:
      items.map(item=><tr key={item.id}>
       <td>{item.externalName||item.memberName||"عضو ثبت‌شده"}</td>
       <td>{labelFor(item.officeCode)}<small>{item.ceoSource==="EXTERNAL"?" · خارج از تعاونی":" · عضو تعاونی (اظهاری)"}</small></td>
       <td>{item.signingScope|| (item.signingAuthorized?"دارای حق امضای اظهارشده":"بدون حق امضا")}</td>
       <td>{displayJalaliDate(item.startDate)}</td><td>{displayJalaliDate(item.endDate)}</td>
       <td><div className="tto-officer-documents-list">{item.documents?.length?
        item.documents.map(doc=><span key={doc.id} className="tto-officer-document-chip">
         <span title={doc.filename}>{doc.filename}</span>
         <button type="button" className="tto-officer-icon" title={"دانلود سند "+doc.filename}
          aria-label={"دانلود سند "+doc.filename} onClick={()=>void downloadDocument(item.id,doc)}>
          <Icon name="download"/></button>
        </span>):<small>بدون ضمیمه</small>}</div></td>
       <td><div className="tto-officer-governance-actions">
        <button type="button" className="tto-officer-icon" aria-label={"ویرایش سمت "+labelFor(item.officeCode)}
         title="ویرایش" onClick={()=>editItem(item)}><Icon name="edit"/></button>
        <button type="button" className="tto-officer-icon" aria-label="مشاهده تاریخچه ویرایش"
         title="تاریخچه تغییرات" onClick={()=>void showHistory(item.id)}><Icon name="history"/></button>
        <button type="button" className="tto-officer-icon danger" aria-label="حذف پیش‌نویس از فهرست فعال"
         title="حذف از فهرست با حفظ سوابق ممیزی"
         onClick={()=>{setArchiveTarget(item);setArchiveConfirmed(false)}}><Icon name="delete"/></button>
       </div></td>
      </tr>)}</tbody>
    </table>
   </div>
  </section>
  {historyId?<section className="tto-settings-card tto-officer-history">
   <h2>تاریخچه ویرایش پیش‌نویس</h2>
   <button type="button" onClick={()=>{setHistoryId("");setHistory([])}}>بستن تاریخچه</button>
   {history.length===0?<p>ویرایشی ثبت نشده است.</p>:<ol>{history.map((h,i)=>
    <li key={i}>نسخه {h.versionBefore} به {h.versionAfter} — {new Date(h.revisedAt).toLocaleString("fa-IR-u-ca-persian")}
     <details><summary>جزئیات ثبت‌شده قبل از تغییر</summary>
      <dl><dt>سمت</dt><dd>{labelFor(String(h.previous.officeCode??""))}</dd>
       <dt>شروع</dt><dd>{displayJalaliDate(String(h.previous.startDate??""))}</dd>
       <dt>پایان</dt><dd>{displayJalaliDate(String(h.previous.endDate??""))}</dd>
       <dt>حدود امضا</dt><dd>{String(h.previous.signingScope??"—")}</dd>
      </dl>
     </details>
    </li>)}</ol>}
  </section>:null}
  {archiveTarget?<div className="tto-officer-dialog-backdrop" role="dialog" aria-modal="true"
   aria-label="تأیید حذف پیش‌نویس">
   <div className="tto-settings-card tto-officer-dialog">
    <h2>حذف پیش‌نویس سمت</h2>
    <p>سمت «{labelFor(archiveTarget.officeCode)}» از فهرست فعال حذف می‌شود؛ برای رعایت الزامات ممیزی، سابقه و اسناد ثبت‌شده باقی می‌مانند. این عمل حذف غیرقابل‌بازگشت از فهرست فعال است، نه پاکسازی فیزیکی سوابق.</p>
    <label><input type="checkbox" checked={archiveConfirmed}
     onChange={e=>setArchiveConfirmed(e.target.checked)} disabled={busy}/>
     این پیام و باقی‌ماندن سوابق ممیزی را تأیید می‌کنم.</label>
    <div className="tto-officer-dialog-buttons">
     <button type="button" className="danger" disabled={!archiveConfirmed||busy}
      onClick={()=>void archive()}>{busy?"در حال پردازش…":"تأیید حذف از فهرست"}</button>
     <button type="button" disabled={busy} onClick={()=>{setArchiveTarget(null);setArchiveConfirmed(false)}}>انصراف</button>
    </div>
   </div>
  </div>:null}
 </section>;
}
