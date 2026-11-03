import {notFound} from "next/navigation";
export const dynamic="force-dynamic";
export default async function Workspace({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))notFound();
 return <main dir="rtl" lang="fa" style={{fontFamily:"Tahoma,Arial,sans-serif",background:"#f3f7fb",minHeight:"100vh",padding:"32px max(20px,6vw)",color:"#183950"}}>
 <section style={{maxWidth:850,margin:"auto",background:"white",padding:28,borderRadius:16}}>
 <a href="/" style={{color:"#075c8f"}}>بازگشت به پلتفرم ملی</a>
 <h1>فضای اختصاصی تعاونی</h1>
 <p>شناسه مسیر: <strong dir="ltr">{slug}</strong></p>
 <p>این مسیر فقط پوسته آزمایشی است. اعتبار رزرو نشانی، مالکیت تعاونی و مجوز مدیر باید در مرحله اتصال داده بررسی شود.</p>
 <p style={{background:"#f0f5fa",padding:15,borderRadius:9}}>ورود به مدیریت تعاونی نیازمند احراز هویت و انتساب مجوز مدیریت همان تعاونی است. داشتن این نشانی به‌تنهایی مجوز دسترسی نمی‌دهد.</p>
 <a href="https://tto-cooperative-preview.vercel.app" style={{display:"inline-block",padding:"12px 20px",background:"#075c8f",borderRadius:8,color:"white",textDecoration:"none"}}>بازکردن پنل مدیریت تعاونی (ورود مستقل)</a>
 </section></main>;
}
