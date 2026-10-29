import "../interactive.css";
import "../nav-04/assemblies.css";
import "../nav-06/services.css";
import "../nav-07/market.css";
import "../nav-08/projects.css";
import "./disclosures.css";
import {SyntheticDisclosures} from "./synthetic-disclosures";
export const dynamic="force-static";
/** Synthetic only: no live document reading, editing, notices or finance systems. */
export default function ShareholderDisclosureReview(){return <SyntheticDisclosures/>;}
