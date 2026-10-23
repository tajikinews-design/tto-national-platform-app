"use client";
import {useEffect,useState} from "react";

type Domain="trade-requests"|"notices";
type Status="idle"|"loading"|"denied"|"unavailable"|"verified";
type Trade={requestId:string;kind:"BUY_REQUEST"|"SELL_ORDER";state:"SUBMITTED"|"UNDER_REVIEW"|"CLOSED";sourceEventId:string;eventVersion:number;lastEventAt:string};
type Notice={noticeId:string;title:string;category:"GENERAL"|"ASSEMBLY"|"SHAREHOLDER";publicationVersion:number;publishedAt:string;audienceApproved:true};
type ReadState={tenantId:string;status:Status;items:(Trade|Notice)[];sourceVersion?:number;sourceAsOf?:string};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ISO=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v));
const VERSION=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>0;
const OBJECT=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const UNKNOWN:ReadState={tenantId:"",status:"idle",items:[]};
function isTrade(v:unknown):v is Trade{
 if(!OBJECT(v))return false;
 return typeof v.requestId==="string"&&UUID.test(v.requestId)&&
  (v.kind==="BUY_REQUEST"||v.kind==="SELL_ORDER")&&
  (v.state==="SUBMITTED"||v.state==="UNDER_REVIEW"||v.state==="CLOSED")&&
  typeof v.sourceEventId==="string"&&UUID.test(v.sourceEventId)&&
  VERSION(v.eventVersion)&&ISO(v.lastEventAt);
}
function isNotice(v:unknown):v is Notice{
 if(!OBJECT(v))return false;
 return typeof v.noticeId==="string"&&UUID.test(v.noticeId)&&
  typeof v.title==="string"&&v.title.trim().length>0&&v.title.length<=160&&
  (v.category==="GENERAL"||v.category==="ASSEMBLY"||v.category==="SHAREHOLDER")&&
  VERSION(v.publicationVersion)&&ISO(v.publishedAt)&&v.audienceApproved===true;
}
function validSource(v:unknown,domain:Domain):v is {sourceVersion:number;sourceAsOf:string;items:(Trade|Notice)[]}{
 if(!OBJECT(v)||v.available!==true||v.sourceDomain!==(domain==="trade-requests"?"CHILD07":"CHILD09")||
   !VERSION(v.sourceVersion)||!ISO(v.sourceAsOf)||typeof v.approvalRef!=="string"||!UUID.test(v.approvalRef)||
   !Array.isArray(v.items)||v.items.length>20)return false;
 const ids=new Set<string>();
 return v.items.every((item:unknown)=>{
  const valid=domain==="trade-requests"?isTrade(item):isNotice(item);
  if(!valid)return false;
  const id=domain==="trade-requests"?(item as Trade).requestId:(item as Notice).noticeId;
  if(ids.has(id))return false;
  ids.add(id);
  return true;
 });
}
function date(value:string){return new Date(value).toLocaleDateString("fa-IR");}
const TRADE_LABEL={BUY_REQUEST:"درخواست خرید",SELL_ORDER:"درخواست فروش"};
const TRADE_STATE={SUBMITTED:"ثبت‌شده در مرجع",UNDER_REVIEW:"در دست بررسی",CLOSED:"پرونده بسته‌شده؛ نتیجه حقوقی نامشخص"};
const NOTICE_CATEGORY={GENERAL:"عمومی",ASSEMBLY:"مجمع و جلسات",SHAREHOLDER:"مخصوص سهامدار"};

/** Candidate read-model, default-denied at the BFF and Nest boundary.
 * Rendering a verified response is NOT legal approval to trade, settle or publish.
 */
export function ShareholderReadModels({tenantId,domain}:{tenantId:string;domain:Domain}){
 const [result,setResult]=useState<ReadState>(UNKNOWN);
 useEffect(()=>{
  if(!UUID.test(tenantId))return;
  const controller=new AbortController();
  const init:RequestInit={credentials:"same-origin",cache:"no-store",signal:controller.signal};
  setResult({tenantId,status:"loading",items:[]});
  fetch("/api/tenants/"+tenantId+"/me/"+domain,init)
   .then(async response=>{
    if(response.status===401)return {tenantId,status:"denied",items:[]} as ReadState;
    if(response.status===403||response.status===404)return {tenantId,status:"denied",items:[]} as ReadState;
    if(response.status!==200)return {tenantId,status:"unavailable",items:[]} as ReadState;
    const payload:unknown=await response.json();
    if(!validSource(payload,domain))return {tenantId,status:"unavailable",items:[]} as ReadState;
    return {tenantId,status:"verified",items:payload.items,sourceVersion:payload.sourceVersion,sourceAsOf:payload.sourceAsOf} as ReadState;
   })
   .then(value=>{if(!controller.signal.aborted)setResult(value);})
   .catch(()=>{if(!controller.signal.aborted)setResult({tenantId,status:"unavailable",items:[]});});
  return ()=>controller.abort();
 },[tenantId,domain]);
 const status=tenantId===result.tenantId?result.status:"idle";
 const title=domain==="trade-requests"?"درخواست‌های سهام":"اطلاعیه‌های منتشرشده";
 if(status==="idle")return <p role="status" className="sw-message">برای استعلام {title} ابتدا محدوده مجاز را تأیید کنید.</p>;
 if(status==="loading")return <p role="status" className="sw-message">در حال بررسی مرجع معتبر {title}…</p>;
 if(status==="denied")return <p role="status" className="sw-message sw-warning">مرجع رسمی، مجوز مخاطب یا حق دسترسی {title} هنوز تأیید نشده است. این وضعیت به معنی نبود رکورد نیست.</p>;
 if(status==="unavailable")return <p role="status" className="sw-message sw-warning">منبع قابل‌استناد {title} در دسترس نیست؛ هیچ فهرست یا شمارنده‌ای جایگزین نمی‌شود.</p>;
 return <div className="sw-read-model" role="status">
  <p className="sw-read-meta">مرجع تأییدشده · نسخه {result.sourceVersion?.toLocaleString("fa-IR")} · تاریخ {result.sourceAsOf?date(result.sourceAsOf):"—"}</p>
  {result.items.length===0?
   <p className="sw-message">این مرجع برای محدوده و مخاطب تأییدشده، فهرست خالی را به‌صورت صریح گزارش کرده است.</p>:
   <ul className="sw-read-list">
    {result.items.map(item=>domain==="trade-requests"&&"requestId" in item?
     <li key={item.requestId}><strong>{TRADE_LABEL[item.kind]}</strong>
       <span>{TRADE_STATE[item.state]}</span>
       <small>نسخه رویداد {item.eventVersion.toLocaleString("fa-IR")} · {date(item.lastEventAt)}</small></li>:
     domain==="notices"&&"noticeId" in item?
     <li key={item.noticeId}><strong>{item.title}</strong>
       <span>{NOTICE_CATEGORY[item.category]}</span>
       <small>نسخه انتشار {item.publicationVersion.toLocaleString("fa-IR")} · {date(item.publishedAt)}</small></li>:null)}
   </ul>}
  <p className="sw-footnote">این نمایش فقط‌خواندنی است؛ نتیجه حقوقی معامله، انتقال سهم یا ابلاغ قانونی از آن استنباط نمی‌شود.</p>
 </div>;
}
