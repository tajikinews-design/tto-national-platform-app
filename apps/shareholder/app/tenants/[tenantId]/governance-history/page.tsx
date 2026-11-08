"use client";
import {useCallback,useEffect,useState} from "react";
import {useParams} from "next/navigation";

type Notice={noticeId:string;sourceType:string;noticeKind:string;legalNationalId:string;
 registrationNumber:string;sourceNoticeNumber:string|null;gazetteIssue:string|null;
 publishedOn:string|null;resolutionOn:string;authorityLetter:string|null;
 authorityLetterOn:string|null;summary:string;sourceUrl:string|null;provenance:string};
type Board={noticeId:string;personName:string;office:string;eventType:string;
 eventOn:string;termEnd:string|null;sourceVerified:false};
type Signing={noticeId:string;authorityKind:string;requiredSigner:string;
 alternateSigners:string[];requiresSeal:boolean;effectiveFrom:string;
 statedEnd:string|null;description:string;sourceVerified:false};
type Response={available:true;verified:false;notices:Notice[];boardHistory:Board[];
 signingHistory:Signing[]};
const office:Record<string,string>={
 BOARD_CHAIR:"رئیس هیئت‌مدیره",BOARD_VICE_CHAIR:"نایب‌رئیس هیئت‌مدیره",
 BOARD_SECRETARY:"منشی هیئت‌مدیره",BOARD_MEMBER:"عضو هیئت‌مدیره",
 CEO:"مدیرعامل",INSPECTOR:"بازرس",OTHER:"سایر"};
const event:Record<string,string>={APPOINTED:"انتخاب‌شده",RESIGNED:"استعفا",
 REAPPOINTED:"انتخاب مجدد",REMOVED:"عزل",REPORTED:"اعلام سمت"};
const kind:Record<string,string>={BINDING_FINANCIAL:"اسناد و تعهدات مالی",
 ORDINARY_LETTERS:"نامه‌ها و اوراق عادی"};
const source:Record<string,string>={COMPANY_REGISTRY:"ثبت شرکت‌ها",
 OFFICIAL_GAZETTE:"روزنامه رسمی"};
