"use client";
import Link from "next/link";
import {useEffect,useMemo,useState,type FormEvent} from "react";
type Section="add"|"shares";
type RecordItem={id:string;name:string;title:string;group:string;identifierMask:string;membershipStatus?:string|null;
 state:string;initialShares?:number;subscribedShares?:number;nominalRial?:number;
 declaredPaidRial?:number;capitalState?:string};
const TITLES=["آقا","خانم"] as const;
const initialProfile={title:"آقا",fullName:"",group:"متقاضی عضویت",nationalId:"",fatherName:"",
 birthCertificate:"",birthDate:"",birthPlace:"",telephone:"",mobile:"",postalCode:"",address:"",
 bornInCounty:"no",residentInCounty:"no",employedInCounty:"no",
 informationConfirmed:"no",membershipStatus:"APPLICANT_UNVERIFIED",
 personType:"NATURAL",shareholdingStatus:"NONE_UNVERIFIED"};
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
 const [personalDataConfirmed,setPersonalDataConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [notice,setNotice]=useState(""),[error,setError]=useState(false);
 const base="/c/"+encodeURIComponent(slug)+"/members/";
 useEffect(()=>{
  if(!photo){setPhotoUrl("");return}
  const url=URL.createObjectURL(photo);setPhotoUrl(url);
  return()=>URL.revokeObjectURL(url);
 },[photo]);
 async function refresh(){
  const r=await fetch("/api/commerce/nav02?slug="+encodeURIComponent(slug),
   {credentials:"same-origin",cache:"no-store"});
  if(!r.ok)throw Error(r.status===403?"فقط مالک فضای آزمایشی امکان مشاهده پرونده‌ها را دارد.":
   r.status===401?"نشست منقضی شده است؛ دوباره وارد شوید.":"سرویس پرونده‌های آزمایشی در دسترس نیست.");
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
 const visibleItems=items.filter(x=>section==="add"?x.membershipStatus==="APPLICANT_UNVERIFIED":x.membershipStatus!=="APPLICANT_UNVERIFIED");
 const filtered=visibleItems.filter(x=>(x as RecordItem & {managementState?:string}).managementState!=="SUSPENDED_DRAFT").filter(x=>(x.name+" "+x.identifierMask+" "+x.group).toLocaleLowerCase("fa")
  .includes(search.toLocaleLowerCase("fa")));
 const subtotal=useMemo(()=>{
  try{return (BigInt(capital.initialShares||0)+BigInt(capital.subscribedShares||0))*
    BigInt(capital.nominalRial||0)}catch{return 0n}
 },[capital]);
 function change(k:keyof Profile,value:string){
  setProfile(old=>({...old,[k]:k==="nationalId"?toLatinDigits(value):value}));setNotice("");
 }
 const nationalIdError=profile.nationalId.length===0?"":!/^[0-9]{0,10}$/.test(profile.nationalId)?
  "کد ملی باید فقط ۱۰ رقم باشد.":profile.nationalId.length===10&&!validIranianNationalId(profile.nationalId)?
  "کد ملی معتبر نیست؛ رقم کنترل را بررسی کنید.":"";
 const countyCondition=profile.bornInCounty==="yes"||profile.residentInCounty==="yes"||
  profile.employedInCounty==="yes";
 async function quarantinePhoto(file:File,id:string){
  if(file.size<68||file.size>716800)throw Error("حجم عکس باید حداکثر ۷۰۰ کیلوبایت باشد.");
  const bytes=new Uint8Array(await file.arrayBuffer());
  let bin="";
  for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const dataBase64=btoa(bin);
  const r=await fetch("/api/commerce/nav02/photo",{
   method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({slug,draftId:id,mime:file.type,dataBase64})
  });
  if(!r.ok)throw Error(r.status===409?"برای این پرونده قبلاً عکس قرنطینه شده است.":
   r.status===403?"مجوز آپلود در این تعاونی ندارید.":
   "سرویس قرنطینه امن عکس آماده نیست. پرونده سهامدار ذخیره شده است.");
  const result=await r.json() as {saved?:boolean;status?:string;visible?:boolean};
  if(result.saved!==true||result.status!=="QUARANTINED"||result.visible!==false)
   throw Error("پاسخ قرنطینه عکس معتبر نبود.");
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setError(false);setNotice("");
  if(section==="add"){
   if(!personalDataConfirmed){setError(true);setNotice("تأیید صحت اطلاعات و مجوز ثبت آن لازم است.");return}
   if(photoRetryId){setError(true);setNotice("آپلود عکس پرونده قبلی را تکمیل یا لغو کنید.");return}
   if(!validIranianNationalId(profile.nationalId)){
    setError(true);setNotice("کد ملی نامعتبر است؛ شماره باید ۱۰ رقم و دارای رقم کنترل صحیح باشد.");return;
   }
   if(!countyCondition){
    setError(true);setNotice("طبق قانون، تولد یا سکونت یا اشتغال در شهرستان کافی است؛ حداقل یک گزینه را انتخاب کنید.");return;
   }
   if(!["آقا","خانم"].includes(profile.title)){
    setError(true);setNotice("در این بخش فقط درخواست عضویت اشخاص حقیقی ثبت می‌شود.");return;
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
    {slug,action:"memberProfile",data:{...profile,informationConfirmed:"yes"}}:
    {slug,action:"capital",draftId,data:capital};
   const r=await fetch("/api/commerce/nav02",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(req)});
   if(!r.ok)throw Error(r.status===409?"این پرونده یا اطلاعات اولیه سهام قبلاً ثبت شده است.":
    r.status===403?"مجوز ورود اطلاعات برای این تعاونی وجود ندارد.":
    r.status===400?"کد ملی یا شرایط عضویت معتبر نیست.":
    r.status===503&&section==="add"?"ثبت اطلاعات واقعی هنوز مجوز امنیت و حفاظت داده را دریافت نکرده است؛ اطلاعاتی ذخیره نشد.":
    "ذخیره اطلاعات انجام نشد.");
   const d=await r.json() as {saved?:boolean;record?:{id?:unknown}};
   if(d.saved!==true)throw Error("ثبت توسط سرور تأیید نشد.");
   // The profile commit is separate. Never retry the profile on a photo error.
   if(section==="add"&&photo){
    const id=d.record?.id;
    if(typeof id!=="string"){setError(true);setNotice("پرونده ثبت شد ولی شناسه عکس معتبر نیست.");return}
    setPhotoRetryId(id);
    try{
     await quarantinePhoto(photo,id);
     setPhotoRetryId("");setPhoto(null);setPersonalDataConfirmed(false);
     setProfile(initialProfile);
     await refresh();
     setError(false);
     setNotice("درخواست عضویت ذخیره شد؛ عکس در قرنطینه خصوصی قرار گرفت و نمایش آن در فهرست منوط به اسکن است.");
    }catch(err){
     await refresh();
     setError(true);
     setNotice(err instanceof Error?err.message:"پرونده ذخیره شد ولی تصویر هنوز قرنطینه نشده است؛ دوباره تلاش کنید.");
    }
    return;
   }
   await refresh();
   setError(false);setNotice(section==="add"?
    "درخواست عضویت ثبت اولیه شد و تا بررسی هیئت مؤسس یا هیئت‌مدیره در وضعیت متقاضی باقی می‌ماند.":
    "اطلاعات اظهارشده سهام ذخیره شد؛ دفتر رسمی سهام و مانده قانونی تغییر نکردند.");
   if(section==="add"){setProfile(initialProfile);setPersonalDataConfirmed(false);}
   else{setCapital(initialCapital);setDraftId("")}
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:"خطا در ثبت")}
  finally{setBusy(false)}
 }
 return <div className="tto-nav02-page">
  <header className="tto-nav02-hero">
   <span className="tto-settings-eyebrow">NAV-02 · پرونده عضویت</span>
   <h1>{section==="add"?"افزودن اعضا":"ثبت اطلاعات اولیه سهام"}</h1>
   <p>{section==="add"?
    "ثبت اطلاعات شخص حقیقی و شرایط درخواست عضویت؛ تأیید عضویت با مرجع مجاز تعاونی است.":
    "ثبت اطلاعات اولیه سهام با رعایت تفکیک قانونی عضو و سهامدار غیرعضو."}</p>
  </header>
  <nav aria-label="زیرمنوهای اعضا و سهام" className="tto-nav02-switch">
   <Link href={base+"add"} aria-current={section==="add"?"page":undefined}>♙ افزودن اعضا</Link>
   <Link href={base+"shares"} aria-current={section==="shares"?"page":undefined}>▥ اطلاعات سهام</Link>
   <Link href={base+"shareholders"}>♧ سهامداران</Link>
  </nav>
  {section==="shares"?<div className="tto-nav02-warning" role="status">
   اطلاعات سرمایه در این بخش صرفاً اظهار اولیه است و جایگزین دفتر رسمی سهام نیست.</div>:null}
  <div className="tto-nav02-layout">
   <section className="tto-nav02-card" aria-label={section==="add"?"فرم افزودن اعضا":"فرم اظهار اطلاعات سهام"}>
    <h2>{section==="add"?"مشخصات متقاضی عضویت":"اطلاعات سرمایه و پرداخت اظهارشده"}</h2>
    <form onSubmit={submit} className="tto-nav02-form">
     {section==="add"?<>
      <div className="tto-nav02-photo">
       <label htmlFor="nav02-photo">عکس پرسنلی</label>
       <input id="nav02-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{
        const file=e.currentTarget.files?.[0]??null;
        if(file&&(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>716800)){
         setError(true);setNotice("فقط تصویر PNG، JPEG یا WebP تا حجم ۷۰۰ کیلوبایت پذیرفته می‌شود.");setPhoto(null);return;
        }
        setPhoto(file);
       }}/>
       {photoUrl?<img src={photoUrl} alt="نمایش فوری عکس انتخاب‌شده" width="110" height="130"/>:null}
       {photo?<button type="button" onClick={()=>{setPhoto(null);setNotice("")}}>حذف عکس انتخابی</button>:null}
      </div>
      <div className="tto-nav02-name-row">
       <Field title="عنوان *"><select value={profile.title} onChange={e=>change("title",e.target.value)}>
        {TITLES.map(t=><option key={t}>{t}</option>)}</select></Field>
       <Field title="نام و نام خانوادگی *"><input required maxLength={180} autoComplete="name"
        value={profile.fullName} onChange={e=>change("fullName",e.target.value)}/></Field>
      </div>
      {fields.map(([key,label,max,required])=><Field key={key} title={label+(required?" *":"")}
       wide={key==="address"}>
       {key==="address"?<textarea value={profile.address} rows={3} maxLength={600}
        onChange={e=>change("address",e.target.value)}/>:
        key==="birthDate"?<input type="date" value={profile.birthDate}
         onChange={e=>change("birthDate",e.target.value)}/>:
        key==="group"?<select value={profile.group} onChange={e=>change("group",e.target.value)}>
         {["متقاضی عضویت","عضو مؤسس","عضو جدید","عضو سابق"].map(g=><option key={g} value={g}>{g}</option>)}
        </select>:
        <input value={profile[key]} maxLength={max} required={required}
         aria-invalid={key==="nationalId"?Boolean(nationalIdError):undefined}
         inputMode={key==="nationalId"||key==="postalCode"||key==="mobile"||key==="telephone"?"numeric":"text"}
         dir={key==="nationalId"?"ltr":undefined}
         autoComplete={key==="nationalId"?"off":undefined}
         pattern={key==="nationalId"?"[0-9]{10}":undefined}
         onChange={e=>change(key,e.target.value)}/>}
       {key==="nationalId"?<>
        {nationalIdError?<small role="alert" className="tto-nav02-field-error">{nationalIdError}</small>:
        profile.nationalId.length===10?<small className="tto-nav02-checksum-ok">رقم کنترل کد ملی صحیح است؛ تطبیق هویت نیازمند استعلام است.</small>:null}
       </>:null}
       {key==="birthDate"?<small>تاریخ مطابق قالب تقویم نمایش داده‌شده ثبت می‌شود.</small>:null}
      </Field>)}
      <fieldset className="tto-nav02-eligibility">
       <legend>شرایط ارتباط با شهرستان طبق ماده ۲ قانون تأسیس (حداقل یکی)</legend>
       <label><input type="checkbox" checked={profile.bornInCounty==="yes"}
        onChange={e=>change("bornInCounty",e.target.checked?"yes":"no")}/> متولد شهرستان است</label>
       <label><input type="checkbox" checked={profile.residentInCounty==="yes"}
        onChange={e=>change("residentInCounty",e.target.checked?"yes":"no")}/> ساکن شهرستان است</label>
       <label><input type="checkbox" checked={profile.employedInCounty==="yes"}
        onChange={e=>change("employedInCounty",e.target.checked?"yes":"no")}/> شاغل در شهرستان است</label>
       {!countyCondition?<small>یکی از سه شرط الزامی است؛ اثبات شرایط در مرحله بررسی انجام می‌شود.</small>:null}
      </fieldset>
      <label className="tto-nav02-confirm">
       <input type="checkbox" checked={personalDataConfirmed}
        onChange={e=>setPersonalDataConfirmed(e.target.checked)}/>
       تأیید می‌کنم اطلاعات ثبت‌شده صحیح است و مجوز لازم برای ثبت و پردازش اطلاعات این شخص را دارم.
      </label>
      <p className="tto-nav02-membership-note">
       عضویت تنها برای شخص حقیقی واجد شرایط است. ثبت این فرم، درخواست را در وضعیت
       «متقاضی / در انتظار احراز» نگه می‌دارد. سهامدار حقیقی یا حقوقی غیرعضو
       باید در گردش‌کار مستقل ثبت شود و حق عضویت یا رأی خودکار ندارد.
      </p>
      {photoRetryId?<div className="tto-nav02-message error" style={{gridColumn:"1/-1"}}>
       پرونده سهامدار قبلاً ذخیره شده است؛ برای آن دوباره فرم را ثبت نکنید.
       <button type="button" disabled={busy||!photo} onClick={async()=>{
        if(!photo||busy)return;setBusy(true);
        try{await quarantinePhoto(photo,photoRetryId);setPhotoRetryId("");setPhoto(null);
         setProfile(initialProfile);setPersonalDataConfirmed(false);setError(false);
         setNotice("عکس فقط در قرنطینه خصوصی رمزنگاری‌شده ثبت شد؛ انتشار و دانلود ممنوع است.");
        }catch(e){setError(true);setNotice(e instanceof Error?e.message:"آپلود ناموفق بود.")}
        finally{setBusy(false)}
       }}>تلاش مجدد آپلود خصوصی</button>
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
      <Field title="تاریخ پرداخت"><input type="date" value={capital.paymentDate}
       onChange={e=>setCapital(p=>({...p,paymentDate:e.target.value}))}/></Field>
      <Field title="شماره پیگیری / شماره فیش بانکی *"><input required maxLength={100} value={capital.receiptRef}
       onChange={e=>setCapital(p=>({...p,receiptRef:e.target.value}))}/></Field>
      <p className="tto-nav02-summary">کل ارزش اسمی اظهارشده: <strong>{faNumber(Number(subtotal))} ریال</strong></p>
     </>}
     <div className="tto-nav02-actions"><button type="submit" disabled={busy||loading||Boolean(photoRetryId)||(section==="add"&&(!personalDataConfirmed||!countyCondition||Boolean(nationalIdError)))}>
      {busy?"در حال ثبت پرونده…":section==="add"?"ثبت درخواست عضویت":"ثبت اطلاعات اظهارشده سهام"}
     </button><span>هیچ اثر مالی یا انتقال قانونی ثبت نمی‌شود.</span></div>
    </form>
    {notice?<div role={error?"alert":"status"} className={"tto-nav02-message"+(error?" error":"")}>{notice}</div>:null}
   </section>
   <aside className="tto-nav02-card" aria-label="فهرست پرونده‌های اولیه">
    <h2>پرونده‌های ثبت اولیه</h2>
    {loading?<p role="status">در حال دریافت پرونده‌های مجاز…</p>:
     visibleItems.length===0?<p>هنوز پرونده اولیه‌ای در این بخش ثبت نشده است.</p>:
     <div className="tto-nav02-records">{visibleItems.map(x=><article key={x.id}>
      <strong>{x.name}</strong><small>{x.title} · {x.group} · {x.identifierMask}</small>
      <span>{x.capitalState?"اطلاعات اولیه سهام ثبت‌شده":"فاقد اطلاعات اظهارشده سهام"}</span>
      {section==="shares"&&!x.capitalState?<button type="button" onClick={()=>setDraftId(x.id)}>انتخاب</button>:null}
     </article>)}</div>}
    <p className="tto-nav02-boundary">ثبت درخواست با تأیید قانونی عضویت، احراز سهام و حق رأی متفاوت است.</p>
   </aside>
  </div>
 </div>;
}
