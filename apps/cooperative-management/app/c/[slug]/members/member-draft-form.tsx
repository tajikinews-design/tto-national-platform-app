"use client";
import Link from "next/link";
import {useEffect,useMemo,useState,type FormEvent} from "react";
type Section="new"|"shares";
type RecordItem={id:string;name:string;title:string;group:string;identifierMask:string;
 state:string;initialShares?:number;subscribedShares?:number;nominalRial?:number;
 declaredPaidRial?:number;capitalState?:string};
const TITLES=["آقا","خانم","شرکت","سازمان","اداره"] as const;
const initialProfile={title:"آقا",fullName:"",group:"",nationalId:"",fatherName:"",
 birthCertificate:"",birthDate:"",birthPlace:"",telephone:"",mobile:"",postalCode:"",address:""};
const initialCapital={initialShares:"0",subscribedShares:"0",nominalRial:"",paidRial:"0",
 paymentDate:"",receiptRef:""};
type Profile=typeof initialProfile;type Capital=typeof initialCapital;
const fields:[keyof Profile,string,number,boolean][]=[
 ["fullName","نام و نام خانوادگی / نام شخصیت حقوقی",180,true],
 ["group","گروه سهامدار",90,true],["nationalId","شماره ملی / شناسه ملی",11,true],
 ["fatherName","نام پدر",120,false],["birthCertificate","شماره شناسنامه",45,false],
 ["birthDate","تاریخ تولد",10,false],["birthPlace","محل تولد",120,false],
 ["telephone","تلفن",25,false],["mobile","موبایل",20,false],
 ["postalCode","کدپستی",12,false],["address","نشانی کامل",600,false]
];
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
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [notice,setNotice]=useState(""),[error,setError]=useState(false);
 const base="/c/"+encodeURIComponent(slug)+"/members/";
 const syntheticOnly=true;
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
 const selected=items.find(x=>x.id===draftId);
 const filtered=items.filter(x=>(x.name+" "+x.identifierMask+" "+x.group).toLocaleLowerCase("fa")
  .includes(search.toLocaleLowerCase("fa")));
 const subtotal=useMemo(()=>{
  try{return (BigInt(capital.initialShares||0)+BigInt(capital.subscribedShares||0))*
    BigInt(capital.nominalRial||0)}catch{return 0n}
 },[capital]);
 function change(k:keyof Profile,value:string){
  setProfile(old=>({...old,[k]:value}));setNotice("");
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setError(false);setNotice("");
  if(section==="new"){
   const id=profile.nationalId.trim();
   if(!((profile.title==="آقا"||profile.title==="خانم")?/^\d{10}$/:/^\d{11}$/).test(id)){
    setError(true);setNotice("کد ملی شخص حقیقی باید ۱۰ رقم و شناسه ملی شخص حقوقی ۱۱ رقم باشد.");return;
   }
   if(photo){setError(true);setNotice("عکس فقط پیش‌نمایش محلی دارد. برای جلوگیری از ثبت ناامن تصویر هویتی، لطفاً عکس را بردارید و اطلاعات آزمایشی را بدون تصویر ثبت کنید.");return}
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
   const req=section==="new"?
    {slug,action:"profile",data:profile}:
    {slug,action:"capital",draftId,data:capital};
   const r=await fetch("/api/commerce/nav02",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(req)});
   if(!r.ok)throw Error(r.status===409?"این پرونده یا اطلاعات اولیه سهام قبلاً ثبت شده است.":
    r.status===403?"مجوز ورود اطلاعات برای این تعاونی وجود ندارد.":
    r.status===400?"برخی اطلاعات صحیح نیستند.":"ذخیره اطلاعات آزمایشی انجام نشد.");
   const d=await r.json() as {saved?:boolean};
   if(d.saved!==true)throw Error("ثبت توسط سرور تأیید نشد.");
   await refresh();
   setError(false);setNotice(section==="new"?
    "پرونده اولیه ذخیره شد؛ این ثبت به‌معنای عضویت یا مالکیت رسمی سهام نیست.":
    "اطلاعات اظهارشده سهام ذخیره شد؛ دفتر رسمی سهام و مانده قانونی تغییر نکردند.");
   if(section==="new")setProfile(initialProfile);
   else{setCapital(initialCapital);setDraftId("")}
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:"خطا در ثبت")}
  finally{setBusy(false)}
 }
 const isLegal=!["آقا","خانم"].includes(profile.title);
 return <div className="tto-nav02-page">
  <header className="tto-nav02-hero">
   <span className="tto-settings-eyebrow">NAV-02 · دفتر ثبت اولیه</span>
   <h1>{section==="new"?"افزودن سهامدار":"ثبت اطلاعات اولیه سهام"}</h1>
   <p>ثبت پرونده آزمایشی و تأییدنشده؛ این اطلاعات تا تطبیق قانونی با دفتر رسمی سهام، حق مالکیت، عضویت یا رأی ایجاد نمی‌کنند.</p>
  </header>
  <nav aria-label="زیرمنوهای اعضا و سهام" className="tto-nav02-switch">
   <Link href={base+"new"} aria-current={section==="new"?"page":undefined}>♙ افزودن سهامدار</Link>
   <Link href={base+"shares"} aria-current={section==="shares"?"page":undefined}>▥ اطلاعات سهام</Link>
  </nav>
  <div className="tto-nav02-warning" role="status"><strong>محیط آزمایشی</strong> · فقط از داده‌های ساختگی استفاده کنید. شماره ملی، تماس یا تصویر واقعی افراد را تا تکمیل ارزیابی حفاظت داده وارد نکنید.</div>
  <div className="tto-nav02-layout">
   <section className="tto-nav02-card" aria-label={section==="new"?"فرم ثبت مشخصات سهامدار":"فرم اظهار اطلاعات سهام"}>
    <h2>{section==="new"?"مشخصات شناسایی سهامدار":"اطلاعات سرمایه و پرداخت اظهارشده"}</h2>
    <form onSubmit={submit} className="tto-nav02-form">
     {section==="new"?<>
      <Field title="عنوان *"><select value={profile.title} onChange={e=>change("title",e.target.value)}>
       {TITLES.map(t=><option key={t}>{t}</option>)}</select></Field>
      {fields.map(([key,label,max,required])=><Field key={key}
       title={(key==="nationalId"?(isLegal?"شناسه ملی حقوقی":"شماره ملی"):label)+(required?" *":"")}
       wide={key==="address"||key==="fullName"}>
       {key==="address"?<textarea value={profile.address} rows={3} maxLength={600}
        onChange={e=>change("address",e.target.value)}/>:
        key==="birthDate"?<input type="date" value={profile.birthDate}
         onChange={e=>change("birthDate",e.target.value)}/>:
       <input value={profile[key]} maxLength={max} required={required}
        inputMode={key==="nationalId"||key==="postalCode"||key==="mobile"||key==="telephone"?"numeric":"text"}
        placeholder={key==="group"?"مثلاً: گروه آزمایشی الف":undefined}
        pattern={key==="nationalId"?(isLegal?"[0-9]{11}":"[0-9]{10}"):undefined}
        onChange={e=>change(key,e.target.value)}/>}
       {key==="birthDate"?<small>تاریخ به قالب استاندارد میلادی ثبت می‌شود؛ تبدیل دقیق تقویم شمسی در نسخه بعدی بررسی می‌شود.</small>:null}
      </Field>)}
      <div className="tto-nav02-photo">
       <label htmlFor="nav02-photo">عکس پرسنلی (فقط پیش‌نمایش محلی؛ ذخیره غیرفعال)</label>
       <input id="nav02-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{
        const file=e.currentTarget.files?.[0]??null;
        if(file&&(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>1500000)){
         setError(true);setNotice("فقط تصویر PNG، JPEG یا WebP تا حجم ۱٫۵ مگابایت پذیرفته می‌شود.");setPhoto(null);return;
        }
        setPhoto(file);
       }}/>
       {photoUrl?<img src={photoUrl} alt="پیش‌نمایش محلی عکس انتخاب‌شده" width="80" height="80"/>:null}
       {photo?<button type="button" onClick={()=>{setPhoto(null);setNotice("")}}>حذف عکس انتخابی</button>:null}
      </div>
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
     <div className="tto-nav02-actions"><button type="submit" disabled={busy||loading||Boolean(photo)}>
      {busy?"در حال ثبت پرونده…":section==="new"?"ثبت پرونده اولیه":"ثبت اطلاعات اظهارشده سهام"}
     </button><span>هیچ اثر مالی یا انتقال قانونی ثبت نمی‌شود.</span></div>
    </form>
    {notice?<div role={error?"alert":"status"} className={"tto-nav02-message"+(error?" error":"")}>{notice}</div>:null}
   </section>
   <aside className="tto-nav02-card" aria-label="فهرست پرونده‌های اولیه">
    <h2>پرونده‌های آزمایشی ثبت‌شده</h2>
    {loading?<p role="status">در حال دریافت پرونده‌های مجاز…</p>:
     items.length===0?<p>هنوز پرونده اولیه‌ای برای این تعاونی ثبت نشده است.</p>:
     <div className="tto-nav02-records">{items.map(x=><article key={x.id}>
      <strong>{x.name}</strong><small>{x.title} · {x.group} · {x.identifierMask}</small>
      <span>{x.capitalState?"اطلاعات اولیه سهام ثبت‌شده":"فاقد اطلاعات اظهارشده سهام"}</span>
      {section==="shares"&&!x.capitalState?<button type="button" onClick={()=>setDraftId(x.id)}>انتخاب</button>:null}
     </article>)}</div>}
    <p className="tto-nav02-boundary">«پرونده اولیه» با «عضو تعاونی»، «سهامدار قانونی» و «صاحب حق رأی» سه مفهوم متفاوت است.</p>
   </aside>
  </div>
 </div>;
}
