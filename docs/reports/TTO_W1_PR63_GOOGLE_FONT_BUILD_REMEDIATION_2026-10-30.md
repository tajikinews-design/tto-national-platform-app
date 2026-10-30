# TTO — ترمیم وابستگی Build به Google Fonts | PR63 follow-up

**تاریخ:** 2026-10-30  
**مبنای شکست:** `2d889ffd8c6214bedaf0ad62880ecfb0b28f33bd`؛ PR #63، گزارش ارسالی کاربر در 2026-10-30.  
**وضعیت:** رفع فنی ثبت‌شده؛ **Release و پذیرش بصری SHA جدید هنوز PENDING**.  
**مرز:** NO_REAL_DATA / NO_OPERATIONAL_AUTHORIZATION / NO_MERGE / NO_DEPLOY.

## تشخیص دقیق
- `SOURCE_SHA_VERIFIED=PASS` و تست زنجیره `TTO_W1_BFF_NEST_PEP_PDP_CHAIN=PASS` در گزارش ثبت شد؛ آزمون‌های منفی به منبع مصنوعی دسترسی پیدا نکردند.
- `Ran 278 tests ... OK` برای مجموعه Python؛ اما **`RELEASE_EXIT_CODE=1`**.
- گام بعدی `pnpm build; pnpm check` به سبب `next/font/google` شکست خورد: دریافت Vazirmatn از `fonts.googleapis.com` در Build برقرار نشد. سه پرتال تحت تأثیر بودند؛ خطا در shareholder Build توقف ایجاد کرد.
- این شکست **ربط اثبات‌شده‌ای به منطق PEP/PDP ندارد**، اما **پذیرش کامل Release را مسدود می‌کند**.

## اصلاح پیشنهادی اجراشده
- هر سه پرتال از `next/font/google` به import بستهٔ self-hosted `@fontsource-variable/vazirmatn/wght.css` منتقل شدند؛ فونت همان خانواده **Vazirmatn** با پوشش عربی/لاتین و وزن متغیر باقی می‌ماند.
- در `packages/ui/src/styles.css` متغیر قبلی `--tto-font` به `"Vazirmatn Variable"` متصل شد؛ CSS مشترک، RTL و متن/چیدمان تغییر مفهومی ندارند.
- بستهٔ فونت در `package.json` سه پرتال به نسخهٔ ثابت `5.2.8` (OFL-1.1) پین و وابستگی همراه با `sha512 integrity` به `pnpm-lock.yaml` اضافه شد.
- فونت به شکل فایل خام در مخزن commit نشده است؛ فایل‌های بسته هنگام `pnpm install --frozen-lockfile` با سایر وابستگی‌ها دریافت می‌شوند و سپس برای Build و سرو وب به Google Fonts نیاز نیست.
- آزمون مستقل `scripts/ci/test_vazirmatn_selfhost_build.py` صحت پین، حذف Google font import، حفظ CSS variable، RTL و lockfile را کنترل می‌کند.

## مراحل پذیرش
1. کلون SHA جدید، فقط کدهای Git-tracked، بررسی SHA/clean status.
2. `Docker Release` کامل؛ نادیده‌گرفتن خطا یا ساخت بدون آزمون ممنوع.
3. الزام همزمان `TTO_W1_BFF_NEST_PEP_PDP_CHAIN=PASS`، `TTO_W1_DENIED_FIXTURE_TOUCHES=0`، `TTO_W1_NO_OPERATIONAL_ALLOW=PASS` و `TTO_LOCAL_RELEASE_PASS_SHA=<SHA>`.
4. بازبینی تغییر ظاهری احتمالی بعد از جابه‌جایی شیوهٔ بارگذاری فونت (باید با Baseline بصری پذیرفته‌شده مقایسه شود). صرفاً هم‌نام بودن خانواده فونت برای پذیرش بصری کافی نیست.
5. ثبت لاگ‌های کامل و شواهد، سپس ارزیابی جداگانهٔ پذیرش فنی/بصری. **بدون Merge یا Deploy**.

## محدودیت صریح
هیچ route، SQL، RLS، session واقعی، منبع سهام/عضویت واقعی، حقوق قانونی، عملیات معامله/پرداخت یا تنظیمات حساب تغییر نکرده است. جایگزینی فونت فقط یک اصلاح build/design است و نمی‌تواند گیت‌های قانونی/امنیتی را آزاد کند.

**تفسیر:** `CHAIN_TEST_PASS` ≠ `DOCKER_RELEASE_PASS` ≠ `LIVE_AUTHORIZED`.
