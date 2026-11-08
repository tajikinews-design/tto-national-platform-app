"use client";
import {useParams} from "next/navigation";
import {useState,type FormEvent} from "react";
type Row=Record<string,unknown>;
type Snapshot={available:true;verified:false;asOf:string;knownAt:string;
 certainty:string;candidateOffices:Row[];endedOffices:Row[];
 signingCandidates:Row[];issues:string[];conflicts:string[];consideredNoticeIds:string[]};
const office:Record<string,string>={BOARD_CHAIR:"رئیس هیئت‌مدیره",
 BOARD_VICE_CHAIR:"نایب‌رئیس",BOARD_SECRETARY:"منشی",
 BOARD_MEMBER:"عضو هیئت‌مدیره",CEO:"مدیرعامل",INSPECTOR:"بازرس"};
const status:Record<string,string>={CONFLICT_HOLD:"تعارض منابع — قابل‌تعیین نیست",
 INCOMPLETE_SOURCE_HOLD:"شواهد ناقص؛ اعتبار حقوقی تأیید نشده",
 SOURCE_DECLARED_ONLY:"ترکیب گزارش‌شده در منابع؛ بدون احراز اصالت"};
export default function TemporalGovernance(){
 const {tenantId}=useParams<{tenantId:string}>();
 const [asOf,setAsOf]=useState("1404/08/06");
 const [knownAt,setKnownAt]=useState("");
 const [result,setResult]=useState<Snapshot|null>(null);
 const [problem,setProblem]=useState("");
 const [busy,setBusy]=useState(false);
 async function lookUp(e:FormEvent){
  e.preventDefault();setBusy(true);setProblem("");setResult(null);
  const query=new URLSearchParams({date:asOf});
  if(knownAt.trim())query.set("knownAt",new Date(knownAt).toISOString());
  try{
   const r=await fetch("/api/tenants/"+encodeURIComponent(tenantId)+
      "/governance-as-of?"+query,{credentials:"same-origin",cache:"no-store"});
   if(!r.ok){setProblem(r.status===401||r.status===403?
       "برای مشاهده سوابق تعاونی، ورود و مجوز لازم است.":
       "بازسازی تاریخچه در این تاریخ ممکن نیست؛ اطلاعات حدسی نمایش داده نمی‌شود.");return;}
   const v=await r.json() as Snapshot;
   if(v.available!==true||v.verified!==false||!Array.isArray(v.candidateOffices)||
     !Array.isArray(v.signingCandidates)||!Array.isArray(v.conflicts))throw Error("BAD_RESPONSE");
   setResult(v);
  }catch{setProblem("دسترسی به منبع یا تاریخ درخواستی نامعتبر است.");}
  finally{setBusy(false);}
 }
 const card={padding:17,border:"1px solid #d3dfea",borderRadius:12,margin:"16px 0",background:"#fff"};
 return <main dir="rtl" lang="fa" style={{fontFamily:"var(--tto-font),sans-serif",
  maxWidth:1100,margin:"0 auto",padding:"24px",lineHeight:1.95,color:"#163347"}}>
  <nav><a href={"/tenants/"+encodeURIComponent(tenantId)+"/governance-history"}>
   بازگشت به آرشیو آگهی‌های هیئت‌مدیره
  </a></nav>
  <h1>ترکیب هیئت‌مدیره و صاحبان امضا در تاریخ مشخص</h1>
  <p>این ابزار با کنار هم گذاشتن تاریخ اثر تغییر، زمان انتشار آگهی، اصلاحیه‌ها،
   ابطال و پایان دوره، ترکیب اعلام‌شده را بازسازی می‌کند؛ صرفاً جدیدترین آگهی ملاک نیست.</p>
  <aside role="note" style={{...card,background:"#fff7e4",borderColor:"#ddbe83"}}>
   <strong>این خروجی گواهی قانونی اختیار امضا نیست.</strong>
   <p>آگهی‌های فاقد تاریخ انتشار یا دارای اصلاحیه مبهم، با هشدار نمایش داده می‌شوند.
   وضعیت HOLD به معنی ناتوانی در تأیید قانونی است؛ نه اثبات فقدان سمت.</p>
  </aside>
  <form onSubmit={e=>void lookUp(e)} style={{...card,display:"flex",gap:14,alignItems:"end",flexWrap:"wrap"}}>
   <label>تاریخ شمسی موردنظر (نمونه ۱۴۰۴/۰۸/۰۶)
    <input required dir="ltr" value={asOf} placeholder="1404/08/06" pattern="14[0-9]{2}/[0-1][0-9]/[0-3][0-9]"
     onChange={e=>setAsOf(e.target.value)} style={{display:"block",padding:10,width:190}}/></label>
   <label>اطلاعات ثبت‌شده تا زمان میلادی (اختیاری)
    <input type="datetime-local" value={knownAt} onChange={e=>setKnownAt(e.target.value)}
     style={{display:"block",padding:10}}/></label>
   <button type="submit" disabled={busy} style={{padding:"10px 18px"}}>
    {busy?"در حال بررسی…":"بازسازی تاریخچه"}
   </button>
  </form>
  {problem&&<p role="alert">{problem}</p>}
  {result&&<>
   <section style={card} aria-label="وضعیت کلی پرونده">
    <h2>{status[result.certainty]??"وضعیت نامشخص"}</h2>
    <p>تاریخ اثر بررسی‌شده: {result.asOf} · زمان آگاهی ثبت‌شده: {result.knownAt}</p>
    <p>تعداد منابع بررسی‌شده: {result.consideredNoticeIds.length}</p>
    {!!result.issues.length&&<><h3>ابهام‌های منبع</h3><ul>{result.issues.map(t=><li key={t}>{t}</li>)}</ul></>}
    {!!result.conflicts.length&&<><h3>تعارض‌های نیازمند بررسی</h3><ul>{result.conflicts.map(t=><li key={t}>{t}</li>)}</ul></>}
   </section>
   <section style={card} aria-labelledby="asof-offices">
    <h2 id="asof-offices">سمت‌های اعلام‌شده در تاریخ انتخابی</h2>
    {result.candidateOffices.length===0?<p>ترکیب قابل بازسازی نیست.</p>:<ul>{
      result.candidateOffices.map((r,i)=><li key={String(r.noticeId)+"-"+i}>
       <strong>{String(r.personName)} — {office[String(r.office)]??String(r.office)}</strong>
       <span>؛ رویداد از {String(r.effectiveOn)}؛ پایان اعلام‌شده: {String(r.termEnd??"نامشخص")}</span>
       {r.publicationKnown===false&&<span> ⚠️ تاریخ انتشار منبع موجود نیست</span>}
      </li>)}</ul>}
   </section>
   <section style={card} aria-labelledby="asof-ceased">
    <h2 id="asof-ceased">استعفا، عزل یا پایان دوره اعلام‌شده</h2>
    {result.endedOffices.length===0?<p>موردی در محدوده موجود نیست.</p>:<ul>{
      result.endedOffices.map((r,i)=><li key={i}>{String(r.personName)} —
        {office[String(r.office)]??String(r.office)}: {String(r.endReason)}</li>)}</ul>}
   </section>
   <section style={card} aria-labelledby="asof-signing">
    <h2 id="asof-signing">قواعد گزارش‌شده حق امضا</h2>
    {result.signingCandidates.length===0?<p>قاعده‌ای با شواهد کافی در دسترس نیست.</p>:
     result.signingCandidates.map((r,i)=><article key={i} style={{padding:9}}>
      <h3>{r.authorityKind==="BINDING_FINANCIAL"?"اسناد مالی و تعهدآور":"نامه‌های عادی"}</h3>
      <p>{String(r.description)}</p>
      <p>امضاکننده ثابت: {String(r.requiredSigner)}؛ سایر امضاکنندگان ذکرشده:
       {Array.isArray(r.alternateSigners)?r.alternateSigners.join(" یا "):"نامشخص"}؛
       مهر شرکت: {r.requiresSeal===true?"الزامی":"نامشخص"}</p>
     </article>)}
   </section>
  </>}
 </main>;
}
