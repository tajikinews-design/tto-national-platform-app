"use client";
import {useState} from "react";

type Case={caseId:string;draftId:string;documentId:string;documentVersion:number;
 documentSha256:string;resolutionNumber:string;resolutionDate:string;
 effectiveFrom:string;effectiveUntil:string;
 signerClaims:Array<{signerId:string;claimedRole:string}>;
 status:string;reviewDecision?:string|null};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const input={width:"100%",padding:11,border:"1px solid #b9cedb",borderRadius:9,
 background:"white",boxSizing:"border-box" as const,font:"inherit"};
const field={display:"grid",gap:5,marginBottom:13};
export default function TariffBoardReview(){
 const [tenant,setTenant]=useState("");
 const [cases,setCases]=useState<Case[]>([]);
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 const [draftId,setDraftId]=useState("");
 const [documentId,setDocumentId]=useState("");
 const [documentVersion,setDocumentVersion]=useState("1");
 const [resolutionNumber,setResolutionNumber]=useState("");
 const [resolutionDate,setResolutionDate]=useState("");
 const [effectiveFrom,setEffectiveFrom]=useState("");
 const [effectiveUntil,setEffectiveUntil]=useState("");
 const [signerId,setSignerId]=useState("");
 const [signerRole,setSignerRole]=useState("BOARD_MEMBER");
 const [finding,setFinding]=useState("");
 const [selected,setSelected]=useState("");
 const [requestId,setRequestId]=useState("");
 const [reviewRequestId,setReviewRequestId]=useState("");
 const path=()=>"/api/tenants/"+encodeURIComponent(tenant)+
   "/share-market/tariff-board-cases";
 async function load(){
  if(!uuid.test(tenant)){setStatus("شناسه تعاونی معتبر نیست.");return;}
  setBusy(true);try{
   const r=await fetch(path(),{credentials:"same-origin",cache:"no-store"});
   if(!r.ok){setStatus("دسترسی یا مستندات قابل تأیید نیستند.");return;}
   const v=await r.json() as {items?:Case[];boardLegallyApproved?:boolean};
   if(!Array.isArray(v.items)||v.boardLegallyApproved!==false)
    throw Error("SOURCE_INVALID");
   setCases(v.items);setStatus("پرونده‌ها دریافت شدند. هیچ مصوبه‌ای تأیید قانونی نشده است.");
  }catch{setStatus("دریافت پرونده‌ها ناموفق بود.");}finally{setBusy(false);}
 }
 async function submit(event:React.FormEvent){
  event.preventDefault();
  if(![tenant,draftId,documentId,signerId].every(x=>uuid.test(x))||
    !/^\d+$/.test(documentVersion)||!resolutionNumber||
    !resolutionDate||!effectiveFrom||!effectiveUntil)
   {setStatus("اطلاعات پرونده ناقص است.");return;}
  setBusy(true);
  const key=requestId||crypto.randomUUID();
  if(!requestId)setRequestId(key);
  const body={requestKey:key,draftId,documentId,documentVersion:Number(documentVersion),
   resolutionNumber,resolutionDate,effectiveFrom,effectiveUntil,
   signerClaims:[{signerId,claimedRole:signerRole}]};
  try{
   const r=await fetch(path(),{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(!r.ok){setStatus("ثبت ارجاع مدرک رد شد؛ تاریخ اعتبار، نسخه فایل، سلامت سند و نقش مدیر را بررسی کنید.");return;}
   const d=await r.json() as {boardLegallyApproved?:boolean;caseId?:string};
   if(d.boardLegallyApproved!==false||!d.caseId)throw Error("UNSAFE_SOURCE");
   setRequestId("");setStatus("پرونده مدرک ثبت شد، اما امضاکنندگان و حق امضای آنان هنوز احراز نشده‌اند.");
   await load();
  }catch{setStatus("نتیجه ثبت نامشخص است؛ شناسه درخواست برای تکرار ایمن حفظ شد.");}
  finally{setBusy(false);}
 }
 async function review(decision:"METADATA_CHECKED_SIGNER_AUTHORITY_UNVERIFIED"|"DOCUMENT_REJECTED"){
  if(!uuid.test(tenant)||!uuid.test(selected)||finding.trim().length<8)
   {setStatus("پرونده و مرجع نتیجه بررسی معتبر نیست.");return;}
  setBusy(true);
  const key=reviewRequestId||crypto.randomUUID();
  if(!reviewRequestId)setReviewRequestId(key);
  try{
   const r=await fetch(path()+"/"+encodeURIComponent(selected)+"/review",{
     method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({requestKey:key,decision,findingReference:finding})});
   if(!r.ok){setStatus("بررسی رد شد؛ بازبین باید مستقل، مجاز و متعلق به همان تعاونی باشد.");return;}
   const d=await r.json() as {boardLegallyApproved?:boolean;signerAuthorityAuthenticated?:boolean};
   if(d.boardLegallyApproved!==false||d.signerAuthorityAuthenticated!==false)
     throw Error("UNSAFE_REVIEW");
   setReviewRequestId("");setStatus(decision==="DOCUMENT_REJECTED"?
    "رد مستند ثبت شد؛ تعرفه همچنان غیرفعال است.":
    "فقط یکپارچگی مدرک بررسی شد؛ اصالت امضا و اختیار هیئت‌مدیره هنوز تأیید نشده است.");
   await load();
  }catch{setStatus("نتیجه بررسی نامشخص است و کلید تکرار ایمن حفظ شد.");}
  finally{setBusy(false);}
 }
 return <main dir="rtl" lang="fa" style={{maxWidth:1050,margin:"0 auto",padding:24,
  fontFamily:"sans-serif",color:"#1b3d4e",lineHeight:1.8}}>
  <a href="/share-market/tariffs">بازگشت به تعرفه‌ها</a>
  <h1>بررسی مستندات هیئت‌مدیره برای تعرفه‌ها</h1>
  <p role="note" style={{padding:15,background:"#fff1d0",borderRadius:10}}>
   این صفحه برای گردآوری پرونده مستندات و بررسی مستقل است؛
   <strong> ثبت اطلاعات امضاکنندگان یا نتیجه بررسی فایل، حق امضای قانونی را اثبات نمی‌کند.</strong>
   هیچ پرونده‌ای تعرفه را فعال نمی‌کند، وجهی دریافت نمی‌شود و انتقال سهامی انجام نمی‌گیرد.
  </p>
  <label style={field}>شناسه تعاونی
   <input style={input} value={tenant} placeholder="UUID تعاونی" onChange={e=>{
    setTenant(e.target.value);setCases([]);setSelected("");}}/>
  </label>
  <button type="button" disabled={busy||!uuid.test(tenant)} onClick={()=>void load()}>
   مشاهده پرونده‌های تعاونی
  </button>
  <section style={{marginTop:20,padding:20,border:"1px solid #d3e2ea",borderRadius:12}}>
   <h2>ثبت ارجاع سند مصوبه برای پیش‌نویس ذخیره‌شده</h2>
   <p>فایل مصوبه باید قبلاً از مسیر امن اسناد تعاونی ثبت و اسکن شده باشد. این صفحه فایل محرمانه بارگذاری نمی‌کند.</p>
   <form onSubmit={e=>void submit(e)} style={{display:"grid",gridTemplateColumns:
    "repeat(auto-fit,minmax(230px,1fr))",gap:14}}>
    {([
      ["شناسه پیش‌نویس",draftId,setDraftId],["شناسه سند محفوظ در سامانه",documentId,setDocumentId],
      ["شماره نسخه سند",documentVersion,setDocumentVersion],
      ["شماره مصوبه",resolutionNumber,setResolutionNumber],
      ["تاریخ مصوبه (میلادی)",resolutionDate,setResolutionDate],
      ["شروع اعتبار",effectiveFrom,setEffectiveFrom],
      ["پایان اعتبار",effectiveUntil,setEffectiveUntil],
      ["شناسه اظهارشده امضاکننده",signerId,setSignerId]
    ] as Array<[string,string,(s:string)=>void]>).map(([text,value,set])=>
     <label key={text} style={field}>{text}
      <input style={input} value={value}
       type={text.includes("تاریخ")||text.includes("اعتبار")?"date":"text"}
       onChange={e=>{set(e.target.value);setRequestId("");}} required/>
     </label>)}
    <label style={field}>سمت اظهارشده امضاکننده
     <select style={input} value={signerRole} onChange={e=>{setSignerRole(e.target.value);setRequestId("");}}>
      <option value="BOARD_MEMBER">عضو هیئت‌مدیره</option>
      <option value="BOARD_CHAIR">رئیس هیئت‌مدیره</option>
      <option value="BOARD_SECRETARY">دبیر هیئت‌مدیره</option>
     </select>
    </label>
    <button type="submit" disabled={busy||!uuid.test(tenant)}
      style={{padding:12,alignSelf:"end"}}>ثبت مدرک برای بررسی (نه تصویب تعرفه)</button>
   </form>
  </section>
  <section style={{marginTop:24}}>
   <h2>بررسی مستقل و ثبت نتیجه مستند</h2>
   <p>فقط بازبین دارای نقش معتبر «بررسی اسناد» در همان تعاونی می‌تواند نتیجه را ثبت کند؛
     تنظیم شماره مصوبه به‌تنهایی مجوز ایجاد نتیجه مثبت نیست.</p>
   <label style={field}>پرونده
    <select value={selected} style={input} onChange={e=>{setSelected(e.target.value);setReviewRequestId("");}}>
     <option value="">انتخاب پرونده</option>
     {cases.map(c=><option key={c.caseId} value={c.caseId}>
      {c.resolutionNumber} — نسخه سند {c.documentVersion} — {c.reviewDecision||c.status}
     </option>)}
    </select>
   </label>
   <label style={field}>شناسه مرجع مستند نتیجه بررسی
    <input style={input} value={finding} onChange={e=>{setFinding(e.target.value);setReviewRequestId("");}}/>
   </label>
   <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
    <button disabled={busy||!selected} onClick={()=>void review("METADATA_CHECKED_SIGNER_AUTHORITY_UNVERIFIED")}>
      تأیید یکپارچگی فایل (بدون تأیید امضا)</button>
    <button disabled={busy||!selected} onClick={()=>void review("DOCUMENT_REJECTED")}>
      رد مستند</button>
   </div>
   <p aria-live="polite" role="status">{status}</p>
   <ul>{cases.map(c=><li key={c.caseId}>مصوبه {c.resolutionNumber} — SHA256: <code>{c.documentSha256}</code>
    {" — "}{c.reviewDecision||c.status} — <strong>تأیید قانونی: خیر</strong></li>)}</ul>
  </section>
 </main>;
}
