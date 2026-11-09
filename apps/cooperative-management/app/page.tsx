import {PortalShell,PortalSessionGate} from "@tto/ui";
export const dynamic="force-dynamic";
export default function Home(){return <PortalSessionGate surface="cooperative">
 <PortalShell surface="cooperative"/>
</PortalSessionGate>}
