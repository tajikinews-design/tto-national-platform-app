"use client";
import {useEffect,useState,type FormEvent} from "react";
type Workspace={slug:string;name:string;username:string;credentialsReady:boolean;loginUrl:string;smsStatus:string;tenantActive:boolean;dnsReady:boolean};
export default function ActivateWorkspace(){
 const [items,setItems]=useState<Workspace[]>([]),[slug,setSlug]=useState(""),[username,setUsername]=useState(""),[password,setPassword]=useState(""),[repeat,setRepeat]=useState(""),[status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 async function refresh(){
  try{const r=await fetch("/api/commerce/workspaces",{cache:"no-store",credentials:"same-origin"});if(!r.ok)throw Error();const d=await r.json() as {items:Workspace[]};setItems(d.items);if(!slug&&d.items[0]){setSlug(d.items[0].slug);setUsername(d.items[0].username)}}catch{setStatus("ابتدا با OTP شماره همراه ثبت‌شده وارد شوید؛ سپس به این صفحه بازگردید.")}}
 useEffect(()=>{void refresh()},[]);
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;if(password!==repeat){setStatus("تکرار رمز مطابقت ندارد.");return}
 setBusy(true);setStatus("");
 try{
  const r=await fetch("/api/commerce/workspaces",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,username,password})});
  const d=await r.json() as {code?:string;changed?:boolean};
  if(r.status===403){setStatus("برای تعیین یا بازیابی رمز، ابتدا ورود تازه با OTP را انجام دهید.");return}
  if(!r.ok||d.changed!==true)throw Error("رمز ثبت نشد؛ دسترسی قبلی بدون تغییر باقی ماند.");
  setPassword("");setRepeat("");setStatus("نام کاربری و رمز ثبت شدند؛ نشست‌های قبلی باطل شده‌اند. اکنون می‌توانید با رمز یا OTP وارد شوید.");
 }catch(e){setStatus(e instanceof Error?e.message:"ثبت انجام نشد")}finally{setBusy(false)}
 }
 return <main lang="fa" dir="rtl" style={{padding:24,fontFamily:"Tahoma,Arial",maxWidth:760,margin:"auto"}}>
 <h1>ورود نخست و تعیین نام کاربری و رمز</h1>
 <p style={{lineHeight:2}}>ابتدا از صفحه ورود با OTP، شماره همراه تأییدشده خود را وارد و رمز پیامکی را تأیید کنید. سپس در همین صفحه رمز دلخواه را تعیین کنید. هیچ رمز قابل استفاده‌ای پیامک نمی‌شود.</p>
 <p><a href="/login">ورود با OTP</a> · <a href="/settings/subscription">مشاهده اشتراک</a></p>
 {items.length===0?<p>پس از ورود با شماره خریدار، مشخصات فضای خریداری‌شده نمایش داده می‌شود.</p>:
 <form onSubmit={submit} style={{display:"grid",gap:14}}>
 <label>فضای اختصاصی<select value={slug} onChange={e=>{const slug=e.target.value;setSlug(slug);setUsername(items.find(x=>x.slug===slug)?.username??"")}}>{items.map(x=><option key={x.slug} value={x.slug}>{x.name} — {x.slug}.ttoir.ir</option>)}</select></label>
 <label>نام کاربری<input required minLength={5} maxLength={64} pattern="[a-z][a-z0-9._-]{4,63}" dir="ltr" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().trim())}/></label>
 <label>رمز دلخواه (حداقل ۱۴ نویسه)<input type="password" autoComplete="new-password" minLength={14} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <label>تکرار رمز<input type="password" autoComplete="new-password" minLength={14} required value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>
 <button disabled={busy} type="submit">{busy?"در حال ثبت…":"ثبت امن مشخصات ورود"}</button>
 </form>}
 {status?<p role="status" style={{background:"#eff5fc",padding:14}}>{status}</p>:null}
 </main>;
}
