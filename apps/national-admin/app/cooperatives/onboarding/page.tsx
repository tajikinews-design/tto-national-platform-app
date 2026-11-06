"use client";
import {useEffect,useState,type FormEvent} from "react";
type Draft={slug:string;payload:Partial<Model>;version:number};
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
 const [correctedEvidence,setCorrectedEvidence]=useState<Record<string,string>>({});
 const [drafts,setDrafts]=useState<Record<string,Draft>>({});
 const [draftVersions,setDraftVersions]=useState<Record<string,number>>({});
 const [evidenceFile,setEvidenceFile]=useState<File|null>(null);
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
   const draftsResponse=await fetch("/api/cooperatives/onboarding-drafts",
     {cache:"no-store",credentials:"same-origin"});
   if(!draftsResponse.ok)throw Error("drafts-unavailable");
   const draftsJson:unknown=await draftsResponse.json();
   if(!draftsJson||typeof draftsJson!=="object"||Array.isArray(draftsJson)||
      !Array.isArray((draftsJson as {items?:unknown}).items))throw Error("invalid-drafts");
   const loaded=(draftsJson as {items:Draft[]}).items;
   const map=Object.fromEntries(loaded.map(d=>[d.slug,d])) as Record<string,Draft>;
   setDrafts(map);
   setDraftVersions(Object.fromEntries(loaded.map(d=>[d.slug,d.version])));
   setItems(records);
   setForm(f=>{
     const slug=records.some(x=>x.slug===f.slug&&!x.dossier_id)?f.slug:
       records.find(x=>!x.dossier_id)?.slug??"";
     return f.slug?{...f,slug}:{...blank,...(map[slug]?.payload??{}),slug};
   });
   setPhase("ready");
  }catch{setPhase("error")}
 }
 useEffect(()=>{void refresh()},[]);
 async function uploadQuarantinedEvidence(){
  const file=evidenceFile;
  if(!file||busy||phase!=="ready"||!form.slug)return;
  if(file.size<8||file.size>524288||
    !["application/pdf","image/jpeg","image/png"].includes(file.type)){
   setMessage("فقط PDF، PNG یا JPEG تا حجم ۵۱۲ کیلوبایت در قرنطینه آزمایشی پذیرفته می‌شود.");return;
  }
  setBusy(true);setMessage("");
  try{
   const dataUrl=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(Error("file-read"));
    reader.readAsDataURL(file);
   });
   const encoded=dataUrl.split(",")[1];
   if(!encoded)throw Error("file-encoding");
   const response=await fetch("/api/cooperatives/onboarding-evidence",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({slug:form.slug,uploadKey:crypto.randomUUID(),
      mimeType:file.type,contentBase64:encoded})
   });
   if(response.status===401||response.status===403){setPhase("denied");return;}
   if(!response.ok)throw Error("upload-failed");
   const obj=await response.json() as {evidenceId?:string;scanStatus?:string;authenticity?:string};
   if(!obj.evidenceId||obj.scanStatus!=="QUARANTINED"||
      obj.authenticity!=="NOT_VERIFIED")throw Error("unexpected-evidence-state");
   setForm(prev=>({...prev,evidenceReference:obj.evidenceId!}));
   setMessage("مدرک رمزگذاری و فقط قرنطینه شد؛ اسکن امنیتی و اصالت حقوقی هنوز تأیید نشده‌اند.");
   setEvidenceFile(null);
  }catch{setMessage("بارگذاری امن تأیید نشد. هیچ اصالت یا وضعیت بررسی برای مدرک ثبت نشده است.");}
  finally{setBusy(false)}
 }
 async function scanCurrentQuarantine(){
  const evidenceId=form.evidenceReference;
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(evidenceId)||busy||phase!=="ready")return;
  setBusy(true);setMessage("");
  try{
   const response=await fetch(
    "/api/cooperatives/onboarding-evidence/"+encodeURIComponent(evidenceId)+"/scan",{
     method:"POST",credentials:"same-origin",cache:"no-store",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({requestKey:crypto.randomUUID()})
    });
   if(response.status===401||response.status===403){setPhase("denied");return;}
   if(!response.ok){
    setMessage("اسکن امنیتی در دسترس یا قابل تأیید نیست؛ مدرک همچنان در قرنطینه باقی می‌ماند.");
    return;
   }
   const result=await response.json() as {
    verdict?:string;stillQuarantined?:boolean;authenticity?:string;legalApproval?:boolean
   };
   if(!["CLEAN","MALWARE"].includes(result.verdict??"")||
      result.stillQuarantined!==true||result.authenticity!=="NOT_VERIFIED"||
      result.legalApproval!==false)throw Error("INVALID_SCAN_RESPONSE");
   setMessage(result.verdict==="MALWARE"?
     "اسکنر آلودگی را گزارش کرد؛ فایل در قرنطینه باقی می‌ماند و قابل تأیید نیست.":
     "اسکن فنی موردی بدون گزارش آلودگی ثبت شد؛ اصالت حقوقی و پایگاه کامل امضاهای ضدبدافزار هنوز تأیید نشده‌اند و فایل در قرنطینه است.");
  }catch{setMessage("نتیجه اسکن قابل تأیید نبود؛ هیچ تغییری در قرنطینه یا اعتبار مدرک ایجاد نشد.");}
  finally{setBusy(false)}
 }
 async function saveDraft(){
  if(busy||phase!=="ready"||!form.slug)return;
  setBusy(true);setMessage("");
  const payload=Object.fromEntries(fields.map(k=>[k,form[k]]));
  try{
   const response=await fetch("/api/cooperatives/onboarding-drafts",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({slug:form.slug,payload,expectedVersion:draftVersions[form.slug]??0,
      requestKey:crypto.randomUUID()})
   });
   if(response.status===409){setMessage("پیش‌نویس روی سرور تغییر کرده است؛ نسخه جدید را دریافت کنید.");await refresh();return;}
   if(response.status===401||response.status===403){setPhase("denied");return;}
   if(!response.ok)throw Error("draft-save-not-confirmed");
   const obj=await response.json() as {slug?:string;version?:number;submitted?:boolean;tenantCreated?:boolean};
   if(obj.slug!==form.slug||typeof obj.version!=="number"||obj.submitted!==false||
      obj.tenantCreated!==false)throw Error("draft-invalid-result");
   setDraftVersions(v=>({...v,[form.slug]:obj.version!}));
   setDrafts(v=>({...v,[form.slug]:{slug:form.slug,version:obj.version!,payload}}));
   setMessage("پیش‌نویس امن در پرونده ذخیره شد؛ هیچ تأیید یا فعال‌سازی انجام نشده است.");
  }catch{setMessage("ذخیره پیش‌نویس تأیید نشد؛ اطلاعات فعلی را حفظ و وضعیت سرور را بررسی کنید.");}
  finally{setBusy(false)}
 }
 async function advance(row:Row,action:string){
  if(busy||!row.dossier_id||!row.review_version)return;
  const reason=(reasons[row.slug]??"").trim();
  const evidenceReference=(correctedEvidence[row.slug]??"").trim();
  if(action==="RESUBMIT"&&(evidenceReference.length<5||evidenceReference.length>180)){
   setMessage("برای ارسال دوباره، مرجع مدرک اصلاح‌شده با طول ۵ تا ۱۸۰ حرف لازم است.");return;
  }
  if(["REQUEST_CHANGES","REJECT","REFER_EXTERNAL_REVIEW","RECOMMEND_EXTERNAL_APPROVAL"].includes(action)&&
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
      requestKey:crypto.randomUUID(),...(reason?{reason}:{}),
      ...(action==="RESUBMIT"?{evidenceReference}:{})})
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
        <button disabled={busy} onClick={()=>void advance(i,"REFER_EXTERNAL_REVIEW")}>ارجاع برای تأیید مستقل حقوقی</button>
      </>:null}
      {i.dossier_state==="CHANGES_REQUESTED"?<div style={{width:"100%"}}>
        <label>شناسه مرجع مدرک اصلاح‌شده
          <input style={style} minLength={5} maxLength={180}
           value={correctedEvidence[i.slug]??""}
           onChange={e=>setCorrectedEvidence(p=>({...p,[i.slug]:e.target.value}))}/>
        </label>
        <button disabled={busy} onClick={()=>void advance(i,"RESUBMIT")}>ارسال مجدد مدرک اصلاح‌شده</button>
      </div>:null}
      </div>
    </>:null}
   </div>)}
   </div>
   {items.some(i=>!i.dossier_id)?<form onSubmit={submit} style={{marginTop:24}}>
    <h2>ثبت اطلاعات واقعی شرکت</h2>
    <label htmlFor="coop-slug" style={{display:"block",margin:"14px 0 8px"}}>نشانی رزروشده موردنظر</label>
    <select id="coop-slug" value={form.slug} onChange={e=>setForm({...blank,...(drafts[e.target.value]?.payload??{}),slug:e.target.value})} required style={style}>
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
    <div style={{marginTop:16,padding:12,border:"1px dashed #8098ac",borderRadius:9}}>
      <label htmlFor="coop-evidence-file">بارگذاری آزمایشی مدرک در قرنطینه رمزگذاری‌شده</label>
      <p style={{lineHeight:2}}>فقط PDF یا تصویر تا ۵۱۲ کیلوبایت. فایل در اختیار کاربران
       دیگر قرار نمی‌گیرد و تا تأیید مستقل اسکن امنیتی و اصالت حقوقی معتبر نیست.</p>
      <input id="coop-evidence-file" type="file" accept="application/pdf,image/png,image/jpeg"
        onChange={e=>setEvidenceFile(e.target.files?.[0]??null)} />
      <button type="button" disabled={!evidenceFile||busy}
        onClick={()=>void uploadQuarantinedEvidence()}
        style={{marginRight:9,padding:"9px 15px"}}>ارسال به قرنطینه</button>
      <button type="button" disabled={busy||!/^[0-9a-f-]{36}$/i.test(form.evidenceReference)}
        onClick={()=>void scanCurrentQuarantine()}
        style={{marginRight:9,padding:"9px 15px",background:"#f0f6f7",border:"1px solid #b7c9cf",
                borderRadius:7,cursor:"pointer"}}>
        اجرای اسکن بدافزار (بدون خروج از قرنطینه)
      </button>
    </div>
    <p style={{lineHeight:2,background:"#fff8e5",padding:12,borderRadius:9}}>
     شماره مدیر پیشنهادی فقط برای تکمیل پرونده ثبت می‌شود. پیامک OTP، تطبیق هویت و تأیید سمت مدیریتی در مراحل جدا انجام خواهند شد. اطلاعات جعلی یا آزمایشی وارد نکنید.
    </p>
    <button type="button" disabled={busy} onClick={()=>void saveDraft()}
     style={{background:"#e8f1f7",color:"#173b53",border:"1px solid #93adbd",borderRadius:9,
             padding:"13px 25px",font:"inherit",marginLeft:9}}>
      {busy?"در حال ذخیره…":"ذخیره پیش‌نویس"}
    </button>
    <button type="submit" disabled={busy} style={{background:"#08618b",color:"#fff",border:0,borderRadius:9,padding:"13px 25px",font:"inherit",cursor:"pointer"}}>
     {busy?"در حال ثبت…":"ثبت پرونده برای بررسی حقوقی"}
    </button>
   </form>:<p role="status">برای همه نشانی‌های فعلی پرونده اولیه وجود دارد و در انتظار بررسی است.</p>}
   </>}
   {message?<p role="status" style={{lineHeight:2,background:"#e6f4fa",padding:13,borderRadius:9}}>{message}</p>:null}
 </section></main>;
}
