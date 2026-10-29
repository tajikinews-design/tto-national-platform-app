# TTO — پنل سهامدار | طرح گیت‌های عملیاتی NAV-01 تا NAV-11 (نسخه 0.1، صرفاً پیشنهادی)
**تاریخ:** 2026-10-29  
**مبنای UI پذیرفته‌شده:** `a443247be2e878162fde11f40f91d20fad7ab684` (Synthetic Review Shell)  
**وضعیت این سند:** DESIGN_PROPOSAL / NO_LIVE_APPROVAL / NO_RUNTIME_CHANGE  
**مرجع اصول:** `docs/analysis/NAVIGATION_CONTRACT.json`، `docs/contracts/shareholder-source-readiness-phase4d-v1.json`، `docs/reports/SHAREHOLDER_ARCHITECTURE_CONSOLIDATION_PHASE4C_4G_2026-10-27.md`، `docs/architecture/ADR-001-FINAL-STACK.md`.

> این سند **مجوز اجرایی نیست**. نام API و permission و انواع داده در جداول زیر **candidate** هستند؛ نام‌های رسمی و سطوح اختیار آنها به تصویب مستقل نیاز دارند. در قرارداد مصوب فعلی `authoritative_routes=null` و `permission_policy=null` برای هر ۱۱ NAV است؛ این فایل نباید آن مقادیر را عوض کند. هیچ endpoint عملیاتی جدید، RLS، کد پرداخت، تولید، یا اتصال داده واقعی ایجاد نمی‌شود.

## ۱. اصول الزام‌آور و ترتیب گیت‌ها
۱. **Identity/Session**: اعتبارسنجی سرور، session فعال و revocable، وضعیت OTP مناسب عملیات؛ نشست/نقش به‌تنهایی دلیل عضویت یا مالکیت سهم نیست.  
۲. **Tenant/Party/Subject**: انتخاب تعاونی در سمت سرور؛ پیوند احرازشده user↔party↔member/shareholder-account؛ مجوز هر tenant مستقل؛ حداقل‌سازی داده.  
۳. **Permission + Feature gate**: `default DENY`؛ حق نمایش منو، حق خواندن داده، حق دانلود فایل و حق تغییر وضعیت، **چهار تصمیم مستقل** هستند.  
۴. **Legal/Source**: مالک منبع، قرارداد و نسخه داده، مرجع تصویب مستقل، سند مبنای قانونی، دامنه مخاطب، انقضای تصویب، حق اصلاح/ابطال و ردپا. Approvals به تفکیک `tenant×source×operation×version`.  
۵. **Request-time enforcement**: اعمال permission و tenant/party scope در BFF/Nest و PostgreSQL RLS با نقش اپلیکیشن بدون `BYPASSRLS`؛ هیچ اعتماد به اطلاعات tenant در URL یا payload بدون تطبیق نشست.  
۶. **Document/Export**: حق مشاهده فهرست با حق دریافت محتوا برابر نیست؛ دانلود با مجوز مستقل و لینک کوتاه‌مدت؛ سند خصوصی نیازمند classification و audit.  
۷. **Mutation safety**: CSRF، re-auth و MFA متناسب با خطر، idempotency، قفل/نسخه خوش‌بینانه، ثبت Audit + outbox برای رویدادهای تغییرناپذیر و حق rollback/correction.  
۸. **Policy version**: ناوبری، مسیرهای عملیاتی، مجوزها و feature gates باید نسخه‌دار و هم‌آهنگ منتشر شوند (NAV-R10).  
۹. **Fail-closed**: نبود اطلاعات ≠ صفر قطعی؛ عدم دسترس/عدم تأیید/منقضی/عدم مجوز با حالت‌های متمایز و بدون افشای اطلاعات محرمانه.  
۱۰. **محدوده مالی**: MVP مالی فقط گردش‌کار مصوب درخواست خرید/فروش سهم؛ **بدون کیف پول، امانت‌داری وجوه، تسویه درون پلتفرم یا حسابداری عمومی تعاونی**. Financial statements صرفاً افشای مجاز به سهامداران است.

