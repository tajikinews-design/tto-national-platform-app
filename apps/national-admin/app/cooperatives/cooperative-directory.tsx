"use client";
import {useCallback,useEffect,useMemo,useState} from "react";

type Row={workspaceId:string;slug:string;state:"RESERVED";createdAt:string};
type Result={items:Row[];truncated:boolean;source:"RESERVED_WORKSPACES";containsActivatedTenants:false};
type ViewState="loading"|"ready"|"unauthorized"|"unavailable";
const persianDate=new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeZone:"Asia/Tehran"});

export default function CooperativeDirectory(){
 const [rows,setRows]=useState<Row[]>([]);
 const [query,setQuery]=useState("");
 const [state,setState]=useState<ViewState>("loading");
 const [truncated,setTruncated]=useState(false);
 const refresh=useCallback(async (signal?:AbortSignal)=>{
  setState("loading");
  try{
   const response=await fetch("/api/cooperatives",{
    method:"GET",credentials:"same-origin",cache:"no-store",signal
   });
   if(response.status===401||response.status===403){setState("unauthorized");return;}
   if(response.status!==200)throw new Error("REGISTRY_UNAVAILABLE");
   const data=await response.json() as Partial<Result>;
   if(data.source!=="RESERVED_WORKSPACES"||
      data.containsActivatedTenants!==false||!Array.isArray(data.items)||
      typeof data.truncated!=="boolean")throw new Error("INVALID_RESPONSE");
   setRows(data.items);
   setTruncated(data.truncated);
   setState("ready");
  }catch(error){
   if(signal?.aborted)return;
   setState("unavailable");
  }
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  void refresh(controller.signal);
  return ()=>controller.abort();
 },[refresh]);
 const visible=useMemo(()=>rows.filter(r=>r.slug.toLowerCase().includes(query.trim().toLowerCase())),[rows,query]);
 const tableCell={padding:"13px 12px",borderBottom:"1px solid #e2eaf1",textAlign:"right" as const,verticalAlign:"middle" as const};
 const action={display:"inline-block",padding:"10px 14px",background:"#075e89",
  color:"#fff",textDecoration:"none",borderRadius:8,fontWeight:700};
 return <section dir="rtl" lang="fa" aria-label="فهرست تعاونی‌ها" style={{padding:"16px 0",maxWidth:1120}}>
  <h2 style={{fontSize:25,margin:"0 0 8px"}}>فهرست تعاونی‌ها</h2>
  <p style={{lineHeight:2,color:"#40586c",marginTop:0}}>
   در این مرحله، فقط نشانی‌های رزروشده از پایگاه داده توسعه نمایش داده می‌شوند.
   ثبت نشانی به معنی ثبت حقوقی، فعال‌شدن تعاونی یا واگذاری دسترسی مدیریتی نیست.
  </p>
  <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",margin:"16px 0"}}>
   <a href="/cooperatives/new" style={action}>+ ایجاد نشانی تعاونی</a>
   <a href="/cooperatives/onboarding" style={{...action,background:"#e9f2f8",color:"#135274"}}>
    بررسی و تکمیل پرونده‌ها
   </a>
   <button type="button" onClick={()=>void refresh()} style={{padding:"10px 14px",border:"1px solid #91b3c7",borderRadius:8,
    background:"#fff",cursor:"pointer",font:"inherit"}}>به‌روزرسانی فهرست</button>
  </div>
  {state==="loading"?<p role="status">در حال دریافت اطلاعات تعاونی‌ها از سرور…</p>:
   state==="unauthorized"?<p role="alert">دسترسی فقط برای مدیر ملی مجاز است. <a href="/login">ورود مدیر ملی</a></p>:
   state==="unavailable"?<div role="alert" style={{padding:14,background:"#fff2e7",borderRadius:9}}>
    فهرست از سرور دریافت نشد. اطلاعات ساختگی نمایش داده نمی‌شود.
    <button type="button" onClick={()=>void refresh()} style={{marginRight:12}}>تلاش مجدد</button>
   </div>:
   <>
    <div style={{display:"flex",flexWrap:"wrap",gap:14,alignItems:"center",marginBottom:14}}>
     <strong role="status">نشانی‌های رزروشده: {rows.length.toLocaleString("fa-IR")}{truncated?" (نمایش ۲۰۰ مورد نخست)":""}</strong>
     <label htmlFor="cooperative-directory-filter">جست‌وجو بر اساس شناسه</label>
     <input id="cooperative-directory-filter" type="search" value={query}
      onChange={e=>setQuery(e.target.value)} placeholder="شناسه تعاونی"
      style={{padding:"10px 12px",border:"1px solid #acc2d2",borderRadius:8,minWidth:220,font:"inherit"}}/>
    </div>
    <div style={{overflowX:"auto",border:"1px solid #d6e1eb",borderRadius:12,background:"#fff"}}>
     <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
      <caption style={{textAlign:"right",padding:13,fontWeight:700}}>نشانی‌های ثبت‌شده در محیط توسعه</caption>
      <thead style={{background:"#eaf3f9"}}>
       <tr><th scope="col" style={tableCell}>ردیف</th><th scope="col" style={tableCell}>شناسه تعاونی</th>
        <th scope="col" style={tableCell}>وضعیت</th><th scope="col" style={tableCell}>تاریخ رزرو</th>
        <th scope="col" style={tableCell}>اقدام بعدی</th></tr>
      </thead>
      <tbody>
       {visible.map((item,i)=><tr key={item.workspaceId}>
        <td style={tableCell}>{(i+1).toLocaleString("fa-IR")}</td>
        <td style={tableCell}><strong dir="ltr" style={{display:"inline-block"}}>{item.slug}</strong></td>
        <td style={tableCell}><span style={{padding:"5px 9px",background:"#fff2d6",borderRadius:7,color:"#694b06"}}>
          نشانی رزروشده
         </span></td>
        <td style={tableCell}><time dateTime={item.createdAt}>{persianDate.format(new Date(item.createdAt))}</time></td>
        <td style={tableCell}><a href="/cooperatives/onboarding">تکمیل پرونده ←</a></td>
       </tr>)}
      </tbody>
     </table>
     {visible.length===0?<p role="status" style={{padding:16}}>
       {rows.length===0?"هنوز هیچ نشانی تعاونی ثبت نشده است.":"موردی مطابق جست‌وجو یافت نشد."}
      </p>:null}
    </div>
    <p style={{fontSize:13,lineHeight:2,color:"#53697b"}}>
     تعاونی‌های فعال و تأییدشده در این خروجی محاسبه نمی‌شوند؛ برای آن‌ها دریافت اطلاعات از
     مرجع معتبر ثبت و وضعیت حقوقی نیاز است. هیچ رکوردی در این صفحه ایجاد یا تغییر داده نمی‌شود.
    </p>
   </>}
 </section>;
}
