# PH12 — بازیابی حساب موجود مدیر ملی با تأیید مستقل

**وضعیت: DRAFT / HOLD — 2026-11-11. فقط Preview ایزوله.**

## تصمیم مالک
نام کاربری: کد ملی معتبر ده‌رقمی. رمز اولیه: موبایل ۱۱ رقمی OTP-verified. اطلاعات شخصی هرگز در GitHub، لاگ یا چت ذخیره نمی‌شوند. UI مصوب V1 بدون تغییر می‌ماند.

## شواهد اولیه (صرفاً شمارش/گزاره)
Supabase Preview PostgreSQL 17 یک حساب فعال مدیر ملی دارد؛ نام کاربری آن ده‌رقمی نیست و هیچ موبایل تأییدشده‌ای به همان user_id متصل نیست. ابزار درج اولیه PR195 حساب موجود را جایگزین نمی‌کند و نباید برای آن استفاده شود.

## ساخته شده در این PR
- scripts/ops/national-root-signed-recovery-evidence.cjs: دو امضای Ed25519 مستقل، یکی از سرویس واقعی تأیید OTP و دیگری از بازبین مستقل. هر دو به rootUserId، نسخه فعلی، کد ملی، موبایل، challengeId و nonce مشخص وصل‌اند. زمان و جلوگیری از replay بررسی می‌شوند.
- scripts/ops/recover-national-root-preview.cjs: اسکریپت اپراتوری با ورودی محرمانه فقط stdin، فقط Postgres Preview، TLS و کلیدهای عمومی پین‌شده از مجرای خصوصی. Vercel و CI و Production مسدود هستند.
- database/migrations/9999zh_ph12_national_root_recovery_audit_preview.sql: جدول ثبت سند فقط‌افزودنی، هنوز در Supabase اجرا نشده.
- تغییر اتمیک همان rootUserId، bind کردن موبایل پس از گواهی واقعی موفق OTP، افزایش credentials_version و security_epoch، ابطال همه نشست‌های قبلی و ثبت رسید. شکست = ROLLBACK؛ هیچ مدیر ملی دیگری ساخته نمی‌شود.
- سناریوهای مصنوعی برای رد امضا/مدرک نامعتبر، موبایل متعلق به کاربر دیگر، root/version متعارض و مدرک منقضی.

## گیت‌های خارجی باز
1. کانال خصوصی برای دریافت کد ملی و موبایل از شخص مجاز و اجرای OTP واقعی، بدون ثبت در گفت‌وگو یا مخزن.
2. سرویس OTP مورد اعتماد که موفقیت واقعی SMS را با کلید خارج از مخزن امضا کند. ارسال SMS یا تولید گواهی از سرویس در این PR پیاده نشده است؛ تست با امضای ساختگی، مجوز عملیاتی نیست.
3. بررسی اختیار قانونی/عملیاتی و امضای مستقل بازبین. صرف mandateRef یا جفت‌کلید خودساخته کافی نیست.
4. تصویب و اجرای Migration فقط در DB آزمایشی توسط DBA پس از تهیه بکاپ. نبود جدول یعنی تراکنش fail-closed.
5. اعتماد به کلیدهای امضاکنندگان از مجرای امن؛ کلید خصوصی هیچ‌کدام در مخزن یا ابزار بازیابی نباشد.
6. شناسایی خصوصی rootUserId و credentials_version موجود توسط اپراتور و تطبیق با اسناد اختیار.
7. تست اتصال Backend، Trusted Sources، ورود واقعی و ابطال نشست بدون افشای اطلاعات خصوصی.

## روش کار فقط برای اپراتور مجاز
متغیرهای محیطی Preview ایزوله:
- TTO_ENVIRONMENT=preview
- TTO_ISOLATED_DEMO_DB=true
- TTO_PREVIEW_NATIONAL_ROOT_RECOVERY=operator-approved
- TTO_PREVIEW_DB_SSL=required
- TTO_PREVIEW_APPROVED_DB_HOST و TTO_PREVIEW_DB_PROJECT_REF
- TTO_PREVIEW_DATABASE_URL (خصوصی، بدون چاپ)
- TTO_RECOVERY_OTP_VERIFIER_PUBLIC_KEY_PEM
- TTO_RECOVERY_REVIEWER_PUBLIC_KEY_PEM

ورودی JSON خصوصی stdin شامل expectedRootUserId، expectedRootVersion، otp و approval.
دستور فقط در محیط مجاز: node scripts/ops/recover-national-root-preview.cjs --apply

## نتیجه فعلی
G1 امضای ساختگی و تراکنش ساختگی: تا تأیید CI همین SHA، PENDING.
G2 تأیید واقعی SMS: HOLD.
G3 تأیید مالک و بازبین مستقل: HOLD.
G4 تغییر اتمیک در DB Preview: HOLD (اجرا نشده).
G5 ورود حقیقی در Preview: HOLD.
G6 Merge، Production، دفتر رسمی CHILD-07، خرید و انتقال سهام: HOLD.

هیچ حساب، موبایل، رمز یا نشست واقعی در این مرحله تغییر داده نشده است.