### ماشین حالت مشترک پیشنهادی
`DESIGN_ONLY → LEGAL_SOURCE_REVIEW → TECHNICAL_ADMISSION → STAGING_VERIFIED → RELEASE_AUTHORIZED → LIVE`  
مسیر `REVOKED / EXPIRED / SUSPENDED` از هر حالت داده‌محور باید به `DENY` بازگردد. هیچ گذار خودکاری از `CI_PASS` یا `PR_MERGE` به `LIVE` مجاز نیست.

### نوع پاسخ استانداردِ پیشنهادی
- `200`: تنها پس از permission و source/authority verified؛ با `dataVersion`, `sourceAsOf`, `tenantScope`, `classification` و `requestId`، در صورت تناسب با دامنه.
- `401`: نشست نامعتبر/منقضی.
- `403`: منع عملیات/منبع/اختیار، بدون افشای وجود پرونده شخص دیگر.
- `404`: عدم وجود رکورد در حوزه مجاز، در صورت سیاست نشت اطلاعات.
- `409`: تعارض نسخه، مهلت یا idempotency.
- `423` یا وضعیت دامنه مورد تصویب: قفل قانونی/عملیاتی فقط در صورت لزوم؛ **انتخاب نهایی کد پاسخ مستلزم قرارداد API**.
- `503`: منبع معتبر موقتاً غیرقابل دسترسی؛ هرگز با صفر یا نتیجه جعلی جایگزین نشود.

## ۲. مرزبندی مسیرها
- `/review/**` و `/review/interactive/**` فقط صفحات نمونه‌اند؛ **هرگز authoritative نیستند**.
- قرارداد APIهای زیر صرفاً **namespace پیشنهادیِ نسخه‌دار** است: `/api/v1/tenants/:tenantId/me/...`. سمت سرور tenant را از نشست و مرجع مجوز تطبیق می‌دهد.
- مسیرهای `GET .../member-record`, `GET .../shareholding`, `.../trade-requests`, `.../notices` در معماری قبلی به‌صورت candidate/safe-fail شناسایی شده‌اند؛ این سند آنها را فعال نمی‌کند. برای بقیه مسیرهای جدول ادعای وجود پیاده‌سازی نداریم.
- در عملیات مدیریتی/انتشار محتوا، endpoint مالک آن دامنه و نقش مسئول باید در قرارداد مستقل همان Child تعریف شود؛ نباید مسیر `/me/` سهامدار به ابزار مدیریت/انتشار تبدیل شود.

