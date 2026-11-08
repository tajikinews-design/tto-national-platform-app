import {PortalPasswordLogin} from "@tto/ui";
export const dynamic="force-dynamic";
export default async function CooperativeLogin({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const p=await searchParams;
 const workspaceSlug=typeof p?.workspace==="string"&&/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(p.workspace)?p.workspace:undefined;
 return <main className="tto-login-page" lang="fa" dir="rtl">
  <PortalPasswordLogin surface="cooperative" workspaceSlug={workspaceSlug}/>
 </main>;
}
