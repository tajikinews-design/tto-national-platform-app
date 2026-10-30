# TTO / W1 — قرارداد اتصال امنیتی BFF و NestJS، نسخه آزمایشی ۰.۱

**تاریخ:** ۳۰ اکتبر ۲۰۲۶  
**پایه پذیرفته‌شده:** `8b36eabbeb9cfb89972cf387276c9524d354790b` (PR #65)  
**وضعیت:** CODED / EXACT-SHA FULL RELEASE PENDING / DRAFT ONLY  
**محدوده:** داده و مجوز کاملاً ساختگی، بدون اتصال به منابع رسمی.

## ۱. هدف و تفاوت با فاز قبلی

در فاز قبلی، کل BFF و NestJS در یک فایل تست شبیه‌سازی شده بودند. در این فاز، **کد قرارداد اتصال در مسیر سورس واقعی هر لایه** قرار گرفته است، اما هنوز به Routeها و کنترلرهای عملیاتی متصل نشده است:

- `apps/shareholder/lib/w1-boundary-seam.ts`: قرارداد ورودی/خروجی در محل کد واقعی BFF.
- `services/api/src/w1-boundary-seam.ts`: اعتبارسنجی مستقل مرز NestJS، آماده بررسی TypeScript.
- `scripts/ci/w1-bff-nest-pep-chain.test.cjs`: از همین دو ماژول TS که در حافظه کامپایل می‌شوند، در دو سرور موقت loopback واقعی استفاده می‌کند و سپس PDP/PEP Python پذیرفته‌شده را صدا می‌زند.
- `docs/contracts/shareholder-w1-bff-nest-boundary-seam-v0.1.json`: مرجع ساختاری و ممنوعیت‌های فعال‌سازی.

**این فاز، اتصال واقعی production route یا Next.js production router نیست.** هدف، آزمون قراردادِ قابل‌اتصال در کد واقعی است؛ اجرای عملیاتی، مجوز قانونی و security sign-off از این مرحله نتیجه نمی‌شود.

## ۲. مرز اول: BFF — آماده‌سازی نامزد تصمیم

BFF صرفاً در آزمایش با چهار flag/شرط اجباری `CI=true`، `TTO_LOOPBACK_E2E=1`، `TTO_W1_CHAIN_LAB=1` (در harness) و `TTO_W1_BOUNDARY_LAB=1` عمل می‌کند. در `VERCEL`، `NODE_ENV=production`، با اتصال configured به منابع DB/API/OTP یا در نبود هر flag، **بسته** است.

۱. فقط درخواست با کوکی **کاملاً مصنوعی** و مطابقت آن با session fixture پذیرفته می‌شود. این مقایسه معادل اعتبارسنجی نشست واقعی نیست.  
۲. tenantKey و ownerKey باید تنها مقادیر تستی `coop-test-[A-Z]` و `fixture-owner-[A-Z]` باشند و با اطلاعات trusted fixture تطابق کنند.  
۳. روش HTTP با عملیات خواندن/دانلود/خروجی/نوشتن جداگانه بررسی می‌شود.  
۴. تنها ۵ فیلد قرارداد به NestJS ارسال می‌شود: `contractVersion`، `environment`، `tenantKey`، `ownerKey`، `operation`. کوکی، Bearer، شناسه شخصی، هدر نقش، ادعای منبع و داده حساس فوروارد نمی‌شود.

## ۳. مرز دوم: NestJS — بازبینی مستقل از ادعای BFF

NestJS **حق ندارد** صرف ارسال نامزد از BFF را مجوز تلقی کند. ماژول Nest از یک proof مستقل و سروری (در این مرحله فقط in-memory test fixture) موارد زیر را بررسی می‌کند:

- مطابقت نسخه قرارداد و نبود فیلد غیرمجاز؛ `environment=SIMULATION`؛ نام‌های فقط مصنوعی.
- وضعیت نشست، تعاونی و مالکیت، پیوند Party.
- پرچم‌های مستقل «منبع عضویت ساختگی»، «منبع سهام ساختگی»، تازگی و نسخه و رده‌بندی.
- فعال بودن قابلیت و permission صرفاً از proof سروری. مجوز read برای دانلود/export یا write کافی نیست.
- از آنجا که reauth و CSRF و idempotency و snapshot و تایید پرداخت/نهایی‌سازی در این مرحله فعال نیستند، تمام write/trade/finalize در PDP بسته باقی می‌مانند.

خروجی مثبت Nest صرفاً `PEP_CANDIDATE` داخلی است؛ نه `ALLOW`، نه اعلام مالکیت واقعی، نه سابقه عضویت، نه پرداخت.

## ۴. مرز سوم: پاسخ PDP/PEP → BFF

هیچ JSON خام از backend به مرورگر بازگردانده نمی‌شود. `sanitizeW1SyntheticBffDecision` دقیقاً هشت فیلد مجاز را کنترل و بازسازی می‌کند:

`decision`, `reasonCode`, `requestId`, `fixtureTouches`, `auditCount`, `legalOperationalEffect`, `canGrantPermission`, `hasActualRecord`.

پاسخ دارای فیلد اضافه، `ALLOW` واقعی، `canGrantPermission=true`، رکورد واقعی، UUID نامعتبر، رخداد ممیزی غایب، تماس با منبع بعد از `DENY` یا انحراف از `legalOperationalEffect=NONE` **رد** می‌شود.

نتیجه تستی `SIMULATED_ALLOW` فقط در آزمایش برای read قابل عبور است و حداکثر به marker غیرواقعی منجر می‌شود. هیچ مجوز واقعی تولید نمی‌کند.

## ۵. ماتریس پذیرش پیشنهادی

| آزمایش | انتظار |
|---|---|
| کوکی آزمایشی نامعتبر/نشست لغوشده | 401، بدون اتصال Nest و بدون دسترسی منبع |
| tenantKey متفاوت/مالکیت دیگر | 403، `fixtureTouches=0` |
| تغییر download/export/write با مجوز فقط read | 403 و تماس صفر |
| هدر forged Authorization, X-Role, X-Party-ID, X-Source-Approved | هیچ ارتقای دسترسی و بدون forward |
| payload تزریقی مستقیم به Nest شامل فیلد اضافه، نسخه متفاوت یا ادعای منبع | تصمیم DENY قبل از PEP |
| قطع منبع/Party | DENY و تماس صفر |
| پاسخ `ALLOW` یا `canGrantPermission=true` یا داده اضافی از upstream | پاسخ BFF مسدود؛ هیچ داده‌ای عبور نمی‌کند |
| تغییر محیط به Vercel/production | هر دو seam برابر DENY |
| درخواست ساختگی معتبر | فقط `SIMULATED_ALLOW` و نشانه بدون داده؛ اثر حقوقی NONE |
| مستندسازی و CI | SHA دقیق، Docker Release=0، مجموعه قبلی PASS، markers جدید PASS |

## ۶. ضمانت عدم دستکاری عملیات واقعی

در این PR هیچ تغییری به `apps/shareholder/app/api/**`، `services/api/src/module.ts`، `services/api/src/main.ts`، migration، RLS، policy واقعی، منابع CHILD06/07، معاملات یا حساب‌ها اعمال نمی‌شود. ماژول‌های جدید **توسط هیچ Route یا کنترلر زنده‌ای import نشده‌اند** و این شرط در unittest بررسی می‌شود. رکورد و شماره واقعی سهام، موبایل و توکن واقعی وجود ندارند.

زنجیره اصلی امنیت و نشست همچنان `HttpOnly cookie → BFF → Nest resolve_session → RLS inTenant` است، اما این فاز آن مسیر عملیاتی را تغییر یا از آن برای fixture استفاده نمی‌کند؛ یک طرح ادغام آینده در انتظار تأیید مستقل است.

## ۷. شروط مستقل پیش از هر اتصال واقعی

اتصال عملیاتی در مراحل بعد فقط با بازبینی مستقل مصوب منابع رسمی و رضایت/مجوزهای لازم، اثبات مالکیت و tenancy از داده‌های معتبر، RLS و audit بادوام، امنیت نشست، CSRF/reauth/idempotency/version، تفکیک عملیات، سیاست افشا، آزمون نفوذ، approvals حقوقی/هیئت‌مدیره و پذیرش دقیق Release قابل بررسی است. هیچ‌کدام از این موارد با این تست به طور خودکار احراز نمی‌شوند.

**وضعیت نهایی فعلی: فقط آزمون SYNTHETIC مجاز؛ فعال‌سازی واقعی ممنوع؛ Merge/Deploy ممنوع.**
