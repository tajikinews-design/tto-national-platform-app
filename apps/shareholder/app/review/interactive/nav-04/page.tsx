import "../interactive.css";
import "./governance.css";
import {SyntheticAssembliesAndElections} from "./synthetic-governance";

export const dynamic="force-static";

/** Synthetic review route only; inherits /review noindex and has no real governance data. */
export default function ShareholderGovernanceReview(){
 return <SyntheticAssembliesAndElections/>;
}
