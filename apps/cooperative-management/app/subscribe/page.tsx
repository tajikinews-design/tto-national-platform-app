"use client";
import {useEffect,useState,type FormEvent} from "react";
type Plan={code:string;title:string;durationDays:number;features:string[]};
export default function CommercialCheckout(){
 const [plans,setPlans]=useState<Plan[]>([]);
 const [form,setForm]=useState({name:"",slug:"",mobile:"",planCode:"",amountIrr:""});
 const [status,setStatus]=useState(""),[busy,setBusy]=useState(false),[result,setResult]=useState<{domain:string;expiresAt:string;status:string}|null>(null);
 useEffect(()=>{void fetch("/api/commerce",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()).then((v:{plans?:Plan[]})=>{if(Array.isArray(v.plans)){setPlans(v.plans);setForm(p=>({...p,planCode:v.plans?.[0]?.code??""}));}}).catch(()=>setStatus("دریافت فهرست پلن‌ها ممکن نیست."));},[]);
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;
  setBusy(true);setStatus("");setResult(null);
  try{
   const amount=Number(form.amountIrr);
   if(!Number.isSafeInteger(amount)||amount<1)throw Error("مبلغ معتبر نیست.");
   const r=await fetch("/api/commerce",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({...form,amountIrr:amount})});
   const data=await r.json() as {code?:string;domain?:string;status?:string;expiresAt?:string};
   if(r.status===409)throw Error("این شناسه قبلاً ثبت شده است؛ نام دیگری انتخاب کنید.");
   if(r.status===401||r.status===403)throw Error("ابتدا با شماره همراه تأییدشده وارد شوید.");
   if(!r.ok||data.status!=="DEMO_AMOUNT_ATTESTED"||!data.domain||!data.expiresAt)throw Error("ثبت مبلغ آزمایشی تأیید نشد.");
   setResult({domain:data.domain,status:data.status,expiresAt:data.expiresAt});
   setStatus("ثبت مبلغ نمایشی انجام شد؛ هیچ پرداخت بانکی، فعال‌سازی پنل یا ارسال پیامک واقعی انجام نشده است.");
  }catch(e){setStatus(e instanceof Error?e.message:"ثبت انجام نشد.");}
  finally{setBusy(false)}
 }
 const input={padding:12,border:"1px solid #b9cad8",borderRadius:9,width:"100%",boxSizing:"border-box" as const,font:"inherit"};
 return <main dir="rtl" lang="fa" style={{fontFamily:"Tahoma,Arial",background:"#f3f7fb",minHeight:"100vh",padding:"25px 14px",color:"#163a57"}}>
 <section style={{maxWidth:820,margin:"auto",background:"white",borderRadius:16,padding:24}}>
  <h1>ثبت سفارش پلتفرم تعاونی</h1>
  <p style={{lineHeight:2}}>نسخه آزمایشی پیش از اتصال درگاه: مبلغ واردشده صرفاً به‌عنوان تأیید نمایشی ثبت می‌شود؛ وجهی دریافت نمی‌شود و حساب مدیریتی صادر نمی‌شود.</p>
  <p><a href="/login">ورود با حساب معتبر</a> — قبل از ثبت سفارش، شماره همراه شما باید با OTP تأیید شده باشد.</p>
  <form onSubmit={submit} style={{display:"grid",gap:16}}>
   <label>نام پیشنهادی تعاونی<input style={input} required minLength={5} maxLength={180} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   <label>شناسه انگلیسی زیردامنه (فقط ttoir.ir)<div dir="ltr" style={{display:"flex",alignItems:"center",gap:8}}><input style={input} dir="ltr" required pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value.toLowerCase().trim()})}/><span>.ttoir.ir</span></div></label>
   <label>شماره همراه تأییدشده<input style={input} dir="ltr" inputMode="numeric" required pattern="09[0-9]{9}" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})}/></label>
   <label>پلن موردنظر<select style={input} value={form.planCode} onChange={e=>setForm({...form,planCode:e.target.value})} required><option value="">انتخاب پلن</option>{plans.map(p=><option key={p.code} value={p.code}>{p.title} — {p.durationDays.toLocaleString("fa-IR")} روز</option>)}</select></label>
   {plans.find(p=>p.code===form.planCode)?<p>امکانات: {plans.find(p=>p.code===form.planCode)?.features.join("، ")}</p>:null}
   <label>مبلغ اعلامی (ریال) — فقط آزمایشی<input type="number" min={1} step={1} style={input} required value={form.amountIrr} onChange={e=>setForm({...form,amountIrr:e.target.value})}/></label>
   <button type="submit" disabled={busy||!form.planCode} style={{background:"#075c8f",color:"#fff",padding:14,border:0,borderRadius:9,font:"inherit",cursor:"pointer"}}>{busy?"در حال بررسی…":"ثبت و تأیید مبلغ آزمایشی"}</button>
  </form>
  {status?<p role="status" style={{background:"#eef5fa",padding:14,lineHeight:2}}>{status}</p>:null}
  {result?<div role="status"><h2>سفارش نمایشی ثبت شد</h2><p>نشانی پیشنهادی: <b dir="ltr">{result.domain}</b></p><p>پایان دوره نمایشی: {new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeZone:"Asia/Tehran"}).format(new Date(result.expiresAt))}</p><p>وضعیت: تأیید مبلغ آزمایشی؛ بدون فعال‌سازی مدیریتی</p></div>:null}
 </section></main>;
}
