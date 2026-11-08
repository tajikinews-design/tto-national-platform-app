"use client";
import {useEffect,useState,type FormEvent} from "react";
type Tenant={tenantId:string;displayName:string;evidenceStatus:string};
type Board={personName:string;office:string;eventType:string;eventOn:string;termEnd:string};
type Signing={authorityKind:string;requiredSigner:string;alternateSigners:string;
 requiresSeal:boolean;effectiveFrom:string;statedEnd:string;description:string};
type Form={
 cooperativeLegalNationalId:string;registrationNumber:string;sourceType:string;noticeKind:string;
 sourceNoticeNumber:string;gazetteIssue:string;publishedOn:string;resolutionOn:string;
 authorityLetter:string;authorityLetterOn:string;summary:string;sourceUrl:string;
};
const init:Form={cooperativeLegalNationalId:"",registrationNumber:"",sourceType:"COMPANY_REGISTRY",
 noticeKind:"BOARD_CHANGE",sourceNoticeNumber:"",gazetteIssue:"",publishedOn:"",
 resolutionOn:"",authorityLetter:"",authorityLetterOn:"",summary:"",sourceUrl:""};
const firstBoard=():Board=>({personName:"",office:"BOARD_MEMBER",eventType:"APPOINTED",
 eventOn:"",termEnd:""});
const firstSigning=():Signing=>({authorityKind:"BINDING_FINANCIAL",requiredSigner:"",
 alternateSigners:"",requiresSeal:true,effectiveFrom:"",statedEnd:"",description:""});
const field={boxSizing:"border-box" as const,width:"100%",padding:"9px 12px",
 border:"1px solid #b4c5d1",borderRadius:8,font:"inherit"};
const row={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12};
const kind:[string,string][]=[["BOARD_CHANGE","تغییر هیئت‌مدیره"],["CEO_CHANGE","تغییر مدیرعامل"],
 ["SIGNATORY_CHANGE","تغییر حق امضا"],["ESTABLISHMENT","تأسیس"],
 ["BYLAWS_CHANGE","اصلاح اساسنامه"],["GENERAL_ASSEMBLY","مجمع عمومی"],
 ["CAPITAL_CHANGE","تغییر سرمایه"],["ADDRESS_CHANGE","تغییر نشانی"],
 ["DISSOLUTION","انحلال"],["OTHER","سایر تغییرات"]];
const roles:[string,string][]=[["BOARD_CHAIR","رئیس هیئت‌مدیره"],
 ["BOARD_VICE_CHAIR","نایب‌رئیس"],["BOARD_SECRETARY","منشی هیئت‌مدیره"],
 ["BOARD_MEMBER","عضو هیئت‌مدیره"],["CEO","مدیرعامل"],
 ["INSPECTOR","بازرس"],["OTHER","سایر"]];
const event:[string,string][]=[["APPOINTED","انتخاب/انتصاب"],["RESIGNED","استعفا"],
 ["REAPPOINTED","انتخاب مجدد"],["REMOVED","عزل"],["REPORTED","اعلام‌شده"]];
