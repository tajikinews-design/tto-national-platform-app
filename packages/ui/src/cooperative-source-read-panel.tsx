"use client";
import {useEffect,useState} from "react";

const VIEWS:Record<string,{title:string;fields:readonly {key:string;label:string}[]}>={
 "NAV-04":{title:"اطلاع‌رسانی و ابلاغیه‌های مجاز",fields:[{key:"title",label:"عنوان"},{key:"version",label:"نسخه"}]},
 "NAV-05":{title:"درخواست‌های پشتیبانی متعلق به شما",fields:[{key:"issue_key",label:"موضوع"},{key:"status",label:"وضعیت"}]},
 "NAV-07":{title:"عرضه‌های منتشرشده تعاونی",fields:[{key:"title",label:"عنوان"},{key:"price_snapshot",label:"قیمت اعلامی"}]},
 "NAV-08":{title:"پروژه‌های دارای مجوز انتشار",fields:[{key:"name",label:"نام پروژه"}]},
 "NAV-09":{title:"اسناد و گزارش‌های منتشرشده",fields:[{key:"report_kind",label:"نوع گزارش"},{key:"version_num",label:"نسخه"}]},
 "NAV-10":{title:"پرونده‌های انطباق مجاز مدیریت",fields:[{key:"kind",label:"نوع"},{key:"status",label:"وضعیت"}]}
};
type RecordItem=Record<string,string|number|null>;
type State={kind:"loading"|"ready"|"denied"|"error";items:RecordItem[]};
export function CooperativeSourceReadPanel({tenantId,moduleId}:{
 tenantId:string;moduleId:string;
}){
 const view=VIEWS[moduleId];
 const [state,setState]=useState<State>({kind:"loading",items:[]});
 useEffect(()=>{
  if(!view)return;
  const controller=new AbortController();
  setState({kind:"loading",items:[]});
  fetch("/api/tenants/"+tenantId+"/ph10/"+moduleId,{
   credentials:"same-origin",cache:"no-store",signal:controller.signal
  }).then(async response=>{
   if(response.status===401||response.status===403)return {kind:"denied" as const,items:[]};
   if(response.status!==200)throw Error("SOURCE_NOT_AVAILABLE");
   const body=await response.json() as {available?:unknown;sourceBound?:unknown;items?:unknown};
   if(body.available!==true||body.sourceBound!==true||!Array.isArray(body.items))
    throw Error("SOURCE_INVALID");
   const safe=body.items.filter((item):item is RecordItem=>
    Boolean(item)&&typeof item==="object"&&!Array.isArray(item)).slice(0,100);
   return {kind:"ready" as const,items:safe};
  }).then(next=>{if(!controller.signal.aborted)setState(next);})
   .catch(()=>{if(!controller.signal.aborted)setState({kind:"error",items:[]});});
  return ()=>controller.abort();
 },[tenantId,moduleId,view]);
 if(!view)return <p role="status">برای این بخش هنوز اتصال قابل‌استناد و مجوز عملیات آماده نیست.</p>;
 return <section aria-label={view.title}>
  <h3>{view.title}</h3>
  <p>اطلاعات فقط‌خواندنی از مرجع دارای کنترل نقش و تعاونی؛ تأیید محدوده به‌تنهایی مجوز عملیات نیست.</p>
  {state.kind==="loading"?<p role="status">در حال استعلام از مرجع تأییدشده…</p>:
   state.kind==="denied"?<p role="alert">محدوده یا مجوز مشاهده این بخش تأیید نشد؛ هیچ داده‌ای نمایش داده نمی‌شود.</p>:
   state.kind==="error"?<p role="alert">دریافت داده قابل‌استناد ممکن نیست. اطلاعات جایگزین ساخته نمی‌شود.</p>:
   state.items.length===0?<p role="status">در این محدوده، رکورد قابل انتشار و دارای مجوز مشاهده وجود ندارد.</p>:
   <ul aria-label={view.title}>{state.items.map((item,index)=>
    <li key={moduleId+"-"+index}>
     {view.fields.map(field=><span key={field.key} style={{display:"block"}}>
      <strong>{field.label}: </strong>{item[field.key]??"ثبت نشده"}
     </span>)}
    </li>)}</ul>}
 </section>;
}
