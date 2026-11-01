# TTO-PCS-003 — Four side-PR blob-level reconciliation and integration baseline
Date 2026-11-01. **Documentation-only reconciliation, no code merges or runtime acceptance.**

## Proven inputs
- Control baseline: PCS #86 HEAD f8278ec3633c37342aca34a4d9b68a378aeb0590 (Draft).
- Candidate application: PR #84 HEAD a5e211ec9933055657055d2bf64712d558fe6c0e, 436 blobs, Draft.
- Side PRs: #43 9bcdddfd653088c4ca98e7268e9642d93ed743c0; #44 fb5bf402400e6149a4d131bd7138e6186f9c9457; #64 a69239c5767771422f1ed4eed06f40347f5b301b; #73 78a590b2db9a2aab5a630a463affc11ba89d62c1.
- Method: GitHub PR changed-file listings compared to exact SHA-1 *Git blob IDs* in recursive trees of each side PR head and candidate #84. A different blob proves different bytes, not necessarily missing functionality or regression. No semantic patch-by-patch resolution or runnable CI execution claimed in this pass.

## Exact file inventory summary
| Side PR | Changed files | Identical blobs in candidate | Absent paths in candidate | Present with different blobs | Decision |
|---|---:|---:|---:|---:|---|
| #43 NAV03 browser | 3 | 0 | 2 | 1 | REVIEW / SELECTIVE TEST PORT |
| #44 NAV04 alternate assemblies | 14 | 0 | 7 | 7 | REVIEW / DO NOT OVERWRITE CURRENT NAV04 |
| #64 offline font variant | 10 | 0 | 2 | 8 | REVIEW / KEEP CURRENT FONT BASELINE UNTIL BUILD VALIDATED |
| #73 alternate W2.4 journal | 8 | 0 | 6 | 2 | REVIEW / ISOLATE ALTERNATIVE SECURITY LAB |

## Missing path detail (not proof missing behavior)
### #43
- scripts/ci/nav03-interactive-browser.cjs
- scripts/ci/test_shareholder_nav03_interactive_browser.py
Different: scripts/ci/run-review-phase3b-docker.ps1.
**Recommendation:** inspect tests for unique keyboard/browser assertions and port those to the current NAV03 suite if absent, avoiding old Docker runner replacement.

### #44
- apps/shareholder/app/review/interactive/nav-04/governance-fixtures.ts
- apps/shareholder/app/review/interactive/nav-04/governance.css
- apps/shareholder/app/review/interactive/nav-04/synthetic-governance.tsx
- scripts/ci/nav04-interactive-browser.cjs
- scripts/ci/run-shareholder-w1-nav04-acceptance.ps1
- scripts/ci/test_shareholder_nav04_browser_contract.py
- scripts/ci/test_shareholder_w1_nav04_acceptance_runner.py
Different: nav-04/page.tsx, interactive/synthetic-dashboard.tsx, historic report, run-review-phase3b-docker.ps1, test_shareholder_w1_nav04.py, verify-shareholder-tsx.cjs, smoke-next-otp.mjs.
**Recommendation:** current candidate uses NAV04 assemblies fixtures/TSX; historical governance variant is an alternative, not an automatic replacement. Preserve unique acceptance assertions only after semantic review; retain approved current UX.

### #64
- docs/reports/TTO_W1_PR63_GOOGLE_FONT_BUILD_REMEDIATION_2026-10-30.md
- scripts/ci/test_vazirmatn_selfhost_build.py
Different: all three portal layout.tsx, all three package.json, shared styles.css and pnpm-lock.yaml.
**Recommendation:** current candidate contains local Vazirmatn asset and a different offline build test. Validate offline font packaging and build; do not replace current lockfile with an old fork.

### #73
- docs/contracts/shareholder-w2-4-durable-security-audit-v0.1.json
- docs/reports/SHAREHOLDER_W2_4_DURABLE_AUDIT_CHAIN_GITHUB_2026-11-01.md
- scripts/ci/test_w24_durable_audit_contract.py
- scripts/ci/w24-bff-nest-pdp-audit-chain.test.cjs
- scripts/ci/w24-durable-audit-ledger.test.cjs
- scripts/security/w24-durable-synthetic-audit.cjs
Different: .github/workflows/tto-adaptive-ci.yml, scripts/ci/test_w23_dormant_boundary_contract.py.
**Recommendation:** competing synthetic journal implementation must be isolated from W2.4/W2.12/W2.13 current candidate until feature-by-feature behavioral comparison; DO NOT indiscriminately cherry-pick or grant operational authority.

## Baseline selection
**Recommended candidate for future integration testing, not an approved release:** PR #84 exact SHA a5e211ec9933055657055d2bf64712d558fe6c0e. Preserve its cumulative main-path UI, Next/Nest/Postgres and W2 laboratory regression suite. Separately bring in PCS docs from #86/#87 as reviewed documentation. Do not force merge 80 Draft PRs; use isolated integration candidate and explicit selected reconciliation commits only after patch review.

## Test acceptance specification (NOT RUN here)
1. Pin all compared SHA, confirm branch ancestry and inspect all 4 side PR diffs for unique tests and behavior.
2. Resolve unique vs superseded checks in each PR with reviewed code diffs, and commit explicit exceptions only.
3. Run full offline pnpm workspace install, build, TypeScript, 3 Next apps + Nest API exact-head checks.
4. Disposable PostgreSQL17 migrations 0001..0010, RLS isolation, no-bypass user context, invalid tenant and cross-tenant adversarial HTTP.
5. Explicit test-only SMS fake provider: Next BFF -> Nest -> PG login/logout, replay, revocation, cookie/origin/rate-limit across three portals.
6. Verify read-model fail-closed behavior for Child06/Child07, Child09 notices and trade requests, including no fake no-data=0.
7. Private Chromium 11 NAV route/desktop/tablet/mobile/keyboard/contrast/visual and no external-requests preview checks; protected authorized reviewer separately.
8. W2 synthetic tests maintained as supplements; log each PASS/FAIL/SKIPPED against exact SHA. Do NOT downgrade real DB/E2E gates to pass based on no-Docker CI.
9. No merge, deploy, actual shareholder PII, SMS or real share transaction without separate owner approval.

## Outcome / wave gate
PCS-003 **BLOB RECONCILIATION DOCUMENTED**, semantic/manual reconciliation and integration builds **PENDING**. Wave 0 **IN_PROGRESS / G0-G2 not complete**. Wave 1 blocked by official Child06 membership, Child07 ledger and pilot/legal approvals. Never mark operational MVP accepted.
