"use client";
import Link from "next/link";
import {JalaliBirthDatePicker,jalaliToGregorianISO,gregorianISOToJalali} from "./jalali-birth-picker";
import {MemberSidebar} from "./member-side-panel";
import {useEffect,useMemo,useState,type FormEvent} from "react";
type Section="add"|"shares";
type RecordItem={id:string;name:string;title:string;group:string;identifierMask:string;membershipStatus?:string|null;
 state:string;initialShares?:number;subscribedShares?:number;nominalRial?:number;
 declaredPaidRial?:number;capitalState?:string};
const TITLES=["آقا","خانم"] as const;
const MEMBER_STATES=[["APPLICANT_UNVERIFIED","متقاضی"],["ACTIVE_REPORTED","عضو فعال (اظهاری)"],["FORMER_REPORTED","عضو سابق (اظهاری)"],["NON_MEMBER_REPORTED","غیرعضو"]] as const;
const SHARE_STATES=[["NONE_UNVERIFIED","فاقد سهام"],["HOLDER_REPORTED","سهامدار (اظهاری)"],["TRANSFER_PENDING_REPORTED","انتقال در جریان (اظهاری)"]] as const;
const initialProfile={title:"آقا",fullName:"",group:"متقاضی عضویت",nationalId:"",fatherName:"",
 birthCertificate:"",birthDate:"",birthPlace:"",telephone:"",mobile:"",postalCode:"",address:"",
 collectionName:"",occupation:"",
 bornInCounty:"no",residentInCounty:"no",employedInCounty:"no",
 informationConfirmed:"no",membershipStatus:"APPLICANT_UNVERIFIED",
 personType:"NATURAL",shareholdingStatus:"NONE_UNVERIFIED",registrationNumber:"",economicCode:"",
 representativeName:"",representativeNationalId:"",representativeMobile:""};
const initialCapital={initialShares:"0",subscribedShares:"0",nominalRial:"",paidRial:"0",
 paymentDate:"",receiptRef:""};
