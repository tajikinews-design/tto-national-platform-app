import {notFound} from "next/navigation";
import {headers} from "next/headers";
export const dynamic="force-dynamic";
export default async function Workspace({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))notFound();
 const base=process.env.TTO_API_BASE_URL;
 if(!base||!base.startsWith("https://"))throw new Error("WORKSPACE_DIRECTORY_UNAVAILABLE");
 const h=await headers();
 const oidc=h.get("x-vercel-oidc-token");
 if(process.env.VERCEL&&(!oidc||!/^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$/.test(oidc)))
  throw new Error("WORKSPACE_IDENTITY_UNAVAILABLE");
 const response=await fetch(new URL("/v1/national/cooperative-workspaces/"+encodeURIComponent(slug),base),{
  headers:oidc?{"x-vercel-trusted-oidc-idp-token":oidc}:{},
  cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)
 });
 if(response.status!==200)throw new Error("WORKSPACE_DIRECTORY_UNAVAILABLE");
 const data=await response.json() as {exists?:boolean;slug?:string};
 if(data.slug!==slug||data.exists!==true)notFound();
 const rawOrigin=process.env.TTO_COOPERATIVE_PORTAL_ORIGIN??"";
 let portalUrl:string|null=null;
 try{const u=new URL(rawOrigin);
  if(u.protocol==="https:"&&!u.username&&!u.password&&!u.pathname.replaceAll("/","")&&
   (u.hostname.endsWith(".vercel.app")||u.hostname.endsWith(".tto.ir")))
   portalUrl=new URL("/login?workspace="+encodeURIComponent(slug),u).href;
 }catch{}
 return <main dir="rtl" lang="fa" style={{fontFamily:"Tahoma,Arial,sans-serif",background:"#f3f7fb",minHeight:"100vh",padding:"32px max(20px,6vw)",color:"#183950"}}>
 <section style={{maxWidth:850,margin:"auto",background:"white",padding:28,borderRadius:16}}>
 <a href="/" style={{color:"#075c8f"}}>بازگشت به پلتفرم ملی</a>
 <h1>فضای اختصاصی تعاونی</h1>
 <p>شناسه مسیر: <strong dir="ltr">{slug}</strong></p>
 <p>این نشانی در فهرست رزروهای نسخه آزمایشی ثبت شده است. هنوز هیچ اطلاعات حقوقی یا مجوز مدیریتی به آن اختصاص داده نشده است.</p>
 <p style={{background:"#f0f5fa",padding:15,borderRadius:9}}>ورود به مدیریت تعاونی نیازمند احراز هویت و انتساب مجوز مدیریت همان تعاونی است. داشتن این نشانی به‌تنهایی مجوز دسترسی نمی‌دهد.</p>
 {portalUrl?<a href={portalUrl} style={{display:"inline-block",padding:"12px 20px",background:"#075c8f",borderRadius:8,color:"white",textDecoration:"none"}}>ورود مستقل مدیر تعاونی برای همین نشانی</a>:<p role="alert">نشانی امن پنل تعاونی هنوز برای این محیط پیکربندی نشده است.</p>}
 </section></main>;
}
