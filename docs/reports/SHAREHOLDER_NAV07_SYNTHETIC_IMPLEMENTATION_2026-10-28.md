# TTO NAV-07 — «فروشگاه و فرصت‌ها» / Synthetic Shareholder Review

**Date:** 2026-10-28 · **W1 shareholder section:** NAV-07 · **Status:** SOURCE IMPLEMENTED / FULL LOCAL RELEASE PENDING / VISUAL REVIEW PENDING
**Base:** NAV06 Draft PR #52, exact tested local PASS `16f5a77713054bff66d79c0a789b67218e7baabe`. NAV04/05/06 accepted technical visual geometry preserved; none of their parent branches changed.

## Authoritative contracts and dependencies
- `TTO-NAVIGATION-INFORMATION-ARCHITECTURE v1.0`: NAV07 shareholder root «فروشگاه و فرصت‌ها», precisely 10 submenus below.
- `TTO-DASHBOARD-UI-IMPLEMENTATION-HANDOFF v1.0`: common 11-root RTL shareholder shell; preserve approved layout.
- `TTO-IMPLEMENTATION-SPECIFICATION-MASTER v1.0`: National Marketplace + Advertising, Opportunities, Collaboration/Procurement and Payment Core boundaries.
- `TTO-UNIFIED-IMPLEMENTATION-PACK v1.0`:
  - CHILD16 marketplace catalog, offers, orders and fulfilment, seller in MVP **cooperative**, proposed member supplier **not** seller.
  - CHILD16 ads: sponsored content clearly labelled, independent from official notices, no political ads or sensitive-profile ad targeting.
  - CHILD18: business/job/project opportunity applications restricted, no automatic final AI rejection.
  - CHILD17: EOI is **not** legal agreement; sourcing is not pooled payment; thresholds are source-backed.
  - CF05 Payment Core: intent/attempt/verification only, order domain decides completion. No platform cash wallet or pooled funds.
- `NAVIGATION_CONTRACT.json` + `shareholder-section-config.ts`: real route/permission/source admission currently gated and not authorized by this preview.

## Ten exact approved submenu labels
1. فروشگاه
2. محصولات شرکت
3. بازار ملی سهامداران
4. محصولات سایر تعاونی‌ها
5. پیشنهادهای ویژه
6. سفارش‌های من
7. پرداخت سفارش
8. وضعیت تحویل
9. معرفی محصول من
10. فرصت‌های کسب‌وکار

## Implemented review-only components
- `/review/interactive/nav-07`: same approved NAV04/NAV05/NAV06 sidebar/header, hero, 4 KPI, 4 info panels, 4 shortcuts; local NAV07 theme, RTL and mobile layouts.
- 15 immutable `DEMO-*` records with distinct owner, explicit synthetic status, no real offer, authority, eligibility, fulfillment, order, payment, proposal or application.
- Modes: `UNVERIFIED` default (shows unknown, not zero), `SOURCE_UNAVAILABLE` (no false cancellation of orders), `DEMO_CONTENT` optional reviewer toolbox.
- All ten submenu filters, local-only query, read-only details and disabled checkout/pay/order/product-proposal/apply actions.
- Sidebar links in NAV04/NAV05/NAV06 and dashboard now navigate to specialized `/review/interactive/nav-07` without changing their accepted visual geometry.
- No real catalog, offers, orders, prices, shipping, payments, personal data, buyer eligibility, seller approval, or domain source adoption; no database migrations, no new payment gateway, no real POST/API call.

## Test and evidence gates (NOT YET EXECUTED)
- `scripts/ci/test_shareholder_w1_nav07.py`: 10 offline source-contract tests.
- `scripts/ci/verify-shareholder-tsx.cjs`: includes all new NAV07 TSX files.
- `scripts/smoke-next-otp.mjs`: NAV07 anonymous SSR fail-closed marker test.
- `scripts/e2e-shareholder-nav07-review.cjs`: five Chromium widths (1440/1536/768/390/320), 11 canonical sidebar roots, 10 approved category tabs, 15 mock items, disabled writes, viewport overflow, network and JS error checks, screenshot SHA256.
- `scripts/ci/run-local-docker.ps1`: syntax preflight and full Docker Release gate for NAV07 after Phase4C and earlier NAVs.
- `scripts/ci/run-nav07-approved-visual-release.ps1`: exact SHA immutable source / PowerShell 5.1 manifest / five SHA256 PNG ZIP.
- Remote connector readback: 23/23 narrow structural checks and Chromium test script JavaScript parser passed. **No actual local Python, Next/TypeScript build, full Playwright run, exported screenshot or human visual acceptance yet**.
- **GitHub hosted Actions remains blocked before runner** on predecessor PRs (Issue #50); this does not authorize bypass, merge, deploy or fee adjustment.
- **Activation gates remain blocked:** no live marketplace listings, product posting, real member solicitation, orders, payment, advertisements, entitlement, delivery or application until independent sources, tenant/member scope, permissions, legal rules, all necessary owner reviews and tests PASS.

### Release instruction
Use verified local TTO Git worktree; retrieve exact PR head SHA from GitHub at run time; execute the branch's `scripts/ci/run-nav07-approved-visual-release.ps1` with `-SourceRepo <verified local repo>` and `-ExpectedSha <sha>`. Accept only all exact-SHA release markers plus five PNG hashes and user-uploaded visual inspection. Keep PR **Draft** until independently signed off; no merge/deploy.
