# W2.3 — قرارداد اتصال غیرفعال PEP/PDP به مرزهای BFF و NestJS

**تاریخ:** ۱ نوامبر ۲۰۲۶  
**مبنای پذیرفته‌شده:** W2.2، PR #71، SHA `609a06e17e8b65262566b94e272e539e95423ca5`  
**وضعیت:** DRAFT / CI-ONLY / DORMANT / NO ROUTE REGISTRATION / NO DOCKER  
**اثر حقوقی و معاملاتی:** NONE؛ هیچ مجوز دسترسی یا معامله واقعی صادر نمی‌شود.

## ۱. دلیل انتخاب این مرحله

موتور W2.2، درخواست مصنوعی را با فرایند مستقل Python، `AbortSignal`، کنترل مالکیت، توقف فرزند و ثبت ممیزی درون‌حافظه‌ای آزمایش کرد. اما اتصال آن به `apps/shareholder/app/api/...` یا `services/api/src/module.ts` در شرایط فعلی امن نیست: Routeهای فعلی `member-record` و `shareholding` دارای منطق مجزا و امکان رسیدن به منبع قانونی در صورت احراز شرایط خود هستند. بنابراین قبل از هر اتصال واقعی، قرارداد شش‌فیلدی، احراز دوباره در Nest، کنترل هم‌بستگی درخواست و سیاست «عدم ارتقای SIMULATED_ALLOW» باید تثبیت شوند.

## ۲. فایل‌ها و مرزهای مسئولیت

**BFF — `apps/shareholder/lib/w23-dormant-policy-boundary.ts`**

این ماژول **هیچ import در Route عملیاتی ندارد**. ابتدا نتیجهٔ گیت آزمایشی W1 را دریافت می‌کند؛ در حالت مناسب فقط یک **نامزد شش‌فیلدی** می‌سازد:

```text
contractVersion | environment | operation | tenantKey | ownerKey | requestId
```

شناسهٔ درخواست UUID سروری تولید می‌شود. کوکی، Authorization، Party، نقش، ادعای منبع و هدرهای کاربر هرگز به payload افزوده نمی‌شوند. `AbortSignal` فقط در حافظهٔ فرایند منتقل می‌شود و در JSON وجود ندارد. عملیات مجاز قرارداد صرفاً `read` ساختگی است.

**Nest — `services/api/src/w23-dormant-policy-boundary.ts`**

این ماژول در کنار سرویس واقعی قرار دارد، اما **در `AppModule` ثبت یا از کنترلر عملیاتی import نمی‌شود**. ورودی BFF صرفاً نامزد است، نه هویت یا مجوز. Nest با دادهٔ اثبات سروری ساختگی و مستقل، وضعیت نشست، تعاونی، مالکیت، Party، پذیرش منبع ساختگی، تازگی منبع، طبقه‌بندی، پرچم قابلیت و مجوز خواندن را مجدداً بررسی می‌کند. سپس تنها `SYNTHETIC_PDP_CANDIDATE` یا `DENY` می‌دهد.

پس از بررسی پاسخ PDP، Nest مجدداً خروجی را به هشت فیلد محدود و با UUID درخواست BFF هم‌بسته می‌کند. اعتبار این هم‌بستگی در این مرحله **فقط آزمایشی** است و معادل زنجیره ممیزی بادوام نیست.

**BFF — تفسیر نتیجه**

خروجی واقعی این ماژول فقط یکی از این دو پاسخ بسته است:

- `403 W23_OPERATIONAL_NOT_APPROVED` برای تصمیم مصنوعی معتبر؛ **حتی SIMULATED_ALLOW**.
- `503 W23_UPSTREAM_CONTRACT_INVALID` برای پاسخ فاقد قرارداد یا آلوده/متناقض.

هیچ مسیر `available:true`، HTTP 200 مجوزدهنده، دادهٔ سهامدار واقعی یا معامله وجود ندارد.

## ۳. مسیر آزمایشی GitHub

