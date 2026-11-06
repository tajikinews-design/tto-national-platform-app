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
type PolicyState={kind:"loading"|"blocked"|"permitted"|"denied"|"unavailable"};
export function CooperativeSourceReadPanel({tenantId,moduleId}:{
 tenantId:string;moduleId:string;
}){
 const view=VIEWS[moduleId];
 const [state,setState]=useState<State>({kind:"loading",items:[]});
 const [policy,setPolicy]=useState<Record<string,PolicyState>>({});
 async function inspectArticle129(caseId:string){
  if(moduleId!=="NAV-10"||!(/^[a-f0-9-]{36}$/).test(caseId)||policy[caseId]?.kind==="loading")return;
  setPolicy(old=>({...old,[caseId]:{kind:"loading"}}));
  try{
   const response=await fetch("/api/tenants/"+tenantId+"/ph10/grc/cases/"+caseId+"/can-finalize",{
    credentials:"same-origin",cache:"no-store"});
   if(response.status===401||response.status===403){
    setPolicy(old=>({...old,[caseId]:{kind:"denied"}}));return;
   }
   if(response.status!==200)throw Error("UNAVAILABLE");
   const result=await response.json() as {available?:unknown;allowed?:unknown;
    readOnly?:unknown;officialApproval?:unknown;sourceBound?:unknown};
   if(result.available!==true||typeof result.allowed!=="boolean"||
      result.readOnly!==true||result.officialApproval!==false||result.sourceBound!==true)
    throw Error("POLICY_CONTRACT_INVALID");
   setPolicy(old=>({...old,[caseId]:{kind:result.allowed?"permitted":"blocked"}}));
  }catch{setPolicy(old=>({...old,[caseId]:{kind:"unavailable"}}));}
 }
 useEffect(()=>{
  if(!view)return;
  const controller=new AbortController();
  setState({kind:"loading",items:[]});setPolicy({});
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
     {moduleId==="NAV-10"&&item.kind==="ARTICLE129"&&
      typeof item.case_id==="string"&&(/^[a-f0-9-]{36}$/).test(item.case_id)?<>
       <button type="button" disabled={policy[item.case_id]?.kind==="loading"}
        onClick={()=>{void inspectArticle129(item.case_id as string);}}>
        بررسی امکان نهایی‌سازی پرونده (فقط استعلام)
       </button>
       {policy[item.case_id]?<p role="status" aria-live="polite">{
        policy[item.case_id].kind==="loading"?"در حال بررسی مجوز مستقل پرونده…":
        policy[item.case_id].kind==="blocked"?"نهایی‌سازی این پرونده بدون گردش‌کار لازم مسدود است.":
        policy[item.case_id].kind==="permitted"?"شرط فنی بررسی شد؛ تأیید حقوقی یا مجوز انجام عملیات صادر نشده است.":
        policy[item.case_id].kind==="denied"?"مجوز بررسی این پرونده وجود ندارد.":
        "استعلام سیاست نهایی‌سازی ممکن نیست؛ هیچ مجوزی صادر نشده است."
       }</p>:null}
      </>:null}
    </li>)}</ul>}
 </section>;
}
