import {redirect} from "next/navigation";
// The national application does not offer SMS registration.
// OTP signup remains a separately governed feature in non-national portals.
export default function NationalRegisterDisabled(){redirect("/");}
