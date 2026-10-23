import { PortalModulePreview, PortalShell, OtpLogin, parsePortalModuleId } from "@tto/ui";
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
    <OtpLogin surface="shareholder" enabled={Boolean(process.env.TTO_API_BASE_URL)}
      initialShareholderView={focus}/>
  </PortalShell>;
  return <PortalModulePreview surface="shareholder" moduleId={moduleId}/>;
}
