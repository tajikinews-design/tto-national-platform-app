# TTO — آزمون ارتباط ایزوله BFF ↔ NestJS ↔ PEP/PDP (W1)

**تاریخ:** ۲۰۲۶-۱۰-۳۰  
**مبنای پذیرفته‌شده:** `b96f051d0c4b93d9f323a0f33dcbcf5331c3189f` — PR #62، پذیرش فنی PEP شبیه‌سازی.  
**نوع:** TEST-ONLY / EXACT-SHA DOCKER RELEASE REQUIRED / NO LIVE DATA / NO MERGE-DEPLOY.

## ۱. مسیر آزمون
`HTTP request (synthetic) → isolated BFF harness using real NextRequest/NextResponse → ephemeral NestJS controller over loopback → Python bridge → accepted in-memory PEP → accepted PDP → synthetic fixture touch counter`

**مرز مهم:** این آزمون از کلاس‌های واقعی Next.js و یک برنامه NestJS موقت استفاده می‌کند؛ اما BFF یک **harness مستقل** است و **Next.js production router** راه‌اندازی یا سیم‌کشی نمی‌شود. بنابراین موفقیت آن به معنای اثبات اتصال عملیاتی Next BFF واقعی یا تضمین امنیت محیط Production نیست. این تمایز باید در گزارش پذیرش حفظ شود.

## ۲. اجزای افزوده‌شده
- `scripts/ci/w1-bff-nest-pep-chain.test.cjs`: آزمون HTTP دو سرویس موقت bind شده به `127.0.0.1` و کنترل‌های انتهابه‌انتها؛ بدون راه‌اندازی برنامه یا سرویس واقعی.
- `scripts/security/w1_isolated_http_bridge.py`: bridge فقط برای اجرای PDP و PEP مصنوعی موجود از طریق JSON استاندارد و بازگرداندن نتیجه پاکسازی‌شده؛ بدون اتصال دیتابیس، منبع رسمی و فایل‌نویسی.
- `scripts/ci/test_shareholder_w1_next_nest_pep_isolation.py`: چهار کنترل ثابت برای حفظ مرزهای synthetic و تشخیص رگرسیون.
- `scripts/ci/run-local-docker.ps1`: اضافه شدن آزمون زنجیره به Core/Release در کانتینر ایزوله موجود؛ با الزام `python3` و کلید صریح `TTO_W1_CHAIN_LAB=1`.

## ۳. آزمون‌های الزامی
| کنترل | انتظار |
|---|---|
| درخواست بدون cookie آزمایشی | 401 در BFF؛ بدون تماس با Nest |
| خواندن با نشست و مجوز مصنوعی معتبر | فقط `SIMULATED_ALLOW`، marker بدون داده واقعی و صفر اثر عملیاتی |
| تعاونی دیگر | 403 و `fixtureTouches=0` |
| صاحب منبع دیگر | 403 و `fixtureTouches=0` |
| دانلود یا خروجی با مجوز صرفاً read | 403 و `fixtureTouches=0` |
| تغییر اطلاعات/POST | 403 و `fixtureTouches=0` |
| هدرهای جعل‌شده role/tenant/approval | بی‌اثر و 403 |
| ابطال منبع رسمی شبیه‌سازی‌شده | 403، عدم تماس با منبع |
| پیوند Party غیرفعال | 403 |
| نشست لغوشده | 401 در BFF، عدم تماس با Nest |
| درخواست مستقیم به کنترلر Nest بدون کانال آزمایشی | 403 |
| رویدادهای رد درخواست | فقط requestId، decision، reasonCode، fixtureTouches، بدون اطلاعات هویتی |

## ۴. محدودیت‌ها و پذیرش
**هیچ تغییر در** `apps/shareholder/app/**`، `services/api/src/**`، SQL migration، RLS، منبع قانونی، OTP، تنظیمات حساب، فرایند سهم، دارایی، کیف پول، ذخیره‌سازی یا استقرار داده نمی‌شود. همه داده‌ها و شناسه‌ها صرفاً آزمایشی‌اند. کانال Nest فقط متعلق به برنامه تست است و هیچ مرجع قانونی یا permission اجرایی تولید نمی‌کند.

تست Node باید با **exit code صفر** و مارکرهای `TTO_W1_BFF_NEST_PEP_PDP_CHAIN=PASS`، `TTO_W1_DENIED_FIXTURE_TOUCHES=0` و `TTO_W1_NO_OPERATIONAL_ALLOW=PASS` عبور کند. برای پذیرش نسخه، `TTO_LOCAL_RELEASE_PASS_SHA=<exact SHA>` ضروری است. **هیچ نتیجه‌ای قبل از Release دقیق SHA نباید PASS اعلام شود.**

## ۵. تصمیم فاز بعد
در صورت موفقیت آزمایش، ورود به طراحی interfaceهای واقعی PEP و امنیت session/tenant فقط در محیط synthetic و پس از review امنیتی مستقل بررسی شود. اتصال منابع Child06/07، مجوزهای رسمی، معامله واقعی و deploy همچنان NO-GO هستند.
