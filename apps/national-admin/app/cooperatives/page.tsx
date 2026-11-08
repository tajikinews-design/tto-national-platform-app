import {PortalSessionGate,PortalShell} from "@tto/ui";
import CooperativeDirectory from "./cooperative-directory";
export const dynamic="force-dynamic";

/** National registry is guarded at the page, BFF and Nest/PG17 boundaries. */
export default function NationalCooperativesPage(){
 return <PortalSessionGate surface="national">
  <PortalShell surface="national" activeId="NAV-02">
   <CooperativeDirectory/>
  </PortalShell>
 </PortalSessionGate>;
}
