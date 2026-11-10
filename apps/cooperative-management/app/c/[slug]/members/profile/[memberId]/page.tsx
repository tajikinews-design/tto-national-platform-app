import {notFound} from "next/navigation";
import {CooperativeNavLink} from "../../../cooperative-nav-link";
import {CooperativeEntryGate} from "../../../entry-gate";
import {PortalSessionGate,PortalShell} from "@tto/ui";
import {MemberCase} from "../../member-case";
export const dynamic="force-dynamic";
export default async function MemberProfile({params}:{params:Promise<{slug:string;memberId:string}>}){
 const {slug,memberId}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)||!
  /^[a-f0-9-]{36}$/i.test(memberId))notFound();
 return <CooperativeEntryGate slug={slug} moduleId="NAV-02"
  memberSection="profile" nav02Content={<MemberCase slug={slug} memberId={memberId}/>}
  manager={<PortalSessionGate surface="cooperative" workspaceSlug={slug}>
   <PortalShell surface="cooperative" activeId="NAV-02" basePath={"/c/"+slug}
    memberSection="profile" NavigationLink={CooperativeNavLink}>
    <section className="tto-nav02-page"><header className="tto-nav02-hero">
     <h1>پرونده عضویت</h1><p>دسترسی مدیر رسمی به اطلاعات هویتی شخصی و سوابق عضویت منوط به احراز مجوز مستقل است.</p>
    </header></section>
   </PortalShell>
  </PortalSessionGate>}/>;
}