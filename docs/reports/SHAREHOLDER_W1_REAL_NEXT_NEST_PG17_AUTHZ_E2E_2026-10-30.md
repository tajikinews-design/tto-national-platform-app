# W1 — واقعی‌سازی آزمون مسیرهای Next.js / NestJS با داده ساختگی و PostgreSQL 17 موقت

**تاریخ:** ۳۰ اکتبر ۲۰۲۶  
**مبنای پذیرفته‌شده:** PR #66، SHA `077a979dd0e1623ef887ec280f126175e9dca28b`  
**وضعیت فعلی:** TEST IMPLEMENTED / EXACT-SHA DOCKER RELEASE PENDING / NO MERGE-DEPLOY  
**محدوده:** فقط نشست، نقش، تعاونی، مالکیت و منابع ساخته‌شده در PostgreSQL 17 یک‌بارمصرف؛ بدون داده یا مجوز رسمی.

## ۱. معماری آزمون واقعی

`HTTP test client → existing Next.js shareholder production-build BFF /api/... routes → transparent 127.0.0.1 request-counting relay → real NestJS AppModule /v1/... routes → disposable PostgreSQL 17 (FORCE RLS + source SQL guards)`

- سرور Next با دستور واقعی `next start` اجرا می‌شود و Route Handlerهای اصلی `context`، `member-record`، `shareholding`، `trade-requests`، `notices` را بدون mock شدن پاسخ‌ها اجرا می‌کند.
- NestJS واقعی از `services/api/dist/main.js` استفاده کرده و نشست‌ها را در `tto.resolve_session` و زمینه تعاونی را در RLS تراکنشی ارزیابی می‌کند.
- relay صرفاً درخواست‌ها را با یک hop داخلی حمل و **مسیر/روش** آن‌ها را در حافظه شمارش می‌کند؛ نه توکن، داده یا body را ثبت می‌کند و نه پاسخ را جعل می‌کند. بازگردانی عین پاسخ Nest انجام می‌شود.
- دو کاربر/تعاونی/Party/نشست ساختگی جداگانه و دو رکورد «عضویت و تعداد سهام ساختگی» در جدول‌های read-source disposable ایجاد می‌شوند. **هیچ source contract approval یا import batch برای این دو تعاونی ایجاد نمی‌شود.**
- تمام ارتباط‌ها روی loopback داخلی Docker و DB موقت است؛ هیچ پورت منتشرشده، سامانه رسمی، هویت واقعی، پیامک واقعی، Vercel یا استقرار وجود ندارد.

## ۲. اثبات‌های قابل قبول

۱. **BFF واقعی:** در درخواست بدون کوکی، با tenant ID نامعتبر و با هدرهای جعلی `Authorization`، `X-Tenant-Id`، `X-Role` و `X-Source-Approved`، پاسخ ۴۰۱/۴۰۰ است و تعداد تماس‌های BFF→Nest برای آن درخواست **صفر** باقی می‌ماند.

۲. **Nest واقعی:** نشست ساختگی معتبر تنها محدوده تعاونی خود را می‌بیند؛ tenant دیگر با ۴۰۳ رد می‌شود. API مستقیم Nest نیز بدون Bearer ۴۰۱ و برای source بدون approval ۴۰۳ است. ابطال نشست در PG واقعی باعث رد شدن مجدد هر دو مرز می‌شود.

۳. **منبع ساختگی:** درحالی‌که read-source snapshotهای ساختگی واقعاً در DB موقت وجود دارند، BFF و Nest بدون پذیرش مستقل منبع هیچ رکورد/سهام/نشان canary را برنمی‌گردانند. `source_contract_approvals=0` و `source_import_batches=0` باقی می‌مانند. درخواست خرید/فروش با روش POST در BFF برابر ۴۰۵ است و به Nest منتقل نمی‌شود. برای GET درخواست معامله و اعلان نیز BFF فقط `/context` را از Nest می‌پرسد و اصلاً endpoint منبع معامله/اعلان فراخوانی نمی‌شود.

۴. **PEP/PDP مستقل shadow:** همان Bridge پایتونی پذیرفته‌شده برای سناریوهای tenant mismatch، owner mismatch، revoked session، source deny، Party deny، download/export/write/trade/finalize بررسی می‌شود؛ هر `DENY` دارای `fixtureTouches=0` و `SIMULATED_ALLOW` صرفاً مصنوعی، با `canGrantPermission=false` و `legalOperationalEffect=NONE` است. این مرحله هیچ تصمیم shadow را به Routeهای واقعی اعمال نمی‌کند.

