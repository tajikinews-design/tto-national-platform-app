# PH12 — CHILD-06 / CHILD-07 field-to-current-PG17 contract crosswalk (engineering review, NOT formal acceptance)

**Freeze baseline:** `b0aaea001182bde504b44aad413809f5346d25df` · **CI run:** [42252992590](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42252992590) · **Date:** 2026-11-06

## Scope and guardrails
Reviewed 12 approved source entities and 75/75 source field phrases (CHILD-06: 5 entities, 32 fields; CHILD-07: 7 entities, 43 fields) against the actual 65-migration PostgreSQL 17 schema from PR #168 evidence: **141 tables, 911 columns**. This is an evidence-backed **manual candidate mapping**, **not** source-owner-certified semantic parity. No hosted database, payment, real holdings or live shareholder transfer was changed.

Status vocabulary: `STRUCTURAL_COLUMN_ONLY` = a relevant physical column exists but full meaning and tests are unapproved; `ALIAS_OR_PARTIAL` = alternate physical representation with a contract gap or equivalence requiring review; `READ_PROJECTION_ONLY` = CF02/read-side projection cannot own canonical truth; `GAP_OR_NO_CANONICAL_FIELD` = no complete matching canonical field demonstrated. The accompanying JSON covers every source field ID, candidate path and gap rationale.

## Entity review

| Child | Contract entity | Fields | Structural columns | Alias/partial | Projection | Gap/no canonical field | Related physical structures |
|---|---|---:|---:|---:|---:|---:|---|
| CHILD-06 | MEMBERSHIP_APPLICATION | 7 | 4 | 2 | 0 | 1 | `tto.ph06_membership_applications` |
| CHILD-06 | COOPERATIVE_RELATIONSHIP | 8 | 2 | 2 | 2 | 2 | `tto.relationship_projections; tto.ph06_membership_current; tto.ph06_membership_events` |
| CHILD-06 | SHAREHOLDER_ACCOUNT | 6 | 3 | 1 | 0 | 2 | `tto.ph06_shareholder_accounts` |
| CHILD-06 | MEMBER_PROFILE | 5 | 0 | 0 | 0 | 5 | `tto.ph06_membership_current` |
| CHILD-06 | RELATIONSHIP_DECISION | 6 | 0 | 2 | 0 | 4 | `tto.ph06_membership_applications` |
| CHILD-07 | SHARE_OWNERSHIP_LEDGER_ENTRY | 8 | 1 | 4 | 0 | 3 | `tto.ph06_ownership_ledger` |
| CHILD-07 | CAPITAL_OFFER | 5 | 0 | 0 | 0 | 5 | `—` |
| CHILD-07 | SHARE_SELL_ORDER | 5 | 0 | 0 | 0 | 5 | `tto.ph06_transfer_cases` |
| CHILD-07 | BUY_REQUEST | 4 | 0 | 0 | 0 | 4 | `tto.ph06_transfer_cases` |
| CHILD-07 | SHARE_LOCK | 6 | 1 | 4 | 0 | 1 | `tto.ph06_share_locks` |
| CHILD-07 | TRANSFER_CASE | 8 | 1 | 6 | 0 | 1 | `tto.ph06_transfer_cases` |
| CHILD-07 | VALUATION_REPORT | 7 | 0 | 0 | 0 | 7 | `tto.ph06_transfer_cases` |

Totals: 75 fields. By status: `STRUCTURAL_COLUMN_ONLY` 12; `ALIAS_OR_PARTIAL` 21; `GAP_OR_NO_CANONICAL_FIELD` 40; `READ_PROJECTION_ONLY` 2. **Formal semantic parity: 0 certified; formal owner sign-off: pending.** This is not an assertion that zero requirements are implemented.

## Findings ranked for downstream implementation

