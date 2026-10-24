# Phase 3 — Shareholder design-review preview (11 fully navigable sections)

**Baseline:** accepted Phase 2C local Release at `480bddabf8acb37d783a1592c57032ac424356c4`. Draft PR #27 remains untouched. Phase 3 is independent and stacked, and has **no accepted release result until exact SHA is tested.**

## User-facing scope

- The protected Vercel shareholder preview will offer `/review`: an explicit **internal design-review** entry point independent of operational shareholder OTP sessions.
- Ten full deep-linkable screens are exposed at `/review/nav-02` through `/review/nav-11`, alongside `/review` for NAV-01. Invalid IDs return HTTP 404.
- The canonical approved `shareholderNavigation` and `NAV_IDS` drive every menu item, avoiding parallel, drifting menu name lists.
- Every section displays useful user-facing design content, three clickable tabs (**layout, steps/workflows, legal/access boundaries**), explicit evidence-dependency labels, and back navigation. Layout supports narrow mobile screens and RTL.
- The operational homepage keeps OTP in place, but shows a prominent link to the review space even when API is unconfigured; the operational user session/roles are never bypassed.
- Review screens **never fetch** personal or source data, do not collect a phone number, do not write to a DB, do not submit trade/payment/notice content, do not claim actual holdings, and never show fabricated business records or assumed empty lists.
- Page metadata discourages crawling with `robots: noindex, nofollow`. **Do not treat robots metadata as access control:** only use the existing Vercel Deployment Protection SSO (checked `ssoProtection.enabled=true`, `deploymentType=all`) for internal previews. If deployment protection is absent, do not distribute a restricted-access link as protected.

## 11 reviewed slots

| ID | Displayed section | Preview function |
|---|---|---|
| NAV-01 | داشبورد | 10 module cards and explanatory safeguards |
| NAV-02 | سهام و عضویت من | approved Child06/Child07 source boundaries and versioned share view layout |
| NAV-03 | خرید و فروش سهام | explained approved workflow; no trade submission/payment |
| NAV-04 | مجامع و انتخابات | meeting/event documentation information architecture |
| NAV-05 | اخبار و ارتباط با شرکت | Child09 publication/recipient/assurance status model |
| NAV-06 | خدمات من | service request information architecture |
| NAV-07 | فروشگاه و فرصت‌ها | legal offer catalogue information architecture, no in-app transactions |
| NAV-08 | پروژه‌های شرکت | approved project disclosure information architecture |
| NAV-09 | شفافیت و اسناد شرکت | documents, public/legal statements — NOT company accounting |
| NAV-10 | گزارش‌های من | only sourced, private reports after legal admission |
| NAV-11 | تنظیمات حساب | user settings information architecture; no change to real identity |

## Tests

- `scripts/ci/test_shareholder_review_preview.py` covers all 11 slots, allowed routes, no application data transport and explicit design-review disclosures.
- `scripts/ci/verify-shareholder-tsx.cjs` parses every new TSX file.
- `scripts/smoke-next-otp.mjs` includes 11 actual HTTP GET review routes and one invalid route 404, while existing protected operational NAV-02/03/05 checks remain unchanged.
- Source-dependent and backend-gated screens are unchanged; no legal approvals are inferred from this UX.

## Acceptance boundaries

1. Run the exact SHA's isolated local `-Suite Release` with no changes to other project volumes or hosted DB. Do not claim Phase 3 Release from Phase 2C's already-accepted SHA.
2. Confirm one **READY preview deployment for the same exact Phase 3 SHA**, with SSO Deployment Protection enabled. The Vercel rate limit may prevent this; a local successful Release is not an online deployment.
3. Check clickable `/review` and `/review/nav-02`.. `/review/nav-11` after reviewer SSO. Do not claim live endpoint usability from design-only navigation.
4. Keep PR #23/#25/#26/#27 and Phase 3 PR in Draft until independent review. Never merge/deploy to production, switch off SSO, connect an unapproved Child07/09 adapter, send SMS, or transact.

**Open gap:** The operational shareholder portal still requires independently verified sources, legal authority and live integration; no user-visible fields should imply those are active now.
