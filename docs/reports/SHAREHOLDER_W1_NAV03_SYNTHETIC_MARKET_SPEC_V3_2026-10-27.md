# W1-NAV03 — اجرای نمای تعاملی خریدوفروش سهام بر اساس Specification رسمی v3.0

**پروژه:** پلتفرم ملی تعاونی توسعه عمران  
**تاریخ:** ۱۴۰۵/۰۸/۰۵ / 2026-10-27  
**وضعیت:** `IMPLEMENTED_CANDIDATE / PENDING_EXACT_SHA_PYTHON_NEXT_DOCKER_RELEASE`  
**پایه‌ی دست‌نخورده:** W1-NAV02 SHA `5f6871f98c07df0b77a54c4c0281a600eebdcc23`، PR #40، پذیرش محلی بر اساس لاگ کاربر.  
**مسیر آزمایشی:** `/review/interactive/nav-03` زیر چیدمان بازبینی `robots:noindex`؛ **noindex کنترل دسترسی نیست**.

## ۱. مستند مرجع دقیق

برخلاف مراحل قبلی که فقط فهرست دامنه را داشتند، در NAV-03 **متن خود سند نهایی** بررسی شد:

- نام رسمی: `TTO-SHARE-MARKET-SPEC v3.0`
- نام فایل: `TTO-Share-Market-Spec-v3.0.docx`
- مرجع موجود در Google Drive: `1JIjvMiIF7MzbO66ZXsIKWFEUNTjZuIF-`
- اثرانگشت ثبت‌شده در ممیزی سند به تاریخ 2026-10-22: SHA-256 `2901deeba29f86a5ba24dd9f047aa4ed36463037fdd8914d0f67089338c9f30a`.
- فصل‌های مستقیماً مورد استفاده: ۳ (Legal Guide)، ۷–۱۵ (مالکیت، قفل، عرضه/صف/قیمت/درخواست خرید)، ۱۶–۲۸ (صلاحیت/تأیید/پرداخت/دفتر سهام/Finalization)، ۳۶–۴۲ (State Machine، Action Owner، Timeline، لغو/اختلاف)، ۴۸–۵۱ (معیارهای پذیرش و فرایند).
- استفاده از این مرجع به معنای اجرای تصمیم‌های عملیاتی یا تأیید legal gate واقعی نیست.

## ۲. مسیر مستقل فروشنده

در صفحه آزمایشی، ۷ مرحله نمایشی به ترتیب قرارداد رسمی پیاده‌سازی شده‌اند:

`SELL_REQUEST_SUBMITTED → SELL_ELIGIBILITY_REVIEW → SHARES_LOCKED → MARKET_QUEUE → MARKET_SCHEDULED → PRICING_RULE_REVIEW → LISTED`

این‌ها **خلاصه نمایشی** Stateها و کنترل‌های مصوب هستند، نه State Machine معاملاتی زنده یا افزودن مرحله حقوقی جدید. State Machine رسمی Offer همچنان مطابق فصل ۳۶ سند مبنا است.

فرم نمونه شامل تعداد سهم، تاریخ درخواست، `FULL_OFFER`، پذیرش سیاست بازار، وضعیت آزادبودن سهم و منبع قیمت است. قیمتِ دلخواه کاربر وجود ندارد. صف پیش‌فرض `FIFO` طبق سیاست معتبر تعاونی و ETA فقط تقریبی است. قفل سهم و قرار گرفتن در صف حتی در محیط واقعی مالکیت فروشنده را تغییر نمی‌دهد.

## ۳. مسیر مستقل خریدار

۲۱ وضعیت مرجع Trade طبق فصل ۳۷ مستقیماً در کاتالوگ UI قرار گرفته‌اند:

```
BUY_REQUESTED → SHARES_RESERVED → AUTO_VALIDATION → COOP_REVIEW
→ BOARD_APPROVAL_PENDING → PRE_APPROVED → SELLER_CONTINUATION_PENDING
→ PAYMENT_PENDING → PAYMENT_REPORTED → PAYMENT_CONFIRMATION_PENDING
→ PAYMENT_CONFIRMED → FEES_RESOLUTION_PENDING → READY_FOR_TRANSFER
→ APPOINTMENT_PENDING → APPOINTMENT_SET → TRANSFER_FORMALITIES
→ REGISTER_ENTRY_PENDING → REGISTER_RECORDED → FINAL_APPROVAL_PENDING
→ FINALIZING → COMPLETED
```

کاربر آزمایشی می‌تواند فقط شرح هر مرحله، متولی اقدام (`next_action_owner`)، شواهد لازم و معنای حقوقی آن را مشاهده کند. در این صفحه `COMPLETED` صرفاً نام یک گام سناریوی خیالی است و **هیچ انتقال مالکیت رخ نمی‌دهد**. درخواست خرید و رزرو، تأیید تعاونی و هیئت‌مدیره، ادامه فروشنده، اعلام پرداخت، تأیید وصول، ثبت دفتر، تأیید نهایی و تسویه اتمیک مستقل نگه داشته شده‌اند.

