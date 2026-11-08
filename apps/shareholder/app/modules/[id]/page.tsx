import {PortalShell,PortalSessionGate,PortalModuleWorkbench,ShareholderWorkspace,parsePortalModuleId,shareholderSectionId} from "@tto/ui";
import {notFound} from "next/navigation";
export const dynamic = "force-dynamic";
export default async function ModulePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params, moduleId=parsePortalModuleId(id);
 if(!moduleId)notFound();
 const focus=moduleId==="NAV-02"?"membership":moduleId==="NAV-03"?"requests":moduleId==="NAV-05"?"notices":null;
 const sectionId=shareholderSectionId(moduleId);
 return <PortalSessionGate surface="shareholder">
  <PortalShell surface="shareholder" activeId={moduleId}>
   <PortalModuleWorkbench surface="shareholder" moduleId={moduleId}/>
   <ShareholderWorkspace initialView={focus??"overview"} {...(sectionId?{initialSectionId:sectionId}:{})}/>
   <p className="sw-footnote">ورود معتبر جایگزین اثبات رابطه عضویت، دفتر مالکیت سهم یا مجوز خریدوفروش نیست.</p>
  </PortalShell>
 </PortalSessionGate>;
}
