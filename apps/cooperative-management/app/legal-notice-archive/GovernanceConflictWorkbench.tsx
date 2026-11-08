"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
type Source={noticeId?:string;transitionId?:string;sourceNoticeNumber?:string|null;
 sourceReference?:string;sourceType?:string};
type Evidence={evidenceId:string;kind:string;sourceId:string;reference:string;
 claimedSha256:string|null;sourceVerified:false};
type Decision={dispositionId:string;outcome:string;reason:string;
 evidenceIds:string[];reviewedAt:string;legalAuthorityVerified:false;tariffActivated:false};
type Case={caseId:string;asOf:string;conflictCode:string;sourceSha256:string;
 openedAt:string;evidence:Evidence[];review:Decision|null};
type Audit={available:true;verified:false;cases:Case[]};
const border={border:"1px solid #cbdde8",borderRadius:12,padding:17,marginTop:18};
const input={padding:"9px 12px",border:"1px solid #9fbbc7",borderRadius:8,
 width:"100%",boxSizing:"border-box" as const,font:"inherit"};
const outcomes:Record<string,string>={
 HOLD_OFFICIAL_SOURCE_REQUIRED:"نیاز به بررسی اصل منبع رسمی",
 REJECT_SOURCE_CLAIM:"رد ادعای منبع (صرفاً در پرونده آزمون)",
 HOLD_INSUFFICIENT_EVIDENCE:"شواهد ناکافی برای نتیجه"};
