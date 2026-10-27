import "../interactive.css";
import "./assemblies.css";
import {SyntheticAssemblies} from "./synthetic-assemblies";

export const dynamic="force-static";

/** Review-only nonoperational showcase; inherits robots noindex from review layout.
 * Does not determine quorum, rights, cast votes or publish legal records.
 */
export default function SyntheticAssembliesPreview(){
 return <SyntheticAssemblies/>;
}
