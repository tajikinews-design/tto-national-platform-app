"use client";
import {useEffect,useRef,useState} from "react";
import {ShareholderReadModels} from "./shareholder-read-models";
import {ShareholderSourceSection} from "./shareholder-source-section";
import {SHAREHOLDER_SECTION_RULES,type ShareholderSectionId} from "./shareholder-section-config";
import {shareholderNavigation} from "./shareholder-navigation";

export type ShareholderView="overview"|"membership"|"requests"|"notices"|"section";
type Candidate={tenantId:string;displayName:string;evidenceStatus:"MEMBERSHIP_EVIDENCE"|"EVIDENCE_PENDING"};
type Member={membershipStatus:"ACTIVE";partyKind:"PERSON"|"ORGANIZATION";sourceVersion:number;sourceAsOf:string};
type Holding={shareQuantity:string;ledgerVersion:number;ledgerAsOf:string};
type Evidence<T>={kind:"idle"|"loading"|"verified"|"not-approved"|"unavailable";record?:T};
type Scope="idle"|"checking"|"verified"|"denied"|"unavailable";
const EMPTY_MEMBER:Evidence<Member>={kind:"idle"};
const EMPTY_HOLDING:Evidence<Holding>={kind:"idle"};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const VIEWS:{id:ShareholderView;name:string;description:string}[]=[
 {id:"overview",name:"نمای کلی",description:"وضعیت داده‌های قابل استناد"},
 {id:"membership",name:"عضویت و سهام من",description:"استعلام از دو مرجع مستقل"},
 {id:"requests",name:"خرید و فروش سهام",description:"پیگیری فرایند پس از گیت قانونی"},
 {id:"notices",name:"اطلاعیه‌های تعاونی",description:"فقط اطلاعیه‌های مجاز و منتشرشده"}
];
function textDate(value:string){
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toLocaleDateString("fa-IR"):"—";
}
function shareNumber(value:string){
 try{return new Intl.NumberFormat("fa-IR").format(BigInt(value));}
 catch{return "—";}
}
function isMember(raw:unknown):raw is Member{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return false;
 const x=raw as Record<string,unknown>;
 return x.membershipStatus==="ACTIVE"&&(x.partyKind==="PERSON"||x.partyKind==="ORGANIZATION")&&
  typeof x.sourceVersion==="number"&&Number.isSafeInteger(x.sourceVersion)&&x.sourceVersion>0&&
  typeof x.sourceAsOf==="string"&&Number.isFinite(Date.parse(x.sourceAsOf));
}
function isHolding(raw:unknown):raw is Holding{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return false;
 const x=raw as Record<string,unknown>;
 return typeof x.shareQuantity==="string"&&/^(0|[1-9][0-9]{0,18})$/.test(x.shareQuantity)&&
  typeof x.ledgerVersion==="number"&&Number.isSafeInteger(x.ledgerVersion)&&x.ledgerVersion>0&&
  typeof x.ledgerAsOf==="string"&&Number.isFinite(Date.parse(x.ledgerAsOf));
}
async function readEvidence<T>(
 url:string,init:RequestInit,guard:(v:unknown)=>v is T
):Promise<Evidence<T>>{
 const response=await fetch(url,init);
 if(response.status===401)throw Error("SESSION_EXPIRED");
 if(response.status===403||response.status===404)return {kind:"not-approved"};
 if(response.status!==200)return {kind:"unavailable"};
 const data=await response.json() as {available?:unknown;record?:unknown};
 if(data.available!==true||!guard(data.record))return {kind:"unavailable"};
 return {kind:"verified",record:data.record};
}
function EvidenceMessage({kind,domain}:{kind:Evidence<unknown>["kind"];domain:"membership"|"shares"}){
 const domainText=domain==="membership"?"عضویت":"سهام";
 if(kind==="loading")return <p className="sw-message" role="status">در حال استعلام اطلاعات {domainText} از مرجع معتبر…</p>;
 if(kind==="not-approved")return <p className="sw-message sw-warning" role="status">مرجع یا مجوز نمایش {domainText} تأیید نشده است. این وضعیت به معنی رد عضویت یا صفر سهم نیست.</p>;
 if(kind==="unavailable")return <p className="sw-message sw-warning" role="status">داده قابل‌استناد {domainText} در دسترس نیست؛ هیچ مقدار جایگزین ساخته نمی‌شود.</p>;
 return <p className="sw-message" role="status">برای مشاهده {domainText}، ابتدا تعاونی و مجوز دسترسی را تأیید کنید.</p>;
}
/**
 * Shareholder-only workspace. Never accepts partyId, role or share quantity from
 * the browser; the BFF resolves a revocable HttpOnly session and source gates.
 * Trade requests and notices use separate deny-default candidate read models;
 * no submission, settlement or fabricated publication is enabled.
 */
