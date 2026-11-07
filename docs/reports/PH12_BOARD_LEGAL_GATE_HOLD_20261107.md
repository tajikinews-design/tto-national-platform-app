# PH12 Board-resolution authority gate — integration boundary (HOLD)
Issue: #171. Candidate code: `services/api/src/ph12-board-legal-gate.ts`.

## Delivered
- Pure fail-closed legal-eligibility evaluator (no write access, no ACTIVE status).
- Synthetic test cases for tenant/draft separation, review independence, signer tenure,
  missing joint signature, document/source validity, revocation, quorum and time bounds.

## NOT delivered / NOT proven
- Migration 0048 was **not located/verified** on this branch; reported 70 migrations are not independently evidenced here.
- No PostgreSQL migration, RLS/role policy, API route, Nest provider binding, direct-DB guard,
  transaction lock, audit outbox, external official registry adapter, or live authority attestation.
- Test file is committed but **not executed** as part of CI by this change.
- No tariff is activated, and no real legal acceptance is claimed.

## Required implementation order
1. Inventory *actual* migration 0048 / tariff draft and dossier tables, status enum,
   service entrypoints and authority data ownership. Do NOT assume table names.
2. Add source-versioned verifier records and immutable legal-review decisions in new
   additive migration with tenant RLS, grants, audit metadata and cross-tenant FKs.
3. Bind an authenticated independent reviewer to the existing dossier lifecycle;
   source checks must use official attributable evidence, not client-supplied booleans.
4. Implement one transaction-only activation boundary: SELECT ... FOR UPDATE
   draft and dossier; re-verify source/version/effective window, independent approval,
   revocation epoch and tenant; authorize with least-privilege DB role;
   atomic state update + immutable audit/outbox in same transaction; default deny.
   Never allow a general API database role to update ACTIVE directly.
5. Add PostgreSQL adversarial tests: direct role bypass, cross-tenant FK/RLS,
   concurrency/replay, rollback, stale/revoked signature, revocation race and crash recovery.
6. Add HTTP integration tests (401/403/404, role spoofing, reviewer self-approval,
   cross-tenant IDOR, expired evidence, concurrent attempts), map to Issue #171 evidence.
7. Publish exact CI run, migration list, SHA and owner-signed external source decision
   before requesting review.

## Gate policy
`PH12=HOLD`; `TARIFF_ACTIVE=BLOCKED`.
No merge, deploy or production action is authorized by this branch.
