"use client";
import {useEffect,useState,type FormEvent} from "react";
type Row={slug:string;workspace_state:string;dossier_id:string|null;dossier_state:string|null;legal_name:string|null;candidate_manager_name:string|null;submitted_at:string|null;review_version:number|null};
type Model={
 slug:string;legalName:string;nationalId:string;registrationNumber:string;province:string;county:string;
 legalAddress:string;representativeName:string;candidateManagerName:string;candidateManagerMobile:string;evidenceReference:string
};
const blank:Model={slug:"",legalName:"",nationalId:"",registrationNumber:"",province:"",county:"",
 legalAddress:"",representativeName:"",candidateManagerName:"",candidateManagerMobile:"",evidenceReference:""};
const names:Record<keyof Model,string>={
 slug:"نشانی رزروشده",legalName:"نام کامل قانونی تعاونی",nationalId:"شناسه ملی ۱۱ رقمی شرکت",
 registrationNumber:"شماره ثبت شرکت",province:"استان",county:"شهرستان",
 legalAddress:"نشانی قانونی شرکت",representativeName:"نام نماینده معرفی‌کننده",
 candidateManagerName:"نام مدیر پیشنهادی",candidateManagerMobile:"شماره موبایل مدیر پیشنهادی",
 evidenceReference:"شماره یا شناسه مرجع مدارک (اختیاری)"
};
const statusLabels:Record<string,string>={
 PENDING_LEGAL_REVIEW:"در انتظار بررسی حقوقی",IN_REVIEW:"در حال بررسی",
 CHANGES_REQUESTED:"نیازمند اصلاح مدارک",REJECTED:"ردشده",
 EXTERNAL_APPROVAL_REQUIRED:"در انتظار تأیید مستقل خارج از سامانه"
};
const fields:(keyof Model)[]=["legalName","nationalId","registrationNumber","province","county",
 "legalAddress","representativeName","candidateManagerName","candidateManagerMobile","evidenceReference"];
