export const dynamic="force-dynamic";
export default async function DemoShareholder(){
 const enabled=process.env.CI==="true"&&process.env.TTO_PCS007_LAB==="1"&&process.env.NODE_ENV==="test"&&!process.env.VERCEL&&!process.env.DATABASE_URL&&!process.env.TTO_API_BASE_URL&&Boolean(process.env.TTO_PCS007_TOKEN);
 if(!enabled)return <main dir="rtl"><h1>نمایش آزمایشی سهامدار غیرفعال است</h1></main>;
 let x:{reviewStatus:string;member:null|{status:string};holdings:null|{quantity:string};official:boolean;canTrade:boolean;canTransfer:boolean}|null=null;
 try{const r=await fetch("http://127.0.0.1:32990/view",{headers:{"x-pcs007-lab-token":process.env.TTO_PCS007_TOKEN!},cache:"no-store",signal:AbortSignal.timeout(2000)});if(r.ok)x=await r.json()}catch{}
 const approved=x?.reviewStatus==="APPROVED_SYNTHETIC"&&x?.official===false&&x?.canTrade===false&&x?.canTransfer===false;
 return <main dir="rtl" lang="fa" style={{padding:24,fontFamily:"Tahoma,sans-serif"}}><h1>پنل سهامدار — آزمایش PCS-007</h1><p>اطلاعات نمونه، بدون اعتبار مالکیت و بدون امکان خریدوفروش.</p>{approved?<section><p>عضویت: نمونه تأییدشده</p><p>تعداد سهام فرضی: {x?.holdings?.quantity} (غیررسمی)</p></section>:<p role="status">اطلاعات تأییدنشده یا در دسترس نیست؛ صفر سهم فرض نمی‌شود.</p>}<p>ثبت انتقال و معامله غیرفعال است.</p></main>;
}
