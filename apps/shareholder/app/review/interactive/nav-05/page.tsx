import "../interactive.css";
import "../nav-04/assemblies.css";
import "./communications.css";
import {SyntheticCommunications} from "./synthetic-communications";

export const dynamic="force-static";
/** NAV-05 is a static internal design review, NOT publication, delivery,
 * legal acknowledgement, ticket submission or an authenticated source client.
 * /review layout noindex is NOT an access-control mechanism.
 */
export default function CommunicationsPreview(){
 return <SyntheticCommunications/>;
}
