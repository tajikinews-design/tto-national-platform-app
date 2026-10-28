# TTO — NAV-06 «خدمات من» — اجرای نمونه مستقل و مبتنی بر معماری مصوب

**Date:** 2026-10-28 · **Scope:** W1 / Shareholder / review-only
**Status:** SOURCE_IMPLEMENTED / LOCAL_DOCKER_RELEASE_PENDING / HUMAN_VISUAL_PENDING
**Dependency:** NAV04 approved visual PR #48; NAV05 Draft PR #49, HEAD at branch creation `86185514de0dd800a423c0cf554e1db9108af4b2`. No merge, deploy or legal-source activation authorized.

## Authoritative sources
- `TTO-NAVIGATION-INFORMATION-ARCHITECTURE-v1.0`: exactly eleven shareholder NAV06 submenus.
- `TTO-DASHBOARD-UI-IMPLEMENTATION-HANDOFF-v1.0`: reuse approved RTL panel shell, **DO NOT REDESIGN**.
- `TTO-IMPLEMENTATION-SPECIFICATION-MASTER-v1.0`: Academy / Events / Benefits ownership, Action/Calendar projection, eligibility and source boundary.
- `TTO-UNIFIED-IMPLEMENTATION-PACK-v1.0`: CHILD14 Academy+Events, CHILD15 Benefits non-cash, separate domains and release gates.
- `docs/analysis/NAVIGATION_CONTRACT.json`: tenant context required; permission/real routes not yet approved; `REVIEW_SHELL_ONLY` until source admission.
- `packages/ui/src/shareholder-section-config.ts`: personal services require official source, verified membership and eligibility.

## Implemented UI
- Static synthetic review route `/review/interactive/nav-06` based on NAV04 accepted `assemblies.css`, identical 11-root sidebar, header, four KPI, four info panels and four action shortcuts; new CSS exclusively for service content.
- Eleven official submenus, without rename or omission:
  1. خدمات من
  2. درخواست‌های من
  3. آکادمی
  4. دوره‌های من
  5. رویدادها
  6. رزروهای من
  7. گواهی‌های آموزشی
  8. مزایای من
  9. Voucherها
  10. خدمات شرکت
  11. تقویم من
- Sixteen clearly tagged `DEMO-*` static fixtures for layout inspection only, search, filtering, 11 menu buttons, local detail with close, keyboard navigation and responsive tablet/mobile layouts.
- State model `UNVERIFIED` (default), `SOURCE_UNAVAILABLE`, `DEMO_CONTENT` accessible solely through collapsed reviewer toolbox / explicit opt-in. Unknown values show `—`, not `0` or inferred negative eligibility.
- Six types of domains mapped explicitly:
  `CHILD14_ACADEMY` for learning/certificate;
  `CHILD14_EVENTS` for events/registration/waitlist/capacity;
  `CHILD15_BENEFITS` for noncash benefit/entitlement/voucher;
  `COOPERATIVE_SERVICE` for company offerings;
  `SERVICE_REQUEST` for personal requests; and
  `ACTION_CALENDAR_PROJECTION` for cross-domain dates and reminders.
- **Hard prohibitions:** attendance ≠ course completion; certificate ≠ legal/professional qualification; non-cash reward ≠ shareholder dividend; no cash wallet, cash withdrawal, or voucher secret; projection ≠ workflow/source ledger.
- Explicit `disabled` controls for all registration, booking, redemption, document download and real submission. No `fetch`, XHR, session data, POST, tokens, background job, DB, migrations or production API change.

## Changed source inventory
- `apps/shareholder/app/review/interactive/nav-06/{page.tsx,synthetic-services.tsx,services-fixtures.ts,services.css}`
- Existing navigation links from NAV01, NAV04 and NAV05 to the new NAV06 route. NAV04/NAV05 layouts unchanged, only hrefs updated **on this new child branch**; accepted PR48/PR49 branches themselves untouched.
- `scripts/ci/test_shareholder_w1_nav06.py`: 10 static architecture/security tests.
- `scripts/ci/verify-shareholder-tsx.cjs`: include NAV06 TSX files in existing AST gate.
- `scripts/smoke-next-otp.mjs`: default-denied SSR route + 11 categories + no MOCK fixture leak.
- `scripts/e2e-shareholder-nav06-review.cjs`: actual private Chromium at 1440,1536,768,390,320; menu actions, mobile, default deny, disabled commands, source loss, no external/writes/overflow, 5 PNGs with SHA256.
- `scripts/ci/run-local-docker.ps1`: NAV06 browser required by complete Release after NAV05.
- `scripts/ci/run-nav06-approved-visual-release.ps1`: isolated exact-SHA Windows PowerShell Docker runner and screenshot manifest ZIP.

## Evidence and release gate
- Source readback / static connector assertions: 25/25 checks were evaluated on the new branch; a syntax parse of browser JS succeeded. **These are not actual Python/Next/Playwright execution results.**
- Execution still required for exact target SHA:
  `python3 -m unittest discover -s scripts/ci -p 'test_*.py' -v`;
  `node scripts/ci/verify-shareholder-tsx.cjs`;
  `pnpm build && pnpm check`;
  `node scripts/smoke-next-otp.mjs`;
  `scripts/ci/run-local-docker.ps1 -Suite Release -ExpectedCommit <sha>`.
- Chromium screenshots required: 5 images with logged SHA256, verify ZIP and human visual acceptance before product-owner approval.
- GitHub hosted CI still blocked pre-run with no runner/steps, see Issue #50. Local pass does not create a hosted pass.
- Strict: no deployment, no merge, no upgrade of billing budget, no feature gate activation or approval of official source until separately authorized.

**Formal status:** NAV06 review UI implemented in a separate Draft PR, awaiting actual exact-SHA local Docker/Chromium Release, screenshot inspection, owner acceptance and hosting gate restoration.
