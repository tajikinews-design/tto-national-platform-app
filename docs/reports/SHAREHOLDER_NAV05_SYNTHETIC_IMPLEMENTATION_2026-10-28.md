# TTO — NAV-05 اخبار و ارتباط با شرکت | اجرای مبتنی بر معماری مصوب

**تاریخ:** ۱۴۰۵/۰۸/۰۶ / 2026-10-28
**مبنا:** NAV-04 accepted visual, Draft PR #48 SHA `2b193b85b56cdfd95e1c8606cf7fdeffff16d954`.
**وضعیت:** `IMPLEMENTED_SOURCE_REVIEW_PENDING_LOCAL_RELEASE`. این سند ادعای تأیید حقوقی، اجرای واقعی ابلاغ یا تست Docker بدون خروجی ندارد.

## قراردادهای مرجع الزام‌آور
- `TTO-NAVIGATION-INFORMATION-ARCHITECTURE-v1.0.docx` (۱۱ ریشه و ۱۰ زیرمنوی NAV-05).
- `TTO-DASHBOARD-UI-IMPLEMENTATION-HANDOFF-v1.0.docx` (Do Not Redesign, one shared RTL system).
- `TTO-UNIFIED-IMPLEMENTATION-PACK-v1.0.docx` (CHILD-09, CHILD-10, CHILD-13, CF-05).
- `TTO-IMPLEMENTATION-SPECIFICATION-MASTER-v1.0.docx`.
- `TTO-PLATFORM-ARCHITECTURE-INTEGRATION-DECISION-REGISTER v1.0.docx`.

## وضعیت پیاده‌سازی
- **پیش‌نمایش اختصاصی:** `/review/interactive/nav-05`; صفحه واقعی Next و CSS، نه عکس یا صفحه صرفاً توصیفی.
- **سازه‌های مشترک با NAV-04:** `w1a-shell/sidebar/global-header/page-heading/kpi-row/four-panels/actions-row/review-toolbox` و فایل CSS تأییدشده NAV-04، بدون انتخاب Palette/Font جدید. تنها CSS مربوط به موضوع اخبار و ارتباطات افزوده شده است.
- **پیمایش:** هر ۱۱ ریشه قابل پیمایش در NAV-05؛ داشبورد تعاملی و پیوند موجود NAV-04 به NAV-05 متصل شده‌اند. تغییر در NAV-04 فقط **URL یک پیوند** است؛ PR48 و SHA پذیرفته‌شده آن دست‌نخورده‌اند.
- **ده زیرمنوی رسمی بدون حذف یا Rename:**
  1. اخبار شرکت — CHILD09
  2. اطلاعیه‌ها — CHILD09
  3. ابلاغ‌های مهم — CHILD09 / Notice Assurance
  4. پیام‌های نیازمند تأیید — CHILD09 / Notice Assurance
  5. نظرسنجی‌ها — CHILD13
  6. صدای من — CHILD13
  7. پیشنهادهای من — CHILD13
  8. پاسخ مدیریت — CHILD13
  9. تیکت‌های من — CHILD10
  10. اعلان‌ها — CF05 (فقط کانال/Delivery؛ منبع خبر نیست).
