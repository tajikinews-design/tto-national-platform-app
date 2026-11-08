# CHILD-06 / PH12 — Bitemporal board-and-signing as-of reconstruction

**Recorded:** 2026-11-08 | **PR:** #172 (Draft, unmerged) | **Legal PH12:** HOLD | **Tariff ACTIVE:** BLOCKED | **Workbook:** 4.37

## What was actually delivered
The preceding 0054 append-only company-register/Gazette archive and Torghabeh-Shandiz source-supplied named test fixture are preserved. New **Migration 0055** adds immutable, tenant-scoped, append-only `tto.cooperative_notice_transitions` with source-declared `CORRECTED` and `REVOKED` actions, optional replacement notice, claimed effective date, separately known publication date, source reference, audit timestamp, per-manager request-key replay protection and guaranteed `USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED` provenance. It makes no legal authorization decision and does not mutate the underlying 0054 archive.

`tto.cooperative_governance_temporal_facts(knownAt)` emits a bounded, tenant-member/manager/legal-reviewer scoped snapshot containing notices, board/CEO events, signing rules and transitions captured before the requested **system-known timestamp**; counts beyond caps fail closed rather than silently truncating and selecting a partial board. Raw `tto_app` table access remains disallowed; RLS forced and UPDATE/DELETE blocked.

`services/api/src/governance-temporal.ts` reconstructs **source-declared** office candidates, concluded office histories and signing rules against **asOf** (Jalali event/effective date), **publishedOn** (when a particular source change became published), and **knownAt** (what was recorded in the platform by that system timestamp). It deliberately does NOT treat the newest notice, a change's claimed effective date, or a role name as a certified power of representation.

### Fail-closed rules
- A published correction only supersedes the targeted immutable original after both claimed **effect** and **publication** dates have passed. The replacement must be a separately stored source notice. An unpublished or future-dated correction cannot quietly replace the original. A correction linked to another notice does not make that replacement applicable before the transition is effective/published.
- A source-declared revocation suppresses its target after both dates pass; previously corrected targets do not auto-resurrect.
- Missing publication date creates an explicit `NOTICE_PUBLICATION_UNKNOWN` / `TRANSITION_PUBLICATION_UNKNOWN` issue. It never creates legally verified status.
- Same-day contradictory events for the same person's office, two simultaneous claimed CEOs or overlapping signing rules produce `CONFLICT_HOLD`, not a silent winner.
- Previous CEO resignation and newly announced CEO appointment are retained separately. Reported term-end is enforced on as-of reconstruction without backdating unknown tenure start dates.
- `knownAt` is independent of historical effect dates: a notice imported only today does not appear in a historical view restricted to a time before it was registered. Caller-requested future knowledge time is denied.
- The result returns `SOURCE_DECLARED_ONLY`, `INCOMPLETE_SOURCE_HOLD`, or `CONFLICT_HOLD`, and always `officialSourceAuthenticated:false`, `legalSignerAuthorityGranted:false`, `boardLegallyApproved:false`, `tariffActivated:false`.
- No personal national identification numbers, company financial workflow, CHILD07 ownership changes or actual tariffs are exposed or altered.

### Application surfaces
- Nest: `POST /v1/tenants/:tenantId/child06/notice-transitions` (manager-only, intake feature flag), `GET /v1/tenants/:tenantId/child06/governance-as-of?date=1404%2F08%2F06&knownAt=...` (tenant member/manager/legal-reviewer, history feature flag). All operations require valid bearer and DB tenant context.
- Shareholder BFF: `GET /api/tenants/:tenantId/governance-as-of`, private HttpOnly session, trusted backend workload identity, strict denial on invalid/no upstream data, never legally approved.
- Shareholder RTL: `/tenants/:tenantId/governance-as-of`; choose a Jalali as-of date and optional **known-at** time, view reported office candidates, ended offices, signing rules, source gaps, conflicts and citation notice IDs. Linked from the existing governance history screen.
- Manager API can append correction/revocation source claims; direct UI form for this new transition API is not yet included (separate bounded follow-up), and official source attestation is pending.

### Actual regression evidence
| Scope | Status |
|---|---|
| [Dedicated PostgreSQL 17](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42479169508) | **SUCCESS**; 77 migrations; SQL role/RLS/immutability; prior root-signed independent-anchor restore PASS |
| [Adaptive real Nest + Next + PG17](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42479169588) | **SUCCESS**; **384** integrated checks |
| User-supplied Torghabeh-Shandiz named initial notice | Retained, nine board/CEO role events, two signing rules, original Gazette publication time still unknown |
| Synthetic correction | Later separate Gazette notice changes CEO and signing claim at 1404/10/10, published 1404/10/11: does **not** apply on 1404/10/10; applies after publication |
| Historical knowledge cut-off | With knownAt before correction recording, original claims are reconstructed even when asOf is later |
| Synthetic revocation | Claimed effective 1405/01/01, published 1405/01/02: replacement persists until publication; after publication it is removed without reviving older superseded notice |
| Conflict | Another independently archived mock CEO at 1404/10/12 produces `CONFLICT_HOLD` and `MULTIPLE_CLAIMANTS:CEO` |
| Authorization | Anonymous shareholder BFF rejected, tenant-crossing rejected; shareholder cannot insert corrections, manager's replay conflict rejected, immutable transitions cannot be deleted |
| Safety | No real co-op tenant onboarded, no real money/share operations, no historical authenticity inferred |

CI-verified code head: `214ce78e7e2970f47810d2091ceb392ad252e4e1`. Runner markers:
`CHILD06_GOVERNANCE_BITEMPORAL_CORRECTION_REVOCATION_CONFLICT_REAL_HTTP_PG17_PASS`, `TTO_CF02_IDENTITY_MANAGER_NATIONAL_E2E_PASS_CHECKS=384`, `PH12_LEGAL_SOURCE_DISPOSABLE_PG17_SCHEMA_PASS count=77`.

## Deliberate uncertainty and release boundaries
- Public original of the registered Torghabeh notice (Gazette issue/notice number, publication date, immutable original issuer) remains absent. Its current snapshot is **provisional** and explicitly marked publication unknown.
- Mock corrective and revoked notices and a second contradictory CEO are **CI-only fictional**, not events concerning the real cooperative.
- Date parsing validates canonical Jalali-style year/month/day ranges and month-day bounds but does **not** constitute a full statutory Iranian calendar / leap-day legal effective-date adjudication; that validation and source timing must be formally reviewed before production use.
- Corrections treat the replacement as a whole-notice supersession. Partial corrections and mixed registry/Gazette precedence should receive separately defined source-specific semantics before real activation.
- `COOPERATIVE_MANAGER` may record *self-reported claims* only; no independent legal reviewer authority, signatory credential or accepted corporate membership is granted.
- PR #172 remains **Draft**, unmerged; no Deploy, real official source registration, tariff activation, money or share transfer.

**Outcome:** TECHNICAL_GREEN in tested scope; official issuer/legal PH12 HOLD; production tariffs ACTIVE BLOCKED.
