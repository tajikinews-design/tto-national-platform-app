# PH12 / Issue #171 — official-source provenance & revocation gate (HOLD)

**Scope:** cooperative tariff board resolutions only. No general accounting, payment execution, share ownership or transfer; never claim legal acceptance solely because PostgreSQL or HTTP tests pass.

## Current trustworthy chain (what the application can prove)
1. Tenant-scoped draft `DRAFT_UNVERIFIED` (migration 0047).
2. File/document version/hash/CLEAN scan and *claimed* board signatories (0048). A clean document does not authenticate a signature.
3. Source-check observations, versions, hashes, observer and declared lifetime. Results are only `PENDING_OFFICIAL_VERIFICATION` or `SOURCE_REJECTED` (0049–0050).
4. Independent `LEGAL_REVIEWER` disposition linked to precise same-tenant source-check IDs (0051). Only `LEGAL_HOLD_SOURCE_UNVERIFIED` / `LEGAL_REJECTED`.
5. Append-only source-check invalidation reports and dynamic assessment (0052). The `SOURCE_REVOCATION_REPORTED` reason is **not** issuer-authenticated revocation; similarly a `SOURCE_UNREACHABLE` report is a conservative hold, not evidence of authenticity.
6. The as-of assessment can only report `HOLD_SOURCE_MISSING`, `HOLD_SOURCE_EXPIRED`, `HOLD_SOURCE_REJECTED`, `HOLD_SOURCE_INVALIDATED`, or `HOLD_OFFICIAL_SOURCE_UNVERIFIED`. It never reports ACTIVE/APPROVED, regardless of how many claims/sources exist.

## Mandatory real-source connection still missing — cannot be inferred
| Official source needed | Competent issuer/owner | Required authenticated evidence | Decision |
| --- | --- | --- | --- |
| Cooperative legal identity and exact tenant match | Not established for each cooperative | Official identifier, source owner identity, verification method and signed version | HOLD |
| Board roster / appointment terms at resolution date | Not established | Authoritative historical roster, term bounds, revocations | HOLD |
| Current bylaws / signing powers / joint signature | Not established | Effective version and source-native legal authority policy | HOLD |
| Minutes, quorum, notice, resolution scope | Not established | Source-native record and independent legal sufficiency finding | HOLD |
| Changes / cancellation / supersession | Not established | Authenticated status history and monotonic revision/checkpoint | HOLD |

**Do not** infer authenticity from arbitrary URLs, uploaded PDF hashes, self-declared names, a manager role, a reviewer role or test fixtures. A real connector is impossible to trust until the competent source owner, endpoints, API credentials/authentication, legal mandate, freshness SLA, revocation semantics and owner-approved verification keys have been established. No official-source credentials/registries have been configured or queried by this change.

## Release gate for a future, separately reviewed connector
- Pin a cooperative-to-official-issuer source identity outside a user-controlled submission; verify organization identity first.
- Distinguish the date of board resolution from the date of verification. Verify signatory term, quorum and joint-signature policy **as of the resolution**.
- Verify source provenance with issuer-controlled authentication or official offline verification and independent attestation; compare signed payload/hash/version.
- Store authoritative status and revocation checkpoint with monotonic versioning, authenticated time and expiry. On timeout, stale cache, source unreachable, rollback, new revocation or concurrency, **fail closed**.
- Make independent legal decision and activation a **separate transactionally enforced, time-of-use recheck**; an earlier HOLD/technical review can never be elevated into approval.
- Demand positive and negative SQL/HTTP, concurrent replay, redaction, cache freshness, recovery and real issuer test evidence before promotion.

## Test evidence
GitHub Actions are authoritative only after actual run results appear. Both test suites are intended to run on disposable PostgreSQL17; `TTO_PH12_LEGAL_SOURCE_INTAKE_ENABLED` is used only for synthetic E2E, not enabled in deployed environments. No Merge or Deploy has been requested.

**Disposition:** PH12 legal acceptance HOLD; `ACTIVE` blocked; Issue #171 remains open; PR #172 Draft.
