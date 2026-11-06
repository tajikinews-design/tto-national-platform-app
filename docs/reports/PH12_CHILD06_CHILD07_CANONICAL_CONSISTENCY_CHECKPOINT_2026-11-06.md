# PH12 — CHILD06/CHILD07 canonical ownership & order-integrity checkpoint

**Date:** 2026-11-06  
**Scope:** Bounded, private, synthetic-only PostgreSQL17 implementation; source truth and legal acceptance remain HOLD.  
**Branch:** `feat/ph12-child06-child07-canonical-failclosed-20261106`  
**PR:** [#169 — DRAFT](https://github.com/tajikinews-design/tto-national-platform-app/pull/169), based on PR #168's audit branch; neither merged.  
**Post-consistency exact-head CI:** [42259971088](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42259971088), commit `57a4714b295e79f243fcd7b49f6ab98b7ce02e0f`, conclusion **SUCCESS**.

## Scope built and reviewed
- Migration `0044_ph12_child06_child07_canonical_failclosed.sql`: adds **ten private candidate tables** plus account classification on existing `ph06_shareholder_accounts`. Child06: versioned relationship, decision and profile. Child07: account-linked immutable ownership ledger, capital offer, valuation, sell order, buy request, staged lock and transfer case.
- Migration `0045_ph12_child06_07_contract_consistency.sql`: private, read-only source version/status/event discrepancy evaluator between latest Child06 candidate relationship and CF02 `relationship_projections`, **not** a synchronizer. Additional triggers reject oversized/self-buy requests; wrong seller, buyer, order and quantity in cases; lock owner/quantity mismatch; and immutable reference field changes in existing order/case/lock rows.
- All ten new tables FORCE RLS, REVOKE ALL from `tto_app` and PUBLIC; tenant-aware FKs for cross-tenant account/evidence/order/valuation relationships. No unreviewed runtime write/import interface.
- A `NON_MEMBER` account with synthetic source evidence remains distinct from MEMBER relationship, MEMBER role and any derived vote rights. Classification is **not** an approved non-member entitlement; legal rules and source verification still require owner approval.
- `child07_ownership_ledger_entries` only structurally permits `OPENING_VERIFIED` credit entries for an evidence-classified account and forbids every `LEGAL_TRANSFER` write. **This is a private candidate, not an approved official register or a production ledger importer.** Existing `ph06_try_finalize_transfer` still returns `false`, and transfer tables reject `TRANSFERRED`.

## Exact-head evidence
- [42259971088](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42259971088): replays **67 migrations** in an isolated disposable PostgreSQL 17; executes frozen source-index guard, canonical schema checks, synthetic checks with `BEGIN/ROLLBACK`, multi-tenant foreign keys, member/nonmember and version behavior, market cross-reference checks, immutable ledger and transfer blocker.
- Previous CI failure on same new test scope was diagnosed and fixed: shared OLD/NEW trigger branch accidentally referenced a column absent from `child07_share_locks`. Fix uses distinct table-specific branches; latest exact-head run succeeded.
- `PH12_CHILD06_CHILD07_FROZEN15_EXECUTION_CROSSWALK.json` preserves **7 MEMBER + 8 SHARE** source test IDs and marks all cases **PARTIAL_COVERAGE**; the exact original verbatim scenario-to-user-journey and independent approval chains remain absent.
- These checks are SQL engineering evidence only: **not** real users, official source truth, financial settlement, authorized share transfer, or signed legal acceptance.

## Authoritative-data boundaries: what is NOT done
1. **No single-writer cutover yet.** Legacy `ph06_membership_current`/events, new `child06_cooperative_relationships`, CF02 read-side `relationship_projections` and imported `member_source_snapshots` are NOT all canonical simultaneously. One authoritative Child06 writer, versioned event handoff, source-approved migration/reconciliation and rollback plan require explicit signoff before cutover.
2. **No official-source non-member rights integration.** Account classification lacks independent legal Rule Registry entitlement for voting or trading, separate identity verification and a user-facing authorized read/command path; default deny.
3. **No authoritative Child07 register admission.** The account-linked ledger is a protected candidate, not approved as formal ownership proof. Opening-balance provenance, legal ownership reconciliation, effective date, supply conservation and independent external register must be verified by responsible source owners.
4. **Market is DRAFT/STAGED.** No live order activation, price determination, atomic inventory reservation against the new ledger, order matching, regulated fee verification or legally approved transfer finalization. Never infer valid payment from webhook receipts or equate seller receipt to final transfer.
5. **No formal PH12 148/786 semantic parity or 155/155 source-journey acceptance.** CHILD06+07 schema/negative checks do not remove wider release gates.

## Next finite gate (requires source/legal reviewers, no automatic approval)
- A. Approve one Child06 source-writer/cutover contract and reconcile event versions with CF02 read models; refuse stale, gapped, differing or conflicting versions.
- B. Have source/legal owner attest non-member shareholder classification and explicit entitlement policy; verify personal rights, tenant access and separate audit evidence.
- C. Have Child07 official register source owner approve account-linked ledger provenance and opening stock reconciliation (including unknown holdings not rendered as zero). Build a source-verifiable ingestion adapter only after approval.
- D. Map each MEMBER-AT-001..007 / SHARE-AT-001..008 to source text, exact SQL + HTTP + UI path, independent QA and legal signoff. Only after these can a separate decision consider the existing transfer blocker.

**Decision:** `PH12_CHILD06_07_CANDIDATE_SCHEMA_AND_CONSISTENCY = GREEN (scoped technical)`; `SOURCE_OWNER_SEMANTIC_ACCEPTANCE = HOLD`; `REAL_OWNERSHIP_TRANSFERS = BLOCKED`; `MERGE/DEPLOY = NO`. No production change, no real shareholder data.
