import "../../interactive.css";
import "../market.css";
import "./case.css";
import {SyntheticTradeCaseTracking} from "./synthetic-trade-case";

export const dynamic="force-static";

/** No live trade read, write, OTP, or official source; inherits review noindex. */
export default function ShareholderSyntheticCaseDemo(){
 return <SyntheticTradeCaseTracking/>;
}
