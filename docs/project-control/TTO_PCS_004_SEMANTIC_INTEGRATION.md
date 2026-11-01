# TTO-PCS-004 — semantic reconciliation and isolated integration candidate

Date: 2026-11-01
Status: IN_PROGRESS until exact-HEAD CI and independent review.

## Inputs
- PCS #87 Draft SHA 3379f5f50b9856bf5329b6189697986499b75c9a
- App base #84 Draft SHA a5e211ec9933055657055d2bf64712d558fe6c0e
- App integration Draft #88 branch integration/tto-pcs-004-candidate-no-docker-20261101.
- Side branches #43, #44, #64, #73 from TTO-PCS-003. No blind cherry-picks.

## Semantic decision per side PR
- **#43**: old nav03-interactive-browser.cjs tests nine fictional cases on 1440 and 390 viewports, keyboard and safety, no actual API. Current scripts/e2e-shareholder-nav03-visual-review.cjs and test_shareholder_w1_nav03_browser_visual.py already check keyboard, dispute blocking finalization, ledger entry not transfer, 21 event steps, and no external requests. Action: preserve existing modern harness; do not import historical runner. Cross-check detailed case coverage before closure.
- **#44**: older synthetic-governance uses a tabbed case browser with five fake assembly/election records and explicit disabled download/voting. Current approved NAV04 synthetic-assemblies has its own approval-reviewed layout and default unverified state. Action: keep current approved visual shell; compare keyboard and audience/zero-vote rights tests before porting only unique assertion.
- **#64**: older @fontsource-variable/vazirmatn 5.2.8 self-host technique; current code has pinned local Vazirmatn woff2, SIL OFL license and offline source hash+Next localFont checks. Action: preserve current local font, lockfile, CSS and regression test; build without remote fonts.
- **#73**: competing synthetic-only W2.4 durable audit implementation includes a checkpoint anchoring the journal, all still locally corruptible. Current W2.4 offline-audit-ledger and later recovery coordinator are differently architected. Action: do not splice alternate journal into current W2 chain without threat and regression review. No verified durable distributed ledger claim.

## Candidate changes
- New scripts/ci/test_pcs004_integration.py: asserts current NAV03 safety semantics, NAV04 default-deny/rights, offline font and no live alternate journal import, no real trades in review UI. This is STATIC SEMANTIC regression, not Chromium E2E.
- Branch-scoped changes to .github/workflows/tto-adaptive-ci.yml: invoke current no-Docker build and offline regressions on PR #88.
- First CI run 41302692961 failed because a newly authored test referenced incorrect path w24-offline-audit-chain.cjs (not present). Corrected to actual w24-offline-audit-ledger.cjs at commit dcb78b4c12db06b293c5a9628f2259bb2dde12f0.
- Follow-up run 41302734260 associated with corrected SHA; status must be confirmed from GitHub before setting success.

## Mandatory acceptance boundaries
1. Exact HEAD successful Next/Nest workspace build, TypeScript and comprehensive offline tests.
2. Separate isolated real PG17 migration/RLS/HTTP/OTP E2E (not demonstrated by no-Docker workflow). Preserve all existing tests; not skip on final acceptance.
3. Four-pr patch semantic review for unique assertions, plus current NAV03/NAV04 browser acceptance on exact SHA.
4. User/product acceptance of architecture; pilot cooperative, Child06 membership and Child07 official share ledger approval.
5. No merge/deploy, real user information, payment, share lock or transfer without separate authority.

Outcome: PR #88 is only a provisional integration candidate. Wave 0 IN_PROGRESS; Wave 1 remains BLOCKED.
