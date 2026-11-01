# W2.2 — فراخوانی غیرهمگام، قابل لغو و محدود به مهلت PDP

**مبنا:** PR #70، SHA `ac4a94c93d15c141844a95cab80a2223fcd9a548` (پذیرش آزمایشگاهی W2.1 در GitHub Actions).  
**محدوده:** آزمایش کاملاً ساختگی در GitHub Actions، بدون Docker، PostgreSQL، منابع رسمی، Merge یا انتشار عملیاتی.

## مسئله حل‌شده

در W2.1، شبیه‌ساز W1 Python از طریق `spawnSync` اجرا می‌شد. محدودیت `Promise.race` جلوی ادامه تصمیم پس از یک پاسخ دیرهنگام را می‌گرفت اما **اجرای همگام Python قابل توقف فوری با AbortSignal نبود**. همچنین باید لغو درخواست از BFF به کنترلر آزمایشگاهی Nest و از آنجا به فرایند PDP منتقل شود.

## معماری پیاده‌سازی W2.2

```
Synthetic browser request
  → temporary HTTP BFF using NextRequest / NextResponse
  → synthetic Nest Fastify controller (NOT AppModule)
  → W2 synthetic inline PEP + AbortController + monotonic deadline
  → child_process.spawn('python3', ['-m','scripts.security.w1_isolated_http_bridge'])
  → W1 synthetic PDP/PEP (read-only demo)
  → allowlisted in-memory audit
  → synthetic in-memory source counter
```

لایه PDP این بار یک **فرایند فرزند غیرهمگام واقعی** است: فرمان و آرگومان‌ها ثابت‌اند، `shell:false` است، محیط فرزند از فهرست حداقلی ساخته می‌شود و هیچ متغیر حاوی رمز، توکن، اتصال DB یا URL منبع به فرزند منتقل نمی‌شود. stdin حداکثر ۸۱۹۲ بایت و خروجی حداکثر ۸۱۹۲ بایت است.

هر فرایند شروع‌شده در مجموعه‌ای داخلی ثبت و در رخداد `close` حذف می‌شود. اگر `AbortSignal` فعال شود، فرایند با `SIGKILL` متوقف می‌گردد و درخواست بلافاصله DENY می‌شود. آزمون‌ها بررسی می‌کنند که فرایندهای فرزند پس از لغو در Runner جمع‌آوری شوند.

## کنترل‌های پایان مهلت و لغو

- **قطع درخواست:** رویداد بسته‌شدن اتصال HTTP بین BFF و NestJS به AbortController آزمایشی Nest منتقل می‌شود؛ درخواست لغوشده نباید منجر به `source.read` شود.
- **آزمون اتصال HTTP واقعی آزمایشی:** کلاینت در میانه انتظار PDP اتصال خود به BFF را قطع می‌کند؛ آزمون باید نشان دهد این لغو قبل از Deadline به Nest و فرایند Python منتقل شده، فرزند خاتمه یافته و شمارنده منبع صفر مانده است.
- **پایان مهلت:** هم Promise ردکننده و هم `AbortController` فعال می‌شوند. زمان سپری‌شده با `performance.now()` بررسی می‌شود تا پاسخ مثبت پس از Deadline معتبر نشود.
- **نتیجه دیرهنگام:** حتی اگر ارائه‌دهنده آزمایشی به AbortSignal بی‌اعتنا باشد، `Promise.race` و کنترل مجدد مهلت پیش از `source.read` آن را فاقد اثر می‌کنند.
- **تغییر مالکیت/مجوز:** snapshot مربوط به نشست/tenant/owner/Party/source و Permission که در W2.1 اضافه شده بود، بعد از PDP و بعد از ممیزی دوباره کنترل می‌شود.
- **خرابی حمل‌ونقل:** خطای اجرای subprocess، پاسخ غیر JSON، پاسخ با schema نادرست و خروجی بزرگ‌تر از سقف مجاز با DENY پایان می‌یابند.
- **هم‌زمانی:** دو درخواست برای دو مالک مصنوعی در یک تعاونی تست می‌شوند؛ لغو یکی، به دیگری اجازه دسترسی اضافه نمی‌دهد.

## آزمون‌ها

- `scripts/security/w2-2-cancellable-pdp-provider.cjs`: ارائه‌دهنده child-process با نظارت بر فعال‌بودن و خاتمه فرزند.
- `scripts/ci/w2-2-cancellable-pdp-fixture.cjs`: فرایند مهاجم مصنوعی که عمداً هنگ، دیرپاسخ، crash، JSON نادرست، schema نامعتبر یا خروجی بیش‌ازحد تولید می‌کند؛ **هیچ شبکه یا داده‌ای ندارد**.
- `scripts/ci/w2-2-cancellable-pdp.test.cjs`: اجرای مستقیم فرایند واقعی Python و آزمون خطا/لغو/Deadline/هم‌زمانی و جمع‌آوری فرزندان.
- `scripts/ci/w2-inline-lab-http.test.cjs`: به‌روزرسانی زنجیرهٔ آزمایشی HTTP به `spawn` غیرهمگام و انتقال درخواست لغوشده در مرزها.
- `scripts/ci/test_w2_2_cancellable_pdp.py`: شش کنترل ساختاری برای جلوگیری از ورود W2.2 به Routeهای تولید و حفظ no-Docker.
- `.github/workflows/tto-adaptive-ci.yml`: فقط برای شاخه **Draft** `test/w2-2-cancellable-pdp-no-docker-20261101`، آزمون‌های Node و Python را فعال نگه داشته و شش گام Docker/Postgres/OCI را Skipped می‌کند.

## معیار پذیرش

موفقیت فقط با اجرای GitHub Actions روی **SHA دقیق HEAD**، exit موفق، انجام build/typecheck و تست‌های Python، حضور مارکرهای W2/W2.1/W2.2 و تأیید `skipped` برای همه شش مرحله Docker پذیرفتنی است.

## مرز اثبات

این فاز **در مسیر آزمایشگاهی** انجام می‌شود و نه در Next App Router یا Nest AppModule عملیاتی. شمارنده‌ها فقط منبع حافظه‌ای ساختگی هستند؛ ردیابی فیزیکی SQL، مجوز داده‌های رسمی CHILD06/CHILD07، ممیزی بادوام و هویت واقعی اثبات نشده است. فرایند child در Runner لینوکس آزموده می‌شود و تضمین لغو process tree در تمام سیستم‌عامل‌ها از این نتایج به دست نمی‌آید. لغو درخواست امکان بازگرداندن عملیاتی که قبلاً کامل شده را ایجاد نمی‌کند.

**NO DOCKER / NO DB / NO REAL SHAREHOLDERS / NO TRADE / NO PAYMENT / NO MERGE / NO MANUAL DEPLOY.** موفقیت آزمایشی معادل فعال‌سازی عملیاتی نیست.
