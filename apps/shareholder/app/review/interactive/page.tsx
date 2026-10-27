import "./interactive.css";
import {SyntheticDashboard} from "./synthetic-dashboard";

export const dynamic="force-static";

/** Review-only preview route, inherits /review noindex metadata.
 * No session, source client, or operational POST path mounts here.
 */
export default function ShareholderSyntheticPreview(){
 return <SyntheticDashboard/>;
}
