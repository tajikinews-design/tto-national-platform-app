import {notFound} from "next/navigation";
import {PortalSessionGate,PortalShell} from "@tto/ui";
export const dynamic="force-dynamic";
export default async function CooperativeWorkspace({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))notFound();
 return <PortalSessionGate surface="cooperative"><PortalShell surface="cooperative">
  <section className="tto-login-scope" dir="rtl">
   <h2>فضای اختصاصی تعاونی</h2><p>شناسه نشانی: <b dir="ltr">{slug}</b></p>
   <p>تأیید نشست و نقش مدیر تعاونی الزامی است؛ مالکیت نشانی به‌تنهایی اختیار مدیریت ایجاد نمی‌کند.</p>
   <p>فعال‌سازی پرونده‌ها و مشاهده داده واقعی فقط پس از تطبیق شناسه تعاونی با نشست و نقش ثبت‌شده مجاز است.</p>
  </section>
 </PortalShell></PortalSessionGate>;
}