مجازبودن خریدار عضو/غیرعضو، سقف قانونی، منبع قیمت، مرجع هیئت‌مدیره، کارمزدها و مشخصات بانکی در این نمونه **تأیید نشده** است؛ نمونه داده‌ها فقط برای مطالعه ساختار فرم و برچسب‌ها هستند. اطلاعات بانکی واقعی در دسترس عمومی نمایش داده نمی‌شود.

## ۴. مرزهای قانونی و مالی

- CTA با نام «ثبت درخواست خرید» است نه «خرید قطعی»؛ هر دو دکمه فروش/خرید در preview `disabled` هستند.
- ثمن فقط به صورت **Buyer → Seller** در فرایند واقعی پرداخت می‌شود. هزینه‌های معتبر جدا به مرجع مجاز تعاونی می‌روند.
- `PAYMENT_REPORTED ≠ PAYMENT_CONFIRMED ≠ OWNERSHIP_TRANSFERRED`.
- `BOARD_APPROVAL` یک پرونده مستقل با مستند مصوبه است؛ `REGISTER_RECORDED` بدون `FINALIZING` کافی نیست.
- `FINALIZING` در اجرای عملیاتی منوط به پذیرش قانونی، تسویه هزینه‌ها، نبود اختلاف، تأیید وجه، ثبت دفتر و تراکنش اتمیک Backend است.
- `LEGAL_GATE-CAPITAL-COMMITMENT-PRICE` حل‌نشده، به خودکارسازی فرمول بدهی یا کسر اجباری سهم تبدیل نمی‌شود؛ راهکار تسویه تعهد داوطلبانه از عملیات بازار جداست.
- تعهد سرمایه، حسابداری عمومی شرکت، کیف پول، صندوق نگهداری وجه و خدمات بانکی داخلی خارج از ماژول‌اند.

## ۵. تغییرات فنی

- `apps/shareholder/app/review/interactive/nav-03/market-flow-model.ts`: کاتالوگ نمایش فروش و ۲۱ وضعیت Trade، نقش اقدام، شرح و شواهد.
- `apps/shareholder/app/review/interactive/nav-03/synthetic-share-market.tsx`: دو مسیر مستقل، جدول اطلاعات لازم، توضیح گام، حالت‌های توقف، Legal Guide و دکمه‌های غیرعملیاتی.
- `apps/shareholder/app/review/interactive/nav-03/page.tsx` و `market.css`: مسیر نمونه، RTL و موبایل.
- افزودن پیوند از NAV02 به NAV03 با حفظ حالت NAV01/02.
- `scripts/ci/test_shareholder_w1_nav03.py`: ۱۲ آزمون امنیتی، قراردادی و ترتیب State Machine، بدون درخواست شبکه و عملیات مالی.
- `scripts/ci/verify-shareholder-tsx.cjs`: TSX جدید تحت کنترل AST.
- `scripts/smoke-next-otp.mjs`: بررسی واقعی HTTP 200 صفحه و برچسب‌های مرز حقوقی در build Next.

**فایل‌هایی که عمداً تغییر نکرده‌اند:** `services/api/**`، `database/migrations/**`، `apps/shareholder/app/api/**`، `packages/ui/src/shareholder-read-models.tsx`، سیستم احراز هویت، Party/Tenant و Source Gates.

## ۶. گیت ورود به پذیرش

- Python discovery جدید + تمامی آزمون‌های قدیمی موفق.
- Build/TypeScript AST و smoke واقعی `GET /review/interactive/nav-03` موفق.
- Docker Core و Release + PostgreSQL17/Chromium + چهار تصویر OCI در SHA جدید موفق.
- بازبینی بصری مستقل موبایل/دسکتاپ/کیبورد و اخذ شواهد.
- حفاظت صفحه Preview و Hosted CI مستقلاً تعیین تکلیف شوند؛ `noindex` کنترل حریم خصوصی نیست.
- تمام ۱۹ کنترل منبع عضویت/دفتر سهم و ۱۵ کنترل مستقل معاملات/اعلان در `PENDING/BLOCKED` باقی بمانند.

**هیچ یک از آزمون‌های اجرای واقعی روی Commit جدید هنوز مشاهده نشده است.** تا آن زمان این تغییر `DRAFT / IMPLEMENTED_NOT_ACCEPTED` است و ادغام یا استقرار مجاز نیست.

## ۷. مرحله بعد

پس از پذیرش فنی NAV03، تکمیل آزمایشی جزئیات درخواست و Timeline شامل حالت‌های پرداخت مورد اختلاف، لغو و رسیدگی دستی، بدون اتصال به سرویس واقعی؛ سپس بازبینی طراحی NAV04. اجرای عملی خریدوفروش، بعداً و فقط پس از پرونده مستقل تصویب قانونی، اتصال منبع معتبر و تأیید رسمی مالک محصول می‌تواند موضوع PR دیگری باشد.
