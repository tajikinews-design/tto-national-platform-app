"use client";
import {useEffect,useState,type FormEvent} from "react";
type Member={id:string;name:string;personType?:string;membershipStatus?:string;identifierMask?:string};
type Officer={id:string;version:number;officeCode:string;memberDraftId:string|null;externalName:string|null;
 ceoSource:string;signingAuthorized:boolean;signingScope:string;startDate:string;endDate:string;
 gazetteName:string;gazetteDate:string|null;gazetteIssue:string;noticeNumber:string;status:string};
const offices=[
 ["BOARD_CHAIR","رئیس هیئت‌مدیره"],["BOARD_VICE_CHAIR","نایب‌رئیس هیئت‌مدیره"],
 ["CEO","مدیرعامل"],["BOARD_MEMBER","عضو هیئت‌مدیره"],
 ["BOARD_SECRETARY","منشی هیئت‌مدیره"],["AUDITOR_PRIMARY","بازرس اصلی"],
 ["AUDITOR_ALT1","بازرس علی‌البدل اول"],["AUDITOR_ALT2","بازرس علی‌البدل دوم"]
] as const;
const empty={officeCode:"BOARD_CHAIR",ceoSource:"MEMBER",memberDraftId:"",
 externalName:"",signingAuthorized:false,signingScope:"",startDate:"",
 endDate:"",gazetteName:"",gazetteDate:"",gazetteIssue:"",noticeNumber:""};
