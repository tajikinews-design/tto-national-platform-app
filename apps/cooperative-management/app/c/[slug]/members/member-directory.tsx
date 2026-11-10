"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
export type MemberRow={
 id:string;name:string;title:string;group:string;identifierMask:string;
 mobileMask?:string;membershipNumber?:string;collectionName?:string;occupation?:string;
 membershipStatus?:string|null;shareholdingStatus?:string|null;personType?:string|null;
 identityVerification?:string;managementState?:string;state:string;version?:number;
 photoState?:string;capitalState?:string;
};
type View="list"|"archive"|"collections";
const membershipText=(v?:string|null)=>({APPLICANT_UNVERIFIED:"متقاضی",ACTIVE_REPORTED:"عضو فعال (اظهاری)",FORMER_REPORTED:"عضو سابق (اظهاری)",NON_MEMBER_REPORTED:"غیرعضو"} as Record<string,string>)[v??""]??"نامشخص";
const sharesText=(v?:string|null)=>({NONE_UNVERIFIED:"فاقد سهام",HOLDER_REPORTED:"سهامدار (اظهاری)",TRANSFER_PENDING_REPORTED:"انتقال در جریان (اظهاری)"} as Record<string,string>)[v??""]??"نامشخص";
const actions=[
 {key:"edit",glyph:"✎",label:"ویرایش کامل عضو",hint:"ویرایش در فرم ثبت عضو"},
 {key:"identity",glyph:"♧",label:"احراز هویت",hint:"وضعیت احراز هویت و مدارک"},
 {key:"termination",glyph:"⚖",label:"پایان عضویت قانونی",hint:"درخواست ثبت دلیل قانونی پایان عضویت"},
 {key:"suspend",glyph:"⏸",label:"تعلیق",hint:"تعلیق پرونده اولیه"},
 {key:"resume",glyph:"▶",label:"رفع تعلیق",hint:"رفع تعلیق پرونده اولیه"},
 {key:"archive",glyph:"▣",label:"بایگانی",hint:"انتقال به فهرست بایگانی"},
 {key:"restore",glyph:"↶",label:"بازگردانی از بایگانی",hint:"بازگردانی پرونده اولیه"},
 {key:"delete",glyph:"⌫",label:"حذف دائم",hint:"حذف شخصی فقط با ضوابط قانونی"},
 {key:"audit",glyph:"◷",label:"سوابق و تاریخچه",hint:"بازکردن سوابق ممیزی"}
] as const;
export function MemberDirectory({slug,view}:{slug:string;view:View}){
 const [rows,setRows]=useState<MemberRow[]>([]);
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState("all");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [message,setMessage]=useState("");
 const [confirm,setConfirm]=useState<MemberRow|null>(null);
 const [memberNumberStart,setMemberNumberStart]=useState("1");
 const [numberPrefix,setNumberPrefix]=useState(""),[numberSuffix,setNumberSuffix]=useState("");
 const [numberPreview,setNumberPreview]=useState("");
 const [policyMessage,setPolicyMessage]=useState("");
 const [catalog,setCatalog]=useState<string[]>([]);
 const [newCatalog,setNewCatalog]=useState("");
 const [catalogMessage,setCatalogMessage]=useState("");
 const base="/c/"+encodeURIComponent(slug)+"/members/";
 async function load(){
  const response=await fetch("/api/commerce/nav02?slug="+encodeURIComponent(slug),
   {credentials:"same-origin",cache:"no-store"});
  if(!response.ok)throw Error(response.status===401?"برای مشاهده اطلاعات وارد شوید.":
   response.status===403?"مجوز دسترسی به پرونده‌های این تعاونی ندارید.":"سرویس فهرست اعضا در دسترس نیست.");
  const data=await response.json() as {items?:MemberRow[]};
  if(!Array.isArray(data.items))throw Error("پاسخ فهرست معتبر نیست.");
  setRows(data.items);
 }
 useEffect(()=>{
  let live=true;
  void load().catch(e=>{if(live)setMessage(String(e instanceof Error?e.message:e))})
    .finally(()=>{if(live)setLoading(false)});
  return ()=>{live=false};
 },[slug]);
 const baseRows=useMemo(()=>rows.filter(x=>view==="archive"?
  x.managementState==="ARCHIVED_DRAFT":x.managementState!=="ARCHIVED_DRAFT"),[rows,view]);
 const entries=useMemo(()=>baseRows.filter(x=>{
  const text=[x.name,x.membershipNumber,x.collectionName,x.group,x.identifierMask,x.mobileMask,x.personType,
   membershipText(x.membershipStatus),sharesText(x.shareholdingStatus)]
   .filter(Boolean).join(" ").toLocaleLowerCase("fa-IR");
  return (!search||text.includes(search.toLocaleLowerCase("fa-IR"))) &&
   (filter==="all"||(filter==="suspended"&&x.managementState==="SUSPENDED_DRAFT")||
    (filter==="active"&&x.managementState!=="SUSPENDED_DRAFT"));
 }),[baseRows,search,filter]);
 const groups=useMemo(()=>{
  const o=new Map<string,MemberRow[]>();
  for(const name of catalog)if(name)o.set(name,[]);
  for(const x of rows){const name=x.collectionName?.trim();if(!name)continue;
   o.set(name,[...(o.get(name)??[]),x]);}
  return [...o].sort(([a],[b])=>a.localeCompare(b,"fa"));
 },[rows,catalog]);
 useEffect(()=>{
  let live=true;
  fetch("/api/commerce/nav02/collections?slug="+encodeURIComponent(slug),
   {credentials:"same-origin",cache:"no-store"})
   .then(async r=>r.ok?r.json() as Promise<{items?:{name?:string}[]}>:{items:[]})
   .then(d=>{if(live)setCatalog((d.items??[]).map(x=>x.name??"").filter(Boolean))})
   .catch(()=>{});
  fetch("/api/commerce/nav02/member-number-policy?slug="+encodeURIComponent(slug),
   {credentials:"same-origin",cache:"no-store"})
   .then(async r=>r.ok?r.json() as Promise<{policy?:{nextSerial:string;prefix:string;suffix:string}}>:null)
   .then(d=>{
    if(!live||!d?.policy)return;
    setMemberNumberStart(d.policy.nextSerial);
    setNumberPrefix(d.policy.prefix);setNumberSuffix(d.policy.suffix);
   }).catch(()=>{});
  return()=>{live=false};
 },[slug]);
 const [selectedGroup,setSelectedGroup]=useState("");
 const chosen=groups.find(([name])=>name===selectedGroup);
 async function run(row:MemberRow,action:string){
  if(action==="edit"){window.location.assign(base+"add?edit="+encodeURIComponent(row.id));return}
  if(action==="audit"){window.location.assign(base+"profile/"+encodeURIComponent(row.id)+"?tab=system");return}
  if(action==="identity"){window.location.assign(base+"profile/"+encodeURIComponent(row.id)+"?tab=identity");return}
  if(action==="termination"){window.location.assign(base+"profile/"+encodeURIComponent(row.id)+"?tab=termination");return}
  if(action==="delete"){setConfirm(row);return}
  if(!["suspend","resume","archive","restore"].includes(action))return;
  if(!Number.isSafeInteger(row.version)||!row.version){setMessage("نسخه پرونده برای تغییر وضعیت تأیید نشده است.");return}
  setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/commerce/nav02/manage",{method:"POST",credentials:"same-origin",
    cache:"no-store",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({slug,draftId:row.id,version:row.version,action})});
   if(!res.ok)throw Error(res.status===409?"نسخه پرونده تغییر کرده است؛ صفحه را تازه‌سازی کنید.":
    res.status===403?"مجوز این تغییر وضعیت را ندارید.":"وضعیت پرونده تغییر نکرد.");
   const data=await res.json() as {saved?:unknown};
   if(data.saved!==true)throw Error("تأیید سرور برای تغییر وضعیت دریافت نشد.");
   await load();setMessage("وضعیت پیش‌نویس با موفقیت ثبت شد؛ حقوق قانونی عضویت و سهام تغییر نکرد.");
  }catch(e){setMessage(e instanceof Error?e.message:"خطای ارتباط");}
  finally{setBusy(false)}
 }
 return <div className="tto-nav02-page">
  <header className="tto-nav02-hero"><span className="tto-settings-eyebrow">NAV-02 · مدیریت اعضا</span>
   <h1>{view==="list"?"لیست اعضا":view==="archive"?"بایگانی اعضا":"مجموعه‌های اعضا"}</h1>
   <p>اطلاعات عضویت و مجموعه‌ها جدا از حقوق سهامداری و دفتر رسمی سهام نمایش داده می‌شوند.</p>
  </header>
  <nav className="tto-nav02-switch" aria-label="بخش‌های مدیریت اعضا">
   <Link href={base+"add"}>＋ ثبت عضو</Link>
   <Link href={base+"shares"}>▣ ثبت سهام</Link>
   <Link href={base+"list"} aria-current={view==="list"?"page":undefined}>☷ لیست اعضا</Link>
   <Link href={base+"collections"} aria-current={view==="collections"?"page":undefined}>▥ مجموعه‌ها</Link>
   <Link href={base+"archive"} aria-current={view==="archive"?"page":undefined}>▣ بایگانی</Link>
  </nav>
  {view==="collections"?<div className="tto-nav02-card">
   <h2>مجموعه‌ها و افراد وابسته</h2>
   <p>برای مشاهده افراد هر مجموعه، آن را انتخاب کنید. فقط مجموعه‌های دارای عضو ثبت‌شده در اطلاعات مجاز نمایش داده می‌شوند.</p>
   <form className="tto-member-catalog-create" onSubmit={async e=>{
    e.preventDefault();
    const name=newCatalog.trim();
    if(name.length<3){setCatalogMessage("نام مجموعه باید حداقل سه حرف باشد.");return;}
    try{
     const r=await fetch("/api/commerce/nav02/collections",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({slug,name})});
     if(!r.ok)throw Error(r.status===403?"مجوز افزودن مجموعه ندارید.":
       "سرویس ثبت مجموعه هنوز فعال نشده است؛ هیچ مجموعه‌ای ذخیره نشد.");
     const d=await r.json() as {saved?:boolean;record?:{name?:string}};
     if(d.saved!==true||d.record?.name!==name)throw Error("تأیید ثبت مجموعه دریافت نشد.");
     setCatalog(old=>[...new Set([...old,name])]);setSelectedGroup(name);
     setNewCatalog("");setCatalogMessage("مجموعه در سرور ثبت شد.");
    }catch(err){setCatalogMessage(err instanceof Error?err.message:"ثبت ناموفق بود.")}
   }}>
    <label>نام مجموعه جدید<input maxLength={100} value={newCatalog}
     onChange={e=>setNewCatalog(e.target.value)} placeholder="مثلاً شهرداری طرقبه" required/></label>
    <button type="submit">ثبت مجموعه</button>
   </form>
   {catalogMessage?<p role="status">{catalogMessage}</p>:null}
   <div className="tto-member-collection-grid">
    <aside className="tto-member-collection-list" aria-label="فهرست مجموعه‌ها">
     {groups.length?groups.map(([name,members])=><button key={name} type="button"
      className={selectedGroup===name?"selected":""} onClick={()=>setSelectedGroup(name)}>
       <span>{name}</span><b>{members.length.toLocaleString("fa-IR")} نفر</b>
      </button>):<p>هنوز مجموعه‌ای از سرور دریافت نشده است.</p>}
    </aside>
    <section className="tto-member-collection-members">
     <h3>{chosen?chosen[0]:"یک مجموعه را انتخاب کنید"}</h3>
     {chosen?chosen[1].map(m=><Link key={m.id} href={base+"profile/"+encodeURIComponent(m.id)}>
      <span>{m.title} {m.name}</span><small>{m.membershipNumber||"شماره تخصیص نیافته"}</small>
     </Link>):<p>با انتخاب مجموعه، اعضای وابسته به آن در این بخش نمایش داده می‌شوند.</p>}
    </section>
   </div>
   <p className="tto-nav02-boundary">ثبت مجموعه خالی و انتساب رسمی آن به عضو نیازمند دفتر مجموعه‌ها و API تأییدشده است؛ نام مجموعه صرفاً با ذخیره امن داده عضو دائمی می‌شود.</p>
  </div>:
  <div className="tto-nav02-card tto-nav02-directory">
   <div className="tto-nav02-directory-tools">
    <label>جست‌وجو<input type="search" value={search} onChange={e=>setSearch(e.target.value)}
     placeholder="نام، شماره عضویت، گروه یا مجموعه"/></label>
    <label>وضعیت<select value={filter} onChange={e=>setFilter(e.target.value)}>
     <option value="all">همه وضعیت‌ها</option><option value="active">فعال / متقاضی</option>
     <option value="suspended">معلق</option></select></label>
    <span className="tto-nav02-directory-count">تعداد: {entries.length.toLocaleString("fa-IR")}</span>
   </div>
   <div className="tto-nav02-table-scroll">
    <table className="tto-nav02-table tto-member-directory-table">
     <thead><tr>
      <th>عکس</th><th>شماره عضویت</th><th>نام / عنوان</th><th>نوع شخصیت</th>
      <th>وضعیت عضویت</th><th>وضعیت سهام</th><th>احراز هویت</th><th>مجموعه</th>
      <th>گروه</th><th>شناسه ملی</th><th>شماره همراه</th><th>عملیات حاکمیتی</th>
     </tr></thead>
     <tbody>{entries.map(row=><tr key={row.id}>
      <td><span className="tto-member-photo-thumb" role="img" aria-label={row.photoState==="QUARANTINED"?"عکس در قرنطینه و غیرقابل نمایش است":"عکس تأییدشده موجود نیست"}>♙</span></td>
      <td className="tto-nav02-num">{row.membershipNumber||"در انتظار صدور"}</td>
      <td><Link className="tto-member-person-link" href={base+"profile/"+encodeURIComponent(row.id)}>
       {row.title} {row.name}</Link><small className="tto-nav02-row-mask">مشاهده پرونده عضویت</small></td>
      <td><strong>{row.personType==="LEGAL"?"حقوقی":"حقیقی"}</strong></td>
      <td><span className={"tto-nav02-state "+(row.managementState==="SUSPENDED_DRAFT"?"suspended":"pending")}>
       {membershipText(row.membershipStatus)}{row.managementState==="SUSPENDED_DRAFT"?" · معلق":""}</span></td>
      <td>{sharesText(row.shareholdingStatus)}</td>
      <td><span title="استعلام یا تطبیق اعلام‌شده، حق عضویت قانونی ایجاد نمی‌کند">{row.identityVerification==="SHAHKAR_CONFIRMED"?"✓ شاهکار":row.identityVerification==="REPRESENTATIVE_MOBILE_CONFIRMED"?"✓ موبایل نماینده":"نیازمند احراز"}</span></td>
      <td>{row.collectionName||"—"}</td>
      <td>{row.group||"—"}</td>
      <td dir="ltr">{row.identifierMask||"—"}</td>
      <td dir="ltr">{row.mobileMask||"پوشیده"}</td>
      <td><div className="tto-member-actions">
       {actions.map(a=>{
        if(view==="archive"&&a.key!=="restore"&&a.key!=="audit"&&a.key!=="edit"&&a.key!=="identity")return null;
        if(view!=="archive"&&a.key==="restore")return null;
        if(a.key==="termination"&&(row.membershipStatus==="NON_MEMBER_REPORTED"||row.membershipStatus==="FORMER_REPORTED"))return null;
        if(a.key==="suspend"&&row.managementState==="SUSPENDED_DRAFT")return null;
        if(a.key==="resume"&&row.managementState!=="SUSPENDED_DRAFT")return null;
        return <button type="button" key={a.key} disabled={busy} title={a.label}
         aria-label={a.label+" "+row.name} className={a.key==="delete"?"danger":""}
         onClick={()=>void run(row,a.key)}>{a.glyph}</button>;
       })}
      </div></td>
     </tr>)}
     </tbody>
    </table>
   </div>
   {loading?<p role="status">در حال دریافت پرونده‌های مجاز…</p>:null}
   {!loading&&entries.length===0?<p>پرونده‌ای مطابق این فیلتر یافت نشد.</p>:null}
   {message?<p role="status" className="tto-nav02-message">{message}</p>:null}
   {confirm?<div className="tto-member-confirm-mask" role="dialog" aria-modal="true"
     aria-label="کنترل حذف دائم">
      <div className="tto-member-confirm">
       <h3>حذف دائم اطلاعات عضویت</h3>
       <p>پرونده «{confirm.name}» انتخاب شد. حذف داده‌های شخصی بدون بررسی الزام نگهداری،
        سهام و سوابق حقوقی مجاز نیست. شماره عضویت صادرشده حتی پس از حذف نیز هرگز
        دوباره تخصیص داده نخواهد شد.</p>
       <p>این عملیات تا استقرار کنترل‌های حقوقی و دفتر شماره‌های ابطالی فعال نیست.</p>
       <button type="button" onClick={()=>setConfirm(null)}>بستن</button>
      </div>
    </div>:null}
  </div>}
  {view==="list"?<section className="tto-nav02-card tto-member-number-policy">
   <h2>تنظیم ساختار شماره عضویت</h2>
   <p>شماره باید به‌صورت تراکنشی توسط سرور صادر شود؛ پیشوند و پسوند بخش ثابت شماره صادرشده هستند.
    تغییر تنظیمات نباید شماره‌های قبلی را تغییر دهد یا دوباره تخصیص دهد.</p>
   <div className="tto-member-policy-fields">
    <label>شروع شماره عضویت<input type="text" inputMode="numeric" value={memberNumberStart}
     onChange={e=>setMemberNumberStart(e.target.value)} placeholder="۱"/></label>
    <label>پیشوند<input type="text" dir="ltr" maxLength={12} value={numberPrefix}
     onChange={e=>setNumberPrefix(e.target.value.toUpperCase())} placeholder="TTO-"/></label>
    <label>پسوند<input type="text" dir="ltr" maxLength={12} value={numberSuffix}
     onChange={e=>setNumberSuffix(e.target.value.toUpperCase())} placeholder="-TR"/></label>
    <button type="button" onClick={()=>{
     if(!/^[0-9]{1,12}$/.test(memberNumberStart)||
       !/^[A-Z0-9-]{0,12}$/.test(numberPrefix)||!/^[A-Z0-9-]{0,12}$/.test(numberSuffix)){
      setNumberPreview("فرمت شماره، پیشوند یا پسوند معتبر نیست.");return;
     }
     setNumberPreview(numberPrefix+memberNumberStart.padStart(6,"0")+numberSuffix);
    }}>پیش‌نمایش شماره</button>
   </div>
   {numberPreview?<p role="status">پیش‌نمایش قالب (ذخیره نشده): <b dir="ltr">{numberPreview}</b></p>:null}
   <div className="tto-member-policy-actions">
    <button type="button" onClick={async()=>{
     if(!/^[1-9][0-9]{0,11}$/.test(memberNumberStart)||
       !/^[A-Z0-9-]{0,12}$/.test(numberPrefix)||!/^[A-Z0-9-]{0,12}$/.test(numberSuffix)){
      setPolicyMessage("ساختار شماره نامعتبر است.");return;
     }
     setPolicyMessage("");
     try{
      const r=await fetch("/api/commerce/nav02/member-number-policy",{
       method:"POST",credentials:"same-origin",cache:"no-store",
       headers:{"Content-Type":"application/json"},
       body:JSON.stringify({slug,nextSerial:memberNumberStart,prefix:numberPrefix,suffix:numberSuffix})
      });
      if(!r.ok)throw Error(r.status===400?"شماره شروع نباید از شماره تخصیص‌نیافته فعلی کمتر باشد.":
       "دفتر شماره عضویت هنوز به سرور متصل نشده است؛ تنظیمات ذخیره نشد.");
      const d=await r.json() as {saved?:boolean};
      if(d.saved!==true)throw Error("تأیید ثبت تنظیمات دریافت نشد.");
      setPolicyMessage("تنظیمات صدور شماره برای اعضای آینده در سرور ثبت شد.");
     }catch(err){setPolicyMessage(err instanceof Error?err.message:"ذخیره ناموفق بود.")}
    }}>ذخیره تنظیمات شماره عضویت</button>
   </div>
   {policyMessage?<p role="status">{policyMessage}</p>:null}
   <small>شماره‌های قبلی دائمی هستند و پس از حذف عضو نیز در رجیستری محفوظ می‌مانند. رزرو شماره توسط مرورگر انجام نمی‌شود.</small>
  </section>:null}
 </div>;
}
