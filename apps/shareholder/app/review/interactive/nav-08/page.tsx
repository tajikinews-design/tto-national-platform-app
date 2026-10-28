import "../interactive.css";
import "../nav-04/assemblies.css";
import "../nav-06/services.css";
import "../nav-07/market.css";
import "./projects.css";
import {SyntheticProjects} from "./synthetic-projects";

export const dynamic="force-static";
/** Static synthetic review only: noindex does not authorize live project, asset, permit or disclosure access. */
export default function ShareholderProjectsReview(){return <SyntheticProjects/>;}
