import "../interactive.css";
import "../nav-04/assemblies.css";
import "./services.css";
import {SyntheticServices} from "./synthetic-services";

export const dynamic="force-static";
/** Static synthetic design-review route: never a real booking, entitlement, course,
 * certificate or shareholder service authorization. noindex != access control. */
export default function ShareholderServicesReview(){return <SyntheticServices/>;}