## ۳. ماتریس طراحی برای ۱۱ بخش
| بخش | حق پیشنهادی (نام غیراجرایی) | candidate route / contract | مالک منبع و گیت اختصاصی | اجازه در این فاز |
|---|---|---|---|---|
| NAV-01 داشبورد | `shareholder.dashboard.read` | `GET /api/v1/tenants/:tenantId/me/dashboard` فقط projection | Child06/07/09؛ هر کارت فقط بعد از قبولی منبع همان کارت؛ عدم تبدیل null به صفر | DESIGN_ONLY |
| NAV-02 سهام و عضویت من | `membership.self.read` و `holdings.self.read` مستقل | `GET .../member-record`, `GET .../shareholding` (candidate موجود) | Child06 **۹ کنترل PENDING** و Child07 **۱۰ کنترل PENDING**؛ پیوند Party/Member/Ledger جدا | DESIGN_ONLY |
| NAV-03 خرید و فروش سهام | `trade.request.self.read` و `trade.request.submit` جدا | `GET .../trade-requests` candidate؛ `POST .../trade-requests` **صرفاً پیشنهاد** | Child07؛ Rule Registry، مرجع قانونی شرکت/هیئت‌مدیره و مقررات بالادستی؛ کنترل اهلیت/موجودی/قیمت و گردش قانونی؛ `PAYMENT_REPORTED≠VERIFIED≠OWNERSHIP_FINALIZED` | read/write BLOCKED |
| NAV-04 مجامع و انتخابات | `assembly.published.read`; `assembly.vote.cast` **پیشنهادی و معلق** | `GET .../assemblies`, `GET .../assemblies/:id/notices`; رأی فقط بعد از مشخصات مصوب | Child08/09/03؛ احراز حق رأی، نصاب، نسخه فراخوان، اعتبار و مرجع رسمی انتخابات | DESIGN_ONLY |
| NAV-05 اخبار و ارتباط با شرکت | `notice.published.read`; `message.self.create` جدا | `GET .../notices` candidate؛ `POST .../messages` پیشنهادی | Child09؛ ناشر معتبر، مخاطب، نسخه و زمان انتشار، ACL، حفظ رضایت و کانال مجاز | DESIGN_ONLY |
| NAV-06 خدمات من | `service.catalog.read`; `service.request.self.create` | `GET .../services`, `POST .../service-requests` پیشنهادی | دامنه خدمات تعاونی و Child06؛ شرایط اهلیت و مالک تصمیم و تعهدات خدمت باید تصویب شود | DESIGN_ONLY |
| NAV-07 فروشگاه و فرصت‌ها | `opportunity.published.read`; حقوق سفارش جدا | `GET .../opportunities`; `POST .../orders` فعلاً **خارج از دامنه** | Child16/18 و مجوز ناشر؛ بازار کالا/خدمت **متمایز** از سهم؛ هیچ سفارش/پرداختی از این سند فعال نمی‌شود | read proposal only |
| NAV-08 پروژه‌های شرکت | `project.published.read` | `GET .../projects` پیشنهادی | Child12؛ مالک پروژه، نسخه گزارش پیشرفت، طبقه‌بندی و تصویب انتشار به سهامداران | DESIGN_ONLY |
| NAV-09 شفافیت و اسناد شرکت | `disclosure.catalog.read`; `document.download` مستقل | `GET .../disclosures`; `POST .../documents/:id/access-grants` پیشنهادی | Child11/03/22؛ سند رسمی، اصالت، نسخه، طبقه‌بندی و حدود مخاطب؛ صورت مالی صرفاً اطلاع‌رسانی | DESIGN_ONLY |
| NAV-10 گزارش‌های من | `report.self.read`; `report.export` مستقل | `GET .../reports`; `POST .../reports/:id/export` پیشنهادی | Child03/05/06/07/14/15/16/22؛ ترکیب فقط منابع مجاز، دسته‌بندی حریم خصوصی و تاریخ اعتبار | DESIGN_ONLY |
| NAV-11 تنظیمات حساب | `account.self.read`, `account.self.update`, `session.self.revoke`, `mfa.self.manage` جدا | `GET .../account-settings`; mutation endpoints جدا و هنوز تعریف نشده | Child01/02/03/05/09/22؛ مالک هویت، re-auth, MFA, CSRF, device binding, session invalidation, privacy | DESIGN_ONLY |

**هر نام در جدول «پیشنهادی» است**: نه حق دسترسی ایجاد می‌کند نه وجود endpoint را ثابت می‌کند.

## ۴. قرارداد مشترک مجوز: تصمیم قبل از داده
**ورودی پیشنهادی Policy Decision Point:**
`subjectId`, `sessionId`, `tenantId`, `partyId`, `resourceType`, `resourceId`, `operation`, `policyVersion`, `featureVersion`, `sourceApprovalRef`, `legalRuleRef`, `purpose`, `now`, `riskContext`.

**خروجی پیشنهادی:**
`decision: DENY|ALLOW`, `reasonCode`, `auditRef`, `obligations` (mask/export restriction/reauth), `expiresAt`.
در حالت نبود یا ابهام هر ورودی الزامی، `DENY`؛ `ALLOW` فقط در زمان درخواست پس از اعتبارسنجی مستقل حقوقی، منبعی و فنی. ذخیره مجوزهای ماندگار سمت کلاینت ممنوع.

