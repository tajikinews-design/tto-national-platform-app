# TTO-PCS-014 — Chromium shareholder self-service source gating and official pilot decision record
Date: 2026-11-01

## Technical acceptance scope
- App Draft PR #107 branch feat/tto-pcs-014-shareholder-browser-sources-20261101, initially SHA 3b64cae6a41b79bb2e703324ebb88d28206087dc, based on PR #105.
- This feature stage does not create a new test-data broker. Extends the existing real Nest+Next+PostgreSQL17, actor/Party/source integration test in scripts/e2e-cf02-identity-authority.cjs to run Chromium at mobile 390px and desktop 1440px.
- Four test-only authorizations/states: (1) both sources unapproved => independent unavailable, not zero; (2) Child06 active, Child07 unavailable; (3) distinct approved Child06 and Child07 synthetic authoritative-in-CI fixtures => share count 37; (4) new approved source snapshot explicitly says zero => zero, with ledger version. Tests reject horizontal overflow and client JavaScript exceptions, while pre-existing suite continues asserting cross-tenant/cross-Party access denial, revoked sessions and revoked/expired sources.
- All fictional approved CI data are confined to disposable PostgreSQL. No real member/holding, production approval, finance, purchase/sale/transfer or merger.

## Decision: activation of official Child06 membership (BLOCKED)
Authority to resolve: nominated pilot cooperative board/legal representative and independent official membership data steward.
Required evidence: official identifier/issuing authority, signed or authenticated source export, permitted purpose/legal basis, retention and deletion policy, tenant boundary, person/organization mapping, evidence integrity, source version/effective and as-of dates, conflict resolution, separate import reviewer and immutable audit.
Approval is independent from general platform ownership and must be documented by responsible legal authority and source steward with scope, validity and revocation.

## Decision: activation of official Child07 share ledger (BLOCKED INDEPENDENTLY)
Authority to resolve: official share-register custodian and legally competent cooperative approval body, separate from Child06 issuer.
Required evidence: verified shareholder account→Party binding, source statement or signed ledger, immutable entry references, exact integer share quantity, independent ledger version and as-of time, source/custodian signature, ledger event chronology, reconciliation on contradictions, explicit zero only where official approved ledger states zero, retention/revocation and independent auditor.
Child06 membership cannot derive ownership, and manager's PCS010–012 fake approval/audit events cannot authorize Child07 or mutate ownership.

## Pilot cooperative decision (NOT SELECTED)
Owner must explicitly nominate a cooperative and authorized contact; specify geographic/tenant scope, legal data controller and processors, an approved secure environment, test population and schedule, restrictions on sensitive data, independent signoffs from Child06 and Child07 stewards, legal review, data protection and rollback. No real dataset is necessary or permitted for this PCS task. Do not invent the cooperative name or approval record.

## Gate/acceptance matrix
| Gate | Required evidence | State |
|---|---|---|
| W0-G3 | reviewed consolidated candidate and owner/codeowner product acceptance | PENDING |
| UI-G2 | exact-head Chromium 390/1440 with actor/Party and Child06/07 transitions on disposable PG17 | WAIT CI RESULT |
| UX-G3 | independent human accessibility, keyboard and visual approval | PENDING |
| CHILD06-AUTH | lawful official membership data steward approval and provenance | BLOCKED |
| CHILD07-AUTH | independent lawful official share-ledger approval and provenance | BLOCKED |
| PILOT-AUTH | nominated cooperative and operating/data-processing permissions | BLOCKED |
| PROD | explicit owner approval of merge and separately approved deployment | NOT AUTHORIZED |

## Technical and design limitations
- Browser automation is not proof of a human accessibility audit or compliance with every WCAG criterion.
- Test fixtures are constructed by an isolated CI database administrator. No official authority is implied by a CI source_contract_approvals flag.
- The shareholder page remains read-only, fails closed with unknown/unavailable source and does not expose trade actions. Official production display must remain blocked until independent source and identity/Party controls are formally approved.
- Regressions from the existing Nest/Next/Postgres test suite continue to be necessary.

## Resume point
Check exact app PR #107 HEAD and workflow run 41313270388. If failing, preserve failure, fix the specific cause and rerun. Update CURRENT_CHECKPOINT and ACCEPTANCE_REGISTER with exact SHA/run ID and remaining blockers. No merge/deploy, real user data or actual trades.

## Final exact-head technical validation
- App Draft PR #107 exact HEAD cb533fd6f06dde8cdeccd8f0adf4665901e33b55.
- GitHub Actions run **41313801001**, job **124869513540**, COMPLETED **SUCCESS**.
- All eight Chromium scenario markers PASS: BLOCKED_BOTH, CHILD06_ONLY, BOTH_APPROVED_37, EXPLICIT_ZERO, each at widths 390/1440; real isolated Next/Nest/PostgreSQL17 sessions and synthetic source approvals used. Existing source/tenant/Party negative and revocation E2E suite passed.
- Earlier run 41313270388 FAILED on new page goto waiting for networkidle for 45 seconds. Replaced browser readiness with DOMContentLoaded and explicit UI element checks, reran exact SHA successfully.
- No manual human WCAG/keyboard acceptance or officially authorized Child06/Child07/pilot. G3 remains PENDING; no merge/deploy or real shareholder information.
