import { PortalShell, OtpLogin, parsePortalModuleId } from "@tto/ui";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** PH03 secure module route: never render privileged content from the URL alone.
 *  Module navigation is public structure, while every private read requires
 *  a verified session, tenant role, legal authority and per-operation PDP. */
export default async function ModulePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const moduleId=parsePortalModuleId(id);
 if(!moduleId)notFound();
 return <PortalShell surface="national" activeId={moduleId}>
  <div className="module-status" role="status">
   <strong>دسترسی ماژول نیازمند تأیید مجوز است</strong>
   <span>عنوان و توضیحات قابل مشاهده‌اند؛ اطلاعات و عملیات اختصاصی فقط پس از تأیید نشست و محدوده مجاز.</span>
  </div>
  <OtpLogin surface="national" enabled={Boolean(process.env.TTO_API_BASE_URL)}
    initialManagementModuleId={moduleId}/>
  <p className="sw-footnote">تأیید محدوده، مجوز انجام عملیات این بخش نیست. گردش‌کارهای دامنه فقط پس از اجرای آزمون‌ها و تأیید اختیار قانونی فعال می‌شوند.</p>
 </PortalShell>;
}
