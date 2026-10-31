# گزارش رخداد W1 — عدم اثبات Fail-Closed کانتینر OCI API

**تاریخ:** ۳۱ اکتبر ۲۰۲۶  
**PR پایه:** #67 — `c535fc43a3ab9ee8bc1be551cdcbd77e51ee9938`  
**مرحله:** پیش از پذیرش Release کامل / محیط Docker Desktop ویندوز  
**وضعیت:** اصلاح محدود ثبت‌شده؛ **آزمون کامل SHA جدید هنوز انجام نشده است**.

## شواهد قطعی از گزارش کاربر

در اجرای نخست Docker برای SHA پایه، ساخت تصویر API موفق بود اما Docker Desktop هنگام `docker create --network none` برای API پاسخ `502 Bad Gateway` داد. این مرحله نه ورود موفق به API بود و نه شکست تصمیم PEP/PDP؛ یک خطای ایجاد کانتینر بود.

در اجرای مجدد در تاریخ ۳۱ اکتبر، `EXACT_SHA_VERIFIED=PASS`، `DOCKER_ENGINE_HEALTH=PASS`، `DOCKER_CONTAINER_CREATE=PASS` و هر سه `OCI_..._PASS` مربوط به پنل‌ها ثبت شد. تصویر چهارم (API) ساخته شد و کانتینر API بدون شبکه و بدون DB credentials ایجاد و start شد. سپس کد آزمون در `scripts/ci/local-release-helper.ps1` خطای `TTO_RELEASE_API_FAIL_CLOSED_NOT_PROVEN` داد؛ خروجی Release برابر ۱ بود و نشانگرهای زیر **وجود نداشتند**:

- `TTO_LOCAL_RELEASE_PASS_SHA=<SHA>`
- `TTO_LOCAL_RELEASE_OCI_FOUR_IMAGE_PASS`
- `TTO_LOCAL_RELEASE_OCI_API_DENY_PASS`

تمام نشانگرهای الزامی W1 که در Wrapper به‌عنوان Missing گزارش نشده‌اند، در خروجی ثبت شده بودند: ۱۱/۱۱ سناریو، جداسازی دو تعاونی، session revocation، منع معامله و Shadow PEP/PDP؛ **این موارد به‌معنای تکمیل Release نیست.**

## تفکیک علت مشاهده‌شده از فرضیه فنی

**قطعی:** شرط OCI برای API فقط وقتی PASS می‌شود که API بدون DB credentials با خروجی غیرصفر متوقف شده باشد **و** لاگ شامل متن `TTO_API_STARTUP_FAILED` یا `DATABASE_URL_NOT_CONFIGURED` باشد. خطای موجود به معنی `exitCode=0` **یا** نبود نشانگر در لاگ است؛ از گزارش ارسالی نمی‌توان تشخیص داد کدام اتفاق افتاده است.

**فرضیه محتمل:** در سورس قبلی، `DATABASE_URL_NOT_CONFIGURED` در constructor ارائه‌دهنده `Database` پرتاب می‌شود؛ Nest ممکن است هنگام مقداردهی اولیه وابستگی‌ها پیش از رسیدن به `main().catch` توقف را انجام دهد. در این شرایط، کد خروج غیرصفر ممکن است وجود داشته باشد اما نشانگر خطای استانداردِ قابل اثبات چاپ نشود. این علت **تأیید قطعی نشده** است چون لاگ خود کانتینر API قبل از cleanup به‌طور مستقیم ارائه نشده است.

## اصلاح محدود و قابل ممیزی

در `services/api/src/main.ts`، پیش از `NestFactory.create` اضافه شد:

```ts
if (!process.env.DATABASE_URL && !process.env.VERCEL) {
  throw Object.assign(new Error("DATABASE_URL_NOT_CONFIGURED"), {
    code: "DATABASE_URL_NOT_CONFIGURED"
  });
}
```

نتیجه مورد انتظار در صورت نبود DB و عدم اجرای Vercel: `main().catch` پیام امن `TTO_API_STARTUP_FAILED_CODE_DATABASE_URL_NOT_CONFIGURED` را بدون connection string، hostname، رمز یا stack trace چاپ کند و `process.exitCode=1` شود. این guard صرفاً اجرای بدون DB را می‌بندد؛ نه راه ورود جدید می‌سازد و نه کنترل‌های RLS، مالکیت، Party، source approval یا Nest API را تغییر می‌دهد. مسیر Vercel (که جداگانه گیت‌های اعتبارسنجی credential دارد) **بدون تغییر می‌ماند**.

همچنین `scripts/ci/w1-api-startup-failclosed.test.cjs` بعد از `pnpm build; pnpm check`، فایل واقعی `services/api/dist/main.js` را با environment کاملاً بدون DB و بدون Vercel اجرا می‌کند و سه کنترل دارد: exit code دقیقاً ۱، نشانگر خطای ثابت و عدم افشای credential. `scripts/ci/test_w1_api_no_db_failclosed.py` ترتیب کنترل قبل از Nest DI و ماندگاری گیت قبلی OCI را محافظت می‌کند.

## چه چیزی عمداً تغییر نکرده است

- `scripts/ci/local-release-helper.ps1`، شرط خروج غیرصفر، جست‌وجوی نشانگر fail-closed و چهار تصویر OCI **دست‌نخورده** است.
- هیچ Route عملیاتی Next، Nest AppModule، مجوز دسترسی، session verifier، منبع رسمی، داده سهامداران، database migration، RLS، خریدوفروش سهام یا پرداخت تغییر نکرده است.
- هیچ Merge، Deploy یا اتصال خارجی مجاز نشده است.

## معیار پذیرش دقیق

همان SHA جدید در Docker Release کامل، بدون skip، باید شامل موارد زیر باشد:

```text
TTO_W1_API_NO_DATABASE_DETERMINISTIC_FAILCLOSED=PASS
TTO_W1_API_NO_DATABASE_OPERATIONS=NONE
TTO_LOCAL_RELEASE_OCI_API_DENY_PASS
TTO_LOCAL_RELEASE_OCI_FOUR_IMAGE_PASS
TTO_W1_REAL_NEXT_NEST_PG17_CASES=11/11
TTO_W1_REAL_NEXT_NEST_PG17_ROUTES=PASS
TTO_W1_REAL_SOURCE_DISCLOSURE=ZERO
TTO_W1_SHADOW_PEP_PDP_NO_OPERATIONAL_ALLOW=PASS
TTO_LOCAL_RELEASE_PASS_SHA=<exact-new-SHA>
```

**شروط:** `RELEASE_EXIT_CODE=0`، همهٔ تست‌های پیشین، build، Chromium، هر چهار OCI، عدم Merge/Deploy و منع کامل منابع و معاملات واقعی.

اگر این اصلاح هم Release را موفق نکند، باید **قبل از تغییر امنیتی بعدی** کد خروج واقعی و متن sanitized `docker logs` کانتینر موقت API را از اجرای جداگانه در اختیار داشته باشیم. حدس بیشتر یا دورزدن گیت ممنوع است.