type Profile=typeof initialProfile;type Capital=typeof initialCapital;
const fields:[keyof Profile,string,number,boolean][]=[
 ["group","گروه عضویت",90,true],["nationalId","کد ملی",10,true],
 ["fatherName","نام پدر",120,false],["birthCertificate","شماره شناسنامه",45,false],
 ["birthDate","تاریخ تولد",10,false],["birthPlace","محل تولد",120,false],
 ["telephone","تلفن",25,false],["mobile","موبایل",20,false],
 ["postalCode","کدپستی",12,false],["address","نشانی کامل",600,false]
];
/** A check digit detects typing errors; only an authorized registry can verify a person's identity. */
function toLatinDigits(value:string){
 return value.replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776))
  .replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632));
}
function validIranianNationalId(value:string){
 if(!/^[0-9]{10}$/.test(value)||/^([0-9])\1{9}$/.test(value))return false;
 const sum=Array.from(value.slice(0,9)).reduce((total,digit,index)=>
  total+Number(digit)*(10-index),0);
 const remainder=sum%11;
 return Number(value[9])===(remainder<2?remainder:11-remainder);
}
function faNumber(n:number){return n.toLocaleString("fa-IR")}
function Field({title,children,wide}:{title:string;children:React.ReactNode;wide?:boolean}){
 return <label className={"tto-nav02-field"+(wide?" wide":"")}><span>{title}</span>{children}</label>;
}
export function MemberDraftForms({slug,section}:{slug:string;section:Section}){
 const [items,setItems]=useState<RecordItem[]>([]),[search,setSearch]=useState("");
 const [profile,setProfile]=useState<Profile>(initialProfile);
 const [capital,setCapital]=useState<Capital>(initialCapital);
 const [draftId,setDraftId]=useState("");
 const [photo,setPhoto]=useState<File|null>(null),[photoUrl,setPhotoUrl]=useState("");
 const [photoRetryId,setPhotoRetryId]=useState("");
 const [attachment,setAttachment]=useState<File|null>(null);
 const [attachmentSubject,setAttachmentSubject]=useState("");
 const [editId,setEditId]=useState("");
 const [editVersion,setEditVersion]=useState<number|null>(null);
 const [editLoading,setEditLoading]=useState(false);
 const [personalDataConfirmed,setPersonalDataConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [notice,setNotice]=useState(""),[error,setError]=useState(false);
 const base="/c/"+encodeURIComponent(slug)+"/members/";
 useEffect(()=>{
  if(section!=="add")return;
  const id=new URLSearchParams(window.location.search).get("edit");
  if(id&&/^[0-9a-f-]{36}$/i.test(id))setEditId(id);
 },[section]);
 useEffect(()=>{
  if(!editId||section!=="add")return;
  let active=true;
  setEditLoading(true);setEditVersion(null);setError(false);setNotice("");
  const url="/api/commerce/nav02/member-profile?slug="+encodeURIComponent(slug)+
    "&draftId="+encodeURIComponent(editId);
  void fetch(url,{credentials:"same-origin",cache:"no-store"}).then(async r=>{
   if(!r.ok){
    const payload=await r.json().catch(()=>null) as {code?:unknown}|null;
    const code=typeof payload?.code==="string"?payload.code:"";
    if(code==="IDENTITY_ENCRYPTION_UNAVAILABLE")
     throw Error("بازیابی پرونده رمزنگاری‌شده در سرور ممکن نیست؛ تنظیمات کلید و نسخه API بررسی شود.");
    throw Error(r.status===401?"نشست ورود منقضی شده است.":
     r.status===403?"دسترسی ویرایش پرونده را ندارید.":"دریافت امن پرونده انجام نشد.");
   }
   return r.json() as Promise<{profile?:Record<string,unknown>;version?:number;managementState?:string}>;
  }).then(result=>{
   if(!active)return;
   if(!result.profile||!Number.isSafeInteger(result.version)||
    result.managementState!=="ACTIVE_DRAFT")throw Error("پرونده در وضعیت قابل ویرایش نیست.");
   const clean:Record<string,string>={...initialProfile};
   for(const k of Object.keys(initialProfile)){
    const v=result.profile[k];if(typeof v==="string"&&v.length<=700)clean[k]=v;
   }
   if(!["NATURAL","LEGAL"].includes(clean.personType))
    throw Error("نوع شخصیت پرونده معتبر نیست.");
   setProfile(clean as unknown as Profile);setEditVersion(Number(result.version));
   setPersonalDataConfirmed(false);
  }).catch(err=>{if(active){setError(true);
   setNotice(err instanceof Error?err.message:"دریافت پرونده ناموفق بود.")}})
   .finally(()=>{if(active)setEditLoading(false)});
  return()=>{active=false};
 },[slug,editId,section]);
 useEffect(()=>{
  if(!photo){setPhotoUrl("");return}
  const url=URL.createObjectURL(photo);setPhotoUrl(url);
  return()=>URL.revokeObjectURL(url);
 },[photo]);
 async function refresh(){
  const r=await fetch("/api/commerce/nav02?slug="+encodeURIComponent(slug),
   {credentials:"same-origin",cache:"no-store"});
  if(!r.ok)throw Error(r.status===403?"دسترسی مدیریت پرونده‌های این تعاونی برای حساب شما تأیید نشده است.":
   r.status===401?"نشست منقضی شده است؛ دوباره وارد شوید.":"سرویس پرونده‌های اعضا در دسترس نیست.");
  const d=await r.json() as {items?:RecordItem[]};
  if(!Array.isArray(d.items))throw Error("پاسخ سامانه معتبر نیست.");
  setItems(d.items);return d.items;
 }
 useEffect(()=>{let live=true;void refresh().catch(e=>{if(live){setError(true);setNotice(String(e.message))}})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[slug]);
 useEffect(()=>{
  if(section!=="shares"||items.length===0)return;
  const requested=new URLSearchParams(window.location.search).get("draft");
  if(requested&&items.some(x=>x.id===requested&&
      (x as RecordItem & {managementState?:string}).managementState!=="SUSPENDED_DRAFT"))
    setDraftId(requested);
 },[section,items]);
 const selected=items.find(x=>x.id===draftId);
 const visibleItems=items;
 const filtered=visibleItems.filter(x=>(x as RecordItem & {managementState?:string}).managementState!=="SUSPENDED_DRAFT").filter(x=>(x.name+" "+x.identifierMask+" "+x.group).toLocaleLowerCase("fa")
  .includes(search.toLocaleLowerCase("fa")));
 const subtotal=useMemo(()=>{
  try{return (BigInt(capital.initialShares||0)+BigInt(capital.subscribedShares||0))*
    BigInt(capital.nominalRial||0)}catch{return 0n}
 },[capital]);
 function change(k:keyof Profile,value:string){
  setProfile(old=>({...old,[k]:["nationalId","mobile","registrationNumber","economicCode","representativeNationalId","representativeMobile"].includes(k)?toLatinDigits(value):value}));setNotice("");
 }
 const mobileError=profile.mobile.length===0?"":!/^09[0-9]{9}$/.test(profile.mobile) ?
  "شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.":"";
 const nationalIdError=profile.nationalId.length===0?"":profile.personType==="LEGAL"?
  (!/^\d{0,11}$/.test(profile.nationalId)||profile.nationalId.length===11&&!/^\d{11}$/.test(profile.nationalId)?"شناسه ملی شخص حقوقی باید ۱۱ رقم باشد.":""):
  !/^[0-9]{0,10}$/.test(profile.nationalId)?"کد ملی باید فقط ۱۰ رقم باشد.":
  profile.nationalId.length===10&&!validIranianNationalId(profile.nationalId)?
  "کد ملی معتبر نیست؛ رقم کنترل را بررسی کنید.":"";
 const countyCondition=profile.bornInCounty==="yes"||profile.residentInCounty==="yes"||
  profile.employedInCounty==="yes";
 async function savePhoto(file:File,id:string){
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size<68||file.size>5242880)
   throw Error("عکس باید JPEG، PNG یا WebP با حجم کمتر از ۵ مگابایت باشد.");
  // Decode then re-encode a bounded raster. No original metadata or active
  // file format is sent to the server. It remains private to the tenant owner.
  let image:ImageBitmap;
  try{image=await createImageBitmap(file);}catch{throw Error("ساختار تصویر معتبر نیست؛ عکس دیگری انتخاب کنید.");}
  let normalized:Blob;
  try{
   if(image.width<1||image.height<1||image.width>9000||image.height>9000)
    throw Error("ابعاد تصویر قابل قبول نیست.");
   const scale=Math.min(1,800/image.width,1000/image.height);
   const canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(image.width*scale));
   canvas.height=Math.max(1,Math.round(image.height*scale));
   const ctx=canvas.getContext("2d");
   if(!ctx)throw Error("پردازش تصویر در این مرورگر پشتیبانی نمی‌شود.");
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   normalized=await new Promise<Blob>((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(Error("پردازش عکس ناموفق بود.")),"image/jpeg",.83);
   });
  }finally{image.close();}
  if(normalized.size<68||normalized.size>716800)
   throw Error("حجم عکس پس از آماده‌سازی باید حداکثر ۷۰۰ کیلوبایت باشد.");
  const bytes=new Uint8Array(await normalized.arrayBuffer());
  let bin="";
  for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const r=await fetch("/api/commerce/nav02/photo",{
   method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({slug,draftId:id,mime:"image/jpeg",dataBase64:btoa(bin)})
  });
  if(!r.ok)throw Error(r.status===403?"مجوز جایگزینی عکس در این تعاونی را ندارید.":
   r.status===409?"پرونده عکس هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.":
   "ذخیره عکس خصوصی موفق نبود؛ اطلاعات پرونده قبلاً ذخیره شده‌اند.");
  const result=await r.json() as {saved?:boolean;status?:string;visible?:boolean};
  if(result.saved!==true||result.status!=="READY_PRIVATE"||result.visible!==true)
   throw Error("سرور آماده‌بودن تصویر خصوصی را تأیید نکرد.");
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setError(false);setNotice("");
  if(section==="add"){
   if(!personalDataConfirmed){setError(true);setNotice("تأیید صحت اطلاعات و مجوز ثبت آن لازم است.");return}
   if(photoRetryId){setError(true);setNotice("آپلود عکس پرونده قبلی را تکمیل یا لغو کنید.");return}
   if(editId&&editVersion===null){setError(true);setNotice("تا دریافت امن پرونده، ویرایش امکان ثبت ندارد.");return}
   if(attachment){setError(true);setNotice("ضمیمه انتخاب شده اما سرویس قرنطینه مدارک هنوز متصل نیست؛ برای جلوگیری از ثبت ناقص، فایل را حذف کنید یا منتظر فعال‌سازی امن ضمائم بمانید.");return}
   if(profile.personType==="NATURAL"&&!/^09[0-9]{9}$/.test(profile.mobile)){
    setError(true);setNotice("شماره همراه معتبر نیست؛ شماره ۱۱ رقمی متعلق به صاحب کد ملی را وارد کنید.");return;
   }
   if(profile.personType==="LEGAL"){
    if(!/^\d{11}$/.test(profile.nationalId)||!/^[0-9]{1,30}$/.test(profile.registrationNumber)||
       !/^\d{12,14}$/.test(profile.economicCode)||!profile.representativeName.trim()||
       !validIranianNationalId(profile.representativeNationalId)||
       !/^09[0-9]{9}$/.test(profile.representativeMobile)||profile.membershipStatus!=="NON_MEMBER_REPORTED"){
      setError(true);setNotice("شناسه ملی، شماره ثبت، شماره اقتصادی و مشخصات نماینده قانونی را تکمیل کنید. شخصیت حقوقی فقط به‌عنوان سهامدار غیرعضو ثبت می‌شود.");return;
    }
   }else if(!validIranianNationalId(profile.nationalId)){
    setError(true);setNotice("کد ملی نامعتبر است؛ شماره باید ۱۰ رقم و دارای رقم کنترل صحیح باشد.");return;
   }
   if(profile.personType==="NATURAL"&&profile.membershipStatus!=="NON_MEMBER_REPORTED"&&!countyCondition){
    setError(true);setNotice("طبق قانون، تولد یا سکونت یا اشتغال در شهرستان کافی است؛ حداقل یک گزینه را انتخاب کنید.");return;
   }
   if(profile.personType==="NATURAL"&&!["آقا","خانم"].includes(profile.title)){
    setError(true);setNotice("عنوان شخص حقیقی نامعتبر است.");return;
   }
  }else{
   if(!draftId){setError(true);setNotice("ابتدا سهامدار را از فهرست انتخاب کنید.");return}
   if((BigInt(capital.initialShares||0)+BigInt(capital.subscribedShares||0))<=0n||
     !capital.nominalRial||!capital.receiptRef.trim()||
     BigInt(capital.paidRial||0)>subtotal){
    setError(true);setNotice("تعداد سهام، مبلغ اسمی، پرداخت و شماره فیش را بررسی کنید. مبلغ اظهارشده نباید از کل ارزش اسمی بیشتر باشد.");return;
   }
  }
  setBusy(true);
  try{
   const req=section==="add"?
    editId?
     {slug,draftId:editId,version:editVersion,data:{...profile,informationConfirmed:"yes"}}:
     {slug,action:profile.personType==="LEGAL"?"legalProfile":"memberProfile",data:{...profile,informationConfirmed:"yes"}}:
    {slug,action:"capital",draftId,data:capital};
   const r=await fetch(editId?"/api/commerce/nav02/member-profile":"/api/commerce/nav02",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(req)});
   if(!r.ok){
    const response=await r.json().catch(()=>null) as {code?:unknown}|null;
    const code=typeof response?.code==="string"?response.code:"";
    if(r.status===503&&section==="add"){
     const detail:Record<string,string>={
      IDENTITY_PROVIDER_NOT_CONFIGURED:"اتصال شاهکار در سرور تنظیم نشده است؛ پرونده ثبت نشد.",
      IDENTITY_PROVIDER_UNAVAILABLE:"سرویس شاهکار پاسخ معتبر نداده است؛ ثبت انجام نشد. پس از برقراری سرویس دوباره اقدام کنید.",
      IDENTITY_ENCRYPTION_UNAVAILABLE:"سرویس رمزنگاری پرونده در سرور آماده نیست؛ ثبت انجام نشد.",
      INTAKE_UNAVAILABLE:"سرویس ثبت اعضا خطا دارد؛ وضعیت اتصال و گزارش سرور بررسی شود."
     };
     if(detail[code])throw Error(detail[code]);
    }
    throw Error(r.status===409?"این پرونده یا اطلاعات اولیه سهام قبلاً ثبت شده است.":
    r.status===403?"مجوز ورود اطلاعات برای این تعاونی وجود ندارد.":
    r.status===422?"شماره همراه با کد ملی واردشده مطابقت ندارد؛ شماره‌ای متعلق به صاحب کد ملی وارد کنید.":
    r.status===400?"کد ملی، تاریخ تولد یا شرایط عضویت معتبر نیست.":
    r.status===503&&section==="add"?"اتصال به سرویس هویت یا دفتر اعضا برقرار نیست؛ ثبت انجام نشد.":
    "ذخیره اطلاعات انجام نشد.");
   }
   const d=await r.json() as {saved?:boolean;record?:{id?:unknown}};
   if(d.saved!==true)throw Error("ثبت توسط سرور تأیید نشد.");
   if(editId){
    const ver=(d.record as {version?:unknown}|undefined)?.version;
    if(typeof ver==="number"&&Number.isSafeInteger(ver))setEditVersion(ver);
    if(photo){
     setPhotoRetryId(editId);
     try{await savePhoto(photo,editId);setPhoto(null);setPhotoRetryId("");}
     catch(err){await refresh();throw Error("اطلاعات ویرایش شد؛ "+
      (err instanceof Error?err.message:"ذخیره عکس انجام نشد."));}
    }
    await refresh();
    setError(false);setNotice("تمام اطلاعات و تصویر انتخابی (در صورت وجود) ذخیره شدند؛ تغییر هویت برای احراز مجدد علامت‌گذاری می‌شود.");
    return;
   }
   // The profile commit is separate. Never retry the profile on a photo error.
   if(section==="add"&&photo){
    const id=d.record?.id;
    if(typeof id!=="string"){setError(true);setNotice("پرونده ثبت شد ولی شناسه عکس معتبر نیست.");return}
    setPhotoRetryId(id);
    try{
     await savePhoto(photo,id);
     setPhotoRetryId("");setPhoto(null);setPersonalDataConfirmed(false);
     setProfile(initialProfile);
     await refresh();
     setError(false);
     setNotice("پرونده و عکس به‌صورت خصوصی ثبت شد؛ عکس در فهرست و سوابق قابل مشاهده است.");
    }catch(err){
     await refresh();
     setError(true);
     setNotice(err instanceof Error?err.message:"پرونده ذخیره شد ولی عکس هنوز بارگذاری نشده است؛ دوباره تلاش کنید.");
    }
    return;
   }
   await refresh();
   setError(false);setNotice(section==="add"?
    "پرونده با وضعیت اظهاری ثبت شد؛ احراز و آثار قانونی عضویت و سهام نیازمند شواهد مستقل است.":
    "اطلاعات اظهارشده سهام ذخیره شد؛ دفتر رسمی سهام و مانده قانونی تغییر نکردند.");
   if(section==="add"){setProfile(initialProfile);setPersonalDataConfirmed(false);}
   else{setCapital(initialCapital);setDraftId("")}
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:"خطا در ثبت")}
  finally{setBusy(false)}
 }
 return <div className="tto-nav02-page">
  <header className="tto-nav02-hero">
   <span className="tto-settings-eyebrow">NAV-02 · پرونده عضویت</span>
   <h1>{section==="add"?"ثبت عضو":"ثبت سهام"}</h1>
   <p>{section==="add"?
    "ثبت پرونده اشخاص حقیقی و حقوقی و وضعیت اظهاری عضویت و سهامداری، بدون اعطای حق رأی یا مالکیت.":
    "ثبت اطلاعات اولیه سهام با رعایت تفکیک قانونی عضو و سهامدار غیرعضو."}</p>
  </header>
  <nav aria-label="زیرمنوهای اعضا و سهام" className="tto-nav02-switch">
   <Link href={base+"add"} aria-current={section==="add"?"page":undefined}>♙ ثبت عضو</Link>
   <Link href={base+"shares"} aria-current={section==="shares"?"page":undefined}>▥ ثبت سهام</Link>
   <Link href={base+"list"}>☷ لیست اعضا</Link>
   <Link href={base+"collections"}>▥ مجموعه‌ها</Link>
   <Link href={base+"shareholders"}>♧ سهامداران</Link>
  </nav>
  {section==="shares"?<div className="tto-nav02-warning" role="status">
   اطلاعات سرمایه در این بخش صرفاً اظهار اولیه است و جایگزین دفتر رسمی سهام نیست.</div>:null}
  <div className={"tto-nav02-layout"+(section==="add"?" tto-nav02-member-layout":"")}>
   <section className="tto-nav02-card" aria-label={section==="add"?"فرم افزودن اعضا":"فرم اظهار اطلاعات سهام"}>
    <h2>{section==="add"?"مشخصات متقاضی عضویت":"اطلاعات سرمایه و پرداخت اظهارشده"}</h2>
    {editId&&section==="add"?<div className="tto-nav02-warning" role="status">
     {editLoading?"در حال دریافت امن پرونده…":
      editVersion===null?"امکان ویرایش تا دریافت معتبر پرونده وجود ندارد.":
      "ویرایش پرونده با ثبت تاریخچه و کنترل نسخه انجام می‌شود."}
     <p><Link href={base+"profile/"+encodeURIComponent(editId)}>مشاهده پرونده عضو</Link>
      {" · "}<Link href={base+"add"}>ثبت عضو جدید</Link></p>
    </div>:null}
    <form onSubmit={submit} className="tto-nav02-form">
     {section==="add"?<>
      <div className="tto-member-number-notice">
       <strong>شماره عضویت:</strong>
       <span>پس از ثبت و تخصیص قطعی در دفتر شماره‌های یکتا صادر می‌شود</span>
       <Link href={"/c/"+encodeURIComponent(slug)+"/settings/member-number"}>تنظیم قالب شماره عضویت</Link>
      </div>
      <div className="tto-nav02-name-row">
       <Field title="نوع شخصیت *"><select value={profile.personType} onChange={e=>{
        const legal=e.target.value==="LEGAL";
        setProfile(old=>({...old,personType:legal?"LEGAL":"NATURAL",
         title:legal?"شرکت":"آقا",group:legal?"سهامدار غیرعضو":"متقاضی عضویت",
         nationalId:"",membershipStatus:legal?"NON_MEMBER_REPORTED":"APPLICANT_UNVERIFIED"}));
       }}><option value="NATURAL">حقیقی</option><option value="LEGAL">حقوقی</option></select></Field>
       {profile.personType==="NATURAL"?<Field title="عنوان *"><select value={profile.title} onChange={e=>change("title",e.target.value)}>
        {TITLES.map(t=><option key={t}>{t}</option>)}</select></Field>:null}
       <Field title={profile.personType==="LEGAL"?"نام شرکت یا شخصیت حقوقی *":"نام و نام خانوادگی *"}>
        <input required maxLength={180} autoComplete={profile.personType==="NATURAL"?"name":"organization"}
         value={profile.fullName} onChange={e=>change("fullName",e.target.value)}/></Field>
      </div>
      <div className="tto-nav02-name-row">
       <Field title="وضعیت عضویت *"><select value={profile.membershipStatus}
         onChange={e=>change("membershipStatus",e.target.value)}>
        {MEMBER_STATES.filter(([key])=>profile.personType!=="LEGAL"||key==="NON_MEMBER_REPORTED")
          .map(([key,label])=><option key={key} value={key}>{label}</option>)}
       </select></Field>
       <Field title="وضعیت سهامداری *"><select value={profile.shareholdingStatus}
        onChange={e=>change("shareholdingStatus",e.target.value)}>
        {SHARE_STATES.map(([key,label])=><option key={key} value={key}>{label}</option>)}
       </select></Field>
      </div>
      {profile.personType==="LEGAL"?<>
       <Field title="شناسه ملی شخصیت حقوقی *"><input required dir="ltr" inputMode="numeric" minLength={11} maxLength={11}
        value={profile.nationalId} onChange={e=>change("nationalId",e.target.value)}/></Field>
       <Field title="شماره ثبت *"><input required maxLength={30} inputMode="numeric"
        value={profile.registrationNumber} onChange={e=>change("registrationNumber",e.target.value)}/></Field>
       <Field title="شماره اقتصادی *"><input required maxLength={14} inputMode="numeric"
        value={profile.economicCode} onChange={e=>change("economicCode",e.target.value)}/></Field>
       <Field title="نام نماینده معرفی‌شده *"><input required maxLength={180}
        value={profile.representativeName} onChange={e=>change("representativeName",e.target.value)}/></Field>
       <Field title="کد ملی نماینده *"><input required maxLength={10} inputMode="numeric" dir="ltr"
        value={profile.representativeNationalId} onChange={e=>change("representativeNationalId",e.target.value)}/></Field>
       <Field title="تلفن همراه نماینده *"><input required maxLength={11} inputMode="numeric" dir="ltr"
        value={profile.representativeMobile} onChange={e=>change("representativeMobile",e.target.value)}/></Field>
       <Field title="شماره تماس شرکت"><input maxLength={25}
        value={profile.telephone} onChange={e=>change("telephone",e.target.value)}/></Field>
       <Field title="کدپستی"><input maxLength={12} value={profile.postalCode}
        onChange={e=>change("postalCode",e.target.value)}/></Field>
       <Field title="نشانی ثبت‌شده" wide><textarea maxLength={600} rows={3}
        value={profile.address} onChange={e=>change("address",e.target.value)}/></Field>
       <p className="tto-nav02-membership-note">شخص حقوقی در این فرم فقط به‌عنوان غیرعضو ثبت می‌شود؛ شماره ثبت، شماره اقتصادی و سمت و اختیار نماینده باید با مدارک رسمی تطبیق یابد. وضعیت سهامداری انتخابی اظهاری است.</p>
      </>:fields.map(([key,label,max,required])=>key==="birthDate"?
       <div key="jalali-birth-row" className="tto-nav02-birth-row">
        <div className="tto-nav02-field"><span>تاریخ تولد (شمسی)</span>
         <JalaliBirthDatePicker value={profile.birthDate} onChange={v=>change("birthDate",v)}/>
        </div>
        <Field title="محل تولد"><input value={profile.birthPlace} maxLength={120}
         onChange={e=>change("birthPlace",e.target.value)}/></Field>
       </div>:key==="birthPlace"?null:<Field key={key} title={label+(required?" *":"")}
       wide={key==="address"}>
       {key==="address"?<textarea value={profile.address} rows={3} maxLength={600}
        onChange={e=>change("address",e.target.value)}/>:
        key==="group"?<select value={profile.group} onChange={e=>change("group",e.target.value)}>
         {["متقاضی عضویت","عضو مؤسس","عضو جدید","عضو سابق"].map(g=><option key={g} value={g}>{g}</option>)}
        </select>:
        <input value={profile[key]} maxLength={max} required={required}
         aria-invalid={key==="nationalId"?Boolean(nationalIdError):key==="mobile"?Boolean(mobileError):undefined}
         inputMode={key==="nationalId"||key==="postalCode"||key==="mobile"||key==="telephone"?"numeric":"text"}
         dir={key==="nationalId"?"ltr":undefined}
         autoComplete={key==="nationalId"?"off":undefined}
         pattern={key==="nationalId"?"[0-9]{10}":key==="mobile"?"09[0-9]{9}":undefined}
         onChange={e=>change(key,e.target.value)}/>}
       {key==="nationalId"?<>
        {nationalIdError?<small role="alert" className="tto-nav02-field-error">{nationalIdError}</small>:
        profile.nationalId.length===10?<small className="tto-nav02-checksum-ok">رقم کنترل کد ملی صحیح است؛ تطبیق هویت نیازمند استعلام است.</small>:null}
       </>:null}
       {key==="mobile"&&mobileError?<small role="alert" className="tto-nav02-field-error">{mobileError}</small>:null}
      </Field>)}
      {profile.personType==="NATURAL"&&profile.membershipStatus!=="NON_MEMBER_REPORTED"?<fieldset className="tto-nav02-eligibility">
       <legend>شرایط ارتباط با شهرستان طبق ماده ۲ قانون تأسیس (حداقل یکی)</legend>
       <label><input type="checkbox" checked={profile.bornInCounty==="yes"}
        onChange={e=>change("bornInCounty",e.target.checked?"yes":"no")}/> متولد شهرستان است</label>
       <label><input type="checkbox" checked={profile.residentInCounty==="yes"}
        onChange={e=>change("residentInCounty",e.target.checked?"yes":"no")}/> ساکن شهرستان است</label>
       <label><input type="checkbox" checked={profile.employedInCounty==="yes"}
        onChange={e=>change("employedInCounty",e.target.checked?"yes":"no")}/> شاغل در شهرستان است</label>
       {!countyCondition?<small>یکی از سه شرط الزامی است؛ اثبات شرایط در مرحله بررسی انجام می‌شود.</small>:null}
      </fieldset>:null}
      <label className="tto-nav02-confirm">
       <input type="checkbox" checked={personalDataConfirmed}
        onChange={e=>setPersonalDataConfirmed(e.target.checked)}/>
       تأیید می‌کنم اطلاعات ثبت‌شده صحیح است و مجوز لازم برای ثبت و پردازش اطلاعات این شخص را دارم.
      </label>
      <p className="tto-nav02-membership-note">
       عضویت قانونی، سهامداری و حق رأی سه وضعیت جدا هستند. مقادیر فعلی صرفاً اظهار اداری‌اند؛
       تغییر دفتر رسمی اعضا و دفتر سهام تنها پس از مدارک و تصویب مرجع صالح انجام می‌شود.
      </p>
      {photoRetryId?<div className="tto-nav02-message error" style={{gridColumn:"1/-1"}}>
       پرونده سهامدار قبلاً ذخیره شده است؛ برای آن دوباره فرم را ثبت نکنید.
       <button type="button" disabled={busy||!photo} onClick={async()=>{
        if(!photo||busy)return;setBusy(true);
        try{await savePhoto(photo,photoRetryId);setPhotoRetryId("");setPhoto(null);
         setProfile(initialProfile);setPersonalDataConfirmed(false);setError(false);
         setNotice("عکس خصوصی ثبت شد و در فهرست و پرونده قابل مشاهده است.");
        }catch(e){setError(true);setNotice(e instanceof Error?e.message:"آپلود ناموفق بود.")}
        finally{setBusy(false)}
       }}>تلاش مجدد ذخیره عکس</button>
       <button type="button" onClick={()=>{setPhotoRetryId("");setPhoto(null);
        setProfile(initialProfile);setPersonalDataConfirmed(false)}}>انصراف از ارسال عکس</button>
      </div>:null}
     </>:<>
      <Field title="جست‌وجوی سهامدار"><input value={search}
       onChange={e=>setSearch(e.target.value)} placeholder="نام، گروه یا چهار رقم انتهایی شناسه…"/></Field>
      <Field title="سهامدار انتخابی *"><select required value={draftId} onChange={e=>setDraftId(e.target.value)}>
       <option value="">انتخاب پرونده سهامدار</option>
       {filtered.map(x=><option value={x.id} key={x.id}>{x.name} — {x.identifierMask}</option>)}
      </select></Field>
      {selected?<p className="tto-nav02-selected">پرونده: {selected.name} · {selected.state}</p>:null}
      <Field title="تعداد سهام خریداری‌شده اولیه *"><input required type="number" min="0" step="1" value={capital.initialShares}
       onChange={e=>setCapital(p=>({...p,initialShares:e.target.value}))}/></Field>
      <Field title="تعداد سهام در تعهد *"><input required type="number" min="0" step="1" value={capital.subscribedShares}
       onChange={e=>setCapital(p=>({...p,subscribedShares:e.target.value}))}/></Field>
      <Field title="مبلغ اسمی هر سهم (ریال) *"><input required type="number" min="1" step="1" value={capital.nominalRial}
       onChange={e=>setCapital(p=>({...p,nominalRial:e.target.value}))}/></Field>
      <Field title="مبلغ پرداختی (ریال) *"><input required type="number" min="0" step="1" value={capital.paidRial}
       onChange={e=>setCapital(p=>({...p,paidRial:e.target.value}))}/></Field>
      <Field title="تاریخ پرداخت (شمسی)">
       <JalaliBirthDatePicker placeholder="انتخاب تاریخ پرداخت (شمسی)" defaultToToday
        value={gregorianISOToJalali(capital.paymentDate)}
        onChange={value=>setCapital(p=>({...p,paymentDate:jalaliToGregorianISO(value)}))}/>
      </Field>
      <Field title="شماره پیگیری / شماره فیش بانکی *"><input required maxLength={100} value={capital.receiptRef}
       onChange={e=>setCapital(p=>({...p,receiptRef:e.target.value}))}/></Field>
      <p className="tto-nav02-summary">کل ارزش اسمی اظهارشده: <strong>{faNumber(Number(subtotal))} ریال</strong></p>
     </>}
     <div className="tto-nav02-actions"><button type="submit" disabled={busy||loading||editLoading||Boolean(photoRetryId)||(Boolean(editId)&&editVersion===null)||(section==="add"&&(!personalDataConfirmed||Boolean(nationalIdError)||
     (profile.personType==="NATURAL"&&((profile.membershipStatus!=="NON_MEMBER_REPORTED"&&!countyCondition)||Boolean(mobileError)||!profile.mobile))||
     (profile.personType==="LEGAL"&&(!profile.registrationNumber||!profile.economicCode||!profile.representativeName||!profile.representativeNationalId||!profile.representativeMobile))))}>
      {busy?"در حال ثبت پرونده…":section==="add"?(editId?"ذخیره ویرایش پرونده":"ثبت درخواست عضویت"):"ثبت اطلاعات اظهارشده سهام"}
     </button><span>هیچ اثر مالی یا انتقال قانونی ثبت نمی‌شود.</span></div>
    </form>
    {notice?<div role={error?"alert":"status"} className={"tto-nav02-message"+(error?" error":"")}>{notice}</div>:null}
   </section>
   {section==="add"?<MemberSidebar slug={slug} photo={photo} photoUrl={photoUrl||(
    editId&&items.find(x=>x.id===editId&&((x as RecordItem & {photoState?:string}).photoState==="READY_PRIVATE"))?
    "/api/commerce/nav02/photo/view?slug="+encodeURIComponent(slug)+"&draftId="+encodeURIComponent(editId):""
   )}
    onPhoto={setPhoto} collection={profile.collectionName}
    onCollection={v=>change("collectionName",v)}
    collections={items.map(x=>(x as RecordItem & {collectionName?:string}).collectionName??"").filter(Boolean)}
    occupation={profile.occupation} onOccupation={v=>change("occupation",v)}
    attachmentSubject={attachmentSubject} onAttachmentSubject={setAttachmentSubject}
    attachment={attachment} onAttachment={setAttachment}/>
   :   <aside className="tto-nav02-card" aria-label="فهرست پرونده‌های اولیه">
    <h2>پرونده‌های ثبت اولیه</h2>
    {loading?<p role="status">در حال دریافت پرونده‌های مجاز…</p>:
     visibleItems.length===0?<p>هنوز پرونده اولیه‌ای در این بخش ثبت نشده است.</p>:
     <div className="tto-nav02-records">{visibleItems.map(x=><article key={x.id}>
      <strong>{x.name}</strong><small>{x.title} · {x.group} · {x.identifierMask}</small>
      <span>{x.capitalState?"اطلاعات اولیه سهام ثبت‌شده":"فاقد اطلاعات اظهارشده سهام"}</span>
      {section==="shares"&&!x.capitalState?<button type="button" onClick={()=>setDraftId(x.id)}>انتخاب</button>:null}
     </article>)}</div>}
    <p className="tto-nav02-boundary">ثبت درخواست با تأیید قانونی عضویت، احراز سهام و حق رأی متفاوت است.</p>
   </aside>}
  </div>
 </div>;
}