export function OfficersSettings({slug}:{slug:string}){
 const [members,setMembers]=useState<Member[]>([]);
 const [items,setItems]=useState<Officer[]>([]);
 const [form,setForm]=useState(empty);
 const [editTarget,setEditTarget]=useState<{id:string;version:number}|null>(null);
 const [historyId,setHistoryId]=useState("");
 const [history,setHistory]=useState<{versionBefore:number;versionAfter:number;revisedAt:string;previous:Record<string,unknown>}[]>([]);
 const [search,setSearch]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const base="/api/commerce/nav02/officers";
 async function load(){
  const [mr,or]=await Promise.all([
   fetch("/api/commerce/nav02?slug="+encodeURIComponent(slug),{credentials:"same-origin",cache:"no-store"}),
   fetch(base+"?slug="+encodeURIComponent(slug),{credentials:"same-origin",cache:"no-store"})
  ]);
  if(!mr.ok||!or.ok)throw Error("دریافت اعضا یا پیش‌نویس سمت‌ها در دسترس نیست.");
  const m=await mr.json() as {items?:Member[]};
  const o=await or.json() as {items?:Officer[]};
  if(!Array.isArray(m.items)||!Array.isArray(o.items))throw Error("فهرست دریافتی معتبر نیست.");
  setMembers(m.items.filter(x=>x.personType==="NATURAL"&&x.membershipStatus!=="NON_MEMBER_REPORTED"));
  setItems(o.items);
 }
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:"خطای دریافت فهرست"));},[slug]);
 const external=form.officeCode==="CEO"&&form.ceoSource==="EXTERNAL";
 const candidates=members.filter(x=>(x.name+" "+(x.identifierMask||"")).toLocaleLowerCase("fa")
  .includes(search.toLocaleLowerCase("fa")));
 const labelFor=(code:string)=>offices.find(x=>x[0]===code)?.[1]||code;
 function editItem(o:Officer){
  setEditTarget({id:o.id,version:o.version});
  setForm({officeCode:o.officeCode,ceoSource:o.ceoSource,memberDraftId:o.memberDraftId||"",
   externalName:o.externalName||"",signingAuthorized:o.signingAuthorized,
   signingScope:o.signingScope||"",startDate:o.startDate,endDate:o.endDate,
   gazetteName:o.gazetteName||"",gazetteDate:o.gazetteDate||"",
   gazetteIssue:o.gazetteIssue||"",noticeNumber:o.noticeNumber||""});
  setError("");setMessage("در حال ویرایش نسخه "+o.version+" پیش‌نویس انتخاب‌شده هستید.");
 }
 async function showHistory(id:string){
  setHistoryId(id);setHistory([]);setError("");
  try{const r=await fetch(base+"/history?slug="+encodeURIComponent(slug)+"&id="+encodeURIComponent(id),
    {credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error("دریافت سوابق با دسترسی فعلی ممکن نیست.");
   const d=await r.json() as {items?:typeof history};
   if(!Array.isArray(d.items))throw Error("پاسخ سوابق معتبر نیست.");
   setHistory(d.items);
  }catch(e){setError(e instanceof Error?e.message:"خطای دریافت تاریخچه");}
 }
 function update<K extends keyof typeof empty>(key:K,value:(typeof empty)[K]){
  setForm(old=>({...old,[key]:value}));
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const payload={slug,...form,...(editTarget?{id:editTarget.id,version:editTarget.version}:{}),ceoSource:external?"EXTERNAL":"MEMBER",
    memberDraftId:external?null:form.memberDraftId,
    externalName:external?form.externalName:"",
    gazetteDate:form.gazetteDate||null};
   const r=await fetch(base+(editTarget?"/edit":""),{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   if(!r.ok)throw Error(r.status===409?"پیش‌نویس توسط کاربر دیگری ویرایش شده است؛ فهرست را تازه‌سازی کنید.":r.status===403?"انتخاب شخص یا مجوز ثبت برای این تعاونی معتبر نیست.":
    r.status===400?"مشخصات سمت یا تاریخ‌ها معتبر نیست.":"پیش‌نویس سمت ذخیره نشد.");
   const data=await r.json() as {saved?:boolean;status?:string;legalPowerGranted?:boolean};
   if(data.saved!==true||data.status!=="DRAFT_ONLY"||data.legalPowerGranted!==false)
    throw Error("سرور وضعیت غیرعملیاتی پیش‌نویس را تأیید نکرد.");
   setForm(empty);setEditTarget(null);await load();setMessage("پیش‌نویس ذخیره شد؛ این ثبت، اعتبار حقوقی سمت یا حق امضا ایجاد نمی‌کند.");
  }catch(e){setError(e instanceof Error?e.message:"خطای ثبت");}
  finally{setBusy(false);}
 }
 return <section className="tto-settings-page" dir="rtl">
  <header className="tto-settings-hero"><div>
   <span className="tto-settings-eyebrow">تنظیمات تعاونی · ارکان مدیریتی</span>
   <h1>هیئت‌مدیره، مدیرعامل، بازرسان و صاحبان امضا</h1>
   <p>ثبت اطلاعات سمت و آگهی رسمی به‌صورت پیش‌نویس؛ اعتبار سمت و امضا پس از کنترل اسناد و مرجع صلاحیت‌دار تعیین می‌شود.</p>
  </div></header>
  <div className="tto-settings-card">
   <h2>{editTarget?"ویرایش پیش‌نویس سمت":"ثبت پیش‌نویس سمت"}</h2>
   <p role="status">افراد هیئت‌مدیره و بازرسان از فهرست اعضای همین تعاونی انتخاب می‌شوند. مدیرعامل می‌تواند خارج از تعاونی باشد.</p>
   <form onSubmit={e=>void submit(e)} className="tto-nav02-form">
    <label>سمت <select value={form.officeCode} onChange={e=>{
     const officeCode=e.target.value;
     setForm(x=>({...x,officeCode,ceoSource:officeCode==="CEO"?x.ceoSource:"MEMBER"}));
    }}>{offices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {form.officeCode==="CEO"?<label>وضعیت مدیرعامل
      <select value={form.ceoSource} onChange={e=>update("ceoSource",e.target.value)}>
       <option value="MEMBER">عضو شرکت تعاونی</option>
       <option value="EXTERNAL">خارج از شرکت تعاونی</option>
      </select></label>:null}
    {external?<label>نام و نام خانوادگی مدیرعامل بیرونی
     <input required minLength={3} maxLength={180} value={form.externalName}
      onChange={e=>update("externalName",e.target.value)}/></label>:<>
     <label>جست‌وجو در فهرست اعضا
      <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
       placeholder="نام یا شناسه پوشیده عضو"/></label>
     <label>انتخاب عضو
      <select required value={form.memberDraftId} onChange={e=>update("memberDraftId",e.target.value)}>
       <option value="">یک عضو را انتخاب کنید</option>
       {candidates.map(x=><option key={x.id} value={x.id}>
        {x.name} — {x.identifierMask||"شناسه محفوظ"}</option>)}
      </select>
     </label></>}
    <label>حدود امضا
      <select value={form.signingAuthorized?"yes":"no"}
       onChange={e=>update("signingAuthorized",e.target.value==="yes")}>
       <option value="no">بدون امضای مجاز</option>
       <option value="yes">صاحب امضای مجاز (اظهاری)</option>
      </select>
    </label>
    <label>شرح حدود اختیارات و ترکیب امضا
      <textarea maxLength={1000} value={form.signingScope}
       onChange={e=>update("signingScope",e.target.value)} rows={2}/></label>
    <label>تاریخ شروع سمت (میلادی موقت) <input required type="date" value={form.startDate}
     onChange={e=>update("startDate",e.target.value)}/></label>
    <label>تاریخ پایان سمت (میلادی موقت) <input required type="date" min={form.startDate||undefined}
     value={form.endDate} onChange={e=>update("endDate",e.target.value)}/></label>
    <label>روزنامه انتشار آگهی <input maxLength={160} value={form.gazetteName}
     onChange={e=>update("gazetteName",e.target.value)}/></label>
    <label>تاریخ انتشار آگهی (میلادی موقت) <input type="date" value={form.gazetteDate}
     onChange={e=>update("gazetteDate",e.target.value)}/></label>
    <label>شماره روزنامه <input maxLength={80} value={form.gazetteIssue}
     onChange={e=>update("gazetteIssue",e.target.value)}/></label>
    <label>شماره آگهی <input maxLength={100} value={form.noticeNumber}
     onChange={e=>update("noticeNumber",e.target.value)}/></label>
    <div className="tto-nav02-actions">
     <button disabled={busy||(!external&&!form.memberDraftId)} type="submit">
      {busy?"در حال ذخیره…":editTarget?"ثبت ویرایش نسخه "+editTarget.version:"ذخیره پیش‌نویس سمت"}</button>
     {editTarget?<button type="button" onClick={()=>{setEditTarget(null);setForm(empty);setMessage("");}}>انصراف از ویرایش</button>:null}
    </div>
   </form>
   {error?<p role="alert">{error}</p>:null}{message?<p role="status">{message}</p>:null}
  </div>
  <section className="tto-settings-card">
   <h2>پیش‌نویس‌های ثبت‌شده</h2>
   {items.length===0?<p>هنوز پیش‌نویسی ثبت نشده است.</p>:
    <div className="tto-nav02-table-scroll"><table className="tto-nav02-table"><thead><tr>
     <th>سمت</th><th>شخص</th><th>امضا</th><th>شروع</th><th>پایان</th><th>شماره آگهی</th><th>نسخه</th><th>وضعیت و عملیات</th>
    </tr></thead><tbody>{items.map(item=><tr key={item.id}>
     <td>{labelFor(item.officeCode)}</td>
     <td>{item.externalName||members.find(x=>x.id===item.memberDraftId)?.name||"عضو ثبت‌شده"}</td>
     <td>{item.signingAuthorized?"اظهاری":"خیر"}</td>
     <td>{item.startDate}</td><td>{item.endDate}</td>
     <td>{item.noticeNumber||"—"}</td><td>{item.version}</td><td>پیش‌نویس غیررسمی
     <div><button type="button" onClick={()=>editItem(item)}>ویرایش</button>
     <button type="button" onClick={()=>void showHistory(item.id)}>تاریخچه</button></div></td>
    </tr>)}</tbody></table></div>}
  </section>
  {historyId?<section className="tto-settings-card"><h2>تاریخچه ویرایش پیش‌نویس</h2>
    <button type="button" onClick={()=>{setHistoryId("");setHistory([]);}}>بستن تاریخچه</button>
    {history.length===0?<p>ویرایشی ثبت نشده است.</p>:<ol>{history.map((h,i)=>
     <li key={i}>نسخه {h.versionBefore} به {h.versionAfter}، {new Date(h.revisedAt).toLocaleString("fa-IR")}
      <details><summary>مشاهده مقادیر پیش از تغییر</summary>
       <pre dir="ltr">{JSON.stringify(h.previous,null,2)}</pre></details>
     </li>)}</ol>}
   </section>:null}
 </section>;
}
