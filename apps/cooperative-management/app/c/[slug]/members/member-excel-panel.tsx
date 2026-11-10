"use client";
import {useState} from "react";
type Profile=Record<string,string>;
type PreviewRow={row:number;valid:boolean;errors:string[];fields:Profile};
type Preview={rows:PreviewRow[];count:number;hasErrors:boolean;status:string};
export function MemberExcelPanel({slug,onImported}:{slug:string;onImported:()=>Promise<void>}){
 const [rows,setRows]=useState<PreviewRow[]>([]);
 const [filename,setFilename]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
 const url="/api/commerce/nav02/workbook?slug="+encodeURIComponent(slug);
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
 return <section className="tto-settings-card" aria-label="ورود و خروج اکسل اعضا">
  <h2>ورود و خروج فایل Excel اعضا</h2>
  <p>ابتدا فایل نمونه را دریافت کنید. ورود فایل با پیش‌نمایش و تأیید صریح انجام می‌شود؛ هر عضو پیش از ثبت، جداگانه در سرور از شاهکار استعلام می‌شود. هیچ سهامی یا حق رأی خودکار ایجاد نمی‌شود.</p>
  <div className="tto-nav02-actions">
   <a href={url+"&mode=sample"} download="TTO_Members_Sample.xlsx">دریافت نمونه Excel با یک ردیف آزمایشی</a>
   <a href={url+"&mode=export"} download="TTO_Members_Export_Masked.xlsx">خروجی Excel اعضا (اطلاعات هویتی پوشیده)</a>
  </div>
  <label>بارگذاری فایل Excel تکمیل‌شده
   <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    disabled={busy} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void preview(file);}}/>
  </label>
  {filename&&rows.length>0?<div>
   <h3>پیش‌نمایش: {filename}</h3>
   <div className="tto-nav02-table-scroll"><table className="tto-nav02-table"><thead><tr>
    <th>ردیف</th><th>نام</th><th>کد ملی</th><th>شماره همراه</th><th>کنترل اولیه</th>
   </tr></thead><tbody>{rows.map(r=><tr key={r.row}>
    <td>{r.row}</td><td>{r.fields.fullName}</td>
    <td>{r.fields.nationalId.replace(/^(.{2}).+(.{2})$/,"$1******$2")}</td>
    <td>{r.fields.mobile.replace(/^(.{4}).+(.{3})$/,"$1****$2")}</td>
    <td>{r.valid?"آماده استعلام شاهکار":r.errors.join("، ")}</td>
   </tr>)}</tbody></table></div>
   <label><input type="checkbox" checked={confirmed}
    disabled={busy||rows.some(r=>!r.valid)}
    onChange={e=>setConfirmed(e.target.checked)}/>
    صحت اطلاعات و اختیار قانونی ثبت این درخواست‌ها را تأیید می‌کنم.</label>
   <button type="button" disabled={busy||!confirmed||rows.some(r=>!r.valid)}
    onClick={()=>void commit()}>{busy?"در حال پردازش…":"استعلام شاهکار و ثبت ردیف‌ها"}</button>
   <button type="button" disabled={busy} onClick={()=>{setRows([]);setConfirmed(false);setFilename("");}}>
    لغو ورود فایل</button>
   <p>عملیات به‌صورت ردیفی انجام می‌شود؛ در صورت توقف، ردیف‌های موفق قبلی خودکار برگردانده نمی‌شوند.</p>
  </div>:null}
  {error?<p role="alert">{error}</p>:null}
  {notice?<p role="status">{notice}</p>:null}
 </section>;
}
