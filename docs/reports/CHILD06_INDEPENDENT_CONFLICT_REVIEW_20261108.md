# CHILD-06 + PH12 | Independent evidence-bound conflict review — 2026-11-08

**Repository:** tajikinews-design/tto-national-platform-app · **PR #172:** Draft / unmerged  
**Technical verification:** GREEN in disposable synthetic CI · **Real legal source authentication:** HOLD · **Tariff ACTIVE:** BLOCKED

## Scope and purpose
The previous CHILD-06 as-of engine detected conflicts between company-registry and Official Gazette announcements (multiple CEO claimants, conflicting changes, correction forks/merges/cycles and overlapping signing rules). This stage creates an **immutable, traceable conflict-case review**, not an official signing authorization.

The real-name cooperative data for **تعاونی توسعه و عمران شهرستان طرقبه شاندیز**, corporate ID **14007823781** and registry **65549**, remains **user-supplied, official-source-unverified**. No personal national IDs are stored in public GitHub or displayed in the conflict tool. **Every additional conflict, evidence reference and disposition in CI is synthetic**.

## Implementation
- **Migration 0057** `database/migrations/0057_child06_conflict_evidence_independent_review_hold.sql`: 3 append-only, tenant-scoped tables: `cooperative_governance_conflict_cases`, `cooperative_governance_conflict_evidence`, `cooperative_governance_conflict_dispositions`. Every table has FORCE RLS, no direct `tto_app` raw access and immutable UPDATE/DELETE triggers.
- Cases record tenant, a Jalali `asOf` date, **exact conflict code emitted by the current as-of reducer**, SHA256 fingerprint of source facts (excluding volatile UTC known-at), opener, event time and request-key identity. The manager can open only an **actually observed conflict** in the tenant's real laboratory snapshot.
- Evidence records link to a **same-tenant existing archived notice or transition UUID**, a source reference, and an *optional claimed* SHA256 of a separate document. References are attached in the same transaction as case creation. This checkpoint stores **references/claimed hashes, NOT original PDF bytes** and never asserts that a PDF hash was verified independently.
- `tto.cooperative_review_governance_conflict` requires **LEGAL_REVIEWER** role. Reviewer must not equal the case opener, evidence submitter, archived notice author or transition author. CI explicitly demonstrates that a manager **who also holds LEGAL_REVIEWER role** still cannot review their own case. Reviewer must cite at least one **existing evidence_id of that case**; foreign/unbound/duplicated citations fail.
- One immutable disposition per case. Only three possible outcomes: `HOLD_OFFICIAL_SOURCE_REQUIRED`, `REJECT_SOURCE_CLAIM`, `HOLD_INSUFFICIENT_EVIDENCE`. No outcome can confer authenticated legal provenance, verified CEO/signing power or a tariff ACTIVE transition; the disposition table has invariant SQL CHECK constraints fixing both relevant flags to false.
- `tto.cooperative_governance_conflict_audit()` produces traceable case/evidence/review IDs, source fingerprint, review reason, evidence citations and timestamps, scoped to manager or independent reviewer. Shareholder permission does not expose restricted legal-review dossier details.
- NestJS: `POST /v1/tenants/:tenantId/child06/governance-conflicts`; `GET .../governance-conflicts`; `POST .../governance-conflicts/:caseId/review`. Return values explicitly keep `legalAuthorityVerified:false`, `officialEvidenceAuthenticated:false`, `tariffActivated:false`.
- Cookie-session Next.js BFF adds source and authorization checks, no-store, bounded JSON, strict UUID shape, role-based backend access and CSRF Origin check (including **only** an operator-pinned CI loopback origin); never trusts unverified X-Forwarded-Host to bypass origin restrictions.
- Persian RTL manager UI: `/legal-notice-archive`, with new `GovernanceConflictWorkbench` for as-of conflict selection and evidence references. Independent reviewer UI: `/governance-conflict-review`, with explicit tenant ID and role-scoped immutable HOLD/REJECT review. Neither page is deployed; development feature gate remains enforced.

## Actual GitHub CI evidence
| Test | Verified result |
| --- | --- |
| [Dedicated PH12 PostgreSQL 17, API compile, migrations, archive and immutable independent-review SQL fence](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42484923504) | **SUCCESS** · **79 migrations** |
| [Adaptive security, real NestJS, Next.js BFF, PostgreSQL 17 integrated suite](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42484923514) | **SUCCESS** · **449 controls** |
| New E2E marker | `CHILD06_INDEPENDENT_CONFLICT_EVIDENCE_REVIEW_NEST_NEXT_PG17_HOLD_PASS` |
| Positive controls | Correct manager opening a source-derived case, stable retry, permitted independent reviewer HOLD, intact evidence references, authorized manager/reviewer audit |
| Negative controls | Anonymous and member denied; reviewer cannot author a manager case; dual-role author cannot review; fake conflict rejected; non-existent evidence denied; forged positive tariff outcome rejected; changed replay rejected; late contradictory reviewer decision rejected; immutable UPDATE/DELETE denied; disallowed Origin denied; foreign evidence_id denied |
| Regression | Existing PH12 lab signed issuer / recovery tests and CHILD-06 as-of case E2E retained |

**Exact tested commit:** `86ff91a2a8db43ebc7629d5e055b4fdcc9eeeb58`. Earlier red build discovered malformed UUID regex in both new Next BFF routes, corrected without weakening session or Origin controls. Final runs above are SUCCESS.

## Remaining release/legal blockers
1. This process **adjudicates synthetic evidence sufficiency only**; it does not independently authenticate origin, corporate legal standing or the validity of registered board appointments. A `REJECT_SOURCE_CLAIM` is a review disposition of a source claim, not a final determination of corporate law.
2. Evidence objects preserve an existing notice/transition reference, human-readable source reference and optional *claimed* SHA256. Secure encrypted original-document storage, issuer signature verification, independently authenticated Gazette number/publication and external regulator trust connector require their own implementation and acceptance.
3. Real PH12 legal acceptance remains HOLD and tariff ACTIVE remains BLOCKED. No Merge, Deploy, production database migration, genuine registration, bank transaction or transfer of shares occurred.

**Workbook SSOT:** `TTO_Master_Execution_Roadmap.xlsx` content version **4.39**, new `C06_Review_v439`; append-only `Execution_Log` row 100 and `Version_History` row 67. PR #172 Draft/unmerged, Issue #171 open.
