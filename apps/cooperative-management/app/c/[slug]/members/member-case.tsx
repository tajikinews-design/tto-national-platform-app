"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import type {MemberRow} from "./member-directory";

const panels=[
 {id:"person",symbol:"♙",name:"مشخصات فردی",message:"مشخصات اولیه عضو و وضعیت درخواست"},
 {id:"files",symbol:"♧",name:"ضمائم",message:"فهرست ضمائم قرنطینه‌شده و مجوزهای مشاهده"},
 {id:"message",symbol:"✉",name:"مکاتبات",message:"مکاتبات و اعلان‌های قابل استناد"},
 {id:"notes",symbol:"☷",name:"یادداشت‌ها",message:"یادداشت‌ها و شرح پیگیری پرونده"},
 {id:"shares",symbol:"＄",name:"سهام",message:"دفتر مستقل سهام و حقوق دارنده سهم"},
 {id:"votes",symbol:"♧",name:"حقوق و رأی",message:"بررسی مستقل حق رأی و اعتبار عضویت"},
 {id:"group",symbol:"▤",name:"مجموعه",message:"تعلق عضو به مجموعه و تغییرات آن"},
 {id:"calendar",symbol:"▦",name:"رویدادها",message:"تاریخچه رویدادها و جلسات"},
 {id:"audit",symbol:"◷",name:"سابقه سیستمی",message:"تاریخچه اقدامات ثبت‌شده در سرور"},
 {id:"identity",symbol:"♧",name:"احراز هویت",message:"وضعیت استعلام معتبر هویتی"},
 {id:"termination",symbol:"⚖",name:"پایان عضویت",message:"ثبت درخواست و مستند قانونی پایان عضویت"},
 {id:"alerts",symbol:"♢",name:"اعلان‌ها",message:"اخطارها و ابلاغ‌ها"},
 {id:"reports",symbol:"▥",name:"گزارش‌ها",message:"گزارش‌های قابل دسترسی"},
 {id:"print",symbol:"▣",name:"چاپ",message:"چاپ کنترل‌شده پرونده"},
 {id:"relations",symbol:"☷",name:"ارتباطات",message:"روابط عضو با سایر پرونده‌ها"},
 {id:"secure",symbol:"♧",name:"امنیت",message:"مجوزها و رویدادهای امنیتی"}
] as const;
export function MemberCase({slug,memberId}:{slug:string;memberId:string}){
 const [items,setItems]=useState<MemberRow[]>([]),[loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [tab,setTab]=useState<string>("person");
 const [audit,setAudit]=useState<{action?:string;at?:string;version?:number}[]>([]);
 const [endReason,setEndReason]=useState("RESIGNATION");
 const [endEvidence,setEndEvidence]=useState("");
 const [endDate,setEndDate]=useState("");
 const [endMessage,setEndMessage]=useState("");
 const [endBusy,setEndBusy]=useState(false);
 const base="/c/"+encodeURIComponent(slug)+"/members/";
 useEffect(()=>{const t=new URLSearchParams(window.location.search).get("tab");
  if(t==="system")setTab("audit");
  if(t==="identity"||t==="termination")setTab(t)},[]);
 useEffect(()=>{
  let alive=true;
  fetch("/api/commerce/nav02?slug="+encodeURIComponent(slug),{credentials:"same-origin",cache:"no-store"})
   .then(async r=>{if(!r.ok)throw Error("پرونده از سرور مجاز دریافت نشد.");
     return r.json() as Promise<{items?:MemberRow[]}>;})
   .then(d=>{if(alive)setItems((d.items??[]))})
   .catch(e=>{if(alive)setError(e instanceof Error?e.message:"ارتباط با سرور ناموفق بود.");})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[slug]);
 const member=items.find(x=>x.id===memberId);
 async function selectTab(name:string){
  setTab(name);setError("");
  if(name!=="audit"||!member)return;
  try{
   const r=await fetch("/api/commerce/nav02/manage?slug="+encodeURIComponent(slug)+
    "&draftId="+encodeURIComponent(member.id),{credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error("دریافت سوابق ممیزی مجاز نبود.");
   const body=await r.json() as {events?:{action?:string;at?:string;version?:number}[]};
   setAudit(Array.isArray(body.events)?body.events:[]);
  }catch(e){setError(e instanceof Error?e.message:"دریافت سوابق ناموفق بود.")}
 }
 return <div className="tto-member-case tto-nav02-page">
  <nav className="tto-member-case-top" aria-label="بازگشت و عملیات">
   <Link href={base+"list"}>« بازگشت به لیست اعضا</Link>
   <Link href={base+"add"}>＋ ثبت عضو</Link>
   <Link href={base+"collections"}>♧ مجموعه‌ها</Link>
  </nav>
  {loading?<p role="status">در حال بررسی هویت و محدوده پرونده…</p>:null}
  {error?<p role="alert" className="tto-nav02-warning">{error}</p>:null}
  {!loading&&!member?<section className="tto-nav02-card"><h2>پرونده در دسترس نیست</h2>
   <p>رکورد انتخاب‌شده در محدوده مجاز این تعاونی وجود ندارد یا دسترسی آن تأیید نشده است.</p>
  </section>:null}
  {member?<div className="tto-member-case-grid">
   <aside className="tto-member-case-people" aria-label="انتخاب پرونده عضو">
    <h2>پرونده اشخاص</h2>
    {items.map(item=><Link href={base+"profile/"+encodeURIComponent(item.id)} key={item.id}
     aria-current={memberId===item.id?"page":undefined}>
     <span className="tto-member-small-avatar" aria-hidden="true">♙</span>
     <span><strong>{item.title} {item.name}</strong><small>{item.membershipNumber||"شماره صادر نشده"}</small></span>
    </Link>)}
   </aside>
   <div className="tto-member-case-main">
    <section className="tto-member-case-head">
     <div className="tto-member-case-person">
      <div className="tto-member-case-avatar" aria-label="عکس پرسنلی خصوصی پرونده">
       {member.photoState==="READY_PRIVATE"?<img
        src={"/api/commerce/nav02/photo/view?slug="+encodeURIComponent(slug)+"&draftId="+encodeURIComponent(member.id)}
        width={75} height={90} alt={"عکس پرسنلی "+member.name}/>:
        <span aria-label={member.photoState==="QUARANTINED"?"تصویر در انتظار اسکن":"عکس موجود نیست"}>♙</span>}</div>
      <div><h1>{member.title} {member.name}</h1>
       <p>شماره عضویت: <strong dir="ltr">{member.membershipNumber||"در انتظار صدور رسمی"}</strong></p>
       <p><span className="tto-nav02-state pending">{({APPLICANT_UNVERIFIED:"متقاضی",ACTIVE_REPORTED:"عضو فعال (اظهاری)",FORMER_REPORTED:"عضو سابق (اظهاری)",NON_MEMBER_REPORTED:"غیرعضو"} as Record<string,string>)[member.membershipStatus??""]??"وضعیت نامشخص"}</span>
        {member.managementState==="SUSPENDED_DRAFT"?<span className="tto-nav02-state suspended">معلق</span>:null}</p>
      </div>
     </div>
     <div className="tto-member-case-head-actions">
      <Link href={base+"add?edit="+encodeURIComponent(member.id)}>✎ ویرایش</Link>
      <Link href={base+"shares?draft="+encodeURIComponent(member.id)}>▥ ثبت سهام</Link>
      <Link href={base+"list"}>☷ لیست اعضا</Link>
     </div>
    </section>
    <div className="tto-member-case-icons" dir="rtl" aria-label="ابزارها و ماژول‌های پرونده">
     {panels.map(p=><button type="button" key={p.id}
      className={tab===p.id?"selected":""} title={p.name} aria-label={p.name}
      onClick={()=>void selectTab(p.id)}>{p.symbol}</button>)}
    </div>
    <section className="tto-member-case-details">
     <nav className="tto-member-case-tabs" aria-label="بخش‌های پرونده">
      {panels.filter(p=>["person","files","group","shares","audit","identity","termination"].includes(p.id))
       .map(p=><button type="button" key={p.id} aria-current={tab===p.id?"page":undefined}
        onClick={()=>void selectTab(p.id)}>{p.name}</button>)}
     </nav>
     {tab==="person"?<>
      <div className="tto-member-case-detail-columns">
       <div><h2>مشخصات اولیه</h2>
        <dl><dt>شماره عضویت</dt><dd dir="ltr">{member.membershipNumber||"صادر نشده"}</dd>
         <dt>نوع شخصیت</dt><dd>{member.personType==="LEGAL"?"حقوقی":"حقیقی"}</dd>
         <dt>گروه عضویت</dt><dd>{member.group||"—"}</dd>
         <dt>وضعیت سهامداری</dt><dd>{({NONE_UNVERIFIED:"فاقد سهام",HOLDER_REPORTED:"سهامدار (اظهاری)",TRANSFER_PENDING_REPORTED:"انتقال در جریان (اظهاری)"} as Record<string,string>)[member.shareholdingStatus??""]??"نامشخص"}</dd>
         <dt>کد ملی</dt><dd dir="ltr">{member.identifierMask||"پوشیده"}</dd>
         <dt>شماره همراه</dt><dd dir="ltr">{member.mobileMask||"پوشیده"}</dd>
         <dt>وضعیت ثبت</dt><dd>{member.state||"در انتظار احراز"}</dd></dl>
       </div>
       <div><h2>مجموعه و فعالیت</h2>
        <dl><dt>مجموعه</dt><dd>{member.collectionName||"بدون مجموعه"}</dd>
         <dt>حوزه فعالیت</dt><dd>{member.occupation||"ثبت نشده"}</dd>
         <dt>وضعیت مدیریتی</dt><dd>{member.managementState==="SUSPENDED_DRAFT"?"معلق":"فعال در پیش‌نویس"}</dd>
         <dt>عکس پرونده</dt><dd>{member.photoState==="QUARANTINED"?"در قرنطینه":"ثبت نشده"}</dd></dl>
       </div>
      </div>
      <p className="tto-nav02-boundary">مشاهده اطلاعات هویتی کامل و تغییر عضویت فقط پس از مجوز نقش، احراز هویت و کنترل مستقل سرور انجام می‌شود.</p>
     </>:tab==="identity"?<div className="tto-member-case-panel">
      <h2>احراز هویت و صحت‌سنجی</h2>
      <p>{member.identityVerification==="SHAHKAR_CONFIRMED"?"تطبیق شماره همراه و کد ملی شخص حقیقی در هنگام ثبت از شاهکار پاسخ مثبت داشته است.":
      member.identityVerification==="REPRESENTATIVE_MOBILE_CONFIRMED"?"تطبیق موبایل نماینده معرفی‌شده انجام شده؛ سمت نمایندگی و شناسه ثبتی شرکت هنوز نیازمند مدرک مستقل است.":
      "تطبیق معتبر هویت هنوز در پرونده اثبات نشده است."}</p>
      <p>احراز مالکیت سهام و تأیید قانونی عضویت در دفتر مستقل انجام می‌شود.</p>
     </div>:tab==="termination"?<div className="tto-member-case-panel">
      <h2>درخواست پایان عضویت براساس دلیل قانونی</h2>
      {member.personType!=="NATURAL"||member.membershipStatus!=="ACTIVE_REPORTED"?<p role="status">درخواست پایان عضویت فقط برای شخص حقیقی با وضعیت عضو فعال قابل ثبت است؛ وضعیت اظهاری باید با دفتر رسمی بررسی شود.</p>:
      <form className="tto-member-end-request" onSubmit={async e=>{
       e.preventDefault();setEndBusy(true);setEndMessage("");
       try{
        const res=await fetch("/api/commerce/nav02/end-requests",{
         method:"POST",credentials:"same-origin",cache:"no-store",
         headers:{"Content-Type":"application/json"},
         body:JSON.stringify({slug,draftId:member.id,reason:endReason,
          evidenceReference:endEvidence.trim(),proposedDate:endDate})});
        if(!res.ok)throw Error(res.status===409?"درخواست قبلی هنوز در انتظار بررسی قانونی است.":
         "ثبت مستند پایان عضویت انجام نشد.");
        const data=await res.json() as {saved?:boolean};
        if(data.saved!==true)throw Error("تأیید سرور دریافت نشد.");
        setEndMessage("درخواست مستند ثبت و برای بررسی قانونی نگهداری شد؛ وضعیت رسمی عضویت و سهام هنوز تغییر نکرده است.");
        setEndEvidence("");setEndDate("");
       }catch(err){setEndMessage(err instanceof Error?err.message:"ثبت ناموفق بود.");}
       finally{setEndBusy(false);}
      }}>
       <label>دلیل قانونی پایان عضویت<select value={endReason} onChange={e=>setEndReason(e.target.value)}>
        <option value="RESIGNATION">استعفا</option><option value="DEATH">فوت</option>
        <option value="LEGAL_EXPULSION">اخراج قانونی</option>
        <option value="FULL_SHARE_TRANSFER">انتقال کامل سهام</option>
       </select></label>
       <label>شماره / شناسه سند یا مصوبه *<input required minLength={5} maxLength={160}
        value={endEvidence} onChange={e=>setEndEvidence(e.target.value)}
        placeholder="شماره نامه، گواهی یا مصوبه مرجع صلاحیت‌دار"/></label>
       <label>تاریخ پیشنهادی رویداد (میلادی، اختیاری)<input type="date" value={endDate}
        onChange={e=>setEndDate(e.target.value)}/></label>
       <button disabled={endBusy||endEvidence.trim().length<5} type="submit">
        {endBusy?"در حال ثبت…":"ثبت درخواست بررسی قانونی"}</button>
       {endMessage?<p role="status">{endMessage}</p>:null}
      </form>}
      <p role="status">ثبت درخواست با خاتمه رسمی عضویت تفاوت دارد؛ ماده ۱۲ تا ۱۵ قانون بخش تعاونی، مصوبه‌ها و دفتر CHILD-07 باید مستقل بررسی شوند.</p>
     </div>:tab==="audit"?<div className="tto-member-case-panel">
      <h2>سوابق سیستمی</h2>
      {audit.length?audit.map((ev,i)=><p key={i}>
       {ev.action||"رویداد"} · {ev.at||"زمان ثبت نشده"} · نسخه {ev.version??"—"}</p>):
       <p>رویداد قابل نمایش یافت نشد یا هنوز بررسی نشده است.</p>}
     </div>:
     <div className="tto-member-case-panel">
      <h2>{panels.find(x=>x.id===tab)?.name}</h2>
      <p>{panels.find(x=>x.id===tab)?.message}</p>
      {tab==="group"?<p>مجموعه فعلی: <strong>{member.collectionName||"تعیین نشده"}</strong>.
       <Link href={base+"collections"}> مشاهده مجموعه‌ها </Link></p>:null}
      <p>چارچوب بصری این بخش ایجاد شده است؛ فعالیت و داده‌های اختصاصی هر آیکون پس از تأیید طراحی و پذیرش API مربوط فعال می‌شود.</p>
     </div>}
    </section>
   </div>
  </div>:null}
 </div>;
}