const box={border:"1px solid #d8e1e8",background:"#fff",borderRadius:12,padding:18,marginTop:16};
export default function GovernanceHistoryPage(){
 const {tenantId}=useParams<{tenantId:string}>();
 const [data,setData]=useState<Response|null>(null);
 const [status,setStatus]=useState<"loading"|"unauthorized"|"unavailable"|"ready">("loading");
 const load=useCallback(async()=>{
  setData(null);setStatus("loading");
  try{
   const r=await fetch("/api/tenants/"+encodeURIComponent(tenantId)+"/governance-history",
    {cache:"no-store",credentials:"same-origin"});
   if(r.status===401||r.status===403){setStatus("unauthorized");return;}
   if(!r.ok){setStatus("unavailable");return;}
   const v:unknown=await r.json();
   if(!v||typeof v!=="object"||Array.isArray(v))throw Error("BAD_RESPONSE");
   const d=v as Response;
   if(d.available!==true||d.verified!==false||!Array.isArray(d.notices)||
     !Array.isArray(d.boardHistory)||!Array.isArray(d.signingHistory))
    throw Error("UNSAFE_RESPONSE");
   setData(d);setStatus("ready");
  }catch{setStatus("unavailable");}
 },[tenantId]);
 useEffect(()=>{void load();},[load]);
 return <main dir="rtl" lang="fa" style={{maxWidth:1100,margin:"0 auto",padding:"26px 18px",
  lineHeight:1.9,color:"#183146",fontFamily:"var(--tto-font),sans-serif"}}>
  <nav><a href={"/tenants/"+encodeURIComponent(tenantId)+"/my-records"}>
   بازگشت به پرونده سهامدار</a></nav>
  <h1>آرشیو آگهی‌های رسمی و سوابق هیئت‌مدیره</h1>
  <p>سوابق در طول زمان حفظ می‌شوند؛ انتصاب جدید، سابقه سمت‌های گذشته را حذف نمی‌کند.</p>
  <aside role="note" style={{...box,background:"#fff7e6",borderColor:"#e6c986"}}>
   <strong>وضعیت اعتبار منابع: نیازمند بررسی اصل آگهی</strong>
   <p>اطلاعات زیر از اسناد و متن‌های ثبت‌شده در پرونده تعاونی استخراج شده‌اند. تا زمانی
   که اصل آگهی نزد مرجع صادرکننده احراز نشده باشد، این صفحه تأیید حقوقی هیئت‌مدیره،
   اعطای حق امضا یا حق رأی ایجاد نمی‌کند.</p>
  </aside>
  {status==="loading"&&<p role="status">در حال دریافت تاریخچه از منبع تعاونی…</p>}
  {status==="unauthorized"&&<p role="alert">برای مشاهده سوابق این تعاونی، ورود و مجوز لازم است.</p>}
  {status==="unavailable"&&<p role="alert">تاریخچه اکنون در دسترس نیست؛ اطلاعات حدسی نمایش داده نمی‌شود.</p>}
  {status==="ready"&&data&&<div>
   <section aria-labelledby="notices-heading" style={box}>
    <h2 id="notices-heading">آگهی‌ها و تغییرات ثبتی ({data.notices.length})</h2>
    {data.notices.length===0?<p>هنوز آگهی در پرونده ثبت نشده است.</p>:data.notices.map(n=><article
      key={n.noticeId} style={{borderTop:"1px solid #e6edf3",padding:"12px 0"}}>
     <h3>{source[n.sourceType]??n.sourceType} — {n.noticeKind}</h3>
     <p>صورت‌جلسه: {n.resolutionOn} · شماره ثبت شرکت: {n.registrationNumber} ·
      شناسه ملی شخصیت حقوقی: {n.legalNationalId}</p>
     <p>شماره آگهی: {n.sourceNoticeNumber??"هنوز ارائه نشده"} ·
      شماره روزنامه: {n.gazetteIssue??"هنوز ارائه نشده"} ·
      انتشار: {n.publishedOn??"نامشخص"}</p>
     {n.authorityLetter&&<p>نامه اداره تعاون: {n.authorityLetter}
      {n.authorityLetterOn?" ـ "+n.authorityLetterOn:""}</p>}
     <p>{n.summary}</p>
     <small>وضعیت منبع: در انتظار تطبیق با اصل صادرشده</small>
     {n.sourceUrl&&<p><a href={n.sourceUrl} rel="noopener noreferrer"
       target="_blank">ارجاع به منبع</a></p>}
    </article>)}
   </section>
   <section aria-labelledby="board-heading" style={box}>
    <h2 id="board-heading">تاریخچه هیئت‌مدیره و مدیرعامل ({data.boardHistory.length})</h2>
    <div style={{overflowX:"auto"}}><table style={{borderCollapse:"collapse",width:"100%"}}>
     <thead><tr>{["نام","سمت","رویداد","تاریخ","پایان اعلام‌شده"].map(t=><th
      key={t} scope="col" style={{textAlign:"right",padding:9,borderBottom:"1px solid #ddd"}}>{t}</th>)}</tr></thead>
     <tbody>{data.boardHistory.map((h,i)=><tr key={h.noticeId+"-"+h.personName+"-"+h.office+"-"+i}>
      <td style={{padding:8}}>{h.personName}</td><td>{office[h.office]??h.office}</td>
      <td>{event[h.eventType]??h.eventType}</td><td>{h.eventOn}</td>
      <td>{h.termEnd??"در منبع مشخص نشده"}</td></tr>)}</tbody>
    </table></div>
   </section>
   <section aria-labelledby="signing-heading" style={box}>
    <h2 id="signing-heading">سوابق شرایط حق امضا</h2>
    {data.signingHistory.map((r,i)=><article
      key={r.noticeId+"-"+r.authorityKind+"-"+i} style={{padding:"12px 0",
        borderTop:"1px solid #e6edf3"}}>
     <h3>{kind[r.authorityKind]??r.authorityKind}</h3>
     <p>{r.description}</p>
     <p>امضاکننده ثابت: {r.requiredSigner} · افراد جایگزین:
      {r.alternateSigners.length?r.alternateSigners.join(" یا "):"ندارد"}
      {" "}· مهر تعاونی: {r.requiresSeal?"الزامی":"ذکر نشده"}</p>
     <p>از تاریخ اعلامی {r.effectiveFrom} {r.statedEnd?"تا "+r.statedEnd:""}</p>
     <small>نقل از آگهی ثبت‌شده در پرونده، بدون احراز مستقل اصالت</small>
    </article>)}
   </section>
  </div>}
  <button type="button" onClick={()=>void load()} style={{marginTop:16,padding:"8px 18px"}}>
   بازخوانی تاریخچه
  </button>
 </main>;
}
