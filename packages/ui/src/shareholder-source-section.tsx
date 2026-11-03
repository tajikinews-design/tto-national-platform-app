"use client";
import {useEffect,useState} from "react";
import type {ShareholderSectionId} from "./shareholder-section-config";
const SOURCE_VIEWS:Record<string,{title:string;fields:readonly {key:string;label:string}[]}>={
 "NAV-06":{title:"دوره‌های آموزشی دارای مجوز نمایش",fields:[{key:"course_title",label:"دوره"},{key:"capacity",label:"ظرفیت"}]},
 "NAV-07":{title:"کالاها و خدمات منتشرشده تعاونی (غیر از سهام)",fields:[{key:"title",label:"عنوان"},{key:"price_snapshot",label:"قیمت اعلامی"}]},
 "NAV-08":{title:"پروژه‌های دارای مجوز انتشار",fields:[{key:"name",label:"عنوان پروژه"}]},
 "NAV-10":{title:"گزارش‌های تأییدشده آثار اجتماعی",fields:[{key:"amount",label:"مقدار گزارش"}]}
};
type Row=Record<string,string|number|null>;
type State={kind:"loading"|"ready"|"error"|"denied";items:Row[]};
export function ShareholderSourceSection({tenantId,moduleId,onSessionInvalidated}:{
 tenantId:string;moduleId:ShareholderSectionId;onSessionInvalidated?:()=>void;
}){
 const spec=SOURCE_VIEWS[moduleId];
 const [state,setState]=useState<State>({kind:"loading",items:[]});
 useEffect(()=>{
  if(!spec||!tenantId){setState({kind:"denied",items:[]});return;}
  const controller=new AbortController();
  setState({kind:"loading",items:[]});
  fetch("/api/tenants/"+tenantId+"/ph10/"+moduleId,{
   credentials:"same-origin",cache:"no-store",signal:controller.signal
  }).then(async response=>{
   if(response.status===401){onSessionInvalidated?.();return {kind:"denied" as const,items:[]};}
   if(response.status===403||response.status===404)return {kind:"denied" as const,items:[]};
   if(response.status!==200)throw Error("SOURCE_UNAVAILABLE");
   const data=await response.json() as {sourceBound?:unknown;available?:unknown;items?:unknown};
   if(data.sourceBound!==true||data.available!==true||!Array.isArray(data.items))
    throw Error("BAD_SOURCE_CONTRACT");
   const items=data.items.filter((x):x is Row=>Boolean(x)&&typeof x==="object"&&!Array.isArray(x)).slice(0,100);
   return {kind:"ready" as const,items};
  }).then(next=>{if(!controller.signal.aborted)setState(next);})
   .catch(()=>{if(!controller.signal.aborted)setState({kind:"error",items:[]});});
  return ()=>controller.abort();
 },[tenantId,moduleId,spec,onSessionInvalidated]);
 if(!spec)return <p role="status">اتصال منبع برای این بخش هنوز مجاز نیست؛ اطلاعاتی ساخته نمی‌شود.</p>;
 if(!tenantId)return <p role="status">ابتدا محدوده تعاونی را تأیید کنید.</p>;
 return <section aria-label={spec.title}>
  <h4>{spec.title}</h4>
  {state.kind==="loading"?<p role="status">در حال دریافت اطلاعات مجاز…</p>:
   state.kind==="denied"?<p role="alert">دسترسی به مرجع این بخش تأیید نشده است.</p>:
   state.kind==="error"?<p role="alert">مرجع قابل‌استناد در دسترس نیست؛ داده جایگزین نمایش داده نمی‌شود.</p>:
   state.items.length===0?<p role="status">مورد قابل‌انتشار برای این تعاونی وجود ندارد.</p>:
   <ul>{state.items.map((row,i)=><li key={moduleId+"-"+i}>
    {spec.fields.map(f=><span style={{display:"block"}} key={f.key}><strong>{f.label}: </strong>{row[f.key]??"ثبت نشده"}</span>)}
   </li>)}</ul>}
  <p>این اطلاعات فقط‌خواندنی است؛ درخواست معامله سهم، انتقال مالکیت یا پرداخت انجام نمی‌شود.</p>
 </section>;
}