### Blockers — ownership boundaries
1. **Child06 membership master:** `ph06_membership_applications`, `ph06_membership_events`, `ph06_membership_current` implement an isolated approval/event/current-state skeleton. The canonical `COOPERATIVE_RELATIONSHIP` is incomplete: effective dates, relationship type owned by Child06, legal basis and explicit decision record/authority reference are not established. `relationship_projections` belongs to CF02 projection, not membership truth. Historical source snapshots (`member_source_snapshots`) are source-admission read models, not master truth.
2. **Child06 shareholder account:** `ph06_shareholder_accounts` has tenant/party/account/status, but lacks `shareholder_type` and `bank_info_refs`. `shareholder_source_accounts` is a restricted source read model with FK to `member_source_snapshots`, so the mandated **non-member shareholder** path is not proven and requires explicit separate eligibility/access design.
3. **Child07 official ledger:** `ph06_ownership_ledger` is append-only (immutable trigger) and has an isolated delta-based skeleton. It references `party_id`, not canonical `shareholder_account_id`; `recorded_at` is not necessarily legal `effective_at`; previous owner and explicit direction fields are absent. `shareholding_source_snapshots` is an immutable *read snapshot*, not the authoritative Child07 ledger.
4. **Child07 market workflow:** no complete canonical `CAPITAL_OFFER`, `SHARE_SELL_ORDER`, `BUY_REQUEST`, or `VALUATION_REPORT` tables observed in current catalog. A `ph06_transfer_cases` record does not substitute for offer/order/request/valuation lifecycle. It has partial seller/buyer/quantity/payment/approver fields, but not all separate fee and approval/evidence relationships.
5. **Transfers stay prohibited:** `ph06_try_finalize_transfer` unconditionally returns `false`; table constraint forbids `TRANSFERRED`. The separate positive transfer lab creates a temporary `ph06_lab` schema, drops blocker **inside a transaction**, and ends in `ROLLBACK`. Those synthetic assertions must never be construed as authorization to enable real transfers.

### Existing bounded engineering controls, not final acceptance
- `ph06_decide_membership` uses application version/row lock and saves an immutable membership event; its signature takes `p_actor` and source evidence but is not evidence that independent legal authority has been verified end-to-end.
- `ph06_try_lock_shares` serializes competing seller locks by tenant+party advisory transaction lock and checks owned minus locked quantity; its model is still party-based and synthetic.
- Read functions `my_member_profile_from_source` and `my_shareholding_from_source` require scoped verified identity, CF02 matching event/version, source approval and appropriate restrictions; these are controlled source projections only, not a real-authority importer or canonical ledger.
- `source_import_batches` and `source_import_claims` are immutable quarantine metadata with assessment-only function, not production source admission.
- `tests/sql/ph06-member-share-frozen15.sql` tests 7 MEMBER and 8 SHARE **derived** assertions. The original frozen acceptance registry in `docs/analysis/PH06_MEMBER07_SHARE08_SOURCE_TESTS.json` has null code assertion/run fields. Exact current-head signed original user-journey-to-test formal acceptance is still missing.
- In CHILD07, payment evidence must remain **buyer → seller**, any required fee **payer → cooperative**, and **payment reported/verified ≠ transfer finalized**. No wallet, cash custody, or general ledger is authorized.

## Bounded next changes (no scope expansion)
1. **CHILD06 canonical source-owner review:** approve/reject column aliases and design the missing relationship validity, decision, authority, shareholder type and non-member shareholder account rules; preserve CF02 as a projection only.
2. **CHILD07 independent official ownership model:** approve the account-linked append-only ledger, legal effective time, original owner/source case, and corresponding register-reconciliation evidence. Explicitly distinguish current import snapshots from canonical writes.
3. **Market/case completeness:** model capital offer, sell order, buy request, valuation/report validity, expiry/release of lock, separate payment/fee/evidence chains; do **not** remove transfer blocker.
4. **Acceptance mapping:** update each of the 15 frozen MEMBER/SHARE IDs to exact SQL/HTTP/integration test and exact-head run evidence, with independent QA and legal/source owner sign-off. Include non-member shareholder, 2-tenant isolation, concurrency, source-version replay/gap, fee evidence, SoD and crash/rollback scenarios.
5. **Only after approvals:** independent CI on disposable PG17, replay all current migrations, compare precise fields and check invariants; then discuss operational go/no-go separately.

## Decision
**Engineering inventory/crosswalk completed for scope 75/75; source semantic parity NOT CERTIFIED; PH12 HOLD; PH13/real trading/payment/merge/deploy HOLD.**

**References:** [Child source index](../analysis/PH01_SOURCE_148_ENTITY_FIELD_INDEX.json), [Historical candidates](../analysis/PH01_148_ENTITY_FIELD_PHYSICAL_CANDIDATES.json), [Current schema audit script](../../scripts/ci/ph12-physical-parity.py), [Migration 0009](../../database/migrations/0009_child06_07_sourced_self_service_reads.sql), [Migration 0010](../../database/migrations/0010_child06_07_import_quarantine.sql), [Migration 0020](../../database/migrations/0020_ph06_member_share_synthetic_boundary.sql), [Frozen derived tests](../analysis/PH06_MEMBER07_SHARE08_SOURCE_TESTS.json).
