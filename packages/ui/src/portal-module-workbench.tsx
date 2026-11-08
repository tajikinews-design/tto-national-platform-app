import type {Surface} from "./index";
/** PH12 preview navigation registry.
 * Routes only to existing real Next pages and their same-origin API proxy clients.
 * Does NOT grant permissions or bypass legal/financial guards.
 */
type Entry={module:string;title:string;href:string;description:string;api:string;readiness:"protected"|"review"|"hold"};
const registry:Record<Surface,Entry[]>={
 cooperative:[
  {module:"NAV-02",title:"عضویت و سهام",href:"/demo",description:"بازبینی نمایش اعضا با داده کاملاً ساختگی؛ مالکیت واقعی همچنان وابسته به دفتر سهام.",api:"Demo only",readiness:"review"},
  {module:"NAV-03",title:"پیش‌نویس تعرفه سهام",href:"/share-market/tariffs",description:"فرم پیش‌نویس تعرفه، انتخاب تعاونی مجاز و سنجش آمادگی؛ هیچ تعرفه‌ای فعال نمی‌شود.",api:"GET /api/me/tenant-options · GET /api/tenants/{tenantId}/share-market/tariff-draft-readiness",readiness:"protected"},
  {module:"NAV-04",title:"آگهی‌ها و سوابق هیئت‌مدیره",href:"/official-records",description:"ثبت اظهارشده سمت‌ها و سوابق آگهی‌ها با کنترل نقش و نشست.",api:"GET /api/tenants/{tenantId}/official-notices",readiness:"protected"},
  {module:"NAV-04",title:"آرشیو آگهی‌های ثبتی",href:"/legal-notice-archive",description:"آرشیو تغییرات، سوابق امضا و درخواست بررسی؛ اطلاعات خوداظهاری هستند.",api:"POST /api/tenants/{tenantId}/governance-archive [development-only]",readiness:"protected"},
  {module:"NAV-04",title:"مستندات مصوبات تعرفه",href:"/share-market/board-review",description:"ثبت و بررسی پرونده‌های مصوبه با حفظ HOLD حقوقی.",api:"/api/tenants/{tenantId}/share-market/tariff-board-cases",readiness:"protected"},
  {module:"NAV-09",title:"بررسی تعارض آگهی‌ها",href:"/governance-conflict-review",description:"مرور پرونده‌ها توسط بازبین مجاز؛ بدون اعطای خودکار اختیار امضا.",api:"/api/tenants/{tenantId}/governance-conflicts",readiness:"protected"},
  {module:"NAV-04",title:"تأیید دو‌نفره اصل PDF",href:"/legal-notice-archive",description:"زیرساخت تأیید داخلی دو شخص در PostgreSQL آزمایش شده؛ فرم امضای عملیاتی و MFA هنوز HOLD.",api:"Migration 0061 / API not released",readiness:"hold"}
 ],
 national:[
  {module:"NAV-02",title:"ایجاد پرونده تعاونی",href:"/cooperatives/new",description:"ثبت اولیه تعاونی با نشست و اختیار مدیریت ملی.",api:"/api/cooperatives/*",readiness:"protected"},
  {module:"NAV-04",title:"پذیرش و راستی‌آزمایی اولیه",href:"/cooperatives/onboarding",description:"گردش کار بررسی مدارک و آغاز هویت معتبر؛ تأیید آگهی قابل جعل خودکار نیست.",api:"/api/cooperatives/onboarding*",readiness:"protected"},
  {module:"NAV-09",title:"نمایش وضعیت پرونده‌های ملی",href:"/demo",description:"نمونه نمایشی و بی‌خطر برای کنترل ظاهر، نه گزارش واقعی.",api:"Demo only",readiness:"review"}
 ],
 shareholder:[
  {module:"NAV-02",title:"عضویت و دفتر سهام",href:"/modules/nav-02",description:"دسترسی بر اساس رابطه عضویت و دفتر مالکیت مستقل با نشست معتبر.",api:"GET /api/tenants/{tenantId}/me/*",readiness:"protected"},
  {module:"NAV-03",title:"درخواست‌های خرید و فروش",href:"/modules/nav-03",description:"پیگیری فقط‌خواندنی و احراز نقش؛ بدون سفارش، پرداخت یا انتقال مالکیت.",api:"GET /api/tenants/{tenantId}/me/*",readiness:"protected"},
  {module:"NAV-05",title:"اطلاعیه‌های مجاز",href:"/modules/nav-05",description:"بازخوانی اطلاعیه‌ها تنها پس از کنترل منبع و حق دسترسی.",api:"GET /api/tenants/{tenantId}/me/*",readiness:"protected"},
  {module:"NAV-04",title:"بازبینی ۱۱ بخش سهامدار",href:"/review",description:"گردش نمایشی بین تمامی بخش‌ها؛ هیچ داده واقعی یا معامله‌ای وجود ندارد.",api:"Design preview only",readiness:"review"}
 ]
};
const badge:Record<Entry["readiness"],{label:string,bg:string,color:string}>={
 protected:{label:"متصل به مسیر API · نیازمند ورود مجاز",bg:"#e4f3ff",color:"#125079"},
 review:{label:"قابل پیمایش · داده ساختگی",bg:"#eaf6eb",color:"#21582b"},
 hold:{label:"HOLD · هنوز عملیاتی نیست",bg:"#fff2d6",color:"#795300"}
};
export function PortalModuleWorkbench({surface,moduleId}:{surface:Surface;moduleId?:string}){
 const items=registry[surface].filter(item=>!moduleId||item.module===moduleId);
 if(!items.length)return <div className="module-status"><strong>این بخش هنوز مسیر اجرایی تأییدشده ندارد</strong><span>ساختار منو برای بررسی قابل مشاهده است؛ API و داده خصوصی بدون مجوز فعال نمی‌شوند.</span></div>;
 return <section dir="rtl" aria-label="مسیرهای واقعی ماژول‌ها" style={{margin:"20px 0"}}>
  <h2 style={{marginBottom:8}}>دسترسی به ماژول‌های آماده</h2>
  <p style={{lineHeight:1.9}}>صفحات زیر به مسیرهای واقعی برنامه متصل هستند. ورود به صفحه به معنای تأیید هویت، مجوز قانونی یا اتصال به داده عملیاتی نیست.</p>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(245px,1fr))",gap:14}}>
   {items.map((item,i)=>{
    const status=badge[item.readiness];
    return <article key={item.href+"-"+i} style={{border:"1px solid #ccdee9",borderRadius:14,padding:17,background:"#fff",display:"grid",gap:8,alignContent:"start"}}>
      <small style={{color:"#3b6480"}}>{item.module}</small>
      <strong style={{fontSize:17,color:"#143b5d"}}>{item.title}</strong>
      <span style={{background:status.bg,color:status.color,borderRadius:7,padding:"6px 8px",fontSize:12,fontWeight:700}}>{status.label}</span>
      <p style={{lineHeight:1.8,margin:"4px 0",fontSize:13}}>{item.description}</p>
      <small style={{direction:"ltr",textAlign:"left",wordBreak:"break-word",color:"#697b88"}}>{item.api}</small>
      <a href={item.href} style={{display:"inline-block",padding:"9px 10px",textAlign:"center",background:"#0c5b87",color:"white",borderRadius:9,fontWeight:700,textDecoration:"none",marginTop:4}}>مشاهده صفحه ←</a>
    </article>;
   })}
  </div>
 </section>
}
