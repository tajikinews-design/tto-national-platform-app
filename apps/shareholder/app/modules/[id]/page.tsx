import { PortalModulePreview, PortalModuleWorkbench, PortalShell, OtpLogin, parsePortalModuleId, shareholderSectionId } from "@tto/ui";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Route IDs must come from the 11 approved navigation slots, not user input. */
export default async function ModulePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const moduleId=parsePortalModuleId(id);
  if(!moduleId)notFound();
  const focus=moduleId==="NAV-02"?"membership":moduleId==="NAV-03"?"requests":
   moduleId==="NAV-05"?"notices":null;
  if(focus)return <PortalShell surface="shareholder" activeId={moduleId}>
    <PortalModuleWorkbench surface="shareholder" moduleId={moduleId}/>
    <OtpLogin surface="shareholder" enabled={Boolean(process.env.TTO_API_BASE_URL)}
      initialShareholderView={focus}/>
  </PortalShell>;
  const sectionId=shareholderSectionId(moduleId);
  if(sectionId)return <PortalShell surface="shareholder" activeId={moduleId}>
    <PortalModuleWorkbench surface="shareholder" moduleId={moduleId}/>
    <div className="module-status" role="status">
      <strong>ساختار این بخش آماده بررسی است</strong>
      <span>داده اختصاصی تنها پس از احراز نشست، محدوده تعاونی و تأیید منبع حقوقی بررسی می‌شود.</span>
    </div>
    <p className="sw-footnote">هیچ داده، مانده سهام یا گزارش شخصی بدون استعلام معتبر نمایش داده نمی‌شود.</p>
    <OtpLogin surface="shareholder" enabled={Boolean(process.env.TTO_API_BASE_URL)}
      initialShareholderSectionId={sectionId}/>
  </PortalShell>;
  return <PortalModulePreview surface="shareholder" moduleId={moduleId}/>;
}