export function ShareholderWorkspace({
 initialView="overview",initialSectionId,onSessionInvalidated
}:{initialView?:ShareholderView;initialSectionId?:ShareholderSectionId;onSessionInvalidated?:()=>void}){
 const section=initialSectionId?SHAREHOLDER_SECTION_RULES[initialSectionId]:null;
 const [view,setView]=useState<ShareholderView>(section?"section":initialView);
 const views:readonly {id:ShareholderView;name:string;description:string}[]=section&&initialSectionId?[
  {id:"section",name:shareholderNavigation[Number(initialSectionId.slice(4))-1],description:"نمای فقط‌خواندنی و بدون منبع متصل"},
  ...VIEWS
 ]:VIEWS;
 const [options,setOptions]=useState<Candidate[]>([]);
 const [selected,setSelected]=useState("");
 const [discovering,setDiscovering]=useState(true);
 const [discoveryError,setDiscoveryError]=useState(false);
 const [busy,setBusy]=useState(false);
 const [scope,setScope]=useState<Scope>("idle");
 const [member,setMember]=useState<Evidence<Member>>(EMPTY_MEMBER);
 const [holding,setHolding]=useState<Evidence<Holding>>(EMPTY_HOLDING);
 const [message,setMessage]=useState("");
 const pending=useRef<AbortController|null>(null);
 const sequence=useRef(0);
 useEffect(()=>{
  const controller=new AbortController();
  const init:RequestInit={credentials:"same-origin",cache:"no-store",signal:controller.signal};
  setDiscovering(true);
  fetch("/api/me/tenant-options",init)
   .then(async response=>{
    if(response.status===401)throw Error("SESSION_EXPIRED");
    if(!response.ok)throw Error("DISCOVERY_NOT_APPROVED");
    return response.json() as Promise<{items?:unknown}>;
   })
   .then(result=>{
    if(controller.signal.aborted)return;
    if(!Array.isArray(result.items)||result.items.length>50||!result.items.every((item:unknown)=>{
      if(!item||typeof item!=="object")return false;
      const r=item as Record<string,unknown>;
      return typeof r.tenantId==="string"&&UUID.test(r.tenantId)&&
       typeof r.displayName==="string"&&r.displayName.length>0&&r.displayName.length<=300&&
       (r.evidenceStatus==="MEMBERSHIP_EVIDENCE"||r.evidenceStatus==="EVIDENCE_PENDING");
    }))throw Error("DISCOVERY_BAD_CONTRACT");
    setOptions(result.items as Candidate[]);
    setDiscoveryError(false);
   }).catch(error=>{
    if(controller.signal.aborted)return;
    setOptions([]);setDiscoveryError(true);
    if(error instanceof Error&&error.message==="SESSION_EXPIRED")onSessionInvalidated?.();
   })
   .finally(()=>{if(!controller.signal.aborted)setDiscovering(false);});
  return ()=>{controller.abort();pending.current?.abort();sequence.current++;};
 },[onSessionInvalidated]);
 const current=options.find(x=>x.tenantId===selected);
 function changeTenant(value:string){
  pending.current?.abort();sequence.current++;
  setSelected(value);setScope("idle");setMember(EMPTY_MEMBER);
  setHolding(EMPTY_HOLDING);setMessage("");setBusy(false);
 }
 async function verify(){
  if(!current||busy)return;
  pending.current?.abort();
  const controller=new AbortController();pending.current=controller;
  const generation=++sequence.current;
  const tenantId=current.tenantId;
  const init:RequestInit={credentials:"same-origin",cache:"no-store",signal:controller.signal};
  const active=()=>!controller.signal.aborted&&sequence.current===generation;
  setBusy(true);setMessage("");setScope("checking");
  setMember(EMPTY_MEMBER);setHolding(EMPTY_HOLDING);
  try{
   const response=await fetch("/api/tenants/"+tenantId+"/context",init);
   if(!active())return;
   if(response.status===401)throw Error("SESSION_EXPIRED");
   if(response.status===403||response.status===404){
    setScope("denied");setMessage("دسترسی به این محدوده مجاز نیست؛ اطلاعات اختصاصی نمایش داده نمی‌شود.");return;
   }
   if(response.status!==200)throw Error("SCOPE_UNAVAILABLE");
   const result=await response.json() as {tenantContextVerified?:unknown;tenantId?:unknown};
   if(!active())return;
   if(result.tenantContextVerified!==true||result.tenantId!==tenantId)
    throw Error("SCOPE_UNAVAILABLE");
   setScope("verified");
   // Informational section views need tenant scope only. Never fetch a
   // membership or ownership record just to view generic section rules.
   if(view==="section")return;
   setMember({kind:"loading"});setHolding({kind:"loading"});
   const root="/api/tenants/"+tenantId+"/me/";
   const [m,h]=await Promise.all([
    readEvidence(root+"member-record",init,isMember),
    readEvidence(root+"shareholding",init,isHolding)
   ]);
   if(!active())return;
   setMember(m);setHolding(h);
  }catch(error){
   if(!active())return;
   if(error instanceof Error&&error.message==="SESSION_EXPIRED"){
    setMember(EMPTY_MEMBER);setHolding(EMPTY_HOLDING);setScope("denied");
    onSessionInvalidated?.();return;
   }
   setMember(EMPTY_MEMBER);setHolding(EMPTY_HOLDING);setScope("unavailable");
   setMessage(error instanceof Error&&error.message==="SESSION_EXPIRED"?
    "نشست ورود معتبر نیست؛ دوباره وارد حساب شوید.":
    "بررسی مجوز یا ارتباط با منبع معتبر ممکن نیست؛ نمایش داده‌های اختصاصی متوقف شد.");
  }finally{if(active())setBusy(false);}
 }
 const verified=scope==="verified";
 const verifiedMember=verified&&member.kind==="verified"?member.record:undefined;
 const verifiedHolding=verified&&holding.kind==="verified"?holding.record:undefined;
 const memberLabel=verifiedMember?"عضویت فعالِ مستند":"—";
 const holdingLabel=verifiedHolding?shareNumber(verifiedHolding.shareQuantity):"—";
 return <section className="sw" aria-label="کارپوشه امن سهامدار">
   <div className="sw-title">
     <div><span className="sw-eyebrow">کارپوشه شخصی سهامدار</span><h2>اطلاعات من در تعاونی</h2>
       <p>نمایش فقط‌خواندنی؛ هر مرجع اطلاعاتی مستقل و پس از تأیید مجوز بررسی می‌شود.</p></div>
     <span className="sw-pill">دسترسی محدود · بدون عملیات مالی</span>
   </div>
   <div className="sw-scope">
     <div className="sw-scope-controls">
       <label htmlFor="sw-tenant">تعاونی موردنظر</label>
       <select id="sw-tenant" value={selected} disabled={discovering||busy||discoveryError}
        onChange={event=>changeTenant(event.target.value)}>
         <option value="">انتخاب تعاونی مجاز…</option>
         {options.map(item=><option key={item.tenantId} value={item.tenantId}>{item.displayName}</option>)}
       </select>
       <button type="button" onClick={()=>{void verify();}} disabled={!current||busy||discovering}>
         {busy?"در حال بررسی…":"تأیید محدوده و استعلام"}
       </button>
     </div>
     {discovering?<p role="status">در حال دریافت محدوده‌های مجاز…</p>:
      discoveryError?<p className="sw-warning" role="alert">فهرست تعاونی‌های مجاز در دسترس نیست؛ دسترسی بسته است.</p>:
      options.length===0?<p role="status">تعاونی دارای نقش مجاز برای این حساب تأیید نشده است.</p>:
      current?<p role="status">{current.evidenceStatus==="MEMBERSHIP_EVIDENCE"?
       "شواهد ارتباط هویت و عضویت شناسایی شده‌اند؛ اعتبار نهایی حقوق سهامداری جداگانه بررسی می‌شود.":
       "بررسی پیوند هویت یا شواهد عضویت کامل نیست؛ انتخاب تعاونی به‌تنهایی حق سهامداری ایجاد نمی‌کند."}</p>:null}
     {message?<p className="sw-warning" role="alert">{message}</p>:null}
     {verified?<p className="sw-scope-ok" role="status">محدوده این تعاونی تأیید شد. نتایج عضویت و دفتر سهام مستقل‌اند.</p>:null}
   </div>
   <div className="sw-tabs" aria-label="بخش‌های کارپوشه">
     {views.map(item=><button type="button" key={item.id} onClick={()=>setView(item.id)}
       className={view===item.id?"sw-tab selected":"sw-tab"}
       aria-pressed={view===item.id} title={item.description}>{item.name}</button>)}
   </div>
   {view==="overview"?<div className="sw-stack">
     <div className="sw-stats">
       <article className="sw-stat"><span>وضعیت عضویت مستند</span><strong>{memberLabel}</strong>
        <small>{verifiedMember?"نسخه منبع "+verifiedMember.sourceVersion:"بدون نتیجه تأییدشده"}</small></article>
       <article className="sw-stat"><span>تعداد سهام تأییدشده</span><strong>{holdingLabel}</strong>
        <small>{verifiedHolding?"نسخه دفتر "+verifiedHolding.ledgerVersion:"ناموجود به معنی صفر نیست"}</small></article>
       <article className="sw-stat"><span>درخواست‌های خریدوفروش</span><strong>—</strong>
        <small>مرجع ثبت و پیگیری هنوز متصل نیست</small></article>
       <article className="sw-stat"><span>اطلاعیه‌های رسمی</span><strong>—</strong>
        <small>فهرست انتشار مصوب هنوز متصل نیست</small></article>
     </div>
     <div className="sw-cards">
       <article className="sw-card"><h3>عضویت و سرمایه من</h3>
        <p>اطلاعات عضویت و تعداد سهم صرفاً از منابع مستقل و دارای نسخه نمایش داده می‌شود.</p>
        <button type="button" onClick={()=>setView("membership")}>مشاهده وضعیت منابع</button></article>
       <article className="sw-card"><h3>بازار و درخواست‌های سهام</h3>
        <p>نمای فرایند خریدوفروش، بدون ثبت سفارش، انتقال مالکیت یا موجودی کیف پول.</p>
        <button type="button" onClick={()=>setView("requests")}>مشاهده وضعیت فرایند</button></article>
       <article className="sw-card"><h3>اطلاع‌رسانی تعاونی</h3>
        <p>اطلاعیه‌ها فقط پس از تصویب حق انتشار و کنترل دسترسی قابل نمایش خواهند بود.</p>
        <button type="button" onClick={()=>setView("notices")}>مشاهده اطلاعیه‌ها</button></article>
     </div>
   </div>:null}
   {view==="section"&&section&&initialSectionId?<article className="sw-card sw-feature sw-closed-section"
      aria-label={"وضعیت دسترسی "+shareholderNavigation[Number(initialSectionId.slice(4))-1]}>
     <div className="sw-feature-heading">
      <div><span className="sw-eyebrow">{initialSectionId} · حوزه مستقل</span>
       <h3>{shareholderNavigation[Number(initialSectionId.slice(4))-1]}</h3>
       <p>{section.description}</p></div>
      <span className="sw-pill">فقط منابع دارای مجوز · بدون عملیات مالی</span>
     </div>
     {verified&&selected?<ShareholderSourceSection tenantId={selected}
      moduleId={initialSectionId} onSessionInvalidated={onSessionInvalidated}/>:null}
     <div className="sw-section-boundary">
      <h4>مرجع موردنیاز</h4><p>{section.authority}</p>
      <h4>قابلیت پیش‌بینی‌شده پس از تصویب</h4><p>{section.capability}</p>
     </div>
     <p className="sw-message sw-warning" role="status">{verified?
       "محدوده تعاونی بررسی شد؛ داده این بخش تنها در صورت مجوز مستقل منبع و نقش از API خوانده می‌شود. عدم وجود مجوز به معنای نمایش فهرست یا داده ساختگی نیست.":
       "ابتدا تعاونی و محدوده مجاز را تأیید کنید. ورود به حساب به‌تنهایی حق مشاهده یا انجام عملیات این بخش ایجاد نمی‌کند."}</p>
     <p className="sw-footnote">این بخش فقط‌خواندنی است. درخواست، رأی‌گیری، دانلود سند، ویرایش تنظیمات و پرداخت در این مرحله فعال نیست.</p>
    </article>:null}
   {view==="membership"?<div className="sw-cards sw-membership">
     <article className="sw-card"><h3>پرونده عضویت</h3>
       {verifiedMember?<div className="sw-confirmed" role="status">
         <strong>عضویت فعال — منبع تأییدشده</strong>
         <dl><div><dt>نوع شخصیت</dt><dd>{verifiedMember.partyKind==="PERSON"?"حقیقی":"حقوقی"}</dd></div>
         <div><dt>نسخه منبع</dt><dd>{verifiedMember.sourceVersion.toLocaleString("fa-IR")}</dd></div>
         <div><dt>تاریخ اعتبار داده</dt><dd>{textDate(verifiedMember.sourceAsOf)}</dd></div></dl></div>:
         <EvidenceMessage kind={verified?member.kind:"idle"} domain="membership"/>}
     </article>
     <article className="sw-card"><h3>وضعیت سهام در دفتر معتبر</h3>
       {verifiedHolding?<div className="sw-confirmed" role="status">
         <strong>تعداد سهام: {shareNumber(verifiedHolding.shareQuantity)}</strong>
         <dl><div><dt>نسخه دفتر</dt><dd>{verifiedHolding.ledgerVersion.toLocaleString("fa-IR")}</dd></div>
         <div><dt>تاریخ اعتبار دفتر</dt><dd>{textDate(verifiedHolding.ledgerAsOf)}</dd></div></dl>
         <p>این تعداد، ارزش ریالی، قابلیت انتقال یا حق رأی را اثبات نمی‌کند.</p></div>:
         <EvidenceMessage kind={verified?holding.kind:"idle"} domain="shares"/>}
     </article>
     <p className="sw-footnote">پیوند حساب کاربری، انتخاب تعاونی و احراز نشست، هیچ‌کدام به‌تنهایی اثبات مالکیت سهام نیستند.</p>
   </div>:null}
   {view==="requests"?<article className="sw-card sw-feature">
      <div className="sw-feature-heading"><div><h3>درخواست‌های خرید و فروش سهام</h3>
        <p>فرایند مصوب به حقوق قانونی و تأیید مراجع ذی‌صلاح وابسته است.</p></div>
        <span className="sw-pill">ثبت و پیگیری غیرفعال</span></div>
      <div className="sw-step-grid">
       <div><b>۱. درخواست</b><span>بررسی اهلیت و قواعد مربوط به همان تعاونی</span></div>
       <div><b>۲. مستندات</b><span>ثبت و کنترل شواهد قرارداد و پرداخت مستقیم خریدار به فروشنده</span></div>
       <div><b>۳. تصویب و ثبت</b><span>تصمیم مرجع قانونی و تغییر دفتر سهام فقط در سامانه مالک داده</span></div>
      </div>
      <ShareholderReadModels tenantId={verified?selected:""} domain="trade-requests" onSessionInvalidated={onSessionInvalidated}/>
      <p className="sw-message sw-warning" role="status">API معتبر ثبت یا فهرست درخواست‌ها هنوز فعال نشده است؛ هیچ سفارش، تعداد درخواست، پرداخت یا انتقال سهم نمایش داده نمی‌شود.</p>
      <p className="sw-footnote">پلتفرم کیف پول نقدی و خدمات حسابداری عمومی تعاونی ندارد. این صفحه مجوز معامله یا انتقال خودکار ایجاد نمی‌کند.</p>
    </article>:null}
   {view==="notices"?<article className="sw-card sw-feature">
     <div className="sw-feature-heading"><div><h3>اطلاعیه‌ها و مکاتبات رسمی</h3>
       <p>دسته‌بندی‌های نمایشی آماده است؛ منبع انتشار و مجوز مخاطب هنوز متصل نشده‌اند.</p></div>
       <span className="sw-pill">در انتظار اتصال مرجع انتشار</span></div>
     <div className="sw-notice-types" aria-label="دسته‌های اطلاع‌رسانی">
       <span>اطلاعیه‌های عمومی تعاونی</span><span>مجامع و جلسات</span>
       <span>اعلان‌های مخصوص سهامدار</span>
     </div>
     <ShareholderReadModels tenantId={verified?selected:""} domain="notices" onSessionInvalidated={onSessionInvalidated}/>
     <p className="sw-message sw-warning" role="status">هیچ اطلاعیه‌ای بدون سند انتشار مصوب، محدوده تعاونی و کنترل دسترسی ارائه نمی‌شود. نبود فهرست به معنی نبود اطلاعیه نیست.</p>
   </article>:null}
   <div className="sw-guard">این کارپوشه فقط داده‌های دارای منبع تأییدشده را نشان می‌دهد؛ «داده نامعلوم»، «در انتظار تأیید» و «صفر سهمِ تأییدشده» یکسان نیستند.</div>
 </section>;
}
