"use client";
import {useState} from "react";
import GovernanceConflictWorkbench from "../legal-notice-archive/GovernanceConflictWorkbench";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{12}$/i;
export default function GovernanceConflictReviewPage(){
 const [input,setInput]=useState(""),[tenant,setTenant]=useState("");
 return <main dir="rtl" lang="fa" style={{maxWidth:1060,margin:"0 auto",padding:24,
  fontFamily:"var(--tto-font),sans-serif",lineHeight:1.9}}>
  <nav><a href="/legal-notice-archive">آرشیو آگهی‌های تعاونی ←</a></nav>
  <h1>بازبینی مستقل پرونده‌های تعارض</h1>
  <p>شناسه تعاونی را از پرونده مجاز دریافت کنید. صرف دانستن شناسه به معنی
   دسترسی نیست؛ خواندن و ثبت نظر فقط با نقش بازبین مستقل همان تعاونی ممکن است.</p>
  <label>شناسه تعاونی
   <input dir="ltr" value={input} onChange={e=>setInput(e.target.value)}
    style={{display:"block",width:"100%",padding:10,maxWidth:430}}/>
  </label>
  <button type="button" disabled={!UUID.test(input)}
    onClick={()=>setTenant(input)} style={{marginTop:12}}>بازکردن پرونده‌ها</button>
  {tenant&&<GovernanceConflictWorkbench tenantId={tenant} mode="reviewer"/>}
 </main>;
}
