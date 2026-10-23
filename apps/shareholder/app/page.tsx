import { PortalShell, OtpLogin } from "@tto/ui";
// Availability of the protected API is resolved at runtime, never frozen at build time.
export const dynamic = "force-dynamic";
export default function Home() {
 return <PortalShell surface="shareholder" suppressStaticKpis>
  <section aria-label="بازبینی رابط کاربری پنل سهامدار"
    style={{padding:"19px",border:"1px solid #d6e5f8",borderRadius:"13px",background:"#edf6ff",marginBottom:"16px"}}>
   <strong style={{display:"block",color:"#145288",fontSize:"16px",marginBottom:"8px"}}>
    نسخه بازبینی طراحی پنل سهامداران
   </strong>
   <p style={{lineHeight:2,margin:"0 0 15px"}}>
    برای دیدن ۱۱ منو و تمام صفحات طراحی، بدون ورود به حساب واقعی و بدون انجام عملیات مالی،
    از فضای بازبینی استفاده کنید.
   </p>
   <a href="/review" style={{display:"inline-block",padding:"11px 18px",borderRadius:"9px",
    color:"#fff",background:"#096dbb",textDecoration:"none",fontWeight:700}}>
    ورود به نسخه قابل پیمایش ۱۱ بخش ←
   </a>
  </section>
  <OtpLogin surface="shareholder" enabled={Boolean(process.env.TTO_API_BASE_URL)}/>
 </PortalShell>;
}
