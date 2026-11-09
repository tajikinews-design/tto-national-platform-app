import {AuthFrame,PortalPasswordLogin} from "@tto/ui";
export const dynamic="force-dynamic";
export default function ShareholderLogin(){
 return <AuthFrame surface="shareholder">
  <PortalPasswordLogin surface="shareholder"/>
 </AuthFrame>;
}