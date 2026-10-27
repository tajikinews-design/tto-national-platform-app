# سند مرجع بازبینی تجمیعی معماری پنل سهامدار — Phase 4C → 4G

**پروژه:** پلتفرم ملی تعاونی توسعه عمران (TTO National Platform)  
**تاریخ برش:** ۲۰۲۶-۱۰-۲۷ / ۱۴۰۵-۰۸-۰۵  
**نوع سند:** ممیزی کد موجود، گزارش آمادگی و مبنای تصمیم مرحله بعد — بدون فعال‌سازی منبع یا تغییر Runtime  
**کد مبنا:** `tajikinews-design/tto-national-platform-app`، `e9f588f7e37c4c2a18853a7feb70a7f27a57b500` (PR #36، Phase4G)  
**مرجع معماری:** `docs/architecture/ADR-001-FINAL-STACK.md`  
**اصول دامنه:** CF01/02/03/04، Child06 عضویت، Child07 دفتر سهام و جریان درخواست خرید/فروش، Child09 اطلاعیه‌ها. **MVP مالیِ پلتفرم فقط گردش‌کار مصوب درخواست خریدوفروش سهام است؛ حسابداری عمومی شرکت و کیف پول یا تسویه در سامانه طراحی نمی‌شود.**

## ۱. رأی معماری اجرایی

| نوع آمادگی | تصمیم | شواهد و محدودیت |
|---|---|---|
| توسعه واقعی کد UI پنل با داده مصنوعی، mock source و APIهای بسته | **GO — با شروط** | Next 16 / React / TypeScript، ۱۱ NAV، BFF، Nest و PG17 وجود دارند؛ عدم استفاده از PII و عدم ساخت آمار ساختگی الزامی است. |
| تکمیل جریان احراز هویت/نشست و انتخاب تعاونی در محیط ایزوله | **GO — فقط محیط آزمایشی** | Phase4C در واقعی‌ترین آزمون محلی Chromium→Next→Nest→PG17 پنج سناریو و ۱۵۶ کنترل را گذرانده است؛ پیامک تولید و login کاربران واقعی آزموده نشده است. |
| نمایش اطلاعات عضویت و دفتر سهم در محصول عملیاتی | **NO-GO تا پذیرش مستقل منبع** | Read BFF + Nest + SQL موجود است، اما ۹ گیت Child06 و ۱۰ گیت Child07 همچنان PENDING؛ نمونه داده آزمایشی، نقش و نشست هیچ‌کدام مجوز قانونی نیست. |
| نمایش تاریخچه معاملات و انتشار اطلاعیه‌های رسمی | **NO-GO** | مسیرهای `trade-requests` و `notices` عمدی 403 می‌دهند؛ ۷+۸ کنترل مستقل Child07/Child09 تایید نشده‌اند. UI هنوز قرارداد واقعی source adapters ندارد. |
| فعال‌سازی خرید/فروش، قفل سهم، پرداخت، انتقال مالکیت | **NO-GO** | فقط Specification دامنه پذیرفته‌شده و صفحات توضیحی/سازه‌های UI وجود دارد؛ هیچ مسیر عملیاتی ثبت/تسویه/انتقال، مجوز هیئت‌مدیره یا پایگاه قانونی در این فاز تأیید نشده است. |
| پذیرش واقعی سند محرمانه و تصمیم‌های حقوقی | **NO-GO** | Phase4F/4G شبیه‌سازی و shadow SQL فقط با test fixtures هستند؛ `realEndpoint:null`، `tempUploadAdapter:DISABLED`، بدون storage/KMS و بدون احراز اصالت اسناد واقعی. |
| ادغام PRهای متوالی، CI میزبان، Preview قابل استفاده و Production | **NO-GO تا گیت مستقل انتشار** | #31..#36 همگی Draft/unmerged، ۳ وضعیت موفق preview UI، API preview failure با مقصد build-rate-limit؛ استقرار Arvan/امنیت Deployment Protection و CI کامل به تأیید جدا نیاز دارند. |

**جمع‌بندی:** مهندسی UI و adapter contract توسعه‌پذیر است؛ **هیچ منبع واقعی یا عملیات سهم به این رأی متکی نیست**. «پذیرش آزمایش محلی» `≠` «پذیرش حقوقی داده» `≠` «تصویب استقرار» `≠` «مجوز معامله».

## ۲. جدول واقعیت‌های قابل ردیابی در مخزن

| فاز | SHA پذیرفته‌شده فقط در محیط محلی | مرز نتیجه | مستندات/کد |
|---|---|---|---|
| 4C | `d78f2d6ca1ca15f99301776501aeadf163e5a0ad` | Chromium 5/5، 156 check، 71 آزمون Python در همان Release؛ revoke/expiry/securityEpoch/logout/OTP mock؛ نه OTP واقعی | PR #32؛ `scripts/e2e-phase4c-real-session-browser.cjs` |
| 4D | `559ba83e2b8c66d279bfaf3a01e27bc36ae1bac6` | قرارداد read-only و ۱۹ کنترل `PENDING`، Python fail-closed؛ قبول فنی محلی، بدون شاهد قانونی | PR #33؛ `docs/contracts/shareholder-source-readiness-phase4d-v1.json` |
| 4E | `7eb11f91a00e67d1325fcb7531540e2aec8d8d5e` | 22/22 آزمون حمله PG17، 65 check، 86 Python و Release محلی؛ temp/rollback، بدون منبع واقعی | PR #34؛ `scripts/e2e-phase4e-source-admission-attack-matrix.cjs` |
| 4F (۴و) | `4da14db409504185a075d7f834b48619440656f5` | 32/32 آزمون زنجیره اختیار و مدرک در SQL TEMP، 71 check، Release محلی؛ `externallyVerified` در fixture اثبات اصالت نیست | PR #35؛ `scripts/e2e-phase4f-legal-authority-chain.cjs` |
| 4G (۴ز) | `e9f588f7e37c4c2a18853a7feb70a7f27a57b500` | اصلاح false positive Python، Release محلی موفق با SHA دقیق؛ آخرین فایل ارسال‌شده **بخش ابتدایی و خط‌های اختصاصی 20 سناریو را نشان نمی‌دهد** | PR #36؛ `phase4g_confidential_review.py` و `scripts/e2e-phase4g-confidential-review-shadow.cjs` |

**کیفیت شواهد:** اطلاعات قبولی محلی از لاگ‌های ارسال‌شده و کامنت‌های همان PRها آمده، نه از اجرای مستقل ابزار بازبین. برای Phase4G مارکر پایانی `TTO_LOCAL_RELEASE_PASS_SHA=e9f5...` در انتهای برش لاگ دیده شد؛ وجود خروجی مستقل `20/20` را از **همین برش** نباید ادعا کرد. برای تأیید ریز ۲۰ سناریو باید از لاگ کامل ذخیره‌شده کاربر استفاده کرد، بدون rebuild غیرضروری.

**بدهی هماهنگی مستندات:** `status/PHASE_GATES.json` در commit مبنا برای 4F و 4G هنوز `PENDING` دارد، در حالی که کامنت‌های پذیرش محلی PRهای #35/#36 و لاگ‌های کاربر Release موفق را ثبت کرده‌اند. این تعارض «گزارش وضعیت داخل کد» با «شاهد پذیرش immutable» است. **باید در یک رویداد/سند evidence-index جدید حل شود، نه با ویرایش SHA پذیرفته‌شده و ادعای آزمون مجدد انجام‌نشده.** هیچ گیت حقوقی را به PASS تبدیل نکنید.

## ۳. وضعیت معماری لایه‌به‌لایه

| لایه | آنچه در کد موجود است | آنچه هنوز آماده نیست | تصمیم |
|---|---|---|---|
| انتخاب Stack | Next.js 16، سه Frontend، UI مشترک، NestJS 11/Fastify، SQL migration + PostgreSQL17 | کل ۲۳ دامنه تجاری و ۱۴۸ موجودیت تحلیل‌شده پیاده نشده‌اند؛ ADR فقط انتخاب معماری است | توسعه افزایشی با ownership boundaries |
| Auth و Session (CF01) | OTP route آزمایشی، first-party Secure HttpOnly SameSite=Lax cookie، session PG17، revoke/logout، 60s revalidation و focus/visibility lock | سرویس واقعی SMS، ریکاوری/پشتیبانی کاربران واقعی، monitoring امنیتی end-to-end، بررسی شرایط Production | GO برای mock |
| Tenant/Party (CF02) | انتخاب تعاونی از سمت سرور، role+party linking، scope و cross-tenant deny، PGRLS و no-store | تطبیق Party/عضویت قانونی واقعی و منبع master تعاونی | GO برای synthetic، NO-GO داده واقعی |
| Member / Ledger (Child06/07) | `GET .../member-record` و `GET .../shareholding` از Next BFF → Nest → توابع `my_*_from_source`، version/asOf، fail-closed، تمایز مجهول با ۰ قطعی | توافق schema و master-owner source، قرارداد ingestion/version/correction/retention، approval واقعی و reconciliation | GO adapter interface، NO-GO live read |
| Admission/Quarantine | `source_import_batches`, `source_import_claims` و `assess_source_import_claim` که فقط verdict می‌دهد، منع replay/stale | pipeline عملیاتی دریافت و تصمیم مستقل و promotion تأییدشده به ledger؛ مسئولیت تطبیق و اصلاح مغایرت | طراحی، بدون ingestion |
| Trade/Market Child07 | `/api/tenants/:id/me/trade-requests` و مسیر Nest، نمایش حالت‌های candidate در UI | پاسخ 200 آگاه از مجوز، canonical trade source، POST سفارش/قفل/انتقال، اثر پرداخت/مقررات | فقط UX و قرارداد با mock |
| Notices Child09 | route `/me/notices`، candidate source validation، no-store/authorization | publisher و نسخه انتشار معتبر، گیرندگان، ابلاغ/تأیید وصول، ACL و revoke | فقط UX و قرارداد با mock |
| Document/Authority | CF03 قبلی، JSON مرجع 19 و 15 گیت، جریان Python 4G و SQL shadow | مخزن خصوصی فایل، اسکن واقعی، KMS، signer/verification provider، immutability/audit trusted, legal custodian decision | No live upload |
| User Experience | `/review` و 11 صفحات پیمایشی طراحی؛ `/modules/nav-02/03/05` source-aware، NAV04/06–11 protected informational shells | ۷ بخش اخیر عمدتاً shell هستند و فاقد read/write business integrations؛ مدیریت پرونده اسناد در پنل واقعی نیست | شروع اجرای UI با fixture |
| CI/Release | Docker Release full, offline Python, PostgreSQL17 E2E, Chromium real, OCI build tests، Arvan static YAML | hosted required checks، API Vercel rate-limited، Proof of Preview SSO on target, staging/ops rollout, production data governance | gate جدا |
| Operations | scripts reproducible Docker و no-network runtime smoke | SLO، backup/restore drill، alerting، incident/on-call، privacy retention، key rotation، rollback روی محیط واقعی | No production |

### مقایسه ۱۱ ماژول پنل

| شناسه | صفحه واقعی موجود | سطح آمادگی برای اجرای بیشتر |
|---|---|---|
| NAV-01 داشبورد | Login و نماهای خلاصهٔ بدون شمارنده ساختگی | **GO UI** — بر مبنای state ماشین و mock؛ آمار واقعی ممنوع |
| NAV-02 سهام و عضویت من | ویجت‌های مستند نسخه‌دار Child06/07 + tenant context | **GO UI**؛ اتصال منبع فقط بعد از گیت 19 کنترل |
| NAV-03 خریدوفروش سهام | توضیح فرایند و status candidate درخواست‌ها | **GO UX**؛ ثبت سفارش/تطبیق/پرداخت/انتقال **NO-GO** |
| NAV-04 مجامع و انتخابات | protected shell + design review | **GO UI اطلاع‌رسانی مصنوعی**؛ رأی‌گیری و تعیین حق رأی **NO-GO** |
| NAV-05 اخبار و ارتباط با شرکت | source-closed notice candidate | **GO UI**؛ انتشار/ارسال رسمی **NO-GO** |
| NAV-06 خدمات من | protected shell | **GO UX**؛ پرونده خدمت عملیاتی نیازمند مالک منبع |
| NAV-07 فروشگاه و فرصت‌ها | protected shell | **GO UX اطلاعاتی**؛ بازارچه کالا جدا از معاملات سهم |
| NAV-08 پروژه‌های شرکت | protected shell | **GO UI شفافیت اطلاعات مصنوعی**؛ پیشرفت/هزینه واقعی فقط با انتشار مصوب |
| NAV-09 شفافیت و اسناد شرکت | protected shell | **GO طراحی طبقه‌بندی اسناد**؛ حسابداری عمومی خارج از دامنه |
| NAV-10 گزارش‌های من | protected shell | **GO طراحی فیلتر و state نمایش**؛ گزارش شخصی واقعی مسدود |
| NAV-11 تنظیمات حساب | protected shell | **GO طراحی نمایشی**؛ تغییر اطلاعات/امنیت حساب پس از contract سرور |

## ۴. فهرست تصمیم‌های الزامی — مرجع تصمیم و شرط آزادسازی

| کد | تصمیم / شواهد لازم | مرجع پاسخگو | اثر |
|---|---|---|---|
| DEC-01 | تصویب `Synthetic-Only UI Implementation` و دامنه 11 NAV؛ ممنوعیت تظاهر به داده واقعی | مالک پروژه و مدیر فنی | اجازه اجرای PR بعدی طراحی/کدنویسی بدون استفاده از PII |
| DEC-02 | جدول RACI و مرجع صاحب‌اختیار مستقل برای **هر تعاونی**، بر اساس اساسنامه/مصوبه/قانونِ واقعاً بررسی‌شده | مرجع حقوقی تعاونی + مالک داده، با بازبین مستقل | پیش‌نیاز پرونده منابع رسمی؛ عنوان نرم‌افزاری کافی نیست |
| DEC-03 | تأیید ۹ کنترل Child06 و سازوکار قانونی User↔Party↔Member؛ منبع master و schema/version | مالک قانونی دفتر عضویت + حاکمیت داده | Child06 real read هنوز BLOCKED |
| DEC-04 | تأیید ۱۰ کنترل Child07 دفتر رسمی سهام؛ سند owner، account/quantity، version و مرجع اصلاح | مالک دفتر رسمی سهم + حقوقی/حاکمیت داده | Child07 holdings real read هنوز BLOCKED |
| DEC-05 | تأیید مستقل ۷ کنترل Child07 market/read history و ۸ کنترل Child09 publisher/recipient | مالکان مجزا Child07 و Child09 + CF04/CF03 | از 403 دائم به read model مأذون تنها با PR جدید |
| DEC-06 | تطبیق Specification نهایی خریدوفروش، تعیین اختیار هیئت‌مدیره در بخش‌های ارجاعی، گردش‌کار پرداخت مستقیم خریدار به فروشنده و ثبوت انتقال | مالک محصول + حقوقی و مرجع قانونی تعاونی | بدون آن ثبت/انتقال معامله نباید کدنویسی عملیاتی یا فعال شود |
| DEC-07 | تصمیم امنیت مدارک: storage، TLS، KMS، AV/scan، retention، legal hold، audit، محرمانگی و اختیار مشاهده | مسئول امنیت/حفاظت داده + مالک فایل + حقوقی | real document intake مسدود |
| DEC-08 | تصمیم حقیقی دربارۀ SMS provider، هویت/رضایت کاربران، abuse/cost، مانیتورینگ و بازیابی نشست | مالک عملیات + امنیت/حریم خصوصی | real login خارج از scope کنونی |
| DEC-09 | رفع API Preview build-rate-limit، تأیید Deployment Protection و SSO، Hosted checks، تعریف Staging، Arvan Production plan و rollback | مدیر فنی/DevOps + مالک پروژه | PR merge/deploy نیازمند گیت مستقل |
| DEC-10 | انتخاب مسئول ممیزی شواهد و نگهداری index immutable test SHA/log/approval؛ رفع drift وضعیت 4F/4G بدون تغییر SHA پذیرفته‌شده | مدیر فنی و مسئول QA | تصمیم فنی Release بر شواهد قابل رجوع متکی می‌ماند |

**نکته حقوقی:** زمان ۹۰ روز در قرارداد Phase4F/4G یک فرض سیاست فنی برای simulation است، نه مدت قانونی. هیچ تصمیم قانونی واقعی نباید از fixtureهای `externallyVerified`، `MOCK_CLEAN`، hash SHA256 یا GitHub approval مشتق شود.

## ۵. Backlog اجرای پنل؛ ترتیب پیشنهادی و معیاری برای Done

### W0 — تثبیت مبنا و انتشار توسعه
**اولویت P0.** یک بسته مستند Evidence Index از PRهای #31–#36 و accepted SHAها، تفاوت statusهای قدیمی، وضعیت Hosted checks، Security Preview، و source approvals بسازید. مسأله ۶ PR موقت روی هم، بدون merge یک اقدام DevOps/governance است؛ **هیچ ادغام خودکار یا production** تا تصویب مالک.

**Done:** کد و تعهدات موجود روی HEAD مشخص؛ هیچ marker قدیمی با PASS جدید اشتباه نشود؛ نسخه پذیرفته‌شده تغییر نکند.

### W1 — اجرای کاربردی UI پنل در حالت synthetic
**اولویت P0، مجاز پس از DEC-01.** برای NAV01–11 UI واقعیِ قابل تعاملِ **غیرعملیاتی** بسازید: مسیرها/وضعیت‌ها، skeleton/loading/error/no-source/denied/expired، mobile/RTL، صفحات فهرست و جزئیات با داده fixture آشکار. برای NAV02 نمایش منطقی عضویت و ledger، برای NAV03 مراحل و وضعیت درخواست *بدون submit*، برای NAV05 فهرست/جزئیات اطلاعیه *بدون publish*؛ برای NAV04/06/07/08/09/10/11 از shell به UX غیرحقیقی با مستندات دامنه و منبع منتقل شوید. هیچ وعدۀ مجوز، پرداخت، سهام یا رویداد حقوقی در UI نباشد.

**Done:** keyboard/RTL/mobile E2E، no PII/no financial post، provenance و tenant isolation در همه viewها؛ تست‌های 4C–4G همچنان سبز.

### W2 — قرارداد adapter داده منبع، بدون وصل‌شدن
**اولویت P1.** Interface دقیق `Child06MemberReader`، `Child07HoldingsReader`، `Child07OwnTradeRequestsReader`، `Child09ApprovedNoticeFeed` را با خروجی های `APPROVED | DENIED | PENDING | UNAVAILABLE` و version/evidence/tenant/party design کنید؛ قرارداد سمت سرور بدون data connector. Stubها `DENIED` بمانند؛ Fixtureها فقط در بسته‌های تست. برای 19+15 کنترل source، runtime activation با policy فایلِ GitHub **غیرممکن** بماند.

**Done:** mock contract/fuzz/rollback tests؛ هیچ API واقعی 200 نمی‌دهد مگر در sandbox تست کنترل‌شده، هیچ حالت استنباط `unknown=zero`.

### W3 — Source Approval + Privacy Intake (طراحی عملیاتی، نه دریافت واقعی)
**اولویت P1 مشروط به DEC-02/03/04/07.** اصل اسناد، متولی، صلاحیت بازبین، تصمیم مستقل، نگهداری و تصحیح باید خارج از کد عمومی واقعاً تأیید شوند؛ ارائه endpoint واقعی اسناد فقط با storage/security/retention approved و PR جدا.

**Done:** پرونده حقوقی مستند هر tenant و domain، بدون دخالت GitHub در تأیید؛ از نظر technical test هم owner و inspector مستقل باشند.

### W4 — اتصال کنترل‌شده و آزمایش عملیاتی
**اولویت P2 و صریحاً NO-GO کنونی.** فقط پس از مدارک معتبر، قرارداد منبع versioned، تست RLS، ممیزی واقعی، صدور مجوز مستقل و کنترل production/staging؛ مراحل real login/real read/trade & notice publication هرکدام approval جدا می‌خواهند.

**Done:** go/no-go کتبی و تاریخ‌دار هر domain، کنترل تغییر/لغو، incident+rollback و بدون نقض توافق بازار.

## ۶. ثبت اختلاف‌ها و ریسک‌ها

| ریسک | شدت | اصلاح پیشنهادی |
|---|---|---|
| شش PR انباشته و Draft با local SHA قبولی؛ هنوز داخل main نیستند | High (release) | تصمیم مستقل درباره ترتیب review/merge و تست commit تجمیعی؛ ممکن است SHA merge با SHA آزموده تفاوت کند |
| 4F/4G در `PHASE_GATES.json` هنوز PENDING اما در کامنت‌های PR log success دارند | Medium (evidence integrity) | ثبت evidence index با سلسله‌مراتب `tested SHA > comment evidence > stale document`؛ اصلاح اسناد در PR جدید با release re-run در صورت تغییر کد |
| Vercel UI preview statuses موفق، API preview خطای build-rate-limit | High (hosted integration) | بررسی خطای API build و SSO/Deployment Protection؛ `success` در build به تنهایی معنی امن بودن preview نیست |
| ۷ ماژول اصلی بیشتر placeholder اطلاع‌رسانی هستند | High (product completeness) | W1 UI واقعی با mock و گیت‌های عدم جعل داده |
| Child07 trade/Child09 notices همچنان 403؛ source 19/15 کنترل PENDING | Critical (legal) | جدا نگه داشتن مجوز read از مجوز write و تعیین مالک رسمی |
| 4F/4G verifier با flags ساختگی، بدون real signatures or storage | Critical (legal/privacy) | عدم تبدیل synthetic boolean به پذیرش خارجی؛ تصمیم اصل مدارک و مسیر محرمانه الزامی |
| کارکردهای زیرساختی Production (backup, recovery, uptime, AV/KMS) اثبات نشده | High (operations) | جداگانه روی Staging/Infrastructure پس از تصویب و با شواهد واقعی تست شود |
| نسخه نهایی Specification خرید/فروش در **مسیر فایل‌های فعلی مخزن app قابل مشاهده نیست** | High (implementation contract) | پیش از هر flow نوشتنی، متن رسمی مصوب و نسخه آن به‌عنوان مرجع تصمیم و قرارداد runtime لینک شود |

## ۷. گیت نهایی برای آغاز W1

**GO برای W1 در صورت موافقت مالک با چهار شرط:**
۱) فقط داده مصنوعی و mock، ۲) بدون SMS/مدرک/پرداخت و share transfer واقعی، ۳) بدون دستکاری accepted SHAها و ادغام خودکار، ۴) حفظ Fail-Closed و تست تمام فازهای گذشته.

