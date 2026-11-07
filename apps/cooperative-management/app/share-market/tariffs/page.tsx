"use client";
import {useEffect,useMemo,useState} from "react";

type Tenant={tenantId:string;displayName:string;evidenceStatus:string};
type Draft={
 feeId:string;title:string;version:string;feeType:string;calculationMode:string;
 fixedAmount:string;percentBps:string;payerMode:string;buyerPercent:string;
 sellerPercent:string;percentageBasis:string;validFrom:string;validUntil:string;
 legalBasisReference:string;boardResolutionReference:string;boardEvidenceReference:string;
};
type LocalDraft={id:string;tenantId:string;createdAt:string;data:Draft;persisted:boolean};
const initial:Draft={
 feeId:"",title:"",version:"1",feeType:"COOP_APPROVED_FEE",calculationMode:"FIXED",
 fixedAmount:"",percentBps:"0",payerMode:"BUYER",buyerPercent:"100",sellerPercent:"0",
 percentageBasis:"TRADE_GROSS_VALUE",validFrom:"",validUntil:"",
 legalBasisReference:"",boardResolutionReference:"",boardEvidenceReference:""
};
const inputStyle={width:"100%",padding:"12px 13px",font:"inherit",borderRadius:10,
 border:"1px solid #b5c9d4",background:"#fff",color:"#203c4b",boxSizing:"border-box" as const};
