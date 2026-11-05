"use client";
import {useState} from "react";
type Outcome="MATCH_REPORTED_UNVERIFIED"|"MISMATCH_REPORTED"|"INCONCLUSIVE";
export default function GazetteReviewerPage(){
 const [claimId,setClaimId]=useState(""),[sourceReference,setSourceReference]=useState("");
 const [sourceHashHex,setSourceHashHex]=useState(""),[outcome,setOutcome]=useState<Outcome>("INCONCLUSIVE");
 const [rationale,setRationale]=useState(""),[key,setKey]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const style={display:"grid",gap:6,marginBlock:12} as const;
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setMessage("");
  const requestKey=key||crypto.randomUUID();if(!key)setKey(requestKey);
  try{
   const res=await fetch("/api/governance/gazette-claims/"+encodeURIComponent(claimId)+"/reviews",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey,sourceReference,sourceHashHex,outcome,rationale})
   });
   if(!res.ok){setMessage(res.status===403?"مجوز بررسی مستقل معتبر نیست.":"ثبت نتیجه انجام نشد؛ اطلاعات یا وضعیت نشست را بررسی کنید.");return;}
   const result=await res.json() as {findingId?:string;roleGranted?:boolean;officiallyVerified?:boolean;legalApproval?:boolean};
   if(!result.findingId||result.roleGranted!==false||result.officiallyVerified!==false||result.legalApproval!==false)
    throw Error("UNSAFE_REVIEW_RECEIPT");
   setMessage("گزارش بررسی ثبت شد؛ این گزارش تأیید قانونی آگهی یا اعطای سمت و حق امضا نیست.");
   setKey("");
  }catch{setMessage("نتیجه درخواست نامشخص است؛ برای تکرار بدون ایجاد گزارش متعارض، اطلاعات را تغییر ندهید.");}
  finally{setBusy(false);}
 }
 return <main dir="rtl" style={{maxWidth:780,margin:"auto",padding:24,lineHeight:1.9}}>
  <a href="/">بازگشت به مدیریت ملی</a>
  <h1>بررسی مستقل اطلاعات آگهی رسمی</h1>
  <p role="note">تنها کارشناس دارای حکم معتبر و نشست فعال مجاز به ثبت گزارش است.
   تطبیق ادعای ثبت‌شده با منبع، به معنی تأیید اصالت رسمی یا ایجاد اختیار اجرایی نیست.</p>
  <form onSubmit={e=>void submit(e)}>
   <label style={style}>شناسه سابقه ثبت‌شده
    <input required pattern="[0-9a-fA-F-]{36}" value={claimId} onChange={e=>{setClaimId(e.target.value);setKey("");}}/>
   </label>
   <label style={style}>شناسه یا مرجع سند بررسی‌شده
    <input required minLength={8} maxLength={240} value={sourceReference} onChange={e=>{setSourceReference(e.target.value);setKey("");}}/>
   </label>
   <label style={style}>هش SHA-256 سند منبع (۶۴ کاراکتر هگزادسیمال)
    <input required pattern="[a-fA-F0-9]{64}" maxLength={64} dir="ltr" value={sourceHashHex} onChange={e=>{setSourceHashHex(e.target.value);setKey("");}}/>
   </label>
   <label style={style}>نتیجه گزارش
    <select value={outcome} onChange={e=>{setOutcome(e.target.value as Outcome);setKey("");}}>
     <option value="INCONCLUSIVE">نامشخص / نیازمند بررسی بیشتر</option>
     <option value="MATCH_REPORTED_UNVERIFIED">تطبیق گزارش شده، اصالت تأیید نشده</option>
     <option value="MISMATCH_REPORTED">مغایرت گزارش شده</option>
    </select>
   </label>
   <label style={style}>دلایل و مستندات ارزیابی
    <textarea required minLength={10} maxLength={1500} rows={5} value={rationale} onChange={e=>{setRationale(e.target.value);setKey("");}}/>
   </label>
   <button disabled={busy} type="submit">{busy?"در حال ثبت…":"ثبت گزارش بدون اعطای اختیار قانونی"}</button>
  </form>
  {message?<p role="status" aria-live="polite">{message}</p>:null}
 </main>;
}
