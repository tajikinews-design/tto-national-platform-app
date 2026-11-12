# راهنمای اجرای خصوصی بازیابی مدیر ملی TTO — PH12

**تاریخ ۱۲ نوامبر ۲۰۲۶ | وضعیت: DRAFT / HOLD تا ارائه مدارک واقعی**

## هدف و مرز اختیار

صاحب‌حساب ملی می‌خواهد **کد ملی خود را نام کاربری** و **شماره موبایل تأییدشده خود را رمز ورود اولیه** قرار دهد. این عملیات فقط روی **همان مدیر ملی موجود** در Preview انجام می‌شود، نه ایجاد مدیر جدید. هیچ عملیات مرتبط با دفتر رسمی سهام، پرداخت یا Production مجاز نیست.

ابزارهای این بسته به محیط اپراتوری خصوصی اختصاص دارند و نباید از داخل مرورگر، Vercel، GitHub Actions یا Production اجرا شوند.

## نقش‌های چهارگانه و تفکیک مسئولیت

| نقش | اختیار | کلید محرمانه | مسیر کار |
| --- | --- | --- | --- |
| متقاضی مدیر ملی | ورود کد ملی و شماره موبایل و OTP روی دستگاه اپراتور | ندارد | `national-root-recovery-private-intake.cjs` |
| صادرکننده گواهی OTP | ارسال واقعی API.ir و امضای نتیجهٔ مصرف موفق کد | کلید خصوصی Ed25519 صادرکننده، **فقط دستگاه اپراتور مورد اعتماد** | مرحله Intake |
| بازبین مستقل | بررسی واقعی هویت و اختیار و امضای رأی مستقل | کلید خصوصی Ed25519 خود بازبین، روی **دستگاه جداگانه** | `national-root-recovery-independent-review.cjs` |
| دو مرجع مستقل ثبت کلید | تأیید صلاحیت صادرکننده و بازبین در یک گواهی عمومی | دو کلید خصوصی جداگانه، خارج از دستگاه اپراتور | `national-root-recovery-governance-sign.cjs` |

مدارک واقعیِ اختیار و شناسایی باید به‌صورت مستقل و خارج از کد بررسی شوند. صحت امضای دیجیتال، جایگزین اختیار قانونی نیست.

## مرحله ۱: پیش‌ثبت و فعال‌سازی اعتماد، بدون کد ملی و موبایل

۱. در دستگاه خصوصی اپراتور، یک پوشه حفاظت‌شده خارج از مخزن Git ایجاد کنید. فایل‌های محرمانه در این پوشه با حق دسترسی حداقلی نگهداری شوند؛ در Windows از حساب شخصی و NTFS ACL مناسب، رمزگذاری دیسک و منع همگام‌سازی عمومی استفاده شود.
۲. شناسه حساب مدیر ملی فعلی، نسخه اعتبارنامه و وضعیت فعال‌بودن آن را با **دسترسی فقط‌خواندنی** از پایگاه داده Preview بررسی کنید. شناسه، کد ملی و شماره موبایل در GitHub ثبت نشوند.
۳. از دو مرجع سازمانی از پیش تأییدشده، کلید عمومی Ed25519 دریافت و اثرانگشت آن را از مجرای مستقل تأیید کنید. این دو کلید باید جدا از کلید صادرکننده OTP و بازبین باشند؛ **خود متقاضی نمی‌تواند هر چهار سمت را به‌عنوان تأیید مستقل امضا کند.**
۴. متقاضی فنی یک گواهی اولیه فقط شامل موارد زیر ایجاد کند (هیچ PII لازم نیست):

```json
{
  "kind": "TTO_PH12_PREVIEW_RECOVERY_TRUST_CERT_V1",
  "projectRef": "zkfwsgrgslxxlusxrwce",
  "environment": "preview",
  "rootUserId": "<existing-root-uuid>",
  "reviewerUserId": "<authorized-reviewer-uuid>",
  "mandateRef": "<externally-verified-authority-reference>",
  "otpIssuerPublicKeyPem": "<issuer-public-ed25519-key>",
  "reviewerPublicKeyPem": "<reviewer-public-ed25519-key>",
  "validFrom": "<current-ISO-time>",
  "expiresAt": "<ISO-time-within-7-days>",
  "ceremonyRef": "<unique-evidence-reference>",
  "approvals": []
}
```

