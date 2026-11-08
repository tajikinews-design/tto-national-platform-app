import {PortalShell} from "@tto/ui";
export const dynamic="force-dynamic";
/** Visually reviews the APPROVED image geometry with NO company/person data.
 * This route is not an authenticated business module or operational transaction.
 */
export default function DesignReview(){
 return <div lang="fa" dir="rtl">
  <div role="note" style={{background:"#fff1d5",padding:"11px 20px",color:"#68451c",
    textAlign:"center",fontSize:13,fontWeight:700}}>
   بازبینی فقط‌خواندنی طرح مصوب · داده واقعی، ورود کاربر و عملیات تجاری در این صفحه اجرا نمی‌شوند
   · <a href="/review" style={{marginRight:14,color:"#075b88"}}>بازبینی ۱۱ بخش</a>
   · <a href="/login" style={{marginRight:14,color:"#075b88"}}>رفتن به صفحه ورود</a>
  </div>
  <PortalShell surface="shareholder"/>
 </div>
}
