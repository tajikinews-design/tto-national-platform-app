"use client";
import {useRef,useState} from "react";
type Profile=Record<string,string>;
type PreviewRow={row:number;valid:boolean;errors:string[];fields:Profile};
type Preview={rows:PreviewRow[];count:number;hasErrors:boolean;status:string};
export function MemberExcelPanel({slug,onImported}:{slug:string;onImported:()=>Promise<void>}){
 const [rows,setRows]=useState<PreviewRow[]>([]);
 const filePicker=useRef<HTMLInputElement|null>(null);
 const [filename,setFilename]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
 const url="/api/commerce/nav02/workbook?slug="+encodeURIComponent(slug);
 async function download(mode:"sample"|"export"){
  if(busy)return;
  if(mode==="export"&&!window.confirm("فایل خروجی شامل اطلاعات هویتی محرمانه اعضای این تعاونی است. فقط در محل امن نگهداری شود. دریافت فایل را تأیید می‌کنید؟"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch(url+"&mode="+mode,{credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error(r.status===401?"برای دریافت اکسل دوباره وارد شوید.":
    r.status===403?"مجوز دریافت اطلاعات این تعاونی را ندارید.":
    r.status===422?"تعداد پرونده‌ها بیش از حد مجاز خروجی است.":
    "سرویس اکسل آماده نیست؛ هیچ فایل ناقصی دانلود نشد.");
   const mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
   if(!r.headers.get("content-type")?.startsWith(mime))throw Error("پاسخ دریافتی فایل معتبر اکسل نیست.");
   const bytes=await r.arrayBuffer();
   const signature=new Uint8Array(bytes);
   if(signature.length<50||signature[0]!==0x50||signature[1]!==0x4b)
    throw Error("ساختار فایل اکسل معتبر نیست؛ دریافت لغو شد.");
   const blob=new Blob([bytes],{type:mime});
   const address=URL.createObjectURL(blob);
   const a=document.createElement("a");a.href=address;
   a.download=mode==="sample"?"TTO_Members_Sample.xlsx":"TTO_Members_Export_Private.xlsx";
   document.body.appendChild(a);a.click();a.remove();
   window.setTimeout(()=>URL.revokeObjectURL(address),3000);
   setNotice(mode==="sample"?"فایل نمونه کامل دریافت شد.":"فایل محرمانه اعضا دریافت شد؛ از انتشار یا اشتراک‌گذاری آن خودداری کنید.");
  }catch(e){setError(e instanceof Error?e.message:"خطای دریافت اکسل");}
  finally{setBusy(false);}
 }
 async function preview(file:File){
  setError("");setNotice("");setRows([]);setConfirmed(false);
  if(!file.name.toLowerCase().endsWith(".xlsx")||file.size>2097152){
   setError("فقط فایل Excel با پسوند xlsx و حداکثر حجم ۲ مگابایت مجاز است.");return;
  }
  setBusy(true);
  try{
   const r=await fetch(url,{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    body:file});
   if(!r.ok)throw Error(r.status===403?"مجوز ورود اطلاعات این تعاونی وجود ندارد.":
    "فایل اکسل معتبر نیست یا ساختار آن با نمونه سامانه تطابق ندارد.");
   const p=await r.json() as Preview;
   if(p.status!=="PREVIEW_ONLY_REQUIRES_EXPLICIT_CONFIRMATION"||!Array.isArray(p.rows))
    throw Error("پاسخ پیش‌نمایش معتبر نیست.");
   setRows(p.rows);setFilename(file.name);
   setNotice("پیش‌نمایش "+p.count+" ردیف آماده شد. هنوز هیچ عضوی ثبت نشده است.");
  }catch(e){setError(e instanceof Error?e.message:"خطای خواندن فایل");}
  finally{setBusy(false);}
 }
 async function commit(){
  if(!confirmed||rows.length===0||rows.some(r=>!r.valid)||busy)return;
  setBusy(true);setError("");setNotice("");
  let count=0;
  try{
   for(const item of rows){
    const r=await fetch("/api/commerce/nav02",{method:"POST",
     credentials:"same-origin",cache:"no-store",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({slug,action:"memberProfile",data:item.fields})});
    if(!r.ok){
     const reason=r.status===422?"تطبیق شاهکار رد شد":r.status===409?"کد ملی یا پرونده تکراری است":
      r.status===403?"مجوز ثبت وجود ندارد":"اعتبارسنجی پرونده یا سرویس ناموفق بود";
     throw Error("ثبت در ردیف "+item.row+" متوقف شد: "+reason);
    }
    const result=await r.json() as {saved?:boolean};
    if(result.saved!==true)throw Error("پاسخ ثبت ردیف "+item.row+" معتبر نیست.");
    count++;
   }
   setRows([]);setConfirmed(false);await onImported();
   setNotice(count+" درخواست عضویت پس از تأیید مستقل شاهکار در سرور ثبت شد. این ثبت، عضویت قانونی یا سهام ایجاد نمی‌کند.");
  }catch(e){
   setError((e instanceof Error?e.message:"خطای ثبت")+
    ". "+count+" ردیف قبلی ممکن است ذخیره شده باشند؛ قبل از تلاش مجدد فهرست را کنترل کنید.");
   // Never automatically replay already committed rows.
   setRows([]);setConfirmed(false);
   await onImported().catch(()=>{});
  }finally{setBusy(false);}
 }
 return <div className="tto-excel-toolbar" aria-label="ابزار فایل اکسل اعضا">
  <button type="button" className="tto-excel-icon" disabled={busy}
   title="ورود فایل اکسل اعضا" aria-label="ورود فایل اکسل اعضا"
   onClick={()=>filePicker.current?.click()}>
   <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V3m0 0L7 8m5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>
  </button>
  <button type="button" className="tto-excel-icon" disabled={busy}
   title="خروجی کامل اکسل اعضا؛ حاوی اطلاعات محرمانه"
   aria-label="خروجی کامل اکسل اعضای مجاز" onClick={()=>void download("export")}>
   <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13m0 0-5-5m5 5 5-5M4 18v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></svg>
  </button>
  <button type="button" disabled={busy} className="tto-excel-icon tto-excel-template"
   title="دریافت نمونه تکمیل‌شده اکسل" aria-label="دریافت فایل نمونه تکمیل‌شده اکسل"
   onClick={()=>void download("sample")}>
   <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3v5h5M8 12h8M8 16h8M11 11v6"/></svg>
  </button>
  <input ref={filePicker} type="file" className="tto-excel-file" aria-label="انتخاب فایل اکسل اعضا"
   accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
   disabled={busy} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void preview(file);e.currentTarget.value="";}}/>
  {error?<p role="alert" className="tto-excel-message">{error}</p>:null}
  {notice&&!rows.length?<p role="status" className="tto-excel-message">{notice}</p>:null}
  {rows.length>0?<div className="tto-excel-review-mask" role="dialog" aria-modal="true"
   aria-label="پیش‌نمایش ورود اعضا از اکسل">
   <section className="tto-excel-review-panel">
    <header><h2>پیش‌نمایش فایل: {filename}</h2>
     <button type="button" aria-label="بستن پیش‌نمایش" disabled={busy}
      onClick={()=>{setRows([]);setConfirmed(false);setFilename("");}}>×</button></header>
    <p role="status">{notice} هیچ رکوردی قبل از تأیید شما ذخیره نمی‌شود.</p>
    <div className="tto-nav02-table-scroll"><table className="tto-nav02-table"><thead><tr>
     <th>ردیف</th><th>نام</th><th>کد ملی</th><th>شماره همراه</th><th>کنترل اولیه</th>
    </tr></thead><tbody>{rows.map(r=><tr key={r.row}>
     <td>{r.row}</td><td>{r.fields.fullName}</td>
     <td>{r.fields.nationalId.replace(/^(.{2}).+(.{2})$/,"$1******$2")}</td>
     <td>{r.fields.mobile.replace(/^(.{4}).+(.{3})$/,"$1****$2")}</td>
     <td>{r.valid?"آماده استعلام شاهکار":r.errors.join("، ")}</td>
    </tr>)}</tbody></table></div>
    <label className="tto-excel-consent"><input type="checkbox" checked={confirmed}
      disabled={busy||rows.some(r=>!r.valid)}
      onChange={e=>setConfirmed(e.target.checked)}/>
      صحت اطلاعات، رعایت محرمانگی و اختیار ثبت این درخواست‌ها را تأیید می‌کنم.</label>
    <footer className="tto-excel-review-actions">
     <button type="button" disabled={busy||!confirmed||rows.some(r=>!r.valid)}
      onClick={()=>void commit()}>{busy?"در حال پردازش…":"استعلام شاهکار و ثبت ردیف‌ها"}</button>
     <button type="button" disabled={busy} onClick={()=>{setRows([]);setConfirmed(false);setFilename("");}}>انصراف</button>
    </footer>
    <small>ثبت‌ها ردیفی‌اند؛ توقف در یک ردیف، ردیف‌های قبلی را خودکار برنمی‌گرداند.
     فایل خروجی اطلاعات خصوصی دارد؛ آن را در محل عمومی منتشر نکنید.</small>
   </section></div>:null}
 </div>;
}
