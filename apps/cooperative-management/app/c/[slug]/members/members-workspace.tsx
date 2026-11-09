"use client";
import {useEffect,useMemo,useState,type ChangeEvent,type FormEvent} from "react";
import Link from "next/link";
import {type InvestorTitle,type DraftPerson,type DraftCapital,peopleFor,capitalFor,
 addPerson,addCapital,clearDrafts,latinDigits,maskIdentifier} from "./draft-store";
type Section="add"|"shares";
const groupOptions=["سهامدار حقیقی","سهامدار حقوقی","سهامدار غیرعضو","سایر / بررسی حقوقی"];
const titleOptions:InvestorTitle[]=["آقا","خانم","شرکت","سازمان","اداره"];
const today=()=>new Date().toISOString();
const emptyPerson={title:"آقا" as InvestorTitle,fullName:"",group:"سهامدار حقیقی",nationalIdentifier:"",
 fatherName:"",birthCertificate:"",birthDate:"",birthPlace:"",telephone:"",mobile:"",postalCode:"",address:""};
const emptyCapital={initialShares:"",committedShares:"",nominalValue:"",paidAmount:"",paymentDate:"",receiptNumber:""};
function validPersianDate(value:string){return /^(13|14)[0-9]{2}[/][01][0-9][/][0-3][0-9]$/.test(value) &&
 +value.split("/")[1]>=1&&+value.split("/")[1]<=12&&+value.split("/")[2]>=1&&+value.split("/")[2]<=31}
