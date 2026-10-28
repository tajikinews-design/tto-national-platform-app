import "../interactive.css";
import "../nav-04/assemblies.css";
import "../nav-06/services.css";
import "./market.css";
import {SyntheticMarketplace} from "./synthetic-marketplace";

export const dynamic="force-static";
/** STATIC SYNTHETIC PREVIEW: noindex is not access-control; no real order or payment. */
export default function ShareholderMarketReview(){return <SyntheticMarketplace/>;}