- **رفتار اجرایی Preview:** نمایش Hero، ۴ KPI، ۴ پنل، ۴ دسترسی سریع، ده تب رسمی، فهرست و جست‌وجوی محلی، جزئیات قابل باز/بسته‌شدن، واکنش‌گرایی و دسترس‌پذیری کیبورد؛ ۱۳ `DEMO-*` رکورد کاملاً مصنوعی.
- **گیت‌های نمایش:** `UNVERIFIED` به‌عنوان default، `SOURCE_UNAVAILABLE` و `DEMO_CONTENT` فقط پس از انتخاب صریح ابزار بازبینی. هیچ مقدار فاقد منبع به‌صورت صفر یا وضعیت تحویل/مطالعه/تأیید رسمی نمایش داده نمی‌شود.
- **مرز عملیاتی:** هیچ `fetch` یا `POST`/فرم، بارگذاری پیوست، ثبت تیکت، ارسال پاسخ، نظرسنجی، ابلاغ، دانلود، ACK یا پیامک وجود ندارد. دکمه‌های عملیات disabled؛ هیچ API یا migration یا Rule جدیدی ساخته نشده است.
- **مالکیت داده:** Child09 محتوای خبر، وضعیت انتشار و مخاطب را مالک است؛ Notice Assurance شواهد تأیید را؛ Child10 تیکت و SLA را؛ Child13 نظر غیرحقوقی و Proposal را؛ CF05 ارسال فنی را. هیچ‌‌کدام با NAV04 دعوت و رأی‌گیری حقوقی و NAV09 افشای اسناد ادغام نشده‌اند.

## مسیرهای افزوده
- `apps/shareholder/app/review/interactive/nav-05/page.tsx`
- `apps/shareholder/app/review/interactive/nav-05/synthetic-communications.tsx`
- `apps/shareholder/app/review/interactive/nav-05/communications-fixtures.ts`
- `apps/shareholder/app/review/interactive/nav-05/communications.css`
- `scripts/ci/test_shareholder_w1_nav05.py`
- `scripts/e2e-shareholder-nav05-review.cjs`
- `scripts/ci/run-nav05-approved-visual-release.ps1`

## گیت‌های اجباری
1. `python3 -m unittest scripts.ci.test_shareholder_w1_nav05 -v` و کل suite `scripts/ci/test_*.py`.
2. `node scripts/ci/verify-shareholder-tsx.cjs`, `pnpm build`, `pnpm check`.
3. `node scripts/smoke-next-otp.mjs`، شامل پاسخ HTTP و ممنوعیت انتشار نمونه در حالت پیش‌فرض.
4. `scripts/ci/run-local-docker.ps1 -Suite Release -ExpectedCommit <exact-SHA>` در Worktree ایزوله؛ کل suites قبلی، PG17، ۴ OCI، Chromium NAV03/NAV04/NAV05.
5. Chromium NAV05: ۱۴۴۰، ۱۵۳۶، ۷۶۸، ۳۹۰، ۳۲۰؛ تعامل ده زیرمنو در دسکتاپ و موبایل؛ عدم POST، عدم اتصال خارجی، نبود overflow؛ پنج اسکرین‌شات SHA256.
6. `run-nav05-approved-visual-release.ps1` برای خواندن Log واقعی، اعتبارسنجی SHA و ZIP و ثبت نتیجه.
7. بازرسی بصری انسانی در پنج Viewport، همراه با مقایسه با طرح پذیرفته‌شده NAV04، پیش از هر پذیرش بصری/ادغام/استقرار.

## موارد عمداً مسدود
- اتصال واقعی به CHILD09 (GET موجود `/api/tenants/:tenantId/me/notices` همچنان DENY).
- ثبت خبر/انتشار رسمی، کمپین ابلاغ، مخاطب قطعی، recipient snapshot، یادآور واقعی، تضمین تحویل/READ/ACK و evidence package.
- ارسال Ticket یا پاسخ و SLA عملیاتی CHILD10؛ ارسال پاسخ نظرسنجی/پیشنهاد CHILD13.
- مجوزهای قانونی/ناشر/مدارک Child09 و دسترسی دانلود CF03 و کانال واقعی CF05.
- استفاده عمومی از Preview بدون Deployment Protection SSO. `robots:noindex` مجوز دسترسی نیست.

**قانون پذیرش:** آزمون سبز فقط طراحی و اجرای آزمایشی روی SHA ثابت را تأیید می‌کند؛ هیچ تأیید حقوقی یا منبع واقعی ایجاد نمی‌کند. تا دریافت لاگ Release و تصاویر **PASS اجرایی و بصری قابل ادعا نیست**. PR باید Draft و بدون Merge/Deploy بماند.
