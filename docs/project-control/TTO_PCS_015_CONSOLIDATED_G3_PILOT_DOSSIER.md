# TTO-PCS-015 — Consolidated Wave-0 candidate and legal pilot decision dossier
Date: 2026-11-01
State: CANDIDATE_FOR_OWNER_REVIEW; NOT ACCEPTED; no merge, deploy, official source or live trade.

## Provenance and proposed freeze
- App code ancestor: Draft PR #107 SHA cb533fd6f06dde8cdeccd8f0adf4665901e33b55. This incorporates earlier application draft chain #84 → #90 → #93 → #95 → #97 → #99 → #101 → #103 → #105 → #107 through cumulative branch ancestry; preserve these branches and original PR reviews.
- Document source: Draft PR #108 SHA 37254e741357f36e6414d9172c60bdefc527d7ff, containing project-control decisions and audit reports #85–#108.
- Integration candidate: branch integration/tto-pcs-015-wave0-candidate-20261101, based on the app SHA with the control documents added as explicit commits. No cherry-pick of side implementations #43/#44/#64/#73.
- **Known documentation exception:** docs/project-control/TTO_PCS_009_AUTH_AUDIT_GAPS.md could not be copied because the GitHub connector write was blocked by safety checks. Its original version remains available unmodified in Draft PR #108. DO NOT claim a complete documents consolidation or waive this exception.
- A branch-scoped CI condition forces FULL RELEASE (not doc-only LITE) on the consolidated candidate; this includes workspace build/TS, disposable PG17 migrations and real identity/tenant/source E2E, historical regressions, and four OCI image smoke builds without registry push. An exact-head SUCCESS on this branch is required for technical gate.

## Wave-0 owner decision: proposed, not presumed
Decision request W0-G3: approve or reject the frozen cumulative app candidate and a reconciliation plan for the missing PCS009 document, with explicit technical/codeowner and product/QA sign-offs.
Technical CI PASS is not the same as human product, legal or operational acceptance. Until codeowner review, missing document reconciliation, manual RTL/keyboard/accessibility verification and owner sign-off, status remains WAVE_0_IN_PROGRESS.
Do not merge to main or deploy unless the owner issues a separate explicit direction after reviewing full cumulative app delta and controls.

## Independent official source authority
CHILD06 membership: nominate legally accountable cooperative membership custodian; identify authority, data controller, purpose, source authenticity (signature/attestation), Party linkage, source version/as-of/effective times, residency/retention, access matrix, revocation, conflict resolution and independent reviewer.
CHILD07 share register: nominate independently authorized register custodian; verify official account-to-Party mapping, source event/ledger entries, exact quantities (including explicit true zero), signed version, custody, reconciliation, immutable provenance, revocation, lawful access and change authority. Child06 approval cannot imply Child07 approval.
PILOT: owner selects a specific cooperative and accountable representative, statutory authorization, processing agreement, secure separated test environment, data minimization, rollback, pilot review and signoffs. NONE selected or approved during this task.
No official data imports, external finance, money custody, trade request activation or actual share transfer.

## Decision table
| Item | Finding | Gate |
|---|---|---|
| cumulative app | PR #107 is the provisional engineering baseline | G2 technical candidate |
| PCS history | 21/22 docs copied; PCS009 document blocked on connector write | DOCUMENT_RECONCILIATION_OPEN |
| CI full release | exact-head workflow still to be observed | G2 pending |
| manager/read-only shareholder | synthetic approvals and existing BFF/Nest/Postgres tested in prior PRs | legal owner signoff pending |
| Human RTL/UX/WCAG | not verified for consolidated candidate | G3 pending |
| Child06 | no official source owner authorization | blocked |
| Child07 | independent ledger custodian authorization missing | blocked |
| Pilot | no cooperative nominated or authorized | blocked |
| Merge/deploy | not requested or authorized | forbidden |

## Resumption
Verify final PR SHA and full-release Actions run; correct any exact CI failure without weakening negative tests. Open/retain a Draft PR for review, record run ID in checkpoint. Resolve the blocked PCS009 document using an authorized reviewed change without modifying its meaning, then conduct explicit owner/codeowner Wave-0 acceptance and separate legal/pilot decisions.
