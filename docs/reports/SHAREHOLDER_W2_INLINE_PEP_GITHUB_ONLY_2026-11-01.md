# TTO / W2 — آزمون درون‌مسیر PDP/PEP در GitHub Actions بدون Docker

**تاریخ شروع:** ۱ نوامبر ۲۰۲۶  
**SHA پایه پذیرفته‌شده:** `40c07a8a972647c3247cc30890f7237b209b7a98`، PR #68  
**محیط:** GitHub Draft PR، فقط Python/Node 22 و کتابخانه‌های Next/Nest؛ **بدون اجرای Docker، بدون PostgreSQL، بدون Merge و بدون Deploy**.  
**وضعیت:** کدنویسی و آزمون‌های آفلاین تعریف شده؛ وضعیت GitHub Actions باید جداگانه تأیید شود.

## ۱. تحویل این مرحله

این مرحله برای اولین بار در محیط **آزمایشگاهی و موقت**، تصمیم PDP/PEP را **داخل مسیر درخواست HTTP** و پیش از مراجعه به منبع مصنوعی اعمال می‌کند؛ برخلاف مرحله W1 که تصمیم PEP/PDP در آزمون مسیرهای اصلی صرفاً shadow بود.

زنجیره آزمایش:

```
Synthetic HTTP client
  → Node HTTP wrapper using real NextRequest + NextResponse
  → in-memory BFF session / tenant / owner gate from W1
  → real NestJS Fastify TEST controller (not AppModule)
  → W2 inline fail-closed enforcer
  → accepted W1 Python PDP/PEP via private subprocess (no real source)
  → allowlisted in-memory audit BEFORE source
  → synthetic source.read (in-memory only; never DB)
```

با وجود استفاده از NextRequest و Nest واقعی، این آزمایش **نه Next production App Router** است و نه مسیر API عملیاتی Nest. به هیچ‌کدام از Routeهای اپلیکیشن یا `services/api/src/module.ts` وصل نشده است.

## ۲. اثبات تفکیک مالکیت

هر دو کاربر تستی در یک تعاونی ساختگی `coop-test-A` هستند، اما:
- کاربر A فقط `fixture-owner-A` را می‌بیند.
- کاربر B فقط `fixture-owner-B` را می‌بیند.
- تلاش متقابل دو کاربر برای مشاهده اطلاعات دیگری، **قبل از ارسال درخواست به Nest** رد می‌شود.
- Nest نیز هویت داخلی را با یک handle سروری صرفاً آزمایشی از حافظه بازسازی می‌کند و شناسه Party/Owner در هدرهای مرورگر را معتبر نمی‌داند.
- پاسخ مجاز فقط یک نشانگر آزمایشی و مقدار `data:null` دارد؛ هیچ رکورد، مانده سهام، شناسه واقعی یا اطلاعات کاربری ارسال نمی‌شود.

## ۳. گیت عدم مراجعه به منبع

در `scripts/security/w2-inline-synthetic-enforcer.cjs`:

- نامزد تصمیم فقط پنج فیلد مجاز دارد: `contractVersion,environment,operation,ownerKey,tenantKey`.
- tenant، owner و Party فقط از proof مستقل سروریِ ساختگی بررسی می‌شوند.
- فقط عملیات `read` در حالت `SIMULATION` می‌تواند به `SIMULATED_ALLOW` ختم شود.
- خطای PDP، timeout، پاسخ ناامن، خطای ممیزی، تغییر محیط، گم‌شدن source approval ساختگی، عملیات download/export/write/trade/finalize و خطای نشست باید DENY باشند.
- ثبت رویداد ممیزی مجازشده پیش از `source.read` انجام می‌شود؛ لاگ فقط `requestId,operation,decision,reasonCode` است.
- مراجعه به منبع در سناریوی DENY باید صفر باشد؛ **این عدد فقط شمارندهٔ منبع مصنوعی در حافظه است، نه شمارنده SQL واقعی.**
- `SIMULATED_ALLOW` هیچ اثر حقوقی ندارد؛ `canGrantPermission=false` و `legalOperationalEffect=NONE` ثابت‌اند.