## ۵. چهار دسته گیت عملیاتی
### G1 — Identity/Tenant/Permission
مالک: تیم امنیت/CF01/CF02؛ مدارک: threat model، session & OTP assurance، cross-tenant negative tests، RLS و pool safety، ماتریس roles+operations، code review و approval مستقل.
**وضعیت:** NOT_APPROVED_FOR_LIVE.

### G2 — Legal & Source
مالک: مالک قانونی داده همان تعاونی، مسئول حقوقی و بازبین مستقل؛ مدارک: مبنای قانونی/اساسنامه/مصوبه، مرجع تصمیم، شناسه مدرک و اصالت، owner/source version، دوره اعتبار، مخاطب/طبقه‌بندی، روش اصلاح و سلب اجازه.
**وضعیت:** Child06=9/9 PENDING؛ Child07 holdings=10/10 PENDING؛ سایر منابع نیازمند پرونده مستقل.

### G3 — Operation / Mutation
مالک: هر Child و تیم امنیت؛ مدارک: فرآیند مصوب با نسخه، کنترل وضعیت/رقابت/idempotency، عدم جایگزینی گزارش پرداخت با تایید واقعی، audit/outbox، rollback/compensation، خطایابی و سناریوهای سوءاستفاده.
**وضعیت:** هیچ عملیاتی در این سند مجاز نیست.

### G4 — Release/Privacy/Ops
مالک: امنیت، عملیات، مالک محصول و صاحب اختیار انتشار؛ مدارک: protected staging، scan، backup/restore drill، monitoring، incident response، retention، revocation drill، gate approvals، rollback plan و مجوز Production مستقل.
**وضعیت:** NO_MERGE / NO_DEPLOY.

## ۶. درخواست تصمیم رسمی (Decision Register)
| کد | تصمیم لازم | نتیجه تا زمان تصویب |
|---|---|---|
| OP-DEC-01 | تأیید نقش‌ها/subject، tenant و ماتریس حقوق read/download/write/export در هر NAV | همه permissions پیشنهادی و deny |
| OP-DEC-02 | انتصاب مالک داده، ناشر و تصویب‌کننده مستقل به تفکیک هر tenant/source | هیچ live source |
| OP-DEC-03 | پذیرش ۹ کنترل Child06 و ۱۰ کنترل Child07 جداگانه + Source Admission | هیچ مانده/عضویت واقعی |
| OP-DEC-04 | انطباق نسخه نهایی خرید/فروش سهم با قوانین و تصمیمات معتبر هیئت‌مدیره؛ ممنوعیت wallet و حسابداری عمومی | هیچ درخواست یا انتقال سهم واقعی |
| OP-DEC-05 | طبقه‌بندی اطلاعات، حدود افشای اسناد، PDF/download، retention و consent | بدون انتشار/دانلود واقعی |
| OP-DEC-06 | قرارداد واقعی Auth/OTP/MFA، تغییر اطلاعات و revoke نشست | بدون تغییر حساب واقعی |
| OP-DEC-07 | امضای طرح OpenAPI و مالک هر route + نسخه مشترک ناوبری/permission | هیچ canonical route جدید |
| OP-DEC-08 | امضای مستقل Release و عملیات واقعی، SLO/backup/rollback | PR Draft، بدون Deploy |

## ۷. آزمون پذیرش قراردادها (قبل از کدنویسی عملیاتی)
- درخواست با tenant دیگر؛ تعویض tenant در URL؛ نشست revoke/expired؛ user بدون party؛ نقش بدون مرجع؛ approved source متعلق به تعاونی دیگر → DENY.
- Child06 مجاز ولی Child07 معلق → عضویت احتمالا مجاز در حوزه خود، سهم همچنان DENY؛ داشبورد projection نباید سهم را جعل کند.
- source بدون version/asOf، stale/replayed، approval expired/revoked، ledger mismatch، doc classification forbidden → DENY + audit.
- مشاهده فهرست سند بدون مجوز دانلود → 403 برای محتوا؛ لینک نباید قابل استفاده مجدد توسط دیگران باشد.
- دسترسی گزارش خود فرد ≠ دسترسی گزارش دیگران؛ انتشار عمومی ≠ مشاهده اسناد محرمانه.
- درخواست خرید/فروش بدون Rule Registry امضاشده/اهلیت/مرحله تأیید پرداخت → هیچ انتقال مالکیتی.
- تغییر شماره تماس/بازیابی حساب بدون re-auth و کنترل تغییر session → DENY.
- دسترسی ناموفق به منبع نباید صفر واقعی، تعداد ساختگی یا موفقیت UI تولید کند.
- Review Shell باید حتی در محیط Staging بدون کلید منبع واقعی و بدون قابلیت mutation باقی بماند.