const style={padding:"11px 13px",border:"1px solid #a8bbce",borderRadius:9,width:"100%",font:"inherit",boxSizing:"border-box" as const};
export default function CooperativeOnboardingPage(){
 const [items,setItems]=useState<Row[]>([]);
 const [form,setForm]=useState<Model>(blank);
 const [phase,setPhase]=useState<"loading"|"ready"|"denied"|"error">("loading");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [reasons,setReasons]=useState<Record<string,string>>({});
 async function refresh(){
  setPhase("loading");
  try{
   const r=await fetch("/api/cooperatives/onboarding",{cache:"no-store",credentials:"same-origin"});
   if(r.status===401||r.status===403){setPhase("denied");return;}
   if(!r.ok)throw Error("not-available");
   const json:unknown=await r.json();
   if(!json||typeof json!=="object"||Array.isArray(json)||!Array.isArray((json as {items?:unknown}).items))
    throw Error("invalid-payload");
   const records=(json as {items:Row[]}).items;
   setItems(records);setForm(f=>({...f,slug:records.some(x=>x.slug===f.slug&&!x.dossier_id)?f.slug:records.find(x=>!x.dossier_id)?.slug??""}));
   setPhase("ready");
  }catch{setPhase("error")}
 }
 useEffect(()=>{void refresh()},[]);
 async function advance(row:Row,action:string){
  if(busy||!row.dossier_id||!row.review_version)return;
  const reason=(reasons[row.slug]??"").trim();
  if(["REQUEST_CHANGES","REJECT","RECOMMEND_EXTERNAL_APPROVAL"].includes(action)&&
     (reason.length<5||reason.length>1500)){
   setMessage("برای این تصمیم، توضیح حداقل پنج حرفی و حداکثر ۱۵۰۰ حرفی لازم است.");return;
  }
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/cooperatives/onboarding/"+
    encodeURIComponent(row.dossier_id)+"/actions",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,expectedVersion:row.review_version,
      requestKey:crypto.randomUUID(),...(reason?{reason}:{})})
   });
   if(response.status===409){setMessage("نسخه پرونده تغییر کرده است؛ اطلاعات تازه را دریافت کنید.");await refresh();return;}
   if(response.status===401||response.status===403){setPhase("denied");return;}
   if(!response.ok)throw Error("action-not-confirmed");
   const value=await response.json() as {tenantCreated?:unknown;managerRoleGranted?:unknown};
   if(value.tenantCreated!==false||value.managerRoleGranted!==false)throw Error("unexpected-activation");
   setMessage("نتیجه بررسی ثبت شد. این تصمیم هیچ نقش مدیریتی یا Tenant ایجاد نکرد.");
   await refresh();
  }catch{setMessage("ثبت تصمیم تأیید نشد. بدون تکرار فوری، ابتدا وضعیت پرونده را بررسی کنید.");}
  finally{setBusy(false)}
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(busy||phase!=="ready"||!form.slug)return;
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/cooperatives/onboarding",{
    method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(form)
   });
   if(response.status===409){setMessage("برای این نشانی یا شناسه ملی پیش‌تر پرونده‌ای ثبت شده است.");return;}
   if(response.status===401||response.status===403){setPhase("denied");return;}
   if(response.status===400){setMessage("اطلاعات ناقص یا نامعتبر است، یا نشانی هنوز رزرو نشده است.");return;}
   if(response.status!==201)throw Error("unavailable");
   const obj=await response.json() as {status?:string;tenantCreated?:boolean;managerRoleGranted?:boolean};
   if(obj.status!=="PENDING_LEGAL_REVIEW"||obj.tenantCreated!==false||obj.managerRoleGranted!==false)
    throw Error("invalid-result");
   setMessage("پرونده برای بررسی مدارک ثبت شد؛ هیچ فضای عملیاتی یا نقش مدیریتی فعال نشده است.");
   await refresh();
  }catch{setMessage("ثبت پرونده در سرور تأیید نشد؛ لطفاً مجدداً وضعیت را بررسی کنید.");}
  finally{setBusy(false);}
 }
 return <main dir="rtl" lang="fa" style={{minHeight:"100vh",background:"#f2f6fb",padding:"28px 16px",fontFamily:"Tahoma,Arial,sans-serif",color:"#183550"}}>
 <section style={{maxWidth:900,margin:"auto",background:"white",borderRadius:18,padding:"clamp(16px,4vw,35px)",boxShadow:"0 5px 25px #18355012"}}>
  <a href="/" style={{color:"#0872ab"}}>بازگشت به پنل ملی</a>
  <h1>تشکیل پرونده حقوقی تعاونی</h1>
  <p style={{lineHeight:2}}>این بخش برای تکمیل اطلاعات نشانی‌های رزروشده است. ثبت فرم صرفاً به معنی دریافت مدارک اولیه است؛ تشکیل Tenant، احراز سمت مدیر، واگذاری نقش و فعال‌سازی پنل به بررسی قانونی مستقل نیاز دارند.</p>
  {phase==="loading"?<p role="status">در حال دریافت نشانی‌های رزروشده…</p>:
   phase==="denied"?<p role="alert">فقط مدیر ملیِ واردشده با اطلاعات جدید می‌تواند این بخش را ببیند. <a href="/">ورود مدیر ملی</a></p>:
   phase==="error"?<div><p role="alert">سرویس پرونده تعاونی در دسترس نیست.</p><button type="button" onClick={()=>void refresh()}>تلاش مجدد</button></div>:
   <>
   <h2>نشانی‌های رزروشده</h2>
   <div style={{display:"grid",gap:9}}>
   {items.map(i=><div key={i.slug} style={{padding:12,background:"#f4f8fb",borderRadius:9}}>
    <strong dir="ltr">{i.slug}</strong> — {i.dossier_id?(
      statusLabels[i.dossier_state??""]??
       "وضعیت پرونده نامشخص"):"آماده تکمیل اطلاعات"}
    {i.legal_name?<div style={{marginTop:6}}>{i.legal_name}</div>:null}
    {i.dossier_id&&i.review_version?<>
      <p style={{margin:"8px 0"}}>نسخه بررسی: {i.review_version} — این پنل مجوز تأیید قانونی یا فعال‌سازی ندارد.</p>
      {i.dossier_state==="IN_REVIEW"?<label style={{display:"block",marginBottom:8}}>
        توضیحات بررسی (الزامی برای درخواست اصلاح یا رد)
        <textarea value={reasons[i.slug]??""} maxLength={1500} rows={3}
          onChange={e=>setReasons(prev=>({...prev,[i.slug]:e.target.value}))}
          style={{...style,marginTop:5}}/>
      </label>:null}
      <div style={{display:"flex",flexWrap:"wrap",gap:9}}>
      {i.dossier_state==="PENDING_LEGAL_REVIEW"?<button disabled={busy}
        onClick={()=>void advance(i,"START_REVIEW")}>شروع بررسی</button>:null}
      {i.dossier_state==="IN_REVIEW"?<>
        <button disabled={busy} onClick={()=>void advance(i,"REQUEST_CHANGES")}>درخواست اصلاح</button>
        <button disabled={busy} onClick={()=>void advance(i,"REJECT")}>رد با ذکر دلیل</button>
      </>:null}
      {i.dossier_state==="CHANGES_REQUESTED"?<button disabled={busy}
        onClick={()=>void advance(i,"RESUBMIT")}>بازگرداندن به صف بررسی</button>:null}
      </div>
    </>:null}
   </div>)}
   </div>
   {items.some(i=>!i.dossier_id)?<form onSubmit={submit} style={{marginTop:24}}>
    <h2>ثبت اطلاعات واقعی شرکت</h2>
    <label htmlFor="coop-slug" style={{display:"block",margin:"14px 0 8px"}}>نشانی رزروشده موردنظر</label>
    <select id="coop-slug" value={form.slug} onChange={e=>setForm(f=>({...f,slug:e.target.value}))} required style={style}>
     {items.filter(i=>!i.dossier_id).map(i=><option key={i.slug} value={i.slug}>{i.slug}</option>)}
    </select>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,marginTop:10}}>
     {fields.map(field=><label key={field} style={{display:"block",lineHeight:2}}>
      {names[field]}
      <input style={{...style,marginTop:5}} value={form[field]}
       dir={["nationalId","registrationNumber","candidateManagerMobile","evidenceReference"].includes(field)?"ltr":"rtl"}
       inputMode={["nationalId","registrationNumber","candidateManagerMobile"].includes(field)?"numeric":"text"}
       maxLength={field==="legalAddress"?300:field==="legalName"||field==="evidenceReference"?180:field==="nationalId"||field==="candidateManagerMobile"?11:field==="registrationNumber"?20:120}
       pattern={field==="nationalId"?"[0-9]{11}":field==="registrationNumber"?"[0-9]{1,20}":field==="candidateManagerMobile"?"09[0-9]{9}":undefined}
       required={field!=="evidenceReference"} autoComplete="off"
       onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}/>
     </label>)}
    </div>
    <p style={{lineHeight:2,background:"#fff8e5",padding:12,borderRadius:9}}>
     شماره مدیر پیشنهادی فقط برای تکمیل پرونده ثبت می‌شود. پیامک OTP، تطبیق هویت و تأیید سمت مدیریتی در مراحل جدا انجام خواهند شد. اطلاعات جعلی یا آزمایشی وارد نکنید.
    </p>
    <button type="submit" disabled={busy} style={{background:"#08618b",color:"#fff",border:0,borderRadius:9,padding:"13px 25px",font:"inherit",cursor:"pointer"}}>
     {busy?"در حال ثبت…":"ثبت پرونده برای بررسی حقوقی"}
    </button>
   </form>:<p role="status">برای همه نشانی‌های فعلی پرونده اولیه وجود دارد و در انتظار بررسی است.</p>}
   </>}
   {message?<p role="status" style={{lineHeight:2,background:"#e6f4fa",padding:13,borderRadius:9}}>{message}</p>:null}
 </section></main>;
}
