import {PortalShell,PortalSessionGate,PortalModuleWorkbench,TenantScopePicker,parsePortalModuleId} from "@tto/ui";
import {notFound} from "next/navigation";
export const dynamic="force-dynamic";
export default async function ModulePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params, moduleId=parsePortalModuleId(id);
 if(!moduleId)notFound();
 return <PortalSessionGate surface="cooperative">
   <PortalShell surface="cooperative" activeId={moduleId}>
     <PortalModuleWorkbench surface="cooperative" moduleId={moduleId}/>
     <TenantScopePicker surface="cooperative" moduleId={moduleId}/>
     <p className="sw-footnote">اطلاعات واقعی صرفاً در محدوده تعاونی احرازشده نمایش داده می‌شود. هیچ معامله، امضا یا تأیید حقوقی به‌طور خودکار مجاز نیست.</p>
   </PortalShell>
 </PortalSessionGate>;
}