۵. با متغیر مسیر خروجی `TTO_RECOVERY_PRIVATE_TRUST_PATH` و شرایط `TTO_ENVIRONMENT=preview` و `TTO_ISOLATED_DEMO_DB=true` دستور زیر را اجرا کنید. ورودی JSON **فقط از stdin خصوصی** منتقل شود:

```powershell
node scripts/ops/national-root-recovery-trust-register.cjs --prepare
```

نتیجه فقط **PENDING** است؛ دو امضا لازم دارد.

۶. هر مرجع سازمانی روی رایانه خودش با کلید خصوصی خودش، شناسه هویتی مصوب و همان فایل عمومی اولیه دستور مربوط را اجرا می‌کند:

```powershell
node scripts/ops/national-root-recovery-governance-sign.cjs --authority-one
node scripts/ops/national-root-recovery-governance-sign.cjs --authority-two
```

هر دستگاه فقط دستور مربوط به خود را اجرا کند. تأیید انسانی عبارت **APPROVE-KEYS** لازم است. خروجی‌ها دو پروندهٔ امضاشدهٔ جداگانه هستند، نه کلید خصوصی.

۷. اپراتور با دو پرونده امضا، کلیدهای مرجع پین‌شده و `TTO_RECOVERY_TRUST_CANDIDATE_PATH`, `TTO_RECOVERY_AUTHORITY_ONE_APPROVAL_PATH`, `TTO_RECOVERY_AUTHORITY_TWO_APPROVAL_PATH`, `TTO_RECOVERY_PRIVATE_TRUST_PATH` دستور زیر را اجرا می‌کند:

```powershell
node scripts/ops/national-root-recovery-trust-assemble.cjs --assemble
node scripts/ops/national-root-recovery-trust-register.cjs --status
```

اگر هر کلید، تاریخ، شناسه یا امضا نادرست باشد، مرحله بعدی **اجرا نخواهد شد**. در اینجا فقط کلیدهای عمومی مورد اعتماد **در فایل خصوصی Preview** ثبت می‌شوند، نه Production یا پایگاه داده.

## مرحله ۲: اجازه DBA برای آماده‌سازی Preview

فقط پس از تأیید هویت و اختیارهای بالا، مسئول DBA مستقل باید نسخه بکاپ، چک‌لیست بازیابی و اتصال به پروژه دقیق `zkfwsgrgslxxlusxrwce` را تأیید کند. سپس Migrationهای `9999zh_ph12_national_root_recovery_audit_preview.sql` و `9999zi_ph12_national_root_recovery_smsotp_preview.sql` جداگانه **فقط در Preview** اجرا و آزمون شوند. ابزارهای این PR هیچ Migration را خودکار اجرا نمی‌کنند.

بدون وجود جدول‌ها و توابع لازم، عملیات ارسال/بازیابی متوقف می‌شود؛ این وضعیت را با حذف شرط امنیتی یا ایجاد مدیر دوم دور نزنید.

## مرحله ۳: دریافت خصوصی کد ملی، موبایل و OTP واقعی

در رایانه اپراتور با اتصال مجاز پایگاه داده، توکن حقیقی API.ir و کلید خصوصی صادرکننده OTP که با گواهی مرحله ۱ تطبیق دارد، متغیرهای زیر باید **فقط در محیط خصوصی** تأمین شده باشند:

