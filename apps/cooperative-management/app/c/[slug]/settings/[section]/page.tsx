import {CooperativeNavLink} from "../../cooperative-nav-link";
import {notFound} from "next/navigation";
import {PortalSessionGate,PortalShell} from "@tto/ui";
import {CooperativeEntryGate} from "../../entry-gate";
import {CredentialsSettings} from "../credentials";
import {UsersSettings} from "../users";
import {OfficersSettings} from "../officers";
import {MemberDirectory} from "../../members/member-directory";
export const dynamic="force-dynamic";
export default async function CooperativeSettingsSubpage({params}:
 {params:Promise<{slug:string;section:string}>}){
 const {slug,section}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)||
    !["credentials","users","collections","member-number","officers"].includes(section))notFound();
 const tab=section as "credentials"|"users"|"collections"|"member-number"|"officers";
 const content=tab==="credentials"?<CredentialsSettings slug={slug}/>:
  tab==="users"?<UsersSettings slug={slug}/>:
  tab==="officers"?<OfficersSettings slug={slug}/>:
  <MemberDirectory slug={slug} view={tab==="collections"?"collections":"member-number"}/>;
 return <CooperativeEntryGate slug={slug} moduleId="NAV-11" settingsSection={tab==="officers"?"users":tab}
  ownerSettings={content}
  manager={<PortalSessionGate surface="cooperative" workspaceSlug={slug}>
    <PortalShell surface="cooperative" activeId="NAV-11" settingsSection={tab}
     basePath={"/c/"+slug} NavigationLink={CooperativeNavLink}>
     <section className="tto-settings-page">
      <div className="tto-settings-card" role="status">
       <h2>تنظیمات کاربران فضای آزمایشی</h2>
       <p>این قابلیت مخصوص مالک تأییدشده فضای آزمایشی است و به‌تنهایی از نقش مدیر قانونی ناشی نمی‌شود.</p>
      </div>
     </section>
    </PortalShell>
   </PortalSessionGate>}/>;
}
