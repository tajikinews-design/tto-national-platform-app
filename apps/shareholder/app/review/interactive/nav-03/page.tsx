import "../interactive.css";
import "./market.css";
import {SyntheticShareMarket} from "./synthetic-share-market";

export const dynamic="force-static";

/** Public-design review only (inherits review noindex); no live trade or auth. */
export default function ShareholderMarketPreview(){
 return <SyntheticShareMarket/>;
}
