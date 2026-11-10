import {redirect} from "next/navigation";
import {AuthFrame} from "@tto/ui";
export const dynamic="force-dynamic";
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const RESERVED=new Set(["www","api","admin","national","shareholder","auth","login","system","portal","test"]);

/** Select a workspace, never a role. All user/password checks stay in the
 * existing tenant-scoped entry gate and protected Nest/PostgreSQL endpoints.
 */
export default async function WorkspaceEntry({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const q=await searchParams;
 const slug=typeof q?.workspace==="string"?q.workspace.trim().toLowerCase():"";
 if(SLUG.test(slug)&&!RESERVED.has(slug))redirect("/c/"+encodeURIComponent(slug));
 return <AuthFrame surface="cooperative">
  <section className="tto-auth-controls" dir="rtl" lang="fa" aria-label="انتخاب فضای امن تعاونی">
   <h1>ورود به فضای اختصاصی تعاونی</h1>
   <p className="tto-auth-muted-note">شناسه زیردامنه تعاونی ثبت‌شده را وارد کنید. در صفحه بعد، روش ورود با رمز یا احراز هویت مجاز را انتخاب خواهید کرد.</p>
   <form method="GET" action="/workspace-entry" autoComplete="off">
    <label htmlFor="workspace-entry-slug">شناسه فضای تعاونی</label>
    <input id="workspace-entry-slug" name="workspace" type="text" required
     dir="ltr" minLength={3} maxLength={40}
     autoComplete="off" autoCapitalize="none" spellCheck={false}
     pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
     placeholder="شناسه زیردامنه ثبت‌شده"/>
    <button type="submit">ادامه به صفحه ورود تعاونی</button>
   </form>
   <p className="tto-auth-muted-note">انتخاب شناسه، هویت یا سمت حقوقی ایجاد نمی‌کند؛ دسترسی پس از تأیید نشست و تعلق فضای تعاونی انجام می‌شود.</p>
   <p className="tto-auth-muted-note">ورود مستقل مدیر قانونی پس از بررسی مستندات هویت، سمت و مجوزهای امنیتی فعال می‌شود.</p>
   <a href="/login">ورود مستقل مدیر تأییدشده</a>
  </section>
 </AuthFrame>;
}
