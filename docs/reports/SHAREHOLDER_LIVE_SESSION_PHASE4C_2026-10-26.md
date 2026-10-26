# فاز ۴ج — آزمون واقعی چرخه اعتبار نشست سهامدار (Next / Nest / PostgreSQL 17 / Chromium)

**تاریخ:** ۱۴۰۵/۰۸/۰۴ / 2026-10-26  
**وضعیت:** `IMPLEMENTED_CANDIDATE / PENDING_LOCAL_DOCKER_RELEASE`  
**مبنای کد:** Phase 4B verified local candidate `2f195b1d97a11eef85ebaa4975e407885e920146` in unmerged Draft PR #31  
**شاخه مستقل:** `feat/shareholder-live-session-e2e-phase4c-20261026`

## مسئله و تفاوت نسبت به ۴ب

فاز ۴ب با **۱۱ آزمون مرورگر دارای پاسخ شبیه‌سازی‌شده API** (۶۶ کنترل، بدون خطا) و آزمون کامل Docker Release در SHA قبلی تأیید شد. آن شواهد رفتار رابط را اثبات می‌کنند، نه چرخه واقعی ابطال نشست در سرور. فاز ۴ج به همین منظور زنجیره واقعی را می‌سنجد:

`Chromium -> Same-origin Next.js BFF (HttpOnly cookie) -> NestJS auth/session -> PostgreSQL17 tto.resolve_session`

هیچ `page.route`، `context.route` یا `route.fulfill` در آزمون جدید وجود ندارد. تمام پاسخ‌های HTTP از فرآیند واقعی Nest و PostgreSQL موقت آمده‌اند.

## پنج سناریوی امنیتی اجباری

| سناریو | رخداد واقعی در پایگاه داده ایزوله | کنترل‌های پذیرش |
| --- | --- | --- |
| ابطال خارج از صفحه | `UPDATE tto.user_sessions SET revoked_at=clock_timestamp()` | ابتدا تأیید نشست و محدوده تعاونی؛ سپس رد Nest و Next، 401 منابع شخصی، حذف React workspace بعد از focus، و انقضای کوکی |
| انقضای سرور | تغییر `expires_at` یک نشست آزمایشی به گذشته | رد نشست قدیمی در Nest/Next و تمام منابع خصوصی؛ بسته‌شدن صفحه با focus |
| ابطال امنیتی سراسری | افزایش `tto.user_accounts.security_epoch` | بی‌اعتبار شدن توکن با epoch قدیمی حتی بدون `revoked_at`، رد سرور و حذف UI |
| خروج رسمی کاربر | کلیک واقعی دکمه خروج داخل Chromium | اجرای BFF و `tto.revoke_own_sessions()` سمت PostgreSQL، تأیید `revoked_at`، رد بازپخش توکن و حذف UI |
| ورود واقعی مرورگر با ارائه‌دهنده پیامک آزمایشی | درخواست و تأیید OTP در Next/Nest با `TTO_MOCK_SMSOTP_PROVIDER=true` و ارسال واقعی صریحاً خاموش | صدور کوکی `HttpOnly/Secure/SameSite=Lax`، ساخت نشست واقعی در PG، تفکیک تعاونی، خروج از فرم و ابطال واقعی همان نشست |

کنترل‌های مشترک: تفکیک تعاونی A/B، 403 در محدوده غیرمجاز، 401 پس از ابطال برای tenant-context، tenant-discovery، Child06 membership، Child07 shareholding، candidate trade-requests و notices؛ انکار استفاده مجدد از bearer در Nest؛ `Cache-Control: no-store`، بدون انتشار bearer در JSON یا HTML، بدون باقی‌ماندن کارت شخصی در صفحه.

## محدوده و مرزهای مجوز

