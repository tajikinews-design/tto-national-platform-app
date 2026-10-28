# TTO NAV-08 — «پروژه‌های شرکت» / Synthetic Shareholder Review

**Date**: 2026-10-28 · **W1 shareholder section**: NAV-08 · **Status**: SOURCE IMPLEMENTED / EXACT SHA LOCAL RELEASE PENDING / VISUAL REVIEW PENDING.

**Parent**: NAV07 Draft PR #53 SHA `a719a7f317fa3084c90998005a7627490b5f28dd` (local Release and technical visual QA PASS). NAV04–07 accepted UI shell layouts remain unchanged; only sibling links upgraded to the new synthetic NAV08 review route in this branch.

## Approved sources and nine immutable menu labels
`TTO-NAVIGATION-INFORMATION-ARCHITECTURE v1.0`, `TTO-DASHBOARD-UI-IMPLEMENTATION-HANDOFF`, `TTO-IMPLEMENTATION-SPECIFICATION-MASTER`, and `TTO-UNIFIED-IMPLEMENTATION-PACK`:
1. پروژه‌های شرکت
2. پیشرفت پروژه‌ها
3. دارایی‌های قابل افشا
4. سرمایه‌گذاری‌های شرکت
5. پروژه‌های جدید
6. فرصت‌های همکاری
7. فرصت‌های شغلی
8. برنامه‌های مسئولیت اجتماعی
9. اثرگذاری محلی

**Domain ownership and boundaries**:
- **Child 12**: projects, investment portfolio, assets, legal permits, contracts, milestones and evidence-backed progress. Record existence `≠` ownership/license; published investment figures reference approved statements and **do not** establish a general accounting workflow. Shareholder-only read projections require independent **Transparency-approved** tenant, classification, source, version and access gates.
- **Child 17**: collaboration/EOI; EOI `≠` binding agreement, no pooled money, procurement separately subject to governing rules.
- **Child 18**: job/project opportunity; application restricted and requires separate legal/identity path, AI cannot silently make final rejection.
- **Child 19**: CSR program and local impact; activity `≠` output `≠` outcome `≠` impact. Measurements must carry methodology, evidence and version; automatic SROI prohibited.
- **Transparency/GRC**: no classified contract, ownership evidence, financial statement, confidential supplier info or individual beneficiary data without approved publication projection; review-only preview is not legal authority.

## Implemented non-operational UI
- `/review/interactive/nav-08`: RTL shareholder sidebar/header reused pixel-compatible from accepted NAV04–07, independent project-themed hero, four KPI, four summary panels, four shortcuts, and nine official submenus grouped 5+2+2.
- Three modes: `UNVERIFIED` (default deny / unknown never zero), `SOURCE_UNAVAILABLE` (unknown does not imply termination), `DEMO_CONTENT` opt-in.
- 18 `DEMO-PRJ-*` records (two per submenu), all `mockOnly:true`, `publication:DEMO_ONLY`, no ownership, permit, investment, activity or impact approval.
- Local React-only search, category switching and read-only details. Every investment, collaboration, document retrieval and application button permanently disabled.
- No API calls, auth/session handling, database changes, arbitrary finance figures, paid functionality, document download, company accounting or permission/tenant/source promotion.
- Prior NAV04/NAV05/NAV06/NAV07 pages remain visually unchanged; only NAV08 sidebar links are routed to the new dedicated review path on the child branch.

## QA and exact-SHA Release contract
- `scripts/ci/test_shareholder_w1_nav08.py`: 10 offline architecture gates.
- `scripts/ci/verify-shareholder-tsx.cjs`: parser includes NAV08 page/UI/fixtures.
- `scripts/smoke-next-otp.mjs`: default-deny route SSR, all nine labels, demo record absence.
- `scripts/e2e-shareholder-nav08-review.cjs`: actual isolated Chromium 1440/1536/768/390/320, all nine categories, explicit demo, no writes/external requests/overflow, SHA256 image manifest.
- `scripts/ci/run-local-docker.ps1`: Chromium script syntax preflight and mandatory NAV08 E2E after prior Phase4C/NAV07 steps.
- `scripts/ci/run-nav08-approved-visual-release.ps1`: pinned SHA only, disposable Docker, verifies all five SHA256 PNGs and emits ZIP for review.

**Current evidence**: GitHub connector source readback 25/25 targeted static assertions PASS; browser JS syntax parser PASS. **NO full local Next/TypeScript/Python/Chromium execution yet for NAV08; NO screenshots, NO product-owner sign-off.** Hosted Actions runner remains pre-start failed on previous PRs (issue #50), never interpret that as green.

## Release gates and non-goals
Do not enable real project creation, file download, confidential financial publishing, investment offers, legal permit/ownership badges, collaboration, recruitment or community-impact claims. Source-of-truth approvals, governing documentation, scoped membership roles, publication approval, accessibility, local exact-SHA Release and human visual review are required before any live use.

**NEXT**: Execute exact-SHA Docker Release on clean review branch and upload `TTO-NAV08-Visual-<sha12>.zip`. PR is Draft, stacked on Draft PR53, with no merge/deploy.
