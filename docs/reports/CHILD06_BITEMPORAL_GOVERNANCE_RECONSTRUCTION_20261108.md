# CHILD-06 / PH12: Bitemporal board and signing-authority reconstruction
**Execution date:** 2026-11-08 · **Draft PR:** #172 · **Issue:** #171 · **Master execution workbook:** 4.37

## Actual delivery
A source-declared, tenant-scoped point-in-time reconstruction engine has been implemented and exercised through **real NestJS HTTP + PostgreSQL17 + shareholder Next BFF** with synthetic correction, revocation and contradictory board declarations.

1. `database/migrations/0055_child06_bitemporal_notice_transitions.sql`: append-only `cooperative_notice_transitions` for `CORRECTED` and `REVOKED` actions. Cross-tenant transition targets and same-request conflicting replay are rejected; transitions carry a claimed effective Jalali date, separate optional publication date, authenticated submitting actor, explicit unverified-source provenance and immutable history. No raw `tto_app` table permission, forced RLS and approved SECURITY DEFINER functions.
2. `tto.cooperative_governance_temporal_facts(p_known_at)`: role/tenant-scoped, bounded historical notices, appointment/resignation events, signing rules and correction/revocation events. Historical **knowledge cutoff** uses actual recorded/submitted timestamps rather than inventing issuer publication dates. A source exceeding upper bounds fails closed rather than quietly truncating records.
3. `services/api/src/governance-temporal.ts`: deterministic reducer distinguishing the claimed **effective date (Jalali)**, the notice/revocation **publication date (Jalali)** and what had been **recorded by a requested timestamp (knownAt, UTC instant)**. No last-notice-wins shortcut. Does not silently resurrect a source superseded then revoked. Flags unknown publication and missing source, conflicts among same-day events, multiple CEOs/board-office claimants, overlapping signed document rules, or conflicting notice transitions. Expired offices and signing rules are excluded. The output is explicitly `SOURCE_DECLARED_ONLY`, `INCOMPLETE_SOURCE_HOLD` or `CONFLICT_HOLD`, never legal approval.
4. Nest controller: `POST /v1/tenants/:tenantId/child06/notice-transitions` and `GET /v1/tenants/:tenantId/child06/governance-as-of?date=YYYY/MM/DD&knownAt=ISO8601`, gated with existing Child06 archival feature flags and bearer/tenant authorization.
5. Shareholder protected BFF: `GET /api/tenants/:tenantId/governance-as-of` and Persian RTL page `/tenants/:tenantId/governance-as-of`. The archive page links to the point-in-time view. BFF returns `verified:false` and refuses upstream output suggesting real official/source/authenticated voting or tariff approval.
6. SQL fence `tests/sql/child06_governance_bitemporal_fence.sql`, and expanded actual Nest/PG17/Next E2E.

## Synthetic regression matrix
- Real named *source-declared* Torghabeh–Shandiz fixture (company **legal-person ID 14007823781**, registration **65549**; owner-supplied 1404/08/06 board event and ending 1406/12/20) reconstructs the previously reported CEO's resignation and the reported new CEO. Original publication date is unknown, so the result is **INCOMPLETE_SOURCE_HOLD**, not official signatory authority.
- Invalid date and cross-tenant access rejected; anonymous shareholder Next BFF returns 401.
- Completely fictional Gazette correction dated 1404/10/10 but published 1404/10/11 leaves earlier reported source in the pre-publication snapshot; after publication its replacement appears, while original source facts remain immutable.
- Query `knownAt` preceding the correction's actual database recording reconstructs the previously known state.
- Fictional revocation effective 1405/01/01 but published 1405/01/02 is excluded before publication and applied from the publication date. An older, already-superseded notice does not silently revive.
- A separate fictional contradictory Gazette CEO notice makes the snapshot **CONFLICT_HOLD** instead of choosing the newest announcement as lawful manager.
- Correction replay is idempotent, conflicting replay rejected, cross-tenant mutations refused and revocation history non-deletable. No such fictional person or Gazette change is asserted to be a fact about the real cooperative.
- Positive-looking returned data always has `officialSourceAuthenticated:false`, `legalSignerAuthorityGranted:false`, `boardLegallyApproved:false`, `tariffActivated:false`.

## CI evidence
- Dedicated PG17 run https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42479169508: **SUCCESS**, all **77** product migrations, SQL fences, prior 21 synthetic Ed25519 checks and full disaster-recovery lab.
- Adaptive security run https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42479169588: **SUCCESS**, `CHILD06_GOVERNANCE_BITEMPORAL_CORRECTION_REVOCATION_CONFLICT_REAL_HTTP_PG17_PASS` and `TTO_CF02_IDENTITY_MANAGER_NATIONAL_E2E_PASS_CHECKS=384`.
- Development checkpoint tested: `214ce78e7e2970f47810d2091ceb392ad252e4e1`. An additional privacy-only correction removed the submitted person's real national-ID literal from the regression fixture in subsequent head `b8281b9e265b3f1395428c420746c65fcee7cd8a`; final verification should be tied to the newest successful CI runs. Older public Git history may retain the literal; the current patch does not erase historical Git objects.

## Limitations (not optional)
- This reconstructs **source-supplied claims**, not legally certified company positions. The official registration announcement number, original official source, verification of legal effective date and signatory authority are still pending. An advertised effective date is not necessarily the legally authoritative date; this code conservatively respects known publication and reports unknown facts as HOLD.
- No gazette scraping, official issuer connector, legal interpretation of invalid decisions, director identity resolution across aliases, full statutory quorum adjudication, complete historical import, tribunal hierarchy or formal correction of published false entries is claimed.
- A single `knownAt` timestamp captures historical database knowledge. Operational-grade retroactive correction workflows may require issuance and acceptance evidence beyond this lab.
- This branch is **Draft and unmerged**. No deploy, real company insertion into production, tariff activation, share transfer, banking or real-person ID processing took place.

**Decision:** `TECHNICAL_BITEMPORAL_SCOPE_GREEN`; `CHILD06_PROVENANCE_PUBLISHED_UNVERIFIED`; `PH12_LEGAL_HOLD`; `TARIFF_ACTIVE_BLOCKED`; `PR172_DRAFT_NO_MERGE`.

**Next bounded engineering task:** handle uncertain historical event order, duplicated competing Gazette sources, a clearer evidence-reconciliation UI, and explicit provenance-vs-effectiveness policy tests before any broader operational acceptance.
