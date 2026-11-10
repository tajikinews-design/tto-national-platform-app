import {redirect} from "next/navigation";
import {AuthFrame} from "@tto/ui";
export const dynamic="force-dynamic";
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** A workspace slug only selects a tenant login screen. It never grants authority.
 * Independent legal manager credentials are provisioned by a separately verified process.
 */
export default async function CooperativeLogin({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const p=await searchParams;
 const input=typeof p?.workspace==="string"?p.workspace:"";
 if(SLUG.test(input))redirect("/c/"+encodeURIComponent(input));
 return <AuthFrame surface="cooperative">
  <section className="tto-auth-controls" data-tto-auth-surface="cooperative" dir="rtl"
   aria-label="ورود امن به فضای تعاونی">
   <h1>ورود به فضای اختصاصی تعاونی</h1>
   <p className="tto-auth-muted-note">ابتدا شناسه فضای تعاونی را وارد کنید؛ سپس می‌توانید با نام کاربری و رمز همان فضای آزمایشی یا روش احراز هویت مجاز وارد شوید.</p>
   <form action="/login" method="GET" autoComplete="off">
    <label htmlFor="workspace-slug">شناسه زیردامنه تعاونی</label>
    <input id="workspace-slug" name="workspace" required dir="ltr" autoCapitalize="none"
     autoComplete="off" spellCheck={false} minLength={3} maxLength={40}
     pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
     placeholder="شناسه فضای ثبت‌شده"/>
    <button type="submit">ادامه به صفحه ورود تعاونی</button>
   </form>
   <p className="tto-auth-muted-note">انتخاب شناسه به‌تنهایی مجوز دسترسی ایجاد نمی‌کند؛ نشست، تعاونی و سطح اختیار توسط سرور بررسی می‌شوند.</p>
   <p className="tto-auth-muted-note">ورود مستقل با عنوان حقوقی مدیر تعاونی فقط پس از تأیید هویت، ثبت سمت معتبر و فعال‌سازی کنترل‌های امنیتی امکان‌پذیر است.</p>
   <a href="/subscribe">درخواست فضای آزمایشی جدید</a>
  </section>
 </AuthFrame>;
}
