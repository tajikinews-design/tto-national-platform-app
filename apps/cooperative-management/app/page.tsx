import {redirect} from "next/navigation";
import {PortalShell,PortalSessionGate} from "@tto/ui";
export const dynamic="force-dynamic";
export default function Home(){
 if(process.env.VERCEL_ENV==="preview")redirect("/workspace-entry");
 return <PortalSessionGate surface="cooperative">
 <PortalShell surface="cooperative"/>
</PortalSessionGate>}
