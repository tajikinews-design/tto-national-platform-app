import {notFound,redirect} from "next/navigation";
import {CooperativeNavLink} from "../../cooperative-nav-link";
import {CooperativeEntryGate} from "../../entry-gate";
import {PortalSessionGate,PortalShell} from "@tto/ui";
import {MemberDraftForms} from "../member-draft-form";
import {ShareholdersTable} from "../shareholders-table";
import {MemberDirectory} from "../member-directory";
export const dynamic="force-dynamic";
export default async function ShareholdersSection({params}:
 {params:Promise<{slug:string;section:string}>}){
 const {slug,section}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))notFound();
 if(section==="new")redirect("/c/"+encodeURIComponent(slug)+"/members/add");
 if(!["add","shares","shareholders","list","archive","collections"].includes(section))notFound();
 const sub=section as "add"|"shares"|"shareholders"|"list"|"archive"|"collections";
 return <CooperativeEntryGate slug={slug} moduleId="NAV-02"
  memberSection={sub} nav02Content={sub==="shareholders"?<ShareholdersTable slug={slug}/>:
  sub==="list"||sub==="archive"||sub==="collections"?<MemberDirectory slug={slug} view={sub}/>:
  <MemberDraftForms slug={slug} section={sub}/>}
  manager={<PortalSessionGate surface="cooperative" workspaceSlug={slug}>
   <PortalShell surface="cooperative" activeId="NAV-02" basePath={"/c/"+slug}
    memberSection={sub} NavigationLink={CooperativeNavLink}>
    <section className="tto-nav02-page"><header className="tto-nav02-hero">
     <h1>دفتر اولیه اعضا و سهام</h1>
     <p>نمایه حقوقی تعاونی به منبع رسمی مستقل نیاز دارد؛ داده آزمایشی مالک اشتراک جایگزین دفتر قانونی نیست.</p>
    </header></section>
   </PortalShell>
  </PortalSessionGate>}/>;
}