const labelStyle={display:"grid",gap:7,fontSize:14,fontWeight:650 as const};
const evidence=[
 ["COOPERATIVE_BOARD_RESOLUTION","مصوبه معتبر هیئت‌مدیره درباره تعرفه، تاریخ اجرا و فرمول"],
 ["FINANCE_OFFICER_BOARD_MANDATE","مصوبه تعیین حدود اختیار مسئول مالی"],
 ["CEO_OFFICIAL_MANDATE","مستند سمت و اختیار مدیرعامل"],
 ["AUTHENTICATED_COOPERATIVE_BANK_SETTLEMENT","گواهی معتبر وصول هزینه به حساب تعاونی"]
] as const;
const numberValue=(s:string)=>/^\d+$/.test(s)?Number(s):NaN;
export default function CooperativeTariffPreparation(){
 const [tenants,setTenants]=useState<Tenant[]>([]);
 const [tenantId,setTenantId]=useState("");
 const [phase,setPhase]=useState<"loading"|"ready"|"denied"|"unavailable">("loading");
 const [gate,setGate]=useState(false);
 const [form,setForm]=useState<Draft>({...initial});
 const [drafts,setDrafts]=useState<LocalDraft[]>([]);
 const [persistence,setPersistence]=useState(false);
 const [busy,setBusy]=useState(false);
 const [requestKey,setRequestKey]=useState("");
 const [message,setMessage]=useState("");
 const selected=useMemo(()=>tenants.find(t=>t.tenantId===tenantId),[tenants,tenantId]);
 useEffect(()=>{
  const abort=new AbortController();
  void fetch("/api/me/tenant-options",{cache:"no-store",credentials:"same-origin",signal:abort.signal})
  .then(async res=>{
    if(!res.ok){setPhase(res.status===401||res.status===403?"denied":"unavailable");return;}
    const data=await res.json() as {items?:Tenant[]};
    const allowed=Array.isArray(data.items)?
      data.items.filter(t=>t.evidenceStatus==="ROLE_AUTHORITY_EVIDENCE"):[];
    setTenants(allowed);setTenantId(allowed[0]?.tenantId??"");setPhase("ready");
  }).catch(()=>{if(!abort.signal.aborted)setPhase("unavailable")});
  return()=>abort.abort();
 },[]);
 useEffect(()=>{
  setGate(false);setPersistence(false);setRequestKey("");
  setMessage("");setDrafts([]);setForm({...initial});
  if(phase!=="ready"||!tenantId)return;
  const abort=new AbortController();
  void fetch("/api/tenants/"+encodeURIComponent(tenantId)+
    "/share-market/tariff-draft-readiness",{cache:"no-store",credentials:"same-origin",signal:abort.signal})
  .then(async res=>{
    if(!res.ok)throw Error("TENANT_CONTEXT_NOT_VERIFIED");
    const data=await res.json() as Record<string,unknown>;
    if(data.tenantId!==tenantId||data.tenantContextVerified!==true||
      data.draftPreparationAllowed!==true||data.liveTariffWrites!==false||
      data.officialTariffActivation!==false||data.officialFeePaid!==false||
      data.ownershipTransferEnabled!==false||
      typeof data.serverSideTariffDraftPersistence!=="boolean")
      throw Error("UNSAFE_DRAFT_GATE");
    if(!abort.signal.aborted){
      setPersistence(data.serverSideTariffDraftPersistence===true);
      setGate(true);
      if(data.serverSideTariffDraftPersistence===true){
        void fetch("/api/tenants/"+encodeURIComponent(tenantId)+"/share-market/tariff-drafts",{
          credentials:"same-origin",cache:"no-store",signal:abort.signal
        }).then(async response=>{
          if(!response.ok)throw Error("DRAFT_LIST_UNAVAILABLE");
          const result=await response.json() as{
            draftOnly?:boolean;feeActivated?:boolean;items?:Array<{
              draftId:string;createdAt:string;status:string;tariff:Draft
            }>};
          if(result.draftOnly!==true||result.feeActivated!==false||!Array.isArray(result.items))
             throw Error("UNSAFE_DRAFT_LIST");
          if(!abort.signal.aborted)setDrafts(result.items.filter(x=>
            x.status==="DRAFT_UNVERIFIED").map(x=>({id:x.draftId,tenantId,
              createdAt:x.createdAt,data:x.tariff,persisted:true})));
        }).catch(()=>{if(!abort.signal.aborted)
          setMessage("بارگذاری پیش‌نویس‌های ثبت‌شده ممکن نیست؛ هیچ رکوردی به‌طور فرضی تأیید نمی‌شود.");});
      }
    }
  }).catch(()=>{if(!abort.signal.aborted){setGate(false);
     setMessage("نشست، محدوده تعاونی یا اتصال به منبع تأیید نشد؛ فرم غیرفعال است.");}});
  return()=>abort.abort();
 },[phase,tenantId]);
 function change(field:keyof Draft,value:string){
  setRequestKey("");
  setForm(o=>({...o,[field]:value,
   ...(field==="payerMode"?{
    buyerPercent:value==="BUYER"?"100":value==="SELLER"?"0":"50",
    sellerPercent:value==="BUYER"?"0":value==="SELLER"?"100":"50"
   }:{})}));
  setMessage("");
 }
 function validate(){
  const version=numberValue(form.version),fixed=numberValue(form.fixedAmount),
    rate=numberValue(form.percentBps),buyer=numberValue(form.buyerPercent),
    seller=numberValue(form.sellerPercent);
  if(!/^[A-Z][A-Z0-9_-]{3,63}$/.test(form.feeId)||form.title.trim().length<8||
    !Number.isSafeInteger(version)||version<1||
    !Number.isSafeInteger(fixed)||fixed<0||
    !Number.isSafeInteger(rate)||rate<0||rate>10000||
    !Number.isInteger(buyer)||!Number.isInteger(seller)||
    buyer+seller!==100||buyer<0||seller<0||
    (form.payerMode==="BUYER"&&buyer!==100)||
    (form.payerMode==="SELLER"&&seller!==100)||
    (form.payerMode==="SPLIT"&&(buyer<=0||seller<=0)))
    return "شناسه، نسخه، مبلغ، نرخ یا جمع سهم پرداخت‌کنندگان معتبر نیست.";
  if(!form.validFrom||!form.validUntil||form.validFrom>=form.validUntil)
    return "بازه اعتبار تعرفه صحیح نیست.";
  if(form.legalBasisReference.trim().length<8||
    form.boardResolutionReference.trim().length<8||
    form.boardEvidenceReference.trim().length<8)
    return "شناسه مبنای قانونی، مصوبه هیئت‌مدیره و مرجع سند باید درج شوند.";
  if(drafts.some(d=>d.tenantId===tenantId&&d.data.feeId===form.feeId&&
      Number(d.data.version)>=version))
    return "نسخه جدید باید از نسخه‌های تهیه‌شده در همین نشست بزرگ‌تر باشد.";
  return null;
 }
 async function addDraft(ev:React.FormEvent){
  ev.preventDefault();if(!gate||!tenantId||busy)return;
  const error=validate();if(error){setMessage(error);return;}
  if(!persistence){
    setDrafts(old=>[...old,{id:crypto.randomUUID(),tenantId,
      createdAt:new Date().toISOString(),data:{...form},persisted:false}]);
    setMessage("پیش‌نویس فقط در حافظه صفحه آماده شد؛ مجوز ثبت سروری فعال نیست و مصوبه‌ای تأیید نشده است.");
    return;
  }
  setBusy(true);
  const key=requestKey||crypto.randomUUID();
  if(!requestKey)setRequestKey(key);
  try{
    const response=await fetch("/api/tenants/"+encodeURIComponent(tenantId)+
      "/share-market/tariff-drafts",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({requestKey:key,tariff:{...form}})
    });
    if(!response.ok){
      setMessage(response.status===409?
        "نسخه یا شناسه درخواست با سابقه ثبت‌شده مغایر است؛ نسخه جدید بسازید.":
        "ثبت پایدار پیش‌نویس مجاز یا ممکن نیست؛ وضعیت مصوبه تغییری نکرده است.");
      return;
    }
    const receipt=await response.json() as Record<string,unknown>;
    if(receipt.tenantId!==tenantId||typeof receipt.draftId!=="string"||
      receipt.status!=="DRAFT_UNVERIFIED"||receipt.draftOnly!==true||
      receipt.feeActivated!==false||receipt.boardVerified!==false||
      receipt.realPaymentConfirmed!==false||receipt.legalShareTransfer!==false)
      throw Error("UNSAFE_DRAFT_RECEIPT");
    setDrafts(old=>old.some(x=>x.id===receipt.draftId)?old:[
      ...old,{id:receipt.draftId as string,tenantId,
        createdAt:new Date().toISOString(),data:{...form},persisted:true}]);
    setRequestKey("");
    setMessage("پیش‌نویس نسخه‌دار و تأییدنشده ذخیره شد؛ هیچ تعرفه‌ای فعال نشده و مصوبه رسمی هنوز نیازمند بررسی است.");
  }catch{
    setMessage("نتیجه ذخیره نامشخص است؛ برای تکرار ایمن، همان شناسه درخواست حفظ می‌شود.");
  }finally{setBusy(false);}
 }
 function revise(d:LocalDraft){
  if(d.tenantId!==tenantId)return;
  setForm({...d.data,version:String(Number(d.data.version)+1)});
  setMessage("نسخه اصلاحی برای آماده‌سازی انتخاب شد؛ نسخه قبلی تغییر نکرده است.");
  window.scrollTo({top:0,behavior:"smooth"});
 }
 function exportPackage(){
  if(!gate||!selected||!drafts.length)return;
  const pack={
    kind:"TTO_PH12_UNVERIFIED_TARIFF_REVIEW_PACKET",
    schemaVersion:"1.0",
    tenantId,tenantDisplayName:selected.displayName,
    status:"SELF_PREPARED_NOT_SUBMITTED",
    tariffDrafts:drafts.map(({createdAt,data})=>({createdAt,...data})),
    requiredIndependentEvidence:evidence.map(([key])=>key),
    approvals:{board:false,financeOfficer:false,chiefExecutive:false,independentQA:false},
    officialFeePaid:false,tradeEnabled:false,ownershipTransferEnabled:false
  };
  const file=new Blob([JSON.stringify(pack,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(file);
  const a=document.createElement("a");
  a.href=url;a.download="TTO-PH12-tariff-review-drafts.json";a.click();
  URL.revokeObjectURL(url);
  setMessage("بسته بررسی مستقل ایجاد شد؛ این فایل نه مصوبه است، نه سند پرداخت و نه رکورد ثبت‌شده در سامانه.");
 }
 return <main dir="rtl" lang="fa" style={{maxWidth:1120,margin:"0 auto",
  padding:"clamp(18px,3vw,40px)",lineHeight:1.9,color:"#203c4b",fontFamily:"var(--tto-font),sans-serif"}}>
  <nav style={{display:"flex",gap:22,flexWrap:"wrap"}}>
   <a href="/" style={{color:"#176b86"}}>بازگشت به پنل تعاونی</a>
   <a href="/share-market/board-review" style={{color:"#176b86"}}>
    پرونده بررسی مصوبه هیئت‌مدیره برای پیش‌نویس تعرفه
   </a>
  </nav>
  <header style={{margin:"22px 0"}}>
   <h1 style={{fontSize:"clamp(24px,3vw,36px)",marginBottom:6}}>آماده‌سازی تعرفه‌های نقل‌وانتقال سهام</h1>
   <p>تعرفه‌ها برای هر تعاونی نسخه‌دارند. تغییر تعرفه باید بر اساس مصوبه معتبر هیئت‌مدیره باشد؛
    تأیید وصول هزینه نیز نیازمند مسئول مالی و مدیرعامل مجاز است.</p>
  </header>
  <aside role="note" style={{background:"#fff4d9",padding:18,border:"1px solid #b68a40",borderRadius:13}}>
   <strong>وضعیت این صفحه: آماده‌سازی پیش‌نویس، نه فعال‌سازی تعرفه.</strong>
   <p style={{margin:0}}>ثبت پایدار پیش‌نویس تنها در محیطی که جداگانه مجاز شده باشد و
   پس از تأیید نشست و اختیار مدیر انجام می‌شود. پیش‌نویس ذخیره‌شده همچنان «تأییدنشده» است.
   تأیید مصوبه هیئت‌مدیره، فعال‌کردن تعرفه، تأیید وصول هزینه و انتقال سهام غیرفعال‌اند.
   در محیط‌های بدون مجوز ثبت سروری، داده‌ها فقط در حافظه همین صفحه باقی می‌مانند.</p>
  </aside>
  {phase==="loading"?<p role="status">در حال بررسی نشست و تعاونی‌های مجاز…</p>:null}
  {phase==="denied"?<p role="alert">برای این بخش باید از پنل مدیریت تعاونی وارد شوید.</p>:null}
  {phase==="unavailable"?<p role="alert">منبع احراز محدوده در دسترس نیست؛ دسترسی بسته است.</p>:null}
  {phase==="ready"&&tenants.length===0?<p role="status">تعاونی دارای اختیار مدیریتی احرازشده یافت نشد.</p>:null}
  {phase==="ready"&&tenants.length>0?<section style={{marginTop:24}}>
    <label style={{...labelStyle,maxWidth:480}}>تعاونی
     <select style={inputStyle} value={tenantId} onChange={e=>setTenantId(e.target.value)}>
      {tenants.map(t=><option key={t.tenantId} value={t.tenantId}>{t.displayName}</option>)}
     </select>
    </label>
    {!gate?<p role="status">در حال تأیید محدوده تعاونی؛ تا تأیید، فرم غیرفعال است.</p>:null}
    <form onSubmit={e=>void addDraft(e)} style={{display:"grid",gap:20,marginTop:20,padding:24,
     background:"#f2f7fa",borderRadius:16,border:"1px solid #d9e5eb"}}>
     <h2 style={{margin:0}}>پیش‌نویس نسخه جدید تعرفه</h2>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>
      <label style={labelStyle}>شناسه تعرفه
       <input style={inputStyle} required maxLength={64} placeholder="TRANSFER_FEE"
        value={form.feeId} onChange={e=>change("feeId",e.target.value)}/></label>
      <label style={labelStyle}>عنوان تعرفه
       <input style={inputStyle} required maxLength={130} value={form.title}
        onChange={e=>change("title",e.target.value)}/></label>
      <label style={labelStyle}>شماره نسخه
       <input style={inputStyle} type="number" min="1" required value={form.version}
        onChange={e=>change("version",e.target.value)}/></label>
      <label style={labelStyle}>نوع هزینه
       <select style={inputStyle} value={form.feeType} onChange={e=>change("feeType",e.target.value)}>
        <option value="COOP_APPROVED_FEE">هزینه مصوب تعاونی</option>
        <option value="STATUTORY_FEE">هزینه قانونی (نیازمند مستند)</option>
        <option value="PLATFORM_SERVICE_FEE">هزینه خدمات پلتفرم (نیازمند مبنا)</option>
       </select></label>
      <label style={labelStyle}>روش محاسبه
       <select style={inputStyle} value={form.calculationMode}
        onChange={e=>change("calculationMode",e.target.value)}>
        <option value="FIXED">ثابت</option><option value="PERCENTAGE">درصدی</option>
        <option value="FIXED_PLUS_PERCENTAGE">ثابت + درصدی</option>
       </select></label>
      <label style={labelStyle}>مبلغ ثابت به واحد مصوب
       <input style={inputStyle} type="number" min="0" required value={form.fixedAmount}
        onChange={e=>change("fixedAmount",e.target.value)}/></label>
      <label style={labelStyle}>نرخ درصدی، برحسب نقطه مبنا (bps)
       <input style={inputStyle} type="number" min="0" max="10000" required value={form.percentBps}
        onChange={e=>change("percentBps",e.target.value)}/></label>
      <label style={labelStyle}>مبنای درصد
       <select style={inputStyle} value={form.percentageBasis}
        onChange={e=>change("percentageBasis",e.target.value)}>
        <option value="TRADE_GROSS_VALUE">بهای کل معامله</option>
        <option value="SHARE_VALUE">ارزش سهام</option>
        <option value="CUSTOM_APPROVED_BASE">مبنای سفارشی مصوب (نیازمند سند مستقل)</option>
       </select></label>
      <label style={labelStyle}>پرداخت‌کننده
       <select style={inputStyle} value={form.payerMode}
        onChange={e=>change("payerMode",e.target.value)}>
        <option value="BUYER">خریدار</option><option value="SELLER">فروشنده</option>
        <option value="SPLIT">تقسیم هزینه</option>
       </select></label>
      <label style={labelStyle}>سهم خریدار (درصد)
       <input style={inputStyle} type="number" min="0" max="100" required
        value={form.buyerPercent} onChange={e=>change("buyerPercent",e.target.value)}/></label>
      <label style={labelStyle}>سهم فروشنده (درصد)
       <input style={inputStyle} type="number" min="0" max="100" required
        value={form.sellerPercent} onChange={e=>change("sellerPercent",e.target.value)}/></label>
      <label style={labelStyle}>تاریخ شروع اعتبار
       <input style={inputStyle} type="date" required value={form.validFrom}
        onChange={e=>change("validFrom",e.target.value)}/></label>
      <label style={labelStyle}>تاریخ پایان اعتبار
       <input style={inputStyle} type="date" required value={form.validUntil}
        onChange={e=>change("validUntil",e.target.value)}/></label>
      <label style={labelStyle}>شماره/مرجع مبنای قانونی
       <input style={inputStyle} required value={form.legalBasisReference}
        onChange={e=>change("legalBasisReference",e.target.value)}/></label>
      <label style={labelStyle}>شماره مصوبه هیئت‌مدیره
       <input style={inputStyle} required value={form.boardResolutionReference}
        onChange={e=>change("boardResolutionReference",e.target.value)}/></label>
      <label style={labelStyle}>شناسه فایل یا پرونده مصوبه
       <input style={inputStyle} required value={form.boardEvidenceReference}
        onChange={e=>change("boardEvidenceReference",e.target.value)}/></label>
     </div>
     <button type="submit" disabled={!gate||busy} style={{padding:13,borderRadius:10,
      background:gate&&!busy?"#155b73":"#9aa9b0",color:"#fff",border:0,font:"inherit",fontWeight:700,
      cursor:gate&&!busy?"pointer":"not-allowed"}}>
       {persistence?"ثبت پایدار پیش‌نویس تأییدنشده":"افزودن به پیش‌نویس‌های موقت"}</button>
    </form>
   </section>:null}
  <p aria-live="polite" role="status" style={{color:"#215c6c",marginTop:16}}>{message}</p>
  {gate&&drafts.length>0?<section style={{marginTop:24}}>
   <h2>نسخه‌های آماده برای بررسی مستقل</h2>
   <div style={{display:"grid",gap:12}}>
    {drafts.map(d=><article key={d.id} style={{padding:16,border:"1px solid #bfd0d8",
     borderRadius:12,background:"#fff"}}>
     <strong>{d.data.title} | {d.data.feeId} | نسخه {d.data.version}</strong>
     <p style={{margin:"4px 0"}}>مصوبه اظهارشده: {d.data.boardResolutionReference} —
      وضعیت: <strong>{d.persisted?"ثبت‌شده به‌عنوان پیش‌نویس تأییدنشده":"موقت و ثبت‌نشده در سرور"}</strong></p>
     <button type="button" onClick={()=>revise(d)}>تهیه نسخه اصلاحی بدون دست‌زدن به سابقه</button>
    </article>)}
   </div>
   <button type="button" onClick={exportPackage} style={{marginTop:18,padding:12,
    font:"inherit",borderRadius:10}}>دریافت بسته JSON برای بررسی حقوقی و QA</button>
  </section>:null}
  <section style={{marginTop:28}}>
   <h2>مدارک لازم برای فعال‌سازی واقعی</h2>
   <ul>{evidence.map(([id,title])=><li key={id}>{title} — <b>تأییدنشده</b></li>)}</ul>
   <p>اعلام وصول هزینه به حساب تعاونی صرفاً پس از بررسی منبع معتبر و تأیید
    جداگانه مسئول مالی و مدیرعامل مجاز قابل پیگیری خواهد بود؛ این صفحه هیچ وضعیت مالی را تغییر نمی‌دهد.</p>
  </section>
 </main>;
}
