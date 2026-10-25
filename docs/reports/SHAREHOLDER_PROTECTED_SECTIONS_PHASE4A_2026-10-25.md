# Shareholder portal Phase 4A — authenticated eleven-section foundation

**Date:** 2026-10-25  
**Status:** `IN_PROGRESS` — code on an isolated feature branch; exact-SHA local Docker Release, runtime browser acceptance, and legal/owner approvals remain pending.  
**Immutable Phase 3b UI baseline:** `8c3e5e6aadc6914f062d9f26caa8ac0c1aef4336` (Draft PR #29, visual acceptance PASS).  
**Review-only route:** `/review` and `/review/nav-02..11` remain unchanged and anonymous design-only.

## Completed slice — seven authenticated placeholders without simulated business data

The operational shareholder route hierarchy `/` + `/modules/nav-02..11` already existed. OTP/session restoration, tenant discovery, revocable CF01/CF02 scope checks, Child06 membership and Child07 holdings independent reads, and the closed Child07 requests/Child09 notices read models **already existed**. This phase reuses these controls rather than rebuilding them.

Previously, the following seven module routes displayed only a static anonymous placeholder. They now mount the same shared `OtpLogin` → `ShareholderWorkspace` **only after validated session restoration/OTP**, and show a source/approval-closed section using the existing tenant picker and explicit scoped verification:

| NAV | Scope | Permanently closed in this phase |
| --- | --- | --- |
| NAV-04 | مجامع و انتخابات | No official voting, meeting decision, electoral authority or self-publication |
| NAV-06 | خدمات من | No service request or personal case without owner contract |
| NAV-07 | فروشگاه و فرصت‌ها | No purchase/payment and no conflation with stock trading |
| NAV-08 | پروژه‌های شرکت | No invented project schedule, budget or progress |
| NAV-09 | شفافیت و اسناد شرکت | No file download without independent authorization, no general accounting |
| NAV-10 | گزارش‌های من | No fabricated count, portfolio or personal report |
| NAV-11 | تنظیمات حساب | No account changes, security updates or session mutation |

`NAV-02`, `NAV-03`, and `NAV-05` retain their existing source-aware, closed-by-default functional shells. `NAV-01` already has an OTP entry. All 11 navigation labels come from one file `packages/ui/src/shareholder-navigation.ts`. Source/authority descriptions for the seven new sections are in the pure, typed and inert `shareholder-section-config.ts`.

### Security invariants

1. Neither public design pages nor generic SSR descriptions reveal member/tenant-private data. The protected module content is mounted only when `/api/auth/session` verifies a current login or existing OTP is verified.
2. A successful session is **not** membership, share ownership, download permission or execution authority. The existing tenant picker/verification operates before source-backed personal data. Changing tenant aborts stale requests and resets the previous scope.
3. New section panels contain no API clients, forms, action buttons, POST mutations or downloadable documents. An authorized tenant alone still leaves these seven sections without source approval.
   - **Data minimization:** when the active workspace view is an informational-only section, verifying tenant context returns without fetching Child06 membership or Child07 ownership. A later explicit switch to membership/overview and new verification may request these independent authorized sources.
4. Invalid NAV IDs continue to be rejected by the existing route parser. No new route/BFF/Nest API, database migration, share ledger, cash wallet or settlement is introduced.
5. Child07 request and Child09 notices source admission packet remains unchanged: both remain BLOCKED with 15 independent PENDING controls. Records and notice publication require approvals from responsible legal and data owners, and cannot be inferred from UI or green tests.
6. Separately: official e-voting is not hosted in this MVP; financial/statutory disclosures are shareholder transparency only, not general accounting; marketplace goods/services differ from share purchase/sale.

### Files changed

- `apps/shareholder/app/modules/[id]/page.tsx` — route mapping and fail-closed OTP mount for remaining seven NAV slots
- `packages/ui/src/shareholder-navigation.ts` and `packages/ui/src/index.tsx` — cycle-free single source of the original 11 labels
- `packages/ui/src/shareholder-section-config.ts` — typed legal/source boundary descriptions
- `packages/ui/src/otp-login.tsx` — pass the selected section only to verified shareholder workspace
- `packages/ui/src/shareholder-workspace.tsx` — protected section rendering with shared tenant-scope state, without new data sources
- `packages/ui/src/styles.css` — responsive RTL readable notices
- `scripts/ci/test_shareholder_phase4a.py` — offline contract and regressions

Existing `scripts/smoke-next-otp.mjs` continues to verify old protected modules and legacy SSR placeholders; the new Phase4A-specific offline suite separately asserts that newly routed NAV modules mount `OtpLogin` under session gating.

### Verification and promotion gates

| Gate | State |
| --- | --- |
| Phase 3b exact-SHA 584 Chromium controls and 84 visual images | `PASS` **only for** preceding immutable SHA |
| Branch code for Phase 4A | `IMPLEMENTED_CANDIDATE` |
| Static/source contract analysis on Phase 4A branch | `PASS` for checks explicitly recorded in handoff |
| Python Phase 4A test under exact new branch source | `PENDING_LOCAL_RUN` until output captured |
| Next TypeScript/Next production build and private Postgres17 Core/Release regression | `PENDING_LOCAL_DOCKER` on exact new SHA |
| Browser navigation/keyboard/mobile test after session authentication | `PENDING` (synthetic local only) |
| Source/legal and tenant-specific approval for new operational sections | `BLOCKED` |
| Hosted GitHub Actions | `BILLING_RESTRICTED` independent of Docker |
| PR merge, main change, production DB or production deployment | `NOT_AUTHORIZED` |

**Do not use Phase 3b's 584 PASS as proof that Phase 4A code builds.** Use `scripts/ci/run-local-docker.ps1 -Repository <clean-exact-commit-worktree> -ExpectedCommit <Phase4A HEAD> -Suite Release` on Windows Docker Desktop; isolated PG17 and disposable Node22 resources only. Verify resulting transcript. No merge without owner's separate explicit approval.