**NO-GO برای Release/Real Sources/Trading** تا تصویب مستقل DEC-02 تا DEC-10.

## ۸. شواهد قابل بازیابی

- PRs: #31 `2f195b...`, #32 `d78f2d...`, #33 `559ba83...`, #34 `7eb11f...`, #35 `4da14d...`, #36 `e9f588...` — همگی در تاریخ برش Draft/unmerged.
- README و ADR: `docs/architecture/ADR-001-FINAL-STACK.md`, `docs/plan/ENVIRONMENT_AND_RELEASE_POLICY.md`.
- UI: `packages/ui/src/shareholder-navigation.ts`, `shareholder-workspace.tsx`, `shareholder-read-models.tsx`, `shareholder-section-config.ts`, `apps/shareholder/app/review`, `apps/shareholder/app/modules/[id]`.
- Runtime API/DB: `services/api/src/module.ts`, `apps/shareholder/lib/source-read-access.ts`, `apps/shareholder/app/api/**`, `database/migrations/0009_*` و `database/migrations/0010_*`.
- Legal contracts: `docs/contracts/shareholder-source-readiness-phase4d-v1.json`، `shareholder-source-authority-readiness-v1.json`، `shareholder-legal-source-chain-phase4f-v1.json`، `shareholder-confidential-intake-phase4g-v1.json`.
- آخرین log کاربر: `C:\Users\Sadra\Downloads\TTO-Local-CI-Reports\TTO-Release-20261027-093748-62e7b84a9068.log`، پس از `TTO_LOCAL_RELEASE_PASS_SHA=e9f588...` بدون مدرک رسمی صاحب منبع.
- GitHub commit status on Phase4G head: Vercel shareholder/cooperative/national preview **success**، API preview **failure** linked to `build-rate-limit`. وضعیت فعلی endpoint واقعی و حفاظت مشاهده‌شده در مرورگر هنوز مستقل اثبات نشده است.

**وضعیت این سند:** `ARCHITECTURE_REVIEW_COMPLETED / DECISION_RECORD_PROPOSED / ZERO_CODE_RUNTIME_CHANGES`. این سند سند پذیرش Production، حکم قانونی یا اجازه معامله نیست.
