# CHILD-06 — سه وابستگی بیرونی و معیارهای پذیرش واقعی (۲۰۲۶-۱۱-۰۸)

**شاخه:** `feat/child06-three-external-gates-20261108` | **PR #176 Draft stacked on #175/#174/#172**

## 1. ClamAV واقعی — اسکن آزمایشگاهی مستقل PASS
- GitHub Actions یک Ubuntu 24.04 disposable با `clamav`, `clamav-daemon`, `clamav-freshclam` اجرا کرد.
- به‌روزرسانی پایگاه رسمی از FreshClam انجام شد؛ فایل `daily.cvd` با `sigtool --info` خوانده شد؛ عمر امضا باید <=۱۶۸ ساعت باشد. هیچ فایل امضای مصنوعی در این Workflow بارگذاری نشد.
- برنامه از طریق Unix socket و پروتکل `INSTREAM` فایل آزمایشی PDF سالم را CLEAN و PDF دارای محتوای آزمون EICAR را MALWARE تشخیص داد (امضای `Eicar-Test-Signature`). در Ubuntu 24.04 دستور VERSION در daemon می‌تواند عمداً غیرفعال باشد؛ در آن صورت بررسی دقیق `PING→PONG` محلی انجام می‌شود؛ نسخه و تازگی پایگاه امضا در همان CI جداگانه بررسی می‌شوند.
- این آزمون صحت مسیر کد و موتور واقعی را ثابت می‌کند، نه پاکی دائمی فایل‌های آگهی واقعی، نه امنیت production یا عملیات حقوقی. نتیجه CLEAN هیچ‌گاه مجوز آزادسازی/فعال‌سازی تعرفه نیست.
- شاهد: https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42497891780

## 2. Vault Transit حقیقی — آزمون ایزوله PASS، عملیات PROD همچنان HOLD
- Migration `0060_child06_external_vault_dek_envelope_hold.sql` نگهداری DEK پوشیده‌شده تحت Vault و نسخه `child06-kms-v1` را به جدول الحاقی اضافه کرد؛ متن اصل PDF فقط به صورت AES-256-GCM ciphertext ذخیره می‌شود.
- کلید ۳۲ بایتی تصادفی مخصوص هر PDF توسط Vault Transit wrap می‌شود؛ API با TLS در غیر آزمایش، توکن از مسیر فایل مطلق (نه فایل مخزن/متن پاسخ) و بدون fallback از نوع local dev، الزام شکست ایمن دارد.
- آزمون با **سرور واقعی HashiCorp Vault** داخل محیط disposable CI: encrypt → decrypt → rotate to v2 → old v1 still decrypts → revocation of v1 → old decryption fails closed → new v2 remains readable.
- ممنوعیت آزادسازی فایل و گیت‌های حقوقی تغییر نکرده است؛ بدون استقرار Vault/سرویس KMS مستقل، اتصال هویت سرویس و token least privilege، key availability SLAs، persistence بین failure domainها و بازیابی آف‌سایت، **KMS عملیاتی GREEN نیست**.
- شاهد: https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42497891787

## 3. احراز اصالت مرجع صادرکننده — BLOCKED / HOLD
- نشانی روزنامه رسمی `https://rrk.ir/ords/r/rrs/rrs-front/home` و سامانه شناسه ملی اشخاص حقوقی `https://ilenc.ssaa.ir/` مستقیماً با HTTPS و بدون تغییر داده بررسی شدند.
- هر دو در Runner با `TIMEOUT` روبه‌رو شدند. حتی پاسخ HTTP 200 یا PDF بارگذاری‌شده، *به‌تنهایی* اثبات اصالت رسمی آگهی مشخص، اختیار امضا یا اعتبار ثبتی نیست.
- API معتبر، شناسه آگهی و شناسه ملی تعاونی مورد آزمون، گواهی/کلید امضای تأییدشده صادرکننده، و پاسخ قابل استناد از مرجع متولی ارائه/دسترسی‌پذیر نیست؛ لذا ثبت نتیجه `authenticated=true` یا بستن گیت پذیرش حقوقی ممنوع است.
- شاهد: https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42497821090
- استاندارد خروج از HOLD: پاسخ مستقیم و قابل استناد صادرکننده + تأیید زنجیره اعتماد و مرجعیت قانونی + تطبیق PDF/SHA256، شناسه ملی، شناسه آگهی، آخرین وضعیت انتشار/ابطال، اعضای هیئت‌مدیره و اختیار امضاکنندگان + تأیید حقوقی مستقل.

## 4. ذخیره و بازیابی مستقل
- ۰۰۵۸/۰۰۵۹: قبلاً بازیابی کامل پشتیبان منطقی PostgreSQL در پایگاه آزمایشی جداگانه، بررسی فایل رمزنگاری‌شده و رویدادهای اسکن و HOLD و فقدان کلید، PASS (اجرای ۴۹۵ کنترل).
- ۰۰۶۰: مسیر جدید KMS-backed در CI واقعی Vault آزمایش شد؛ اما **پشتیبان‌گیری پایدار خارجی از Vault و DB، restore در زیرساخت مستقل، آزمون RPO/RTO و تأیید عملیات تولید انجام نشده‌اند**.
- سیاست: حذف یا ابطال نسخه قدیمی Vault key قبل از پایان نگهداری یا آزمون Restore مستقل ممنوع؛ شاهدی که صرفاً رمز بودن اطلاعات را اثبات کند، جایگزین دسترسی به کلید و داده بعد از بحران نیست.

## جمع‌بندی Gate
| مورد | پیشرفت قابل اثبات | وضعیت نهایی |
|---|---|---|
| ClamAV واقعی + امضاهای رسمی در CI | PASS | **GREEN محدود به آزمون مصنوعی** |
| Vault Transit واقعی و چرخش/انقضا | PASS | **GREEN فنی آزمایشگاهی؛ PROD HOLD** |
| Backup و Restore مستقل عملیاتی | فقط PostgreSQL موقت | **HOLD** |
| اتصال معتبر صادرکننده + اصالت آگهی مشخص | Timeout و فقدان تأیید مستقل | **HOLD** |
| اعتبار امضاکنندگان و فعال‌سازی تعرفه | فاقد سند رسمی مورد تأیید | **BLOCKED** |

**هیچ Merge، Deploy، تغییر DB واقعی، عملیات مالی و معامله سهام صورت نگرفت.** PR های ۱۷۲، ۱۷۴، ۱۷۵ و ۱۷۶ Draft و unmerged هستند. وضعیت SSOT فقط پس از کنترل اجرای جدید درج شود.
