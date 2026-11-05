import {PortalShell} from "@tto/ui";
import NationalRootLogin from "./national-root-login";
export const dynamic="force-dynamic";
export default function Home(){
 return <PortalShell surface="national">
  <div dir="rtl" style={{margin:"18px 0",padding:"20px 24px",borderRadius:14,border:"1px solid #c5d8e8",background:"#eef6fc"}}>
   <h2 style={{marginTop:0}}>پلتفرم ملی تعاونی‌های توسعه و عمران</h2>
   <p style={{lineHeight:2}}>پنل مدیر اصلی؛ ورود صرفاً با نام کاربری و رمز عبور اختصاصی انجام می‌شود. ایجاد نشانی اختصاصی تعاونی‌ها پس از ورود مجاز خواهد بود.</p>
  </div>
  <NationalRootLogin/>
 </PortalShell>;
}
