import {PortalShell,PortalSessionGate} from "@tto/ui";
export const dynamic="force-dynamic";
export default function Home(){return <PortalSessionGate surface="shareholder">
 <PortalShell surface="shareholder" suppressStaticKpis/>
</PortalSessionGate>}
