import {PortalShell,PortalSessionGate} from "@tto/ui";
export const dynamic="force-dynamic";
export default function Home(){return <PortalSessionGate surface="national">
 <PortalShell surface="national"/>
</PortalSessionGate>}