## ۸. معیار خروج از فاز طراحی
- سند حاضر و JSON Registry با تطبیق ۱۱ NAV به‌صورت **SPEC DRAFT** پذیرفته شوند.
- تعیین مالک هر تصمیم، سند شاهد و مرجع امضا؛ بدون جعل تاریخ/امضا.
- ارجاع مستقل هر عملیات به Child Specification، OpenAPI و Migration/RLS مربوط؛ بررسی موارد خارج از MVP.
- سپس تنها PRهای توسعه synthetic/contract tests؛ هیچ live toggle تا تأییدهای G1–G4.

**اصل جداسازی:** پذیرش فنی/بصری SHA مبنا ≠ صدور مجوز حقوقی، منبع رسمی یا عملیات واقعی.

## ۹. قرارداد قابل آزمون: Security Contract Test Pack v0.1
**وضعیت:** DESIGN_ONLY؛ صرفاً Python standard library و JSON؛ بدون endpoint، بدون RLS migration و بدون engine اجرایی.

**فایل‌ها و نقش‌ها:**
- `docs/contracts/shareholder-w1-security-test-matrix-v0.1.json`: ورودی‌های مصنوعی و ۲۹ سناریو؛ سنجش منشأ تصمیم `DENY` یا `SIMULATED_ALLOW` همراه با کد علت.
- `docs/contracts/shareholder-w1-policy-decision-request-v0.1.schema.json`: ساختار داده تصمیم پیشنهادی (subject/session، tenant/party، resource ownership، policy/feature، legal source، امنیت write/پرداخت).
- `scripts/ci/test_shareholder_w1_operational_gates.py`: آزمون مستقل به‌عنوان بخشی از `python3 -m unittest discover -s scripts/ci -p test_*.py -v` در Release موجود؛ بدون اتصال به داده واقعی.

### سناریوهای منفی پوشش‌داده‌شده
- نشست مفقود، منقضی یا revoke شده؛ تغییر tenant و قطع رابطه Party؛ نقش بدون تأیید source عضویت.
- feature/permission خاموش، legal approval غایب/منقضی/باطل، نسخه منبع مفقود یا stale.
- منبع شخص دیگر، طبقه‌بندی غیرمجاز، تفکیک list/view از download/export.
- write بدون permission، re-auth، CSRF، idempotency یا تطبیق نسخه.
- معامله بدون Rule Registry و finalization بدون `PAYMENT_VERIFIED` و اجازه مستقل انتقال.
- تلاش استفاده از این شبیه‌ساز در `LIVE` / `STAGING` / `REVIEW` همیشه `DENY`.
- موارد `SIMULATED_ALLOW` **فقط نشان‌دهنده رسیدن fixture کاملاً ساختگی به آخر زنجیره آزمون هستند**؛ هرگز `ALLOW` حقوقی یا عملیاتی نیستند.

### وضعیت پذیرش
- **کد تست، JSON و schema در PR موجود است.**
- تطبیق منطقی اولیه ۲۹ fixture با evaluator بررسی شد، اما **Docker Release کامل و آزمون محلی SHA جدید هنوز انجام نشده است**.
- اجازه ادعای `PASS` یا تغییر `permission_policy:null` و `authoritative_routes:null` تا دریافت log همان SHA وجود ندارد.
