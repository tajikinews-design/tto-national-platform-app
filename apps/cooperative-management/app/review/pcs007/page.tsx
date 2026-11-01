export const dynamic="force-dynamic";
const allowed=()=>process.env.CI==="true"&&process.env.TTO_PCS007_LAB==="1"&&!process.env.VERCEL&&!process.env.DATABASE_URL&&!process.env.TTO_API_BASE_URL;
export default async function DemoManager(){
 if(!allowed())return <main dir="rtl"><h1>آزمایش تأیید عضویت غیرفعال است</h1></main>;
 let state="منبع آزمایشی در دسترس نیست";
 try{const r=await fetch("http://127.0.0.1:32990/view",{headers:{"x-pcs007-lab-token":process.env.TTO_PCS007_TOKEN??""},cache:"no-store"});if(r.ok){const x=await r.json();state=x.reviewStatus==="APPROVED_SYNTHETIC"?"تأیید نمایشی انجام شده":"در انتظار تأیید نمایشی"}}catch{}
 return <main dir="rtl" lang="fa" style={{padding:24,fontFamily:"Tahoma,sans-serif"}}><h1>پنل تعاونی — آزمایش PCS-007</h1><p>فقط داده ساختگی؛ فاقد اعتبار حقوقی یا اثر بر دفتر سهام.</p><p aria-live="polite">{state}</p><form action="/review/pcs007/approve" method="post"><button type="submit">تأیید اطلاعات ساختگی</button></form></main>;
}