## ۳. مرز ادعاها و ریسک‌های باقی‌مانده

**توجه:** گزاره «هیچ درخواست ردشده به هیچ منبعی نمی‌رسد» هنوز **به‌صورت عام ثابت نشده است**. برای routeهای `member-record` و `shareholding`، NestJS با نشست معتبر می‌تواند به توابع SQL مربوط به منبع برای ارزیابی مجوز برسد؛ این آزمون عدم **افشای رکورد** را اثبات می‌کند، نه صفر شدن تمام queryهای درون DB. شمارنده relay، مرز HTTP Next→Nest را می‌سنجد، نه تعداد دسترسی فیزیکی به جدول‌های PostgreSQL.

همچنین PEP/PDP فعلاً فقط **shadow** هستند و در endpointهای Nest واقعی یا BFF واقعی به‌عنوان کنترل عملیاتی فراخوانی نمی‌شوند. نباید نتیجه این فاز را «PEP runtime enforced» یا مجوز قانونی خواند. برای آن مرحله به طراحی اتصال واقعی fail-closed، source admission مستقل، سیاست عملیاتی مصوب، شمارنده/ردیابی منبع بدون داده حساس، audit بادوام و آزمون نفوذ نیاز است.

**بنابراین این مرحله، پذیرش «آزمون یکپارچگی مسیر واقعی و shadow policy consistency» است؛ نه پذیرش runtime PEP enforcement، صفر‌دسترسی عمومی به منبع یا مجوز عملیاتی.**

## ۴. تست‌ها و گیت‌های CI

- `scripts/e2e-w1-real-next-nest-authorization.cjs`: ۱۱ کیس HTTP واقعی با داده کاملاً مصنوعی، دو کاربر و دو تعاونی، ادعای هدر جعلی، scoped role، منبع بدون approval، روش POST مسدود، session revoked، direct Nest و shadow PDP/PEP.
- `scripts/ci/test_w1_real_next_nest_synthetic_e2e.py`: ۷ تست ثابت برای الزام DB موقت، منع اتصال به سرویس زنده، عدم دست‌کاری منابع و عدم ورود shadow به Routeها.
- `scripts/ci/run-local-docker.ps1`: بعد از Build و migrationهای disposable، قبل از بخش Chromium Release، آزمون فوق را در کانتینر موقت Node22 با Python3 موجود اجرا می‌کند. هر شکست باعث خروج غیرصفر می‌شود.
- آزمون مرورگر Phase4C و سایر آزمون‌های NAV قبلی همچنان بدون تغییر و به قوت خود هستند.

**مارکرهای الزامی برای پذیرش SHA جدید:**

```text
TTO_W1_REAL_NEXT_NEST_PG17_CASES=11/11
TTO_W1_REAL_NEXT_NEST_PG17_ROUTES=PASS
TTO_W1_REAL_BFF_ANONYMOUS_NO_NEST_CONTACT=PASS
TTO_W1_REAL_TRADE_NOTICE_NO_SOURCE_ADAPTER=PASS
TTO_W1_REAL_TRADE_MUTATION_DISABLED=PASS
TTO_W1_SHADOW_PEP_PDP_NO_OPERATIONAL_ALLOW=PASS
TTO_W1_REAL_SOURCE_DISCLOSURE=ZERO
TTO_W1_REAL_SOURCE_APPROVALS=ZERO
TTO_W1_REAL_LIVE_OPERATIONS=BLOCKED
TTO_LOCAL_RELEASE_PASS_SHA=<exact SHA>
```

**شروط تکمیلی:** code exit صفر، تست‌های Python، Node، buildها، Chromium، چهار تصویر OCI و گیت‌های سابق همگی موفق؛ آزمایش مستندات false-green ندهد. گزارش از هر دو stdout و stderr خوانده شود.

## ۵. ممنوعیت‌های قطعی

**NO MERGE / NO DEPLOY / NO REAL SOURCE ADMISSION / NO REAL SHAREHOLDER PII / NO SHARE TRADING / NO PAYMENTS / NO ACCOUNT SETTINGS MUTATION.**  
موفقیت آزمایش «صدور مجوز حقوقی» یا فعال‌شدن خودکار قابلیت نیست.
