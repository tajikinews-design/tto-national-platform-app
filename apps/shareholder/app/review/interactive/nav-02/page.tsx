import "../interactive.css";
import "./membership.css";
import {SyntheticMembershipHoldings} from "./synthetic-membership-holdings";

export const dynamic="force-static";

/** No source adapter, session lookup, storage, or actual shareholder data. */
export default function ShareholderSyntheticMembershipPage(){
 return <SyntheticMembershipHoldings/>;
}