function positiveInteger(value:string){return /^[0-9]+$/.test(value)&&BigInt(value)>0n}
function nonnegativeInteger(value:string){return /^[0-9]+$/.test(value)}
function field(label:string,id:string,value:string,onChange:(x:string)=>void,props:Record<string,unknown>={}){
 return <label className="tto-settings-field" htmlFor={id}><span>{label}</span>
 <input id={id} name={id} value={value} onChange={e=>onChange(e.target.value)} {...props}/></label>
}
export function MembersWorkspace({slug,section}:{slug:string;section:Section}){
 const [people,setPeople]=useState<DraftPerson[]>([]);
 const [capital,setCapital]=useState<DraftCapital[]>([]);
 const [person,setPerson]=useState(emptyPerson);
 const [share,setShare]=useState(emptyCapital);
 const [photo,setPhoto]=useState<File|null>(null);
 const [preview,setPreview]=useState<string|null>(null);
 const [selected,setSelected]=useState("");
 const [search,setSearch]=useState("");
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [permit,setPermit]=useState(false);
 const updatePerson=(key:keyof typeof emptyPerson)=>(value:string)=>{
  setPerson(s=>({...s,[key]:value}));setError("");setNotice("");
 };
 const updateShare=(key:keyof typeof emptyCapital)=>(value:string)=>{
  setShare(s=>({...s,[key]:latinDigits(value).trim()}));setError("");setNotice("");
 };
 useEffect(()=>{setPeople(peopleFor(slug));setCapital(capitalFor(slug))},[slug,section]);
 useEffect(()=>{
  if(!photo){setPreview(null);return;}
  const obj=URL.createObjectURL(photo);setPreview(obj);
  return()=>{URL.revokeObjectURL(obj)};
 },[photo]);
 const found=useMemo(()=>{
  const q=latinDigits(search).trim().toLocaleLowerCase("fa");
  return people.filter(p=>!q||p.fullName.toLocaleLowerCase("fa").includes(q)||
   p.nationalIdentifier.includes(q));
 },[people,search]);
 const picked=people.find(p=>p.id===selected);
 const personCount=people.length;
 const count=capital.length;
 function addPersonDraft(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");setNotice("");
  if(!permit){setError("برای ادامه، تأیید کنید که صرفاً از اطلاعات ساختگی استفاده می‌کنید.");return}
  const legal=["شرکت","سازمان","اداره"].includes(person.title);
  const identifier=latinDigits(person.nationalIdentifier).trim();
  if(!/^[0-9]{10,11}$/.test(identifier)||(legal?identifier.length!==11:identifier.length!==10)){
   setError(legal?"شناسه ملی شخص حقوقی باید ۱۱ رقم باشد.":"کد ملی شخص حقیقی باید ۱۰ رقم باشد.");return}
  if(person.fullName.trim().length<3){setError("نام شخص یا عنوان شخصیت حقوقی لازم است.");return}
  if(person.mobile&& !/^09[0-9]{9}$/.test(latinDigits(person.mobile))){
   setError("شماره موبایل واردشده معتبر نیست.");return}
  if(person.postalCode&& !/^[0-9]{10}$/.test(latinDigits(person.postalCode))){
   setError("کدپستی در صورت ثبت باید ۱۰ رقم باشد.");return}
  if(person.birthDate&&!validPersianDate(latinDigits(person.birthDate))){
   setError("تاریخ تولد را به‌صورت ۱۴۰۰/۰۱/۰۱ وارد کنید.");return}
  const draft:DraftPerson={...person,id:crypto.randomUUID(),nationalIdentifier:identifier,
   mobile:latinDigits(person.mobile),postalCode:latinDigits(person.postalCode),
   birthDate:latinDigits(person.birthDate),photoName:photo?.name??"",createdAt:today()};
  if(!addPerson(slug,draft)){setError("این شناسه قبلاً در پیش‌نویس‌های همین تب ثبت شده است.");return}
  setPeople(peopleFor(slug));setPerson(emptyPerson);setPhoto(null);setPermit(false);
  setNotice("پیش‌نویس سهامدار فقط در حافظه همین تب ایجاد شد؛ هیچ داده هویتی یا عکس به سرور ارسال نشده است.");
 }
 function addSharesDraft(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");setNotice("");
  if(!permit){setError("تأیید استفاده از اطلاعات ساختگی لازم است.");return}
  if(!picked){setError("ابتدا سهامدار را از فهرست جست‌وجو انتخاب کنید.");return}
  const keys=["initialShares","nominalValue","paidAmount"] as const;
  if(keys.some(key=>!positiveInteger(share[key]))||
   !nonnegativeInteger(share.committedShares||"0")){
   setError("تعداد اولیه، مبلغ اسمی و مبلغ پرداختی باید مثبت و تعداد تعهد غیرمنفی باشد.");return}
  if(!validPersianDate(share.paymentDate)){setError("تاریخ پرداخت را به شکل ۱۴۰۵/۰۸/۱۸ وارد کنید.");return}
  if(share.receiptNumber.trim().length<3){setError("شماره فیش یا پیگیری را وارد کنید.");return}
  const draft:DraftCapital={...share,id:crypto.randomUUID(),personId:picked.id,createdAt:today(),
   committedShares:share.committedShares||"0"};
  if(!addCapital(slug,draft)){setError("سهامدار در فهرست پیش‌نویس همین تب یافت نشد.");return}
  setCapital(capitalFor(slug));setShare(emptyCapital);setPermit(false);
  setNotice("اطلاعات سهام صرفاً به‌عنوان پیش‌نویس آزمایشی ثبت شد؛ مانده رسمی، رسید بانکی و انتقال مالکیت تأیید نشده‌اند.");
 }
 function photoChange(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0]??null;
  if(file&&(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>2*1024*1024)){
   setError("فرمت عکس باید JPG، PNG یا WebP و حجم آن کمتر از ۲ مگابایت باشد.");e.target.value="";return;
  }
  setPhoto(file);setError("");
 }
 function removeAll(){
  clearDrafts(slug);setPeople([]);setCapital([]);setSelected("");setNotice("تمام پیش‌نویس‌های حافظه این تب پاک شدند.");setError("");
 }
 const calculated=positiveInteger(share.initialShares||"0")&&positiveInteger(share.nominalValue||"0")?
  (BigInt(share.initialShares)*BigInt(share.nominalValue)).toLocaleString("fa-IR"):null;
 return <div className="tto-settings-page tto-members-page">
  <header className="tto-settings-hero">
   <div><span className="tto-settings-eyebrow">♙ CHILD-06 / CHILD-07 · ثبت آزمایشی</span>
    <h1>{section==="add"?"افزودن سهامدار":"ثبت اطلاعات اولیه سهام"}</h1>
    <p>{section==="add"?"تعریف پرونده هویتی آزمایشی سهامدار؛ وضعیت عضویت و حق رأی جداگانه بررسی می‌شود.":
    "سهامدار را جست‌وجو کنید و مشخصات خرید اولیه، تعهد و پرداخت را فقط به‌صورت پیش‌نویس وارد کنید."}</p>
   </div><span className="tto-settings-hero-icon" aria-hidden="true">♙</span>
  </header>
  <nav className="tto-settings-switcher" aria-label="زیرمنوهای اعضا و سهام">
   <Link href={"/c/"+slug+"/members/add"} aria-current={section==="add"?"page":undefined}>＋ افزودن سهامدار</Link>
   <Link href={"/c/"+slug+"/members/shares"} aria-current={section==="shares"?"page":undefined}>▥ اطلاعات سهام</Link>
  </nav>
  <div className="tto-members-warning" role="note">
   <strong>محیط غیررسمی و موقت</strong> — برای آزمایش فرم از داده کاملاً ساختگی استفاده کنید. اطلاعات واردشده
   فقط در حافظه همین تب مرورگر است، با نوسازی صفحه از بین می‌رود و هیچ اتصال به دفتر رسمی اعضا یا سهام، بانک یا سامانه ثبت ندارد.
   عکس انتخاب‌شده فقط پیش‌نمایش محلی دارد و ارسال یا ذخیره نمی‌شود.
  </div>
  <section className="tto-settings-access-stats" aria-label="شمارنده پیش‌نویس‌ها">
   <div className="tto-settings-stat"><small>پرونده‌های ساختگی این تب</small><strong>{personCount.toLocaleString("fa-IR")}</strong></div>
   <div className="tto-settings-stat"><small>پیش‌نویس‌های سهام</small><strong>{count.toLocaleString("fa-IR")}</strong></div>
   <div className="tto-settings-stat"><small>سهم رسمی ثبت‌شده</small><strong>۰</strong></div>
  </section>
  <div className="tto-settings-grid">
   <div>
    {section==="add"?<section className="tto-settings-card">
     <header className="tto-settings-card-head"><span className="tto-settings-card-icon">♙</span>
      <div><h2>مشخصات سهامدار</h2><p>تمام فیلدهای موردنیاز؛ اشخاص حقیقی و حقوقی از هم تفکیک می‌شوند.</p></div>
     </header>
     <form onSubmit={addPersonDraft} autoComplete="off" noValidate={false}>
      <div className="tto-settings-fields">
       <label className="tto-settings-field" htmlFor="member-title"><span>عنوان</span>
        <select id="member-title" value={person.title} onChange={e=>{
         const title=e.target.value as InvestorTitle;
         setPerson(s=>({...s,title,group:["شرکت","سازمان","اداره"].includes(title)?"سهامدار حقوقی":"سهامدار حقیقی"}));
        }} required>{titleOptions.map(v=><option key={v}>{v}</option>)}</select>
       </label>
       <label className="tto-settings-field" htmlFor="member-group"><span>گروه سهامدار</span>
        <select id="member-group" value={person.group} onChange={e=>updatePerson("group")(e.target.value)}>
         {groupOptions.map(v=><option key={v}>{v}</option>)}</select>
       </label>
       {field(["شرکت","سازمان","اداره"].includes(person.title)?"نام شخص حقوقی":"نام و نام خانوادگی","member-full-name",person.fullName,updatePerson("fullName"),{required:true,maxLength:120,placeholder:"نام کامل"})}
       {field(["شرکت","سازمان","اداره"].includes(person.title)?"شناسه ملی شخصیت حقوقی":"شماره ملی","member-national",person.nationalIdentifier,updatePerson("nationalIdentifier"),{required:true,inputMode:"numeric",dir:"ltr",maxLength:11,placeholder:["شرکت","سازمان","اداره"].includes(person.title)?"۱۱ رقم":"۱۰ رقم"})}
       {field("نام پدر","member-father",person.fatherName,updatePerson("fatherName"),{maxLength:80,placeholder:"برای اشخاص حقیقی"})}
       {field("شماره شناسنامه","member-birth-id",person.birthCertificate,updatePerson("birthCertificate"),{maxLength:20,inputMode:"numeric"})}
       {field("تاریخ تولد (شمسی)","member-birth-date",person.birthDate,updatePerson("birthDate"),{placeholder:"۱۴۰۰/۰۱/۰۱",dir:"ltr",maxLength:10})}
       {field("محل تولد","member-birthplace",person.birthPlace,updatePerson("birthPlace"),{maxLength:100})}
       {field("تلفن ثابت","member-telephone",person.telephone,updatePerson("telephone"),{inputMode:"tel",dir:"ltr",maxLength:20})}
       {field("موبایل","member-mobile",person.mobile,updatePerson("mobile"),{inputMode:"tel",dir:"ltr",maxLength:11,placeholder:"09123456789"})}
       {field("کدپستی","member-postal",person.postalCode,updatePerson("postalCode"),{inputMode:"numeric",dir:"ltr",maxLength:10})}
       <label className="tto-settings-field wide" htmlFor="member-address"><span>آدرس</span>
        <textarea id="member-address" value={person.address} onChange={e=>updatePerson("address")(e.target.value)}
         maxLength={500} rows={3} placeholder="نشانی کامل"/></label>
       <div className="tto-settings-field wide">
        <label htmlFor="member-photo">عکس پرسنلی (فقط پیش‌نمایش محلی)</label>
        <input id="member-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={photoChange}/>
        {photo?<div className="tto-members-photo-preview">{preview?<img src={preview} alt="پیش‌نمایش محلی عکس انتخاب‌شده"/>:null}
         <span>{photo.name}<br/><small>فایل به سرور ارسال نمی‌شود.</small></span>
         <button type="button" onClick={()=>setPhoto(null)}>حذف عکس</button>
        </div>:null}
       </div>
      </div>
      <div className="tto-settings-section-line"/>
      <label className="tto-members-consent"><input type="checkbox" checked={permit} onChange={e=>setPermit(e.target.checked)}/>
       تأیید می‌کنم داده‌ها کاملاً ساختگی‌اند و ثبت من اعتبار حقوقی یا مالی ندارد.</label>
      <div className="tto-settings-button-row"><button type="submit" className="tto-settings-btn" disabled={!permit}>ثبت پیش‌نویس سهامدار</button>
       <button type="reset" className="tto-settings-btn secondary" onClick={()=>{setPerson(emptyPerson);setPhoto(null);setError("");setPermit(false)}}>پاک‌کردن فرم</button></div>
     </form>
    </section>:<section className="tto-settings-card">
     <header className="tto-settings-card-head"><span className="tto-settings-card-icon">▥</span>
      <div><h2>جست‌وجو و انتخاب سهامدار</h2><p>اطلاعات سهام فقط به رکورد ساختگی ایجادشده در زیرمنوی قبل مرتبط می‌شود.</p></div>
     </header>
     <label className="tto-settings-field" htmlFor="member-search"><span>جست‌وجو با نام یا شماره ملی</span>
      <input id="member-search" value={search} onChange={e=>setSearch(e.target.value)}
       placeholder="نام سهامدار یا شماره ملی آزمایشی" autoComplete="off"/></label>
     <div className="tto-members-search-results" role="listbox" aria-label="سهامداران ساختگی">
      {found.map(p=><button type="button" key={p.id} className={p.id===selected?"picked":""}
       onClick={()=>{setSelected(p.id);setError("")}} role="option" aria-selected={p.id===selected}>
       <strong>{p.fullName}</strong><small>{p.title} · {p.group} · {maskIdentifier(p.nationalIdentifier)}</small>
      </button>)}
      {found.length===0?<p>سهامداری یافت نشد؛ ابتدا در زیرمنوی «افزودن سهامدار» یک رکورد ساختگی بسازید.</p>:null}
     </div>
     {picked?<div className="tto-settings-note">سهامدار انتخاب‌شده: <strong>{picked.fullName}</strong> ·
      {maskIdentifier(picked.nationalIdentifier)} <br/> انتخاب سهامدار به‌معنی تأیید عضویت یا حق رأی نیست.</div>:null}
     <div className="tto-settings-section-line"/>
     <form onSubmit={addSharesDraft} autoComplete="off">
      <div className="tto-settings-fields">
       {field("تعداد سهام خریداری‌شده اولیه","share-initial",share.initialShares,updateShare("initialShares"),{required:true,inputMode:"numeric",dir:"ltr",pattern:"[0-9]+",placeholder:"0"})}
       {field("تعداد سهام در تعهد","share-committed",share.committedShares,updateShare("committedShares"),{inputMode:"numeric",dir:"ltr",placeholder:"0"})}
       {field("مبلغ اسمی هر سهم (ریال)","share-face",share.nominalValue,updateShare("nominalValue"),{required:true,inputMode:"numeric",dir:"ltr",pattern:"[0-9]+",placeholder:"ریال"})}
       {field("مبلغ پرداختی (ریال)","share-paid",share.paidAmount,updateShare("paidAmount"),{required:true,inputMode:"numeric",dir:"ltr",pattern:"[0-9]+",placeholder:"ریال"})}
       {field("تاریخ پرداخت (شمسی)","share-date",share.paymentDate,updateShare("paymentDate"),{required:true,dir:"ltr",maxLength:10,placeholder:"۱۴۰۵/۰۸/۱۸"})}
       {field("شماره پیگیری / شماره فیش بانکی","share-ref",share.receiptNumber,updateShare("receiptNumber"),{required:true,maxLength:80,placeholder:"کد ساختگی برای آزمون"})}
      </div>
      {calculated?<div className="tto-settings-note" style={{marginTop:16}}>ارزش اسمی سهام اولیه: <strong>{calculated} ریال</strong>
       <br/> این محاسبه نه تأیید پرداخت است و نه مالکیت رسمی.</div>:null}
      <div className="tto-settings-section-line"/>
      <label className="tto-members-consent"><input type="checkbox" checked={permit} onChange={e=>setPermit(e.target.checked)}/>
       تمام تعدادها، مبالغ و شماره فیش صرفاً ساختگی و فاقد اثر بانکی و حقوقی هستند.</label>
      <div className="tto-settings-button-row"><button type="submit" className="tto-settings-btn" disabled={!picked||!permit}>ثبت پیش‌نویس اطلاعات سهام</button></div>
     </form>
    </section>}
    {error?<div style={{marginTop:15}} className="tto-settings-note error" role="alert">{error}</div>:null}
    {notice?<div style={{marginTop:15}} className="tto-settings-note success" role="status">{notice}</div>:null}
   </div>
   <aside className="tto-settings-card">
    <header className="tto-settings-card-head"><span className="tto-settings-card-icon">◇</span>
     <div><h2>فهرست پیش‌نویس‌های موقت</h2><p>فقط در همین تب مرورگر و صرفاً برای بازبینی گردش‌کار</p></div></header>
    {people.length===0?<p>هنوز سهامداری در حافظه این تب ثبت نشده است.</p>:people.map(p=><div className="tto-members-person-summary" key={p.id}>
     <strong>{p.fullName}</strong><small>{p.group} · {maskIdentifier(p.nationalIdentifier)}</small>
     <small>{capital.filter(c=>c.personId===p.id).length.toLocaleString("fa-IR")} پیش‌نویس سهام</small>
    </div>)}
    <button type="button" className="tto-settings-btn danger" onClick={removeAll}
     style={{marginTop:18}} disabled={people.length===0}>پاک‌کردن همه پیش‌نویس‌های این تب</button>
    <div className="tto-settings-section-line"/>
    <h3>گیت‌های رسمی باقی‌مانده</h3>
    <div className="tto-settings-tip"><span>①</span><div><strong>CHILD-06: عضویت و رابطه قانونی</strong>
     <small>تطبیق با Member Master، Party و منبع دارای اختیار لازم است.</small></div></div>
    <div className="tto-settings-tip"><span>②</span><div><strong>CHILD-07: دفتر رسمی سهام</strong>
     <small>دفتر افتتاحیه، جمع سهام و مغایرت‌های رسمی باید تأیید شوند.</small></div></div>
    <div className="tto-settings-tip"><span>③</span><div><strong>پرداخت و سند هویتی</strong>
     <small>کد فیش و انتخاب عکس، مدرک احراز بانک یا هویت نیست.</small></div></div>
   </aside>
  </div>
 </div>;
}
