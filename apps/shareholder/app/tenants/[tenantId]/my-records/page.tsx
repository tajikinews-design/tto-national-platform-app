"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useParams} from "next/navigation";

type Member={membershipStatus:"ACTIVE";partyKind:"PERSON"|"ORGANIZATION";sourceVersion:number;sourceAsOf:string};
type Holding={shareQuantity:string;ledgerVersion:number;ledgerAsOf:string};
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
async function getSource<T>(tenantId:string,domain:"member-record"|"shareholding",
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
 const [busy,setBusy]=useState(false);
 // A response belongs to one exact tenant route; a navigation cannot display prior-tenant data.
 const [loadedTenantId,setLoadedTenantId]=useState("");
 const load=useCallback(async()=>{
  active.current?.abort();
  const controller=new AbortController();active.current=controller;
  setBusy(true);setLoadedTenantId("");setMember(initial());setHolding(initial());
  if(!UUID.test(tenantId)){
   setMember(error("unavailable"));setHolding(error("unavailable"));setLoadedTenantId(tenantId);setBusy(false);return;
  }
  const [m,h]=await Promise.all([
   getSource(tenantId,"member-record",controller.signal,memberRecord),
   getSource(tenantId,"shareholding",controller.signal,holdingRecord)
  ]);
  if(controller.signal.aborted)return; // never render a late response from an old tenant/session
  if(m.status==="session-required"||h.status==="session-required"){
   setMember(error("session-required"));setHolding(error("session-required"));
  }else{
   setMember(m);setHolding(h); // independent source approval, not inferred from the other domain
  }
  setLoadedTenantId(tenantId);
  setBusy(false);
 },[tenantId]);
 useEffect(()=>{void load();return ()=>active.current?.abort()},[load]);
 // Render-time guard is needed: effects run after render on client-side tenant navigation.
 const visibleMember=loadedTenantId===tenantId?member:initial<Member>();
 const visibleHolding=loadedTenantId===tenantId?holding:initial<Holding>();
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
  <button type="button" disabled={busy} onClick={()=>void load()}
   style={{minHeight:44,padding:"8px 16px",font:"inherit",cursor:"pointer"}}>
   بررسی مجدد اطلاعات
  </button>
  <p>این صفحه امکان خرید، فروش، انتقال یا تغییر تعداد سهام ندارد. تأیید عضویت، مجوز مشاهده سهام ایجاد نمی‌کند.</p>
 </main>;
}