- `TTO_PREVIEW_DATABASE_URL`, `TTO_PREVIEW_APPROVED_DB_HOST`, `TTO_PREVIEW_DB_PROJECT_REF`, `TTO_PREVIEW_DB_SSL=required`
- `TTO_ENVIRONMENT=preview`, `TTO_ISOLATED_DEMO_DB=true`, `TTO_PREVIEW_NATIONAL_ROOT_RECOVERY_SMSOTP=operator-approved`
- `TTO_ENABLE_REAL_SMSOTP_DELIVERY=true`, `APIIR_TOKEN`, `TTO_RECOVERY_OTP_CHALLENGE_SECRET`, `TTO_RECOVERY_IDENTITY_HMAC_SECRET`
- `TTO_RECOVERY_OTP_ISSUER_PRIVATE_KEY_PEM` و `TTO_RECOVERY_PRIVATE_TRUST_PATH`
- `TTO_RECOVERY_AUTHORITY_ONE_PUBLIC_KEY_PEM`, `TTO_RECOVERY_AUTHORITY_TWO_PUBLIC_KEY_PEM`, `TTO_RECOVERY_PRIVATE_OTP_RECEIPT_PATH`

تأمین این مقادیر باید از Secret Store مجاز یا کنسول محافظت‌شده انجام شود. هیچ رمز، کد ملی یا موبایل را در خط فرمان، فایل مخزن، GitHub Actions یا این چت ارسال نکنید.

```powershell
node scripts/ops/national-root-recovery-private-intake.cjs --run
```

اپراتور، کد ملی، شماره موبایل و کد پیامکی را در **همان پنجره تعاملی با ورودی مخفی** دریافت می‌کند. کد فقط ۶۰ ثانیه معتبر است. موفقیت با یک رسید خصوصی Ed25519 ثبت می‌شود و **هیچ دسترسی مدیریتی صادر نمی‌شود**.

## مرحله ۴: تأیید مستقل اختیار

رسید OTP از راه امن سازمانی به دستگاه بازبین مستقل تحویل داده می‌شود. بازبین با کلید خودش و گواهی عمومی تأییدشده، اسناد واقعی مالکیت و اختیار مدیر ملی را بررسی می‌کند. سپس:

```powershell
node scripts/ops/national-root-recovery-independent-review.cjs --approve
```

برای امضا عبارت **APPROVE-PH12** لازم است. بازبین باید `TTO_RECOVERY_REVIEWER_PRIVATE_KEY_PEM` خود را فقط در دستگاه خودش نگهداری کند. امضای متقاضی، امضای صادرکننده پیامک یا یک جفت‌کلید ساختگی جایگزین بازبین نیست.

## مرحله ۵: تغییر حساب موجود و آزمون ورود

اپراتور از دو رسید امضاشده، گواهی معتبر کلیدها و اتصال Preview استفاده می‌کند. تأیید نهایی انسانی با **APPLY-PH12** انجام می‌شود:

```powershell
node scripts/ops/national-root-recovery-private-complete.cjs --apply
```

این دستور با استفاده از تراکنش SERIALIZABLE، **وجود و مصرف واقعی همان چالش OTP**، تطبیق حساب/نسخه/زمان، اختیار بازبین و وضعیت شماره موبایل را بررسی می‌کند؛ فقط سپس نام کاربری و رمز را در **همان حساب موجود** تغییر می‌دهد، دوره امنیتی را افزایش داده و نشست‌های قبلی را باطل می‌کند. در صورت هر خطا کل تراکنش ROLLBACK می‌شود.

پس از موفقیت، آزمون ورود واقعی به Preview محافظت‌شده (به‌همراه SSO)، خروج، انقضا و رد دسترسی متقاطع باید جداگانه ثبت شود. موفقیت ابزار CLI به‌تنهایی اثبات ورود مرورگری نیست.

## وضعیت کنونی و محدودیت‌های اجباری

در زمان ایجاد این PR: حساب مدیر ملی موجود است اما نام کاربری کد ملی و موبایل تأییدشده ندارد؛ Migrationها در Supabase اجرا نشده‌اند؛ دو کلید مرجع و امضاهای قانونی واقعی در دسترس نیستند؛ توکن پیامک اختصاصی و اطلاعات شخصی مالک در این محیط وجود ندارند. بنابراین **هیچ تأیید یا فعال‌سازی واقعی انجام نشده** و **HOLD** باقی است.

هیچ Merge، Production Deploy، پرداخت، انتقال رسمی سهام یا تغییر اطلاعات حساب واقعی مجاز نیست. گیت قانونی CHILD-07 مستقل از این مسیر باقی می‌ماند.
