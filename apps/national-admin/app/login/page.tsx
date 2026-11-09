import {AuthFrame} from "@tto/ui";
import NationalRootLogin from "../national-root-login";
export const dynamic="force-dynamic";
export default function NationalLogin(){
 return <AuthFrame surface="national" description="به درگاه امن مدیریت کل پلتفرم خوش آمدید؛ ورود با حساب مستقل مدیر ملی انجام می‌شود.">
  <NationalRootLogin/>
 </AuthFrame>;
}