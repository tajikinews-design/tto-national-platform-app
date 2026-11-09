import {CooperativeNavLink} from "../../cooperative-nav-link";
import {notFound} from "next/navigation";
import {PortalSessionGate,PortalShell} from "@tto/ui";
import {CooperativeEntryGate} from "../../entry-gate";
import {CredentialsSettings} from "../credentials";
import {UsersSettings} from "../users";
export const dynamic="force-dynamic";
export default async function CooperativeSettingsSubpage({params}:
 {params:Promise<{slug:string;section:string}>}){
 const {slug,section}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)||
    (section!=="credentials"&&section!=="users"))notFound();
 const tab=section==="credentials"?"credentials" as const:"users" as const;
 const content=tab==="credentials"?<CredentialsSettings slug={slug}/>:<UsersSettings slug={slug}/>;
 return <CooperativeEntryGate slug={slug} moduleId="NAV-11" settingsSection={tab}
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
