"use client";
import {useCallback,useEffect,useState} from "react";
import {useParams} from "next/navigation";

type Member={membershipStatus:"ACTIVE";partyKind:"PERSON"|"ORGANIZATION";sourceVersion:number;sourceAsOf:string};
type Holding={shareQuantity:string;ledgerVersion:number;ledgerAsOf:string};
type SourceState<T>={status:"loading"|"available"|"unavailable"|"session-required";record:T|null};

const initial=<T,>():SourceState<T>=>({status:"loading",record:null});
export default function MyVerifiedRecords(){
 const {tenantId}=useParams<{tenantId:string}>();
 const [member,setMember]=useState<SourceState<Member>>(initial<Member>);
 const [holding,setHolding]=useState<SourceState<Holding>>(initial<Holding>);
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  setBusy(true);setMember(initial());setHolding(initial());
  const read=async <T,>(name:"member-record"|"shareholding",update:(s:SourceState<T>)=>void)=>{
   try{
    const r=await fetch("/api/tenants/"+encodeURIComponent(tenantId)+"/me/"+name,{cache:"no-store",credentials:"same-origin"});
    if(r.status===401){update({status:"session-required",record:null});return}
    if(!r.ok){update({status:"unavailable",record:null});return}
    const data=await r.json();
    if(data.available!==true||!data.record){update({status:"unavailable",record:null});return}
    update({status:"available",record:data.record as T});
   }catch{update({status:"unavailable",record:null})}
  };
  await Promise.all([read<Member>("member-record",setMember),read<Holding>("shareholding",setHolding)]);
  setBusy(false);
 },[tenantId]);
 useEffect(()=>{void load()},[load]);
 const text=(s:SourceState<unknown>)=>s.status==="loading"?"در حال بررسی منبع معتبر":s.status==="session-required"?"برای مشاهده اطلاعات، ورود معتبر الزامی است":s.status==="unavailable"?"اطلاعات رسمی تأییدشده در دسترس نیست":null;
 return <main dir="rtl" lang="fa" style={{maxWidth:860,margin:"0 auto",padding:"24px",lineHeight:1.9}}>
  <h1>پرونده اختصاصی عضویت و سهام</h1>
  <p>اطلاعات فقط در صورت تأیید منبع رسمی و مجوز مشاهده شخص نمایش داده می‌شود. نبود اطلاعات به معنی صفر سهم نیست.</p>
  <section aria-labelledby="membership-heading">
   <h2 id="membership-heading">وضعیت عضویت</h2>
   <p role="status" aria-live="polite">{text(member)}</p>
   {member.status==="available"&&member.record&&<div>
     <p>عضویت: فعال</p><p>نوع پرونده: {member.record.partyKind==="PERSON"?"شخص حقیقی":"شخص حقوقی"}</p>
     <p>نسخه منبع عضویت: {member.record.sourceVersion}</p><p>زمان مرجع عضویت: {member.record.sourceAsOf}</p>
   </div>}
  </section>
  <section aria-labelledby="holdings-heading">
   <h2 id="holdings-heading">موجودی سهام</h2>
   <p role="status" aria-live="polite">{text(holding)}</p>
   {holding.status==="available"&&holding.record&&<div>
    <p>تعداد سهام ثبت‌شده: {holding.record.shareQuantity}</p>
    <p>نسخه دفتر سهام: {holding.record.ledgerVersion}</p><p>زمان مرجع دفتر سهام: {holding.record.ledgerAsOf}</p>
   </div>}
  </section>
  <button type="button" disabled={busy} onClick={()=>void load()}>بررسی مجدد اطلاعات</button>
  <p>این صفحه امکان خرید، فروش، انتقال یا تغییر تعداد سهام ندارد.</p>
 </main>;
}
