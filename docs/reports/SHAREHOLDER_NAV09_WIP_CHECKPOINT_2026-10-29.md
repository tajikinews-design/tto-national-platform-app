# NAV09 «شفافیت و اسناد شرکت» — Synthetic implementation checkpoint

**Date:** 2026-10-29. **Source status:** IMPLEMENTED / STATIC CHECKS PASS / ACTUAL BUILD AND RELEASE PENDING.
**Base:** NAV08 Draft PR54 exact locally released and technically visually reviewed SHA `15127083fe5e734c1229d4ba33f83a35c8170158`.
**Branch:** `feat/shareholder-nav09-transparency-documents-synthetic-20261029`. **No merge/deploy or real financial/legal data activation.**

## Approved Navigation v1.0 scope
Exactly 8 shareholder submenus: شفافیت شرکت، گزارش‌های مالی، گزارش هیئت‌مدیره، گزارش بازرس، اسناد قانونی، حقوق و مقررات سهامدار، سیاست حریم خصوصی، هشدارهای مهم شرکت.

## Legal/business boundaries
- Child11 owns shareholder transparency, financial statements and board/auditor/legal disclosures, based on versioned authoritative source, approved classification, period, publication status and entitlement. Official edits require new version and audit evidence. Proposed ≠ approved ≠ paid.
- TTO **never** performs general accounting, journal posting, ledger entry, or internal financial procedures. It displays authorized shareholder reports only.
- Child09 owns notice communications: DELIVERED ≠ READ ≠ ACKNOWLEDGED. Sending an alert cannot become legal receipt evidence automatically.
- Child20 GRC owns restricted findings/conflicts and permits **only approved projection**. This review never certifies company compliance.
- Child22: Data classification ≠ authorization; ARCHIVED ≠ DELETED and Legal Hold wins over disposition.
- CF03 Document/Evidence Core controls source and version; tenant membership and access are separate server-side gates.

## Implemented synthetic review
- `/review/interactive/nav-09` independent static Next.js review with unchanged approved W1 RTL 11-root sidebar/header.
- Four KPI, four summary panels, four shortcuts; eight submenus grouped 4+2+2 and contextual sample detail panes.
- 16 wholly fabricated `DEMO-DISC-*` examples (two each). Every sample explicitly denies publication authority, document download, notice ACK and accounting entry.
- `UNVERIFIED` is default fail-closed; `SOURCE_UNAVAILABLE` does not masquerade as empty/zero; reviewer-opt-in `DEMO_CONTENT` is synthetic only.
- All PDF, notice ACK, document edit, appeal and related actions permanently disabled. No document link/download, no real payment, no API calls or database migration.
- Reviewed sibling NAV04–08 and dashboard now route NAV09 to independent review. No shared approved layout geometry changed.

## Security and QA gates implemented but not yet executed
- Ten focused offline Python contracts at `scripts/ci/test_shareholder_w1_nav09.py`.
- `scripts/ci/verify-shareholder-tsx.cjs` parses NAV09 TSX and fixture files before Next build.
- `scripts/smoke-next-otp.mjs` requires default-deny SSR route and all eight approved menu names; forbids sample ID in SSR default.
- `scripts/e2e-shareholder-nav09-review.cjs` runs private Chromium at widths 1440,1536,768,390,320, checks 11-root shell, eight sections, sample opt-in, no network writes, source unavailable deny, no overflow and SHA256 PNG manifest.
- `scripts/ci/run-local-docker.ps1` requires browser JS syntax before typecheck and real Chromium after Phase4C/NAV03–08.
- `scripts/ci/run-nav09-approved-visual-release.ps1` verifies GitHub exact-head SHA, disposable Docker Release, five PNG hashes and creates `TTO-NAV09-Visual-<sha12>.zip` for human inspection.

**Evidence available now**: 28/28 targeted remote source static checks PASS and NAV09 browser JS parser PASS. **These are not actual TSX parsing, Python execution, TypeScript/Next builds, Chromium execution, complete Docker Release, or visual acceptance.**

**Remaining:** hosted selected CI, immutable local exact-SHA Docker Release, uploaded 5 PNG ZIP and visual QA against NAV08, product-owner sign-off and independent legal publication/tenant source admissions. Keep Draft; no merge/deploy.