## ۴. GitHub Actions بدون Docker

در `.github/workflows/tto-adaptive-ci.yml` تنها برای **Draft PR با نام دقیق شاخه** `test/w2-inline-pep-offline-20261101` یک وضعیت W2 بدون Docker افزوده شده است. این کار سایر PRها یا اجرای `workflow_dispatch` را تغییر نمی‌دهد.

در W2 Draft:
- آزمون‌های عمومی Python و بررسی manifestها اجرا می‌شوند.
- Node 22، نصب وابستگی‌ها، build و typecheck اجرا می‌شوند.
- تست W2 به‌صورت `node --test scripts/ci/w2-inline-lab-http.test.cjs` اجرا می‌شود.
- شش مرحله‌ای که به Docker/PostgreSQL/OCI متکی هستند فقط برای این شاخه Draft اجرا نمی‌شوند.
- **هیچ‌یک از مراحل Release کامل حذف نشده‌اند** و این نتیجه مجوز merge نیست. با خارج‌شدن از حالت Draft، معافیت Docker از بین می‌رود؛ اما تا دستور بعدی کاربر، PR باید Draft بماند.

## ۵. وضعیت آزمون و پذیرش

مارکرهای لازم برای پذیرش فاز آفلاین W2:

```
TTO_W2_ANONYMOUS_ZERO_NEST_TOUCH=PASS
TTO_W2_SAME_TENANT_TWO_OWNERS_ISOLATED=PASS
TTO_W2_INLINE_DENIED_SOURCE_TOUCHES=0
TTO_W2_PDP_FAILURE_AND_TIMEOUT_DENY=PASS
TTO_W2_AUDIT_FAILURE_FAIL_CLOSED=PASS
TTO_W2_MUTATING_AND_EXPORT_OPERATIONS_CLOSED=PASS
TTO_W2_PRODUCTION_LAB_GATE_CLOSED=PASS
TTO_W2_INMEMORY_AUDIT_ALLOWLIST=PASS
TTO_W2_INLINE_POLICY_BEFORE_SOURCE=PASS
TTO_W2_SYNTHETIC_ONLY_NO_OPERATIONAL_ALLOW=PASS
TTO_W2_NO_DB_NO_DOCKER_NO_DEPLOY=PASS
TTO_W2_GITHUB_ACTIONS_NO_DOCKER=PASS
```

GitHub Actions باید نتیجهٔ مثبت آزمون Python، Node، build و typecheck را ثبت کند. بدون شواهد اجرای واقعی Job نباید `PASS` اعلام کرد.

## ۶. موارد اثبات‌نشده یا ممنوع

- اجرای درون‌مسیر PEP در **Route واقعی اپلیکیشن** هنوز وجود ندارد؛ این مرحله یک قرارداد اجرایی آزمایشگاهی است.
- آزمون مثبت مالکیت با دو کاربر **واقعی** و دو پروندهٔ منبعِ مورد تأیید وجود ندارد.
- هیچ ممیزی بادوام، RLS واقعی یا اثبات شمارش SQL وجود ندارد.
- هیچ حساب، سهم، پرداخت، خریدوفروش یا منبع رسمی مجاز نشده است.
- تا دستور کاربر **Docker در GitHub برای این PR نیز ممنوع** است؛ Release کامل و گیت‌های OCI قبلی به‌عنوان پیش‌نیاز احتمالی پیش از Merge باقی می‌مانند.
- هرگونه Merge، فعال‌سازی یا Deploy ممنوع است.

**تصمیم:** این مرحله را فقط می‌توان با عنوان `W2 Offline Inline Policy Lab` و پس از تأیید آزمون GitHub Actions پذیرفت؛ نه `Production Inline Authorization`.
