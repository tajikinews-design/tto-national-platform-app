import {notFound} from "next/navigation";
import {PortalSessionGate,PortalShell} from "@tto/ui";
import {CooperativeEntryGate} from "../../entry-gate";
import {CooperativeNavLink} from "../../cooperative-nav-link";
import {MembersWorkspace} from "../members-workspace";
export const dynamic="force-dynamic";
export default async function MembersSectionPage({params}:{params:Promise<{slug:string;section:string}>}){
 const {slug,section}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)||
 (section!=="add"&&section!=="shares"))notFound();
 const content=<MembersWorkspace slug={slug} section={section} />;
 return <CooperativeEntryGate slug={slug} moduleId="NAV-02" membersSection={section} ownerMembers={content}
  manager={<PortalSessionGate surface="cooperative" workspaceSlug={slug}>
   <PortalShell surface="cooperative" activeId="NAV-02" membersSection={section}
    basePath={"/c/"+slug} NavigationLink={CooperativeNavLink}>
     {content}
   </PortalShell>
  </PortalSessionGate>}/>;
}
