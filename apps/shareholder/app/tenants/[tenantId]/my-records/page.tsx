"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useParams} from "next/navigation";

type Member={membershipStatus:"ACTIVE";partyKind:"PERSON"|"ORGANIZATION";sourceVersion:number;sourceAsOf:string};
type Holding={shareQuantity:string;ledgerVersion:number;ledgerAsOf:string};
type History={items:Holding[]};
type State="loading"|"available"|"unavailable"|"session-required";
type SourceState<T>={status:State;record:T|null};
const initial=<T,>():SourceState<T>=>({status:"loading",record:null});
const error=<T,>(status:"unavailable"|"session-required"):SourceState<T>=>({status,record:null});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHARE_QTY=/^(0|[1-9][0-9]{0,18})$/;
// Defense-in-depth: the source-gated BFF and Nest/PG remain the only authorization authorities.
function memberRecord(value:unknown):value is Member{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const r=value as Record<string,unknown>;
 return r.membershipStatus==="ACTIVE"&&(r.partyKind==="PERSON"||r.partyKind==="ORGANIZATION")&&
  Number.isSafeInteger(r.sourceVersion)&&Number(r.sourceVersion)>0&&
  typeof r.sourceAsOf==="string"&&Number.isFinite(Date.parse(r.sourceAsOf));
}
function holdingRecord(value:unknown):value is Holding{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const r=value as Record<string,unknown>;
 return typeof r.shareQuantity==="string"&&SHARE_QTY.test(r.shareQuantity)&&
  Number.isSafeInteger(r.ledgerVersion)&&Number(r.ledgerVersion)>0&&
  typeof r.ledgerAsOf==="string"&&Number.isFinite(Date.parse(r.ledgerAsOf));
}
function historyRecord(value:unknown):value is History{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const items=(value as Record<string,unknown>).items;
 if(!Array.isArray(items)||items.length<1||items.length>20)return false;
 let previous=Number.MAX_SAFE_INTEGER;
 for(const v of items){
  if(!holdingRecord(v)||v.ledgerVersion>=previous)return false;
  previous=v.ledgerVersion;
 }
 return true;
}
async function getSource<T>(tenantId:string,domain:"member-record"|"shareholding"|"shareholding-history",
 signal:AbortSignal,validate:(value:unknown)=>value is T):Promise<SourceState<T>>{
 try{
  const r=await fetch("/api/tenants/"+encodeURIComponent(tenantId)+"/me/"+domain,{
   method:"GET",cache:"no-store",credentials:"same-origin",redirect:"error",signal
  });
  if(r.status===401)return error("session-required");
  if(r.status!==200)return error("unavailable"); // 403, missing source, outage are never zero
  const body=await r.json() as {available?:unknown;record?:unknown};
  if(body?.available!==true||!validate(body.record))return error("unavailable");
  return {status:"available",record:body.record};
 }catch{return error("unavailable");}
}
export default function MyVerifiedRecords(){
 const {tenantId}=useParams<{tenantId:string}>();
 const active=useRef<AbortController|null>(null);
 const [member,setMember]=useState<SourceState<Member>>(initial<Member>);
 const [holding,setHolding]=useState<SourceState<Holding>>(initial<Holding>);
 const [history,setHistory]=useState<SourceState<History>>(initial<History>);
 const [busy,setBusy]=useState(false);
 // A response belongs to one exact tenant route; a navigation cannot display prior-tenant data.
 const [loadedTenantId,setLoadedTenantId]=useState("");
 const load=useCallback(async()=>{
  active.current?.abort();
  const controller=new AbortController();active.current=controller;
  setBusy(true);setLoadedTenantId("");setMember(initial());setHolding(initial());setHistory(initial());
  if(!UUID.test(tenantId)){
   setMember(error("unavailable"));setHolding(error("unavailable"));setHistory(error("unavailable"));setLoadedTenantId(tenantId);setBusy(false);return;
  }
  const [m,h,snapshots]=await Promise.all([
   getSource(tenantId,"member-record",controller.signal,memberRecord),
   getSource(tenantId,"shareholding",controller.signal,holdingRecord),
   getSource(tenantId,"shareholding-history",controller.signal,historyRecord)
  ]);
  if(controller.signal.aborted)return; // never render a late response from an old tenant/session
  if(m.status==="session-required"||h.status==="session-required"||snapshots.status==="session-required"){
   setMember(error("session-required"));setHolding(error("session-required"));setHistory(error("session-required"));
  }else{
   setMember(m);setHolding(h); // independent source approval, not inferred from the other domain
   // A history read from a different source version is unavailable, never mixed with current holdings.
   const sameLatest=h.status==="available"&&h.record&&snapshots.status==="available"&&
     snapshots.record&&snapshots.record.items[0].ledgerVersion===h.record.ledgerVersion&&
     snapshots.record.items[0].shareQuantity===h.record.shareQuantity;
   setHistory(sameLatest?snapshots:error("unavailable"));
  }
  setLoadedTenantId(tenantId);
  setBusy(false);
 },[tenantId]);
 useEffect(()=>{void load();return ()=>active.current?.abort()},[load]);
 // Render-time guard is needed: effects run after render on client-side tenant navigation.
 const visibleMember=loadedTenantId===tenantId?member:initial<Member>();
 const visibleHolding=loadedTenantId===tenantId?holding:initial<Holding>();
 const visibleHistory=loadedTenantId===tenantId?history:initial<History>();
 const text=(s:SourceState<unknown>)=>
  s.status==="loading"?"در حال بررسی منبع معتبر":
  s.status==="session-required"?"برای مشاهده اطلاعات، ورود معتبر الزامی است":
  s.status==="unavailable"?"اطلاعات رسمی تأییدشده در دسترس نیست":null;
 return <main dir="rtl" lang="fa" style={{maxWidth:860,margin:"0 auto",padding:"24px",lineHeight:1.9}}>
  <h1>پرونده اختصاصی عضویت و سهام</h1>
  <p>اطلاعات فقط در صورت تأیید منبع رسمی و مجوز مشاهده شخص نمایش داده می‌شود. نبود اطلاعات به معنی صفر سهم نیست.</p>
  <section aria-labelledby="membership-heading">
   <h2 id="membership-heading">وضعیت عضویت</h2>
   <p role="status" aria-live="polite">{text(visibleMember)}</p>
   {visibleMember.status==="available"&&visibleMember.record&&<div>
    <p>عضویت: فعال</p><p>نوع پرونده: {visibleMember.record.partyKind==="PERSON"?"شخص حقیقی":"شخص حقوقی"}</p>
    <p>نسخه منبع عضویت: {visibleMember.record.sourceVersion}</p><p>زمان مرجع عضویت: {visibleMember.record.sourceAsOf}</p>
   </div>}
  </section>
  <section aria-labelledby="holdings-heading">
   <h2 id="holdings-heading">موجودی سهام</h2>
   <p role="status" aria-live="polite">{text(visibleHolding)}</p>
   {visibleHolding.status==="available"&&visibleHolding.record&&<div>
    <p>تعداد سهام ثبت‌شده: {visibleHolding.record.shareQuantity}</p>
    <p>نسخه دفتر سهام: {visibleHolding.record.ledgerVersion}</p><p>زمان مرجع دفتر سهام: {visibleHolding.record.ledgerAsOf}</p>
   </div>}
  </section>
  <section aria-labelledby="share-snapshots-heading">
   <h2 id="share-snapshots-heading">سوابق نسخه‌های تأییدشده موجودی</h2>
   <p>این سوابق، نسخه‌های ثبت‌شده از موجودی سهام هستند؛ دفتر معاملات یا سوابق انتقال سهام نیستند.</p>
   <p role="status" aria-live="polite">{text(visibleHistory)}</p>
   {visibleHolding.status==="available"&&visibleHistory.status==="available"&&visibleHistory.record&&<ol>
    {visibleHistory.record.items.map(item=><li key={item.ledgerVersion}>
     نسخه {item.ledgerVersion}: {item.shareQuantity} سهم — زمان مرجع: {item.ledgerAsOf}
    </li>)}
   </ol>}
  </section>
  <button type="button" disabled={busy} onClick={()=>void load()}
   style={{minHeight:44,padding:"8px 16px",font:"inherit",cursor:"pointer"}}>
   بررسی مجدد اطلاعات
  </button>
  <p>این صفحه امکان خرید، فروش، انتقال یا تغییر تعداد سهام ندارد. تأیید عضویت، مجوز مشاهده سهام ایجاد نمی‌کند.</p>
 </main>;
}
