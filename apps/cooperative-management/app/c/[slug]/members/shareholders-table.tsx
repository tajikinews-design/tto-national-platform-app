"use client";
import Link from "next/link";
import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";

type Draft={
 id:string;title:string;name:string;group:string;identifierMask:string;membershipStatus?:string|null;
 state:string;managementState?:"ACTIVE_DRAFT"|"SUSPENDED_DRAFT";
 version?:number;photoState?:"NONE"|"QUARANTINED";
 initialShares?:string|null;subscribedShares?:string|null;
 nominalRial?:string|null;declaredPaidRial?:string|null;
 paymentDate?:string|null;capitalState?:string|null;
};
type Mode="details"|"profileEdit"|"capitalEdit"|"suspend"|"resume"|"delete"|"audit";
type Entry={action:string;version:number;at:string};
const TITLES=["آقا","خانم","شرکت","سازمان","اداره"];
const EMPTY_CAPITAL={initialShares:"0",subscribedShares:"0",nominalRial:"",paidRial:"0",paymentDate:"",receiptRef:""};
type Capital=typeof EMPTY_CAPITAL;
function fmt(value:string|null|undefined){
 if(value===null||value===undefined||!/^[0-9]+$/.test(value))return "—";
 return BigInt(value).toLocaleString("fa-IR");
}
function commitment(item:Draft){
 if(item.subscribedShares==null||item.nominalRial==null)return "—";
 try{return (BigInt(item.subscribedShares)*BigInt(item.nominalRial)).toLocaleString("fa-IR");}
 catch{return "—";}
}
function Glyph({name}:{name:"view"|"edit"|"capital"|"pause"|"resume"|"trash"|"audit"}){
 const props={width:17,height:17,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",
  strokeWidth:1.9,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true as const};
 return <svg {...props}>
  {name==="view"?<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>:null}
  {name==="edit"?<><path d="m16 4 4 4M4 20l5-.9L20 7a2 2 0 0 0-3-3L4.9 16.1 4 20Z"/></>:null}
  {name==="capital"?<><circle cx="12" cy="12" r="9"/><path d="M8.5 9.5c0-2 7-2 7 0s-7 2-7 4 7 2 7 0M12 5v14"/></>:null}
  {name==="pause"?<><circle cx="12" cy="12" r="9"/><path d="M10 9v6m4-6v6"/></>:null}
  {name==="resume"?<><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></>:null}
  {name==="trash"?<><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v6m4-6v6"/></>:null}
  {name==="audit"?<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2M3 3v5h5"/></>:null}
 </svg>;
}
function Btn({type,onClick,disabled,title,danger=false}:{
 type:"view"|"edit"|"capital"|"pause"|"resume"|"trash"|"audit";
 onClick:()=>void;disabled?:boolean;title:string;danger?:boolean;
}){
 return <button type="button" className={"tto-nav02-icon-btn"+(danger?" danger":"")}
   onClick={onClick} disabled={disabled} title={title} aria-label={title}>
  <Glyph name={type}/></button>;
}
function outcome(mode:Mode){
 return mode==="profileEdit"?"مشخصات ساختگی ویرایش شد.":mode==="capitalEdit"?"اطلاعات اظهارشده سهام ویرایش شد.":
 mode==="suspend"?"پرونده آزمایشی معلق شد.":mode==="resume"?"پرونده آزمایشی بازفعال شد.":
 "پرونده ساختگی از پایگاه فعال حذف شد. سابقه بدون مشخصات هویتی باقی می‌ماند.";
}
const actionTitle:Record<Mode,string>={
 details:"جزئیات پرونده",profileEdit:"ویرایش مشخصات",capitalEdit:"ویرایش سرمایه و پرداخت",
 suspend:"تعلیق پرونده آزمایشی",resume:"رفع تعلیق آزمایشی",
 delete:"حذف دائم پرونده آزمایشی",audit:"تاریخچه اقدامات مدیریتی"
};
const eventTitle:Record<string,string>={
 PROFILE_EDITED:"ویرایش مشخصات",CAPITAL_EDITED:"ویرایش اطلاعات سهام",
 SUSPENDED:"تعلیق آزمایشی",REACTIVATED:"رفع تعلیق آزمایشی",DELETED:"حذف پرونده آزمایشی"
};
export function ShareholdersTable({slug}:{slug:string}){
 const [rows,setRows]=useState<Draft[]>([]),[loading,setLoading]=useState(true);
 const [search,setSearch]=useState(""),[filter,setFilter]=useState("all"),[page,setPage]=useState(1);
 const [selection,setSelection]=useState<Draft|null>(null),[mode,setMode]=useState<Mode|null>(null);
 const [profile,setProfile]=useState({title:"آقا",fullName:"",group:""});
 const [capital,setCapital]=useState<Capital>(EMPTY_CAPITAL);
 const [audit,setAudit]=useState<Entry[]>([]);
 const [confirmation,setConfirmation]=useState(""),[ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(false);
 const dialogRef=useRef<HTMLDivElement|null>(null);
 const base="/c/"+encodeURIComponent(slug)+"/members/";
 async function reload(){
  const response=await fetch("/api/commerce/nav02?slug="+encodeURIComponent(slug),
   {credentials:"same-origin",cache:"no-store"});
  if(!response.ok)throw Error(response.status===401?"نشست منقضی شده است.":
   response.status===403?"فقط مالک فضای آزمایشی به این فهرست دسترسی دارد.":
   "دریافت فهرست سهامداران آزمایشی ناموفق بود.");
  const body=await response.json() as {items?:Draft[]};
  if(!Array.isArray(body.items))throw Error("پاسخ سرور معتبر نیست.");
  const shareholderDrafts=body.items.filter(item=>item.membershipStatus!=="APPLICANT_UNVERIFIED");
  setRows(shareholderDrafts);return shareholderDrafts;
 }
 useEffect(()=>{
  let alive=true;void reload().catch(e=>{
    if(alive){setError(true);setMessage(e instanceof Error?e.message:"خطا در بارگذاری");}
  }).finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[slug]);
 useEffect(()=>{
  if(!mode)return;
  dialogRef.current?.focus();
  const onEscape=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!busy)close()};
  window.addEventListener("keydown",onEscape);
  return()=>window.removeEventListener("keydown",onEscape);
 },[mode,busy]);
 const filtered=useMemo(()=>rows.filter(r=>{
  const term=(r.name+" "+r.group+" "+r.identifierMask+" "+r.title).toLocaleLowerCase("fa-IR");
  if(search.trim()&&!term.includes(search.trim().toLocaleLowerCase("fa-IR")))return false;
  return filter==="all"||(filter==="suspended"&&r.managementState==="SUSPENDED_DRAFT")||
   (filter==="active"&&r.managementState!=="SUSPENDED_DRAFT")||
   (filter==="no-capital"&&!r.capitalState);
 }),[rows,search,filter]);
 const totalPages=Math.max(1,Math.ceil(filtered.length/10));
 const visible=filtered.slice((Math.min(page,totalPages)-1)*10,Math.min(page,totalPages)*10);
 function close(){setMode(null);setSelection(null);setAudit([]);setConfirmation("");setAck(false);}
 async function open(row:Draft,next:Mode){
  setSelection(row);setMode(next);setConfirmation("");setAck(false);setAudit([]);
  setProfile({title:row.title,fullName:row.name,group:row.group});
  setCapital({initialShares:row.initialShares??"0",subscribedShares:row.subscribedShares??"0",
   nominalRial:row.nominalRial??"",paidRial:row.declaredPaidRial??"0",
   paymentDate:row.paymentDate?.slice(0,10)??"",receiptRef:""});
  if(next==="audit"){
   try{
    const resp=await fetch("/api/commerce/nav02/manage?slug="+encodeURIComponent(slug)+
     "&draftId="+encodeURIComponent(row.id),{credentials:"same-origin",cache:"no-store"});
    if(!resp.ok)throw Error("سوابق قابل دریافت نیست.");
    const data=await resp.json() as {events?:Entry[]};
    if(!Array.isArray(data.events))throw Error("پاسخ تاریخچه معتبر نیست.");
    setAudit(data.events);
   }catch(e){setError(true);setMessage(e instanceof Error?e.message:"خطا در دریافت سوابق");}
  }
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!selection||!mode||busy)return;
  if(mode==="details"||mode==="audit")return;
  if(mode==="delete"&&(!ack||confirmation!=="حذف دائم")){
    setError(true);setMessage("برای حذف باید عبارت «حذف دائم» را وارد و پیام هشدار را تأیید کنید.");return;
  }
  setBusy(true);setError(false);setMessage("");
  try{
   const payload:Record<string,unknown>={
    slug,draftId:selection.id,version:selection.version??1,action:mode
   };
   if(mode==="profileEdit")payload.data=profile;
   if(mode==="capitalEdit")payload.data=capital;
   if(mode==="delete")payload.confirmation="DELETE_SYNTHETIC_DRAFT";
   const response=await fetch("/api/commerce/nav02/manage",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   if(!response.ok)throw Error(response.status===409?
    "رکورد هم‌زمان تغییر کرده است؛ فهرست تازه را بررسی کنید.":
    response.status===403?"این عملیات برای این پرونده یا حساب مجاز نیست.":
    response.status===400?"اطلاعات یا وضعیت پرونده برای این عملیات معتبر نیست.":
    "عملیات ثبت نشد. هیچ تغییری را قطعی فرض نکنید.");
   const data=await response.json() as {saved?:boolean;record?:{deleted?:boolean;updated?:boolean;version?:number}};
   if(data.saved!==true||!data.record)throw Error("سرور موفقیت عملیات را تأیید نکرد.");
   await reload();
   setMessage(outcome(mode));close();
  }catch(e){
   setError(true);setMessage(e instanceof Error?e.message:"عملیات ناموفق بود.");
   try{await reload();}catch{/* preserve the original failure */}
  }finally{setBusy(false)}
 }
 function updateCapital(key:keyof Capital,value:string){setCapital(old=>({...old,[key]:value}));}
 return <section className="tto-nav02-page" aria-label="جدول سهامداران آزمایشی">
  <header className="tto-nav02-hero">
   <span className="tto-settings-eyebrow">NAV-02 · فهرست پرونده‌ها</span>
   <h1>سهامداران</h1>
   <p>فهرست پرونده‌های اولیه و تأییدنشده در فضای همین تعاونی؛ وضعیت‌های این جدول جایگزین دفتر رسمی مالکیت سهام یا وضعیت قانونی عضویت نیستند.</p>
  </header>
  <nav aria-label="زیرمنوهای اعضا و سهام" className="tto-nav02-switch">
   <Link href={base+"add"}>♙ افزودن سهامدار</Link>
   <Link href={base+"shares"}>▥ اطلاعات سهام</Link>
   <Link href={base+"shareholders"} aria-current="page">♧ سهامداران</Link>
  </nav>
  <div className="tto-nav02-warning" role="status">
   فقط پرونده‌های ساختگی و تأییدنشده؛ عکس‌های قرنطینه‌شده تا قبل از اسکن ایمن نمایش یا دانلود نمی‌شوند.
   تعلیق فقط وضعیت پیش‌نویس را تغییر می‌دهد و هیچ سهم قانونی را مسدود نمی‌کند.
  </div>
  <div className="tto-nav02-card tto-nav02-directory">
   <div className="tto-nav02-directory-tools">
    <label>جست‌وجو در فهرست
     <input type="search" value={search} placeholder="نام، گروه، چهار رقم آخر شناسه"
      onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
    </label>
    <label>وضعیت پرونده
     <select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1)}}>
      <option value="all">همه پرونده‌ها</option><option value="active">فعال آزمایشی</option>
      <option value="suspended">معلق آزمایشی</option><option value="no-capital">بدون اطلاعات سهام</option>
     </select>
    </label>
    <span className="tto-nav02-directory-count">{filtered.length.toLocaleString("fa-IR")} پرونده از {rows.length.toLocaleString("fa-IR")} مورد بارگذاری‌شده (۱۰۰ پرونده آخر)</span>
    <button type="button" onClick={()=>{setLoading(true);void reload().then(()=>{setError(false);setMessage("فهرست به‌روز شد.")})
     .catch(e=>{setError(true);setMessage(String(e.message))}).finally(()=>setLoading(false))}} disabled={loading}>تازه‌سازی</button>
   </div>
   {message?<p className={"tto-nav02-message"+(error?" error":"")} role={error?"alert":"status"}>{message}</p>:null}
   <div className="tto-nav02-table-scroll" tabIndex={0} aria-label="جدول قابل پیمایش افقی">
    <table className="tto-nav02-table">
     <thead><tr>
      <th scope="col">عکس بندانگشتی</th><th scope="col">عنوان</th>
      <th scope="col">نام و نام خانوادگی</th><th scope="col">گروه</th>
      <th scope="col">تعداد سهام</th><th scope="col">سهام در تعهد</th>
      <th scope="col">مبلغ پرداختی (ریال)</th><th scope="col">مبلغ در تعهد (ریال)</th>
      <th scope="col">وضعیت سهام</th><th scope="col">عملیات مدیریتی</th>
     </tr></thead>
     <tbody>
      {loading?<tr><td colSpan={10}>در حال بارگذاری پرونده‌ها…</td></tr>:
       visible.length===0?<tr><td colSpan={10}>پرونده‌ای مطابق جست‌وجو پیدا نشد.</td></tr>:
       visible.map(item=>{
        const suspended=item.managementState==="SUSPENDED_DRAFT";
        return <tr key={item.id}>
         <td><div className="tto-nav02-avatar" title={item.photoState==="QUARANTINED"?"عکس قرنطینه‌شده؛ نمایش ممنوع":"تصویری ثبت نشده"}>
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
           <circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg></div>
          <small>{item.photoState==="QUARANTINED"?"قرنطینه":"بدون عکس"}</small>
         </td>
         <td>{item.title}</td>
         <td><strong>{item.name}</strong><small className="tto-nav02-row-mask">{item.identifierMask}</small></td>
         <td>{item.group}</td>
         <td className="tto-nav02-num">{fmt(item.initialShares)}</td>
         <td className="tto-nav02-num">{fmt(item.subscribedShares)}</td>
         <td className="tto-nav02-num">{fmt(item.declaredPaidRial)}</td>
         <td className="tto-nav02-num">{commitment(item)}</td>
         <td>{suspended?<span className="tto-nav02-state suspended">معلق آزمایشی</span>:
          item.capitalState?<span className="tto-nav02-state">اظهاری، تأییدنشده</span>:
          <span className="tto-nav02-state pending">بدون ثبت سهام</span>}
         </td>
         <td><div className="tto-nav02-action-group">
          <Btn type="view" title={"جزئیات "+item.name} onClick={()=>void open(item,"details")}/>
          <Btn type="edit" title={"ویرایش مشخصات "+item.name} disabled={suspended} onClick={()=>void open(item,"profileEdit")}/>
          {item.capitalState?
           <Btn type="capital" title={"ویرایش سرمایه "+item.name} disabled={suspended} onClick={()=>void open(item,"capitalEdit")}/>:
           <Link title="ثبت اطلاعات سهام" aria-label={"ثبت اطلاعات سهام "+item.name} className="tto-nav02-icon-btn"
             href={base+"shares?draft="+encodeURIComponent(item.id)}><Glyph name="capital"/></Link>}
          <Btn type={suspended?"resume":"pause"} title={(suspended?"رفع تعلیق ":"تعلیق ")+item.name}
           onClick={()=>void open(item,suspended?"resume":"suspend")}/>
          <Btn type="audit" title={"سوابق "+item.name} onClick={()=>void open(item,"audit")}/>
          <Btn type="trash" danger title={"حذف دائم "+item.name} onClick={()=>void open(item,"delete")}/>
         </div></td>
        </tr>;
       })
      }
     </tbody>
    </table>
   </div>
   <div className="tto-nav02-directory-footer">
    <p>«مبلغ در تعهد» = تعداد سهام در تعهد × ارزش اسمی هر سهم؛ این عدد لزوماً مانده بدهی یا مبلغ پرداخت‌نشده نیست. علامت «—» یعنی اطلاعات ثبت نشده است.</p>
    <div><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>قبلی</button>
     <span>صفحه {Math.min(page,totalPages).toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}</span>
     <button type="button" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>بعدی</button>
    </div>
   </div>
  </div>
  {selection&&mode?<div className="tto-nav02-modal-cover">
    <div role="dialog" aria-modal="true" aria-label={actionTitle[mode]}
     className="tto-nav02-modal" tabIndex={-1} ref={dialogRef}>
     <div className="tto-nav02-modal-heading"><h2>{actionTitle[mode]}</h2>
      <button type="button" aria-label="بستن پنجره" onClick={close} disabled={busy}>×</button></div>
     <p className="tto-nav02-modal-target">{selection.name} · {selection.identifierMask} · نسخه {fmt(String(selection.version??1))}</p>
     {mode==="details"?<div className="tto-nav02-details">
      <p>عنوان: <strong>{selection.title}</strong></p>
      <p>گروه: <strong>{selection.group}</strong></p>
      <p>تعداد سهام اظهارشده: <strong>{fmt(selection.initialShares)}</strong></p>
      <p>سهام در تعهد: <strong>{fmt(selection.subscribedShares)}</strong></p>
      <p>پرداخت اظهارشده: <strong>{fmt(selection.declaredPaidRial)} ریال</strong></p>
      <p>مبلغ در تعهد: <strong>{commitment(selection)} ریال</strong></p>
      <p>عکس: <strong>{selection.photoState==="QUARANTINED"?"قرنطینه امن، فاقد مجوز نمایش":"ثبت نشده"}</strong></p>
      <p>مالکیت، عضویت و حق رأی قانونی: <strong>تأیید نشده</strong></p>
     </div>:null}
     {mode==="audit"?<div className="tto-nav02-audit">
      {audit.length===0?<p>سابقه مدیریتی برای این پرونده ثبت نشده است.</p>:
       <ul>{audit.map((e,i)=><li key={i}><strong>{eventTitle[e.action]??"اقدام مدیریتی"}</strong>
        <span>{new Date(e.at).toLocaleString("fa-IR")} · نسخه {fmt(String(e.version))}</span>
       </li>)}</ul>}
     </div>:null}
     {mode!=="details"&&mode!=="audit"?<form onSubmit={submit} className="tto-nav02-modal-form">
      {mode==="profileEdit"?<>
       <label>عنوان
        <select value={profile.title} onChange={e=>setProfile(p=>({...p,title:e.target.value}))}>
         {TITLES.filter(t=>["آقا","خانم"].includes(selection.title)===["آقا","خانم"].includes(t))
           .map(t=><option key={t}>{t}</option>)}
        </select></label>
       <label>نام و نام خانوادگی / نام شخصیت حقوقی
        <input required maxLength={180} value={profile.fullName}
         onChange={e=>setProfile(p=>({...p,fullName:e.target.value}))}/></label>
       <label>گروه
        <input required maxLength={90} value={profile.group}
         onChange={e=>setProfile(p=>({...p,group:e.target.value}))}/></label>
       <small>شناسه ملی و نوع حقیقی/حقوقی در این ویرایش ثابت‌اند؛ برای تغییر آن‌ها پرونده جدید لازم است. فقط داده ساختگی مجاز است.</small>
      </>:null}
      {mode==="capitalEdit"?<>
       {([
        ["initialShares","تعداد سهام اولیه"],["subscribedShares","تعداد سهام در تعهد"],
        ["nominalRial","ارزش اسمی هر سهم (ریال)"],["paidRial","مبلغ پرداختی اظهارشده (ریال)"]
       ] as const).map(([key,title])=><label key={key}>{title}
         <input required type="number" min={key==="nominalRial"?1:0} step={1}
          value={capital[key]} onChange={e=>updateCapital(key,e.target.value)}/></label>)}
       <label>تاریخ پرداخت اظهارشده
        <input type="date" value={capital.paymentDate} onChange={e=>updateCapital("paymentDate",e.target.value)}/></label>
       <label>شماره پیگیری جدیدِ کاملاً ساختگی
        <input required maxLength={100} placeholder="TEST-RECEIPT-001"
         value={capital.receiptRef} onChange={e=>updateCapital("receiptRef",e.target.value)}/></label>
       <small>فیش قبلی محرمانه و رمزنگاری‌شده است؛ برای هر ویرایش، مرجع ساختگی جدید وارد کنید.</small>
      </>:null}
      {mode==="suspend"||mode==="resume"?<p className="tto-nav02-warning">این تغییر فقط وضعیت داخلی همین پرونده آزمایشی را ثبت می‌کند. تعلیق رسمی عضو، مسدودسازی سهام و حق رأی انجام نمی‌شود.</p>:null}
      {mode==="delete"?<div className="tto-nav02-danger-zone">
       <strong>حذف برگشت‌ناپذیر از پایگاه فعال آزمایشی</strong>
       <p>پرونده، اطلاعات سرمایه و عکس قرنطینه‌شده مرتبط حذف می‌شوند. تنها لاگ غیرهویتی عملیات باقی می‌ماند؛ نسخه‌های پشتیبان تابع سیاست نگهداری جداگانه هستند.</p>
       <label>برای تأیید عبارت «حذف دائم» را دقیقاً بنویسید.
        <input required autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
       <label className="tto-nav02-delete-check"><input type="checkbox" checked={ack}
        onChange={e=>setAck(e.target.checked)}/> این پرونده صرفاً ساختگی و تأییدنشده است.</label>
      </div>:null}
      <div className="tto-nav02-modal-buttons">
       <button type="button" onClick={close} disabled={busy}>انصراف</button>
       <button type="submit" className={mode==="delete"?"danger":""}
        disabled={busy||(mode==="delete"&&(confirmation!=="حذف دائم"||!ack))}>
        {busy?"در حال ثبت امن…":mode==="delete"?"حذف دائم":mode==="suspend"?"ثبت تعلیق":mode==="resume"?"رفع تعلیق":"ذخیره تغییرات"}
       </button>
      </div>
     </form>:<div className="tto-nav02-modal-buttons"><button type="button" onClick={close}>بستن</button></div>}
    </div>
   </div>:null}
 </section>;
}
