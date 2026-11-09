import {CooperativeNavLink} from "../../cooperative-nav-link";
import {notFound,redirect} from "next/navigation";
import {PortalSessionGate,PortalShell,NAV_IDS} from "@tto/ui";
import {CooperativeEntryGate} from "../../entry-gate";
export const dynamic="force-dynamic";
export default async function WorkspaceModule({params}:
 {params:Promise<{slug:string;moduleId:string}>}){
 const {slug,moduleId}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)||
  !/^nav-(?:0[2-9]|1[01])$/.test(moduleId))notFound();
 const activeId=moduleId.toUpperCase();
 if(!NAV_IDS.includes(activeId))notFound();
 if(activeId==="NAV-11")redirect("/c/"+encodeURIComponent(slug)+"/settings/credentials");
 return <CooperativeEntryGate slug={slug} moduleId={activeId}
  manager={<PortalSessionGate surface="cooperative" workspaceSlug={slug}>
   <PortalShell surface="cooperative" activeId={activeId} basePath={"/c/"+slug} NavigationLink={CooperativeNavLink}/>
  </PortalSessionGate>}/>;
}