```
Synthetic HTTP client
    ↓
Ephemeral Node BFF (real NextRequest/NextResponse objects)
    ↓ W1 synthetic BFF identity/tenant/owner preflight
W2.3 detached actual-location BFF adapter
    ↓ six-field candidate only; AbortSignal stays out of JSON
Ephemeral Nest Fastify test controller (NOT AppModule)
    ↓ independent synthetic session/tenant/owner/source validation
W2.3 detached actual-location Nest adapter
    ↓
W2.2 cancellable Python PDP (fake bridge, no DB)
    ↓
Nest eight-field simulated-only decision normalization
    ↓
BFF always-closed verdict (403 or 503)
```

در این مسیر **هیچ source.read، SQL، درخواست به سرویس خارجی، معامله، پرداخت یا منبع رسمی** وجود ندارد. آزمون‌ها دو مالک مصنوعی در یک تعاونی، مالک و تعاونی نامعتبر، نقش و Party جعلی، پاسخ آلوده، تصمیم جعلی ALLOW، ابطال، Timeout و قطع قابلیت آزمایشگاهی را پوشش می‌دهند.

## ۴. کنترل‌های fail-closed و موارد ممنوع

۱. هیچ درخواست ناشناس، غیرمالک یا خارج از تعاونی نباید به Nest آزمایشی برسد.  
۲. هیچ فیلد اضافه، نقش، Party یا sourceApproved دریافتی از مرورگر در پیام داخلی پذیرفته نمی‌شود.  
۳. Nest باید هویت، مالکیت و منبع را مستقل از بسته BFF بررسی کند.  
۴. پاسخ مثبت PDP آزمایشی هرگز نمی‌تواند به HTTP 200، رکورد یا مجوز عملیاتی تبدیل شود.  
۵. پاسخ‌های ناقص، با UUID نامعتبر، دادهٔ اضافه، مالکیت نامعتبر، یا پایان مهلت باید fail-closed باشند.  
۶. در محیطی غیر از CI آزمایشی، ماژول از صدور نامزد تصمیم جلوگیری می‌کند.  
۷. هیچ import جدید در Routeهای `apps/shareholder/app/api` یا `services/api/src/module.ts` مجاز نیست.  
۸. هیچ کدام از گیت‌های حقوقی و عملیاتی پذیرفته نشده‌اند: منبع رسمی CHILD06/07، حساب حقیقی، سند مجوز، ثبت ممیزی پایدار، معاملات، پرداخت و تغییر حساب همچنان غیرفعال‌اند.

## ۵. معیار پذیرش

GitHub Actions باید بر **SHA دقیق PR** موفق شود و Build/TypeScript، Python static contract checks، آزمون Node با NextRequest و Nest Fastify، کنترل‌های W2.2 و سایر آزمون‌های موجود را بگذراند. مجموعه W2.2 باید در همین PR مجدداً با ۱۲ آزمون فرایند Python اجرا شود؛ صرفاً ارجاع به پذیرش تاریخی PR پیشین کافی نیست. هر شش مرحله Docker/PostgreSQL/OCI باید برای Draft این شاخه **Skipped** باشند. موفقیت Vercel Preview—even if any—جایگزین آزمون امنیتی نیست؛ اتصال خودکار Vercel ممکن است Preview را اجرا کند یا بر اثر سهمیه محدود شود.

## ۶. پیش‌نیازهای مرحله اتصال واقعی در آینده

اتصال عملیاتی نیازمند تصمیم مستقل است: تعیین مرجع احراز هویت و Party در Nest، تأیید منبع رسمی و محدوده افشا، سنجهٔ فیزیکی مراجعه به منابع، نسخه سیاست و مجوز قانونی هیأت‌مدیره، ذخیره امن و پایدار Audit، بازبینی RLS و سمت سرویس، بررسی امنیتی مستقل، آزمون کامل Release و مجوز صریح Merge/Deploy. **هیچ‌کدام با W2.3 فعال نمی‌شوند.**

**NO MERGE / NO MANUAL DEPLOY / NO DOCKER / NO REAL SHAREHOLDER DATA / NO TRADE / NO PAYMENT.**