- **NO_PRODUCTION_DATA:** شناسه‌های کاربر، تعاونی، Party و session فقط به‌صورت UUID تصادفی در PostgreSQL17 موقت ایجاد می‌شوند. اتصال به دیتابیس بیرونی با بررسی دقیق `TEST_ADMIN_DATABASE_URL` رد می‌شود.
- **REAL_OTP_PROVIDER_NOT_TESTED:** چهار سناریوی ابطال/انقضا از نشست‌های آزمایشی با هش SHA256 در PostgreSQL disposable استفاده می‌کنند؛ سناریوی پنجم مسیر واقعی فرم OTP و کوکی را با **SMS provider صرفاً آزمایشی** بررسی می‌کند. هیچ پیامک خارجی، ثبت‌نام قانونی سهامدار یا پذیرش OTP بیرونی آزمایش یا اثبات نمی‌شود؛ CF01 آزمون مستقل OTP سه پنل را دارد.
- هیچ کوکی یا توکن در گزارش چاپ نمی‌شود. مرورگر کوکی HttpOnly دارد؛ نمایش `authenticated:true` جایگزین احراز مجوز تعاونی نیست.
- Child06/Child07 مستقل و مشروط به مجوز منبع باقی می‌مانند. آزمون هیچ داده یا تعداد سهم ساختگی به اپلیکیشن عملیاتی تزریق نمی‌کند و هیچ گردش خریدوفروش، تسویه یا حسابداری عمومی فعال نمی‌شود.
- ساخت اسکریپت و فعال شدن گیت در Release **به معنی اجرای موفق نیست**؛ انتشار نتیجه PASS تنها با لاگ Docker روی همان SHA معتبر است.
- در آزمون حقیقی فاز ۴ج، کوکی مرورگر `Secure + HttpOnly` است و ارسال آن با `Chromium -> Next` کنترل می‌شود. توکن نه چاپ می‌شود و نه از API مرورگر به کد برنامه منتقل می‌شود؛ فقط فرآیند تست با اختیارات دیتابیس disposable آن را در CookieJar مرورگر قرار می‌دهد.
- خروجی ماشین‌خوان `TTO_PHASE4C_REAL_BROWSER_REPORT=` با `casesExecuted`، `casesPassed`، `checksPassed` و SHA در لاگ نسخه ایزوله ثبت می‌شود. هیچ شناسه کاربر یا bearer در این خلاصه نیست.
- همه PRهای قبلی Draft، شاخه main و تولید و منابع مالی دست‌نخورده‌اند.

## تغییرات

`scripts/e2e-phase4c-real-session-browser.cjs` — E2E ایزوله با Chromium واقعی، Nest، Next و PG17.  
`scripts/ci/run-local-docker.ps1` — گیت اجباری فاز ۴ج فقط در حالت `-Suite Release`، پس از مهاجرت‌ها و E2E منبع قبلی و قبل از آزمون‌های OCI.  
`scripts/ci/test_shareholder_phase4c.py` — آزمون‌های آفلاین پوشش دامنه و منع شبیه‌سازی API.  
`status/PHASE_GATES.json` — وضعیت دقیق و بدون پذیرش فرضی.

## تأییدها و شواهد موردنیاز

| گیت | وضعیت پیش از اجرای کاربر |
| --- | --- |
| کد و چهار سناریوی آزمایشی در GitHub | `IMPLEMENTED_CANDIDATE` |
| بررسی ساختاری منبع | `STATIC_REVIEW_ONLY` |
| Build TypeScript + Next + API روی SHA جدید | `PENDING_LOCAL_DOCKER_RELEASE` |
| Chromium ↔ Next ↔ Nest ↔ PG17 واقعی | `PENDING_LOCAL_DOCKER_RELEASE` |
| تست UI امضا / شناسایی قانونی / OTP ارائه‌دهنده واقعی | `NOT_IN_SCOPE` |
| Hosted Actions | `BILLING_RESTRICTED` |
| Merge و استقرار | `NOT_AUTHORIZED` |

اجرای مجدد پس از دریافت کد SHA مستقل فاز ۴ج:

```powershell
& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File <isolated-worktree>\scripts\ci\run-local-docker.ps1 -Repository <isolated-worktree> -ExpectedCommit <phase4c_exact_sha> -Suite Release
```

به‌دلیل رخدادهای `ECONNRESET` در npm، هنگام اجرا می‌توان صرفاً کپی موقت **خارج از Git** از Runner را با تلاش مجدد pnpm اجرا کرد؛ منبع SHA و Docker ایزوله باید همان نسخه ثابت بماند. اگر Playwright image یا نصب dependency ناموفق شد، این **مانع شبکه/زیرساخت** است و نه PASS برای رفتار امنیتی.
