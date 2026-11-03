"use client";
import {useEffect,useState,type FormEvent,type CSSProperties} from "react";
type CompanyDraft={name:string,registrationNumber:string,nationalId:string,province:string,county:string,address:string,representative:string};
const initial:CompanyDraft={name:"",registrationNumber:"",nationalId:"",province:"",county:"",address:"",representative:""};
const fieldStyle:CSSProperties={width:"100%",minHeight:45,border:"1px solid #bacddd",borderRadius:8,padding:"10px 12px",background:"#fff",boxSizing:"border-box",font:"inherit"};
const textStyle:CSSProperties={color:"#244661",lineHeight:1.9};
const digits=(v:string)=>v.replace(/[۰-۹]/g,x=>String(x.charCodeAt(0)-1776)).replace(/[٠-٩]/g,x=>String(x.charCodeAt(0)-1632));
export default function NewCooperative(){
 const [draft,setDraft]=useState<CompanyDraft>(initial);
 const [authorized,setAuthorized]=useState<"checking"|"authenticated"|"unauthenticated"|"unavailable">("checking");
 const [validated,setValidated]=useState(false);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 const [intakeId,setIntakeId]=useState("");
 useEffect(()=>{
  let active=true;
  fetch("/api/auth/session",{cache:"no-store",credentials:"same-origin"}).then(async r=>{
   if(!r.ok)throw Error("unavailable");
   const data=await r.json() as {authenticated?:unknown};
   if(active)setAuthorized(data.authenticated===true?"authenticated":"unauthenticated");
  }).catch(()=>{if(active)setAuthorized("unavailable");});
  return ()=>{active=false;};
 },[]);
 const update=(key:keyof CompanyDraft,value:string)=>{setDraft(p=>({...p,[key]:value}));setValidated(false);setError("");};
 const onSubmit=async(e:FormEvent)=>{e.preventDefault();setError("");setIntakeId("");
  const name=draft.name.trim(),nationalId=digits(draft.nationalId.trim()),number=digits(draft.registrationNumber.trim());
  if(name.length<8||name.length>180){setError("نام تعاونی باید بین ۸ تا ۱۸۰ نویسه باشد.");return;}
  if(!/^\d{11}$/.test(nationalId)){setError("شناسه ملی شرکت باید دقیقاً ۱۱ رقم باشد.");return;}
  if(!/^\d{1,20}$/.test(number)){setError("شماره ثبت باید عددی و حداکثر ۲۰ رقم باشد.");return;}
  if(!draft.province.trim()||!draft.county.trim()||!draft.address.trim()){setError("استان، شهرستان و نشانی را کامل کنید.");return;}
  if(!draft.representative.trim()){setError("نام نماینده معرفی‌شده را وارد کنید.");return;}
  setValidated(true);
  setSaving(true);
  try{
   const response=await fetch("/api/cooperatives/intakes",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({...draft,nationalId,registrationNumber:number})});
   const result=await response.json() as {intakeId?:string;code?:string};
   if(response.status===201&&result.intakeId){setIntakeId(result.intakeId);}
   else {setError(response.status===403?"مجوز مدیر ملی برای ثبت این پرونده تأیید نشد.":response.status===409?"این شناسه ملی قبلاً در محیط آزمایشی ثبت شده است.":"ثبت در پایگاه داده آزمایشی هنوز فعال یا در دسترس نیست. کد: "+(result.code??response.status));}
  }catch{setError("ارتباط با سرویس ثبت آزمایشی برقرار نشد.");}
  finally{setSaving(false);}
 };
 return <main dir="rtl" lang="fa" style={{fontFamily:"Tahoma,Arial,sans-serif",padding:"28px max(16px,5vw)",background:"#f3f7fa",minHeight:"100vh",color:"#18364e"}}>
 <div style={{maxWidth:880,margin:"auto"}}>
 <a href="/" style={{color:"#075a83"}}>← بازگشت به پنل مدیریت پلتفرم ملی</a>
 <h1>ثبت شرکت تعاونی جدید</h1>
 <p style={textStyle}>گام نخست: ورود و بررسی اطلاعات پایه تعاونی توسعه و عمران. اطلاعات این فرم صرفاً برای آماده‌سازی پرونده است؛ در این گام نه شرکت جدیدی در پایگاه داده ایجاد می‌شود و نه سهامی تخصیص می‌یابد.</p>
 <div role="status" style={{background:"#e9f3ff",padding:16,borderRadius:10,marginBottom:18}}>
 {authorized==="checking"?"در حال بررسی نشست مدیر پلتفرم…":authorized==="authenticated"?"نشست کاربر تأیید شد. ثبت نهایی نیازمند بررسی مستقل نقش مدیر ملی و مجوز ایجاد تعاونی است.":authorized==="unauthenticated"?"برای ادامه، ابتدا از صفحه اصلی پنل ملی وارد حساب خود شوید.":"اتصال سرویس احراز هویت در دسترس نیست؛ فرم عملیاتی غیرفعال است."}
 </div>
 {authorized==="authenticated"?<form onSubmit={onSubmit} style={{background:"white",borderRadius:16,padding:24,border:"1px solid #d7e1eb",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:18}}>
 {([["name","نام کامل تعاونی"],["registrationNumber","شماره ثبت شرکت"],["nationalId","شناسه ملی ۱۱ رقمی"],["province","استان"],["county","شهرستان"],["representative","نام نماینده معرفی‌شده"],["address","نشانی قانونی"] ] as [keyof CompanyDraft,string][]).map(([key,label])=><label key={key} style={{display:"block",fontWeight:600}}>{label}<input autoComplete="off" required maxLength={key==="name"?180:key==="address"?300:120} value={draft[key]} onChange={e=>update(key,e.target.value)} style={{...fieldStyle,marginTop:8}}/></label>)}
 {error&&<p role="alert" style={{color:"#a12222",gridColumn:"1/-1"}}>{error}</p>}
 <div style={{gridColumn:"1/-1"}}><button type="submit" disabled={saving} style={{border:0,borderRadius:8,padding:"13px 22px",background:"#075b89",color:"#fff",font:"inherit",fontWeight:700,cursor:"pointer"}}>{saving?"در حال بررسی و ثبت پرونده…":"بررسی و ثبت پرونده در محیط آزمایشی"}</button></div>
 </form>:null}
 {validated&&authorized==="authenticated"&&<section role="status" style={{background:"#effbef",padding:22,marginTop:20,border:"1px solid #a5cfad",borderRadius:12}}>
 <h2>اطلاعات اولیه بررسی شد</h2><p>نام شرکت: <strong>{draft.name.trim()}</strong></p><p>شماره ثبت: {digits(draft.registrationNumber)} | شناسه ملی: {digits(draft.nationalId)}</p><p>موقعیت: {draft.province}، {draft.county}</p><p>نماینده معرفی‌شده: {draft.representative}</p>
 <strong>{intakeId?"پرونده آزمایشی با موفقیت ذخیره شد. شناسه پرونده: "+intakeId:"اطلاعات صرفاً در همین صفحه بررسی شده و ذخیره نهایی تأیید نشده است."}</strong>
 <p>پرونده ثبت‌شده فقط حالت PENDING_VERIFICATION دارد؛ هیچ تعاونی فعال یا سهامی ایجاد نشده است.</p></section>}
 </div></main>;
}