const warn={background:"#fff5db",border:"1px solid #e5c37d",borderRadius:12,padding:15};
export default function LegalNoticeArchiveForm(){
 const [tenants,setTenants]=useState<Tenant[]>([]);
 const [tenant,setTenant]=useState("");
 const [form,setForm]=useState<Form>(init);
 const [board,setBoard]=useState<Board[]>([firstBoard()]);
 const [signing,setSigning]=useState<Signing[]>([firstSigning()]);
 const [status,setStatus]=useState<"loading"|"ready"|"denied">("loading");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [requestKey,setRequestKey]=useState("");
 useEffect(()=>{let live=true;void fetch("/api/me/tenant-options",{
  credentials:"same-origin",cache:"no-store"})
  .then(async r=>{if(!live)return;if(!r.ok){setStatus("denied");return;}
   const data=await r.json() as {items?:Tenant[]};
   const list=(data.items??[]).filter(x=>x.evidenceStatus==="ROLE_AUTHORITY_EVIDENCE");
   setTenants(list);setTenant(list[0]?.tenantId??"");setStatus("ready");
  }).catch(()=>{if(live)setStatus("denied")});
  return()=>{live=false};},[]);
 const updateForm=(k:keyof Form,v:string)=>{setForm(p=>({...p,[k]:v}));setRequestKey("");};
 const updateBoard=(idx:number,k:keyof Board,v:string)=>{setBoard(b=>b.map((x,i)=>i===idx?{...x,[k]:v}:x));setRequestKey("");};
 const updateSigning=(idx:number,k:keyof Signing,v:string|boolean)=>{
  setSigning(s=>s.map((x,i)=>i===idx?{...x,[k]:v}:x));setRequestKey("");
 };
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!tenant||busy)return;
  setBusy(true);setMessage("");
  const key=requestKey||crypto.randomUUID();setRequestKey(key);
  try{
   const payload={...form,requestKey:key,
    sourceNoticeNumber:form.sourceNoticeNumber||null,
    gazetteIssue:form.gazetteIssue||null,publishedOn:form.publishedOn||null,
    authorityLetter:form.authorityLetter||null,
    authorityLetterOn:form.authorityLetterOn||null,sourceUrl:form.sourceUrl||null,
    board:board.filter(x=>x.personName.trim()).map(x=>({
     ...x,termEnd:x.termEnd||null})),
    signing:signing.filter(x=>x.requiredSigner.trim()).map(x=>({
     ...x,alternateSigners:x.alternateSigners.split("،").map(t=>t.trim()).filter(Boolean),
     statedEnd:x.statedEnd||null}))
   };
   const r=await fetch("/api/tenants/"+encodeURIComponent(tenant)+"/governance-archive",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   if(!r.ok){setMessage("ثبت انجام نشد ("+r.status+"). دسترسی، مشخصات منبع یا داده‌های فرم را بررسی کنید.");return;}
   const result=await r.json() as {noticeId?:string;state?:string};
   if(result.state!=="USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED"||!result.noticeId)
     throw Error("UNSAFE_SUCCESS");
   setMessage("آگهی با شناسه "+result.noticeId+" در آرشیو غیرقابل‌ویرایش ثبت شد؛ اصالت منبع هنوز تأیید نشده است.");
   setRequestKey("");setForm({...init});setBoard([firstBoard()]);setSigning([firstSigning()]);
  }catch{setMessage("وضعیت ثبت مشخص نیست؛ برای بررسی تکرار، همان شناسه درخواست را حفظ کنید.");}
  finally{setBusy(false);}
 }
 return <main dir="rtl" lang="fa" style={{padding:"24px 16px",maxWidth:1080,margin:"auto",
  color:"#1d3745",fontFamily:"var(--tto-font),sans-serif",lineHeight:1.95}}>
  <nav><a href="/official-records">بازگشت به سوابق قبلی مدیریت</a></nav>
  <h1>آرشیو جامع آگهی‌های ثبتی و روزنامه رسمی</h1>
  <p>هر آگهی را یک بار با تمام سمت‌ها و قواعد امضای مندرج در آن ثبت کنید.
    در ثبت آگهی بعدی، تاریخچه قبلی حذف نمی‌شود.</p>
  <aside role="note" style={warn}>
   این ابزار در محیط توسعه فعال می‌شود. ثبت متن آگهی، به‌تنهایی احراز اصالت ثبت شرکت‌ها،
   اعتبار قانونی سمت یا مجوز پرداخت و عملیات سهام نیست. شماره ملی اشخاص حقیقی را وارد نکنید.
   برای هر آگهی اصل سند و شناسه انتشار باید در صورت دسترسی جداگانه تطبیق داده شود.
  </aside>
  {status==="loading"&&<p role="status">در حال بررسی مجوز مدیریت…</p>}
  {status==="denied"&&<p role="alert">نشست یا دسترسی مدیریت در دسترس نیست.</p>}
  {status==="ready"&&<form onSubmit={e=>void submit(e)} style={{marginTop:20}}>
   <label>تعاونی
    <select required style={field} value={tenant} onChange={e=>{setTenant(e.target.value);setRequestKey("");}}>
     {tenants.map(t=><option value={t.tenantId} key={t.tenantId}>{t.displayName}</option>)}
    </select></label>
   <fieldset style={{marginTop:22,border:"1px solid #d9e2e9",borderRadius:12,padding:16}}>
    <legend>هویت شرکت و منبع آگهی</legend>
    <div style={row}>
     <label>شناسه ملی شخصیت حقوقی<input required pattern="[0-9]{11}" maxLength={11}
       style={field} value={form.cooperativeLegalNationalId}
       onChange={e=>updateForm("cooperativeLegalNationalId",e.target.value)}/></label>
     <label>شماره ثبت<input required style={field} value={form.registrationNumber}
       onChange={e=>updateForm("registrationNumber",e.target.value)}/></label>
     <label>مرجع آگهی<select style={field} value={form.sourceType}
       onChange={e=>updateForm("sourceType",e.target.value)}>
       <option value="COMPANY_REGISTRY">اداره ثبت شرکت‌ها</option>
       <option value="OFFICIAL_GAZETTE">روزنامه رسمی</option>
      </select></label>
     <label>موضوع آگهی<select style={field} value={form.noticeKind}
       onChange={e=>updateForm("noticeKind",e.target.value)}>
       {kind.map(([k,title])=><option key={k} value={k}>{title}</option>)}</select></label>
     <label>شماره آگهی (در صورت وجود)<input style={field} value={form.sourceNoticeNumber}
       onChange={e=>updateForm("sourceNoticeNumber",e.target.value)}/></label>
     <label>شماره روزنامه رسمی (اختیاری)<input style={field} value={form.gazetteIssue}
       onChange={e=>updateForm("gazetteIssue",e.target.value)}/></label>
     <label>تاریخ صورت‌جلسه (۱۴۰۴/۰۸/۰۶)<input required style={field}
       placeholder="1404/08/06" value={form.resolutionOn}
       onChange={e=>updateForm("resolutionOn",e.target.value)}/></label>
     <label>تاریخ انتشار (در صورت احراز)<input style={field} placeholder="1404/11/05"
       value={form.publishedOn} onChange={e=>updateForm("publishedOn",e.target.value)}/></label>
     <label>شماره نامه اداره تعاون<input style={field} value={form.authorityLetter}
       onChange={e=>updateForm("authorityLetter",e.target.value)}/></label>
     <label>تاریخ نامه اداره تعاون<input style={field} placeholder="1404/11/05"
       value={form.authorityLetterOn} onChange={e=>updateForm("authorityLetterOn",e.target.value)}/></label>
    </div>
    <label>پیوند اصلی سند (اگر موجود باشد)<input style={field} type="url"
      value={form.sourceUrl} onChange={e=>updateForm("sourceUrl",e.target.value)}/></label>
    <label>خلاصه متن آگهی بدون شماره ملی اشخاص حقیقی
     <textarea required rows={4} minLength={30} maxLength={6000} style={field}
       value={form.summary} onChange={e=>updateForm("summary",e.target.value)}/>
    </label>
   </fieldset>
   <fieldset style={{marginTop:22,border:"1px solid #d9e2e9",borderRadius:12,padding:16}}>
    <legend>تاریخچه هیئت‌مدیره و مدیریت</legend>
    {board.map((x,i)=><div key={i} style={{...row,padding:"15px 0",borderBottom:"1px solid #eee"}}>
     <label>نام شخص<input style={field} value={x.personName}
       onChange={e=>updateBoard(i,"personName",e.target.value)}/></label>
     <label>سمت<select style={field} value={x.office}
       onChange={e=>updateBoard(i,"office",e.target.value)}>
       {roles.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
     <label>رویداد<select style={field} value={x.eventType}
       onChange={e=>updateBoard(i,"eventType",e.target.value)}>
       {event.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
     <label>تاریخ رویداد<input style={field} placeholder="1404/08/06" value={x.eventOn}
       onChange={e=>updateBoard(i,"eventOn",e.target.value)}/></label>
     <label>پایان دوره اعلام‌شده<input style={field} placeholder="1406/12/20" value={x.termEnd}
       onChange={e=>updateBoard(i,"termEnd",e.target.value)}/></label>
     <button type="button" disabled={board.length===1}
       onClick={()=>setBoard(b=>b.filter((_,n)=>n!==i))}>حذف این سطرِ پیش‌نویس</button>
    </div>)}
    <button type="button" onClick={()=>setBoard(b=>[...b,firstBoard()])}>
     افزودن سمت یا تغییر مدیر</button>
   </fieldset>
   <fieldset style={{marginTop:22,border:"1px solid #d9e2e9",borderRadius:12,padding:16}}>
    <legend>قواعد حق امضا مطابق متن آگهی</legend>
    {signing.map((x,i)=><div key={i} style={{...row,padding:"15px 0",borderBottom:"1px solid #eee"}}>
     <label>نوع سند<select style={field} value={x.authorityKind}
       onChange={e=>updateSigning(i,"authorityKind",e.target.value)}>
       <option value="BINDING_FINANCIAL">تعهدات مالی و بانکی</option>
       <option value="ORDINARY_LETTERS">اوراق و نامه‌های عادی</option>
      </select></label>
     <label>امضاکننده ثابت<input style={field} value={x.requiredSigner}
       onChange={e=>updateSigning(i,"requiredSigner",e.target.value)}/></label>
     <label>امضاکنندگان جایگزین (با «،» جدا شوند)<input style={field}
       value={x.alternateSigners}
       onChange={e=>updateSigning(i,"alternateSigners",e.target.value)}/></label>
     <label>از تاریخ<input style={field} placeholder="1404/08/06"
       value={x.effectiveFrom} onChange={e=>updateSigning(i,"effectiveFrom",e.target.value)}/></label>
     <label>پایان اعلام‌شده<input style={field} placeholder="1406/12/20"
       value={x.statedEnd} onChange={e=>updateSigning(i,"statedEnd",e.target.value)}/></label>
     <label>نیاز به مهر شرکت<input type="checkbox" checked={x.requiresSeal}
       onChange={e=>updateSigning(i,"requiresSeal",e.target.checked)}/></label>
     <label style={{gridColumn:"1/-1"}}>شرح دقیق قاعده امضا<textarea style={field}
       minLength={20} maxLength={1300} rows={2} value={x.description}
       onChange={e=>updateSigning(i,"description",e.target.value)}/></label>
     <button type="button" disabled={signing.length===1}
       onClick={()=>setSigning(b=>b.filter((_,n)=>n!==i))}>حذف سطر پیش‌نویس</button>
    </div>)}
    <button type="button" onClick={()=>setSigning(b=>[...b,firstSigning()])}>
     افزودن قاعده حق امضا</button>
   </fieldset>
   <button type="submit" disabled={busy||!tenant} style={{padding:"12px 26px",
     marginTop:22,borderRadius:9,background:"#146b77",color:"white"}}>
     {busy?"در حال ثبت…":"ثبت آگهی در آرشیو بدون حذف سوابق"}</button>
   {message&&<p role="status" aria-live="polite">{message}</p>}
  </form>}
 </main>;
}
