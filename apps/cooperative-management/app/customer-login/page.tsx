"use client";
import {useEffect,useState,type FormEvent} from "react";
export default function CommercialLogin(){
 const [slug,setSlug]=useState(""),[username,setUsername]=useState(""),[password,setPassword]=useState(""),[status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{
  const hostname=window.location.hostname.toLowerCase();
  const hostSlug=hostname.endsWith(".ttoir.ir")?hostname.slice(0,-".ttoir.ir".length):"";
  const queried=new URLSearchParams(window.location.search).get("slug")??"";
  const requested=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(hostSlug)?hostSlug:queried;
  if(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(requested))setSlug(requested);
 },[]);
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setStatus("");
 try{
  const r=await fetch("/api/commerce/password-login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,username,password})});
  if(!r.ok){setStatus(r.status===401?"نام کاربری یا رمز اشتباه است.":"ورود در دسترس نیست.");return;}
  setPassword("");
  // The authenticated owner enters the same scoped dashboard in both
  // wildcard-domain testing and isolated Vercel Preview. Never fall back
  // to an unscoped settings page after a successful scoped password login.
  window.location.replace("/c/"+encodeURIComponent(slug));
 }catch{setStatus("اتصال برقرار نشد.")}finally{setBusy(false)}
 }
 return <main dir="rtl" lang="fa" style={{fontFamily:"Tahoma,Arial",padding:25,maxWidth:700,margin:"auto"}}>
 <h1>ورود صاحب اشتراک TTO</h1>
 <p>این ورود ویژه تنظیمات اشتراک تجاری است. برای اولین ورود و تعیین یا بازیابی رمز، ابتدا با OTP وارد شوید.</p>
 <p><a href="/login">ورود پیامکی (OTP)</a> · <a href="/first-login">تعیین یا بازیابی نام کاربری و رمز</a></p>
 <form onSubmit={submit} style={{display:"grid",gap:13}}>
 <label>شناسه زیردامنه<input required dir="ltr" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())}/><span>.ttoir.ir</span></label>
 <label>نام کاربری<input required dir="ltr" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/></label>
 <label>رمز عبور<input required dir="ltr" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <button disabled={busy} type="submit">{busy?"در حال ورود":"ورود به تنظیمات اشتراک"}</button>
 </form>{status?<p role="alert">{status}</p>:null}
 </main>;
}