export default function GovernanceConflictWorkbench({
 tenantId,mode="manager"}:{tenantId:string;mode?:"manager"|"reviewer"}){
 const [asOf,setAsOf]=useState("1404/11/12");
 const [conflicts,setConflicts]=useState<string[]>([]);
 const [conflict,setConflict]=useState("");
 const [notices,setNotices]=useState<Source[]>([]);
 const [transitions,setTransitions]=useState<Source[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [reference,setReference]=useState("شناسه آگهی/رویداد مطابق آرشیو داخلی تعاونی");
 const [audit,setAudit]=useState<Case[]>([]);
 const [loadError,setLoadError]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [key,setKey]=useState("");
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [chosen,setChosen]=useState<Record<string,string>>({});
 const [reviewKeys,setReviewKeys]=useState<Record<string,string>>({});
 const [reviewEvidence,setReviewEvidence]=useState<Record<string,string[]>>({});
 const get=useCallback(async(path:string)=>{
  const r=await fetch(path,{credentials:"same-origin",cache:"no-store"});
  if(!r.ok)throw Error("SOURCE_DENIED_"+r.status);
  return r.json() as Promise<Record<string,unknown>>;
 },[]);
 const root="/api/tenants/"+encodeURIComponent(tenantId);
 const refresh=useCallback(async()=>{
  if(!tenantId)return;
  setLoadError("");
  try{
   const data=await get(root+"/governance-conflicts") as unknown as Audit;
   if(data.available!==true||data.verified!==false||!Array.isArray(data.cases))
    throw Error("UNSAFE_AUDIT");
   setAudit(data.cases);
   if(mode==="manager"){
    const sources=await get(root+"/notice-transitions");
    if(sources.verified!==false||!Array.isArray(sources.notices)||
     !Array.isArray(sources.transitions))throw Error("UNSAFE_CATALOG");
    setNotices(sources.notices as Source[]);
    setTransitions(sources.transitions as Source[]);
   }
  }catch{setLoadError("پرونده‌های تعارض یا منابع مجاز در دسترس نیستند؛ هیچ نتیجه‌ای حدس زده نمی‌شود.");}
 },[root,mode,get,tenantId]);
 useEffect(()=>{void refresh();},[refresh]);
 async function findConflicts(){
  setMessage("");setConflicts([]);setConflict("");
  try{
   const data=await get(root+"/governance-conflicts?asOf="+encodeURIComponent(asOf));
   if(data.verified!==false||!Array.isArray(data.conflicts))throw Error("UNSAFE_CONFLICT");
   const next=data.conflicts.filter((v):v is string=>typeof v==="string");
   setConflicts(next);setConflict(next[0]??"");
   if(!next.length)setMessage("در داده‌های ثبت‌شده تعارضی برای این تاریخ گزارش نشده است.");
  }catch{setMessage("بازسازی تعارضها در تاریخ انتخابی ممکن نیست.");}
 }
 async function openCase(e:FormEvent){
  e.preventDefault();if(!tenantId||!conflict||selected.length===0||busy)return;
  const requestKey=key||crypto.randomUUID();setKey(requestKey);setBusy(true);setMessage("");
  const evidence=selected.map(v=>{
   const [kind,sourceId]=v.split(":");
   return {kind,sourceId,reference,sha256:null};
  });
  try{
   const r=await fetch(root+"/governance-conflicts",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({asOf,conflictCode:conflict,evidence,requestKey})});
   if(!r.ok){setMessage("ثبت پرونده رد شد ("+r.status+"). مستندات یا مجوز را بررسی کنید.");return;}
   const data=await r.json() as {caseId?:string;verified?:boolean};
   if(!data.caseId||data.verified!==false)throw Error("UNSAFE_RECEIPT");
   setMessage("پرونده تعارض ثبت شد؛ شناسه: "+data.caseId+
    ". منتظر نظر بازبین مستقل، بدون اعطای اعتبار حقوقی.");
   setKey("");setSelected([]);
   await refresh();
  }catch{setMessage("وضعیت ثبت نامشخص است؛ درخواست را دوباره بدون تغییر ارسال کنید.");}
  finally{setBusy(false);}
 }
 async function reviewCase(c:Case){
  if(!tenantId||busy||c.review)return;
  const requestKey=reviewKeys[c.caseId]||crypto.randomUUID();
  setReviewKeys(old=>({...old,[c.caseId]:requestKey}));
  setBusy(true);setMessage("");
  try{
   const r=await fetch(root+"/governance-conflicts/"+encodeURIComponent(c.caseId)+"/review",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({outcome:chosen[c.caseId]??"HOLD_OFFICIAL_SOURCE_REQUIRED",
      evidenceIds:reviewEvidence[c.caseId]??[],
      reason:reasons[c.caseId]??"",requestKey})});
   if(!r.ok){setMessage("رأی ثبت نشد ("+r.status+"). کنترل استقلال و مستندات را بررسی کنید.");return;}
   const v=await r.json() as {dispositionId?:string;verified?:boolean};
   if(!v.dispositionId||v.verified!==false)throw Error("UNSAFE_RESULT");
   setMessage("نظر مستقل به‌صورت غیرقابل‌ویرایش ثبت شد: "+v.dispositionId+
    "؛ این رأی مجوز امضا یا فعال‌سازی تعرفه نیست.");
   setReviewKeys(old=>({...old,[c.caseId]:""}));await refresh();
  }catch{setMessage("وضعیت رأی نامشخص است؛ پرونده را دوباره بازخوانی کنید.");}
  finally{setBusy(false);}
 }
 const items=[
  ...notices.map(x=>({id:"NOTICE:"+x.noticeId,label:"آگهی "+(x.sourceNoticeNumber??x.noticeId)})),
  ...transitions.map(x=>({id:"TRANSITION:"+x.transitionId,
   label:"اصلاح/ابطال "+(x.transitionId??"").slice(0,8)}))
 ];
 return <section dir="rtl" lang="fa" style={{...border,background:"#fff"}}>
  <h2>{mode==="manager"?"ثبت مستندات پرونده تعارض":"بازبینی مستقل تعارض آگهی‌ها"}</h2>
  <p style={{padding:12,background:"#fff2d4"}}>تمامی مدارک و تصمیم‌ها صرفاً ادعاهای ثبت‌شده در
   محیط توسعه هستند. رأی بازبین به تأیید رسمی اشخاص یا فعال‌سازی تعرفه تبدیل نمی‌شود.</p>
  <button type="button" onClick={()=>void refresh()} disabled={busy}>بازخوانی پرونده‌ها</button>
  {loadError&&<p role="alert">{loadError}</p>}
  {mode==="manager"&&<form onSubmit={e=>void openCase(e)} style={border}>
   <label>تاریخ بازسازی تعارض<input style={input} value={asOf}
    required placeholder="1404/11/12" pattern="14[0-9]{2}/[0-1][0-9]/[0-3][0-9]"
    onChange={e=>{setAsOf(e.target.value);setKey("");}}/></label>
   <button type="button" onClick={()=>void findConflicts()} style={{marginTop:10}}>
    استخراج تعارض‌های همان تاریخ
   </button>
   {conflicts.length>0&&<>
    <label style={{display:"block",marginTop:12}}>کد تعارض
     <select style={input} value={conflict} required onChange={e=>{
      setConflict(e.target.value);setKey("");}}>
      {conflicts.map(x=><option key={x}>{x}</option>)}</select>
    </label>
    <fieldset style={{marginTop:12}}>
     <legend>مستندات مرتبط (انتخاب حداقل یک مورد)</legend>
     {items.map(x=><label key={x.id} style={{display:"block",padding:6}}>
      <input type="checkbox" checked={selected.includes(x.id)}
       onChange={e=>{setSelected(list=>e.target.checked?[...list,x.id]:
        list.filter(a=>a!==x.id));setKey("");}}/> {x.label}
     </label>)}
    </fieldset>
    <label>شرح مرجع مستند (بدون شناسه ملی اشخاص)
     <textarea required style={input} rows={2} minLength={12} maxLength={350}
      value={reference} onChange={e=>{setReference(e.target.value);setKey("");}}/>
    </label>
    <button type="submit" disabled={busy||selected.length<1}>
     ثبت پرونده و ارجاع برای بررسی مستقل
    </button>
   </>}
  </form>}
  {message&&<p role="status">{message}</p>}
  <section aria-label="تاریخچه رسیدگی" style={border}>
   <h3>پرونده‌های ثبت‌شده ({audit.length})</h3>
   {audit.map(c=><article key={c.caseId} style={{borderTop:"1px solid #cbdde8",padding:"12px 0"}}>
    <h4>{c.conflictCode}</h4>
    <p>شناسه: {c.caseId} | تاریخ اثر: {c.asOf} | زمان ثبت: {c.openedAt}</p>
    <p>اثر انگشت وضعیت منبع: <code dir="ltr">{c.sourceSha256}</code></p>
    <ul>{c.evidence.map(ev=><li key={ev.evidenceId}>مستند {ev.kind} / شناسه
     {ev.sourceId.slice(0,8)} / ارجاع: {ev.reference} / اصالت‌سنجی نشده</li>)}</ul>
    {c.review?<aside style={{padding:12,background:"#e5edf0"}}>
      <strong>نتیجه ثبت‌شده: {outcomes[c.review.outcome]??c.review.outcome}</strong>
      <p>{c.review.reason}</p><small>شناسه نظر: {c.review.dispositionId} ·
       تاریخ ثبت: {c.review.reviewedAt} · بدون احراز حقوقی</small>
     </aside>:<p>وضعیت: در انتظار بازبینی مستقل</p>}
    {mode==="reviewer"&&!c.review&&<section style={border}>
     <label>نتیجه رسیدگی (صرفاً HOLD یا رد منبع)
      <select style={input} value={chosen[c.caseId]??"HOLD_OFFICIAL_SOURCE_REQUIRED"}
       onChange={e=>setChosen(p=>({...p,[c.caseId]:e.target.value}))}>
       {Object.entries(outcomes).map(([v,label])=><option key={v} value={v}>{label}</option>)}
      </select>
     </label>
     <fieldset><legend>مستندات مورد استناد رأی (حداقل یک مورد)</legend>
      {c.evidence.map(ev=><label key={ev.evidenceId} style={{display:"block"}}>
       <input type="checkbox" checked={(reviewEvidence[c.caseId]??[]).includes(ev.evidenceId)}
        onChange={e=>setReviewEvidence(p=>({...p,[c.caseId]:
         e.target.checked?[...(p[c.caseId]??[]),ev.evidenceId]:
         (p[c.caseId]??[]).filter(id=>id!==ev.evidenceId)}))}/>
       {ev.reference} ({ev.evidenceId.slice(0,8)})
      </label>)}
     </fieldset>
     <label>استدلال مستقل بازبین<textarea style={input} minLength={25}
      maxLength={1400} rows={4} value={reasons[c.caseId]??""}
      onChange={e=>setReasons(p=>({...p,[c.caseId]:e.target.value}))}/></label>
     <button type="button" disabled={busy||!(reviewEvidence[c.caseId]?.length)}
      onClick={()=>void reviewCase(c)}>ثبت قطعی نظر غیرقابل‌ویرایش</button>
    </section>}
   </article>)}
  </section>
 </section>;
}
