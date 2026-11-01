# TTO-PCS-010 — Actual Nest/PG Session & Fictional Review Audit: Verified Limited Vertical Slice
Date 2026-11-01 | App PR #99 Draft, parent #97 | Technical validation only.

## Source and evidence
- App exact SHA a073e9638f0414377afffc21eded1b10f6217250.
- GitHub Actions run 41309869200, job 124857797398: COMPLETED SUCCESS. PCS-010 real session/manager tenant role and PostgreSQL fictional approval audit step SUCCESS; other core steps passed.
- No production merge, deploy, official Child06/07 source, payment, transfer or real shares.

## Implemented
1. `database/migrations/0011_pcs010_fixture_review_lab.sql` introduces nonauthoritative, append-only `tto.pcs010_fixture_reviews` tenant/actor/fixture audit table. Strict fictional reference prefix, nonofficial CHECK constraint, RLS FORCE, privilege REVOKE, immutable trigger. Includes a guarded SECURITY DEFINER function requiring active context and COOPERATIVE_MANAGER role.
2. `services/api/src/module.ts` exposes `POST /v1/pcs010-lab/tenants/:tenantId/fixture-reviews` only when CI=true, TTO_PCS010_LAB=1, no Vercel/real SMS and strictly local disposable `tto_app` database URL. It resolves the **real opaque bearer session** via `tto.resolve_session`, runs the transaction under the verified actor+tenant and appends a fictional audit event. It does not update membership or shareholding sources.
3. `scripts/ci/pcs010-real-nest-pg.test.cjs` tests a real launched Nest instance on temporary PostgreSQL17, created genuine test sessions and tenant roles, denies missing session, MEMBER approval, wrong tenant, official-looking reference and duplicate, checks persisted audit actor/tenant and no official share snapshot.
4. Branch-scoped CI applies migration 0011 **only in the disposable PCS010 test database** on PR #99. Existing baseline CI executes migration 0001..0010 separately. No production migration applied.

## Important limitations
- Only an **authenticated API fixture approval** is verified. Manager UI of PCS007/008/009 remains a separate browser-only fictional demonstration and is NOT wired to this Nest endpoint.
- The actual shareholder page reads no new production holdings or officially approved Child06/07 source. No Party link to an official member or shareholder is claimed. Missing data must remain unavailable, never treated as zero.
- The 0011 table is an experimental noncanonical audit. A production audit model requires design review, retention/access policy and explicit sign-off before migration into shared deployment environments.
- Requires owner acceptance of Wave0 integration baseline and legal/data owner decision on official source roles and pilot before authentic data.
- The test does not authenticate a real person (it creates fake users and bona fide test PG sessions), nor prove delegation evidence for a real cooperative board. A real COOPERATIVE_MANAGER database role alone is not sufficient legal delegation.
- Never grant share edits, ownership transfer, payment custody or live trading on the basis of this CI result.

## Next independently verifiable increment
TTO-PCS-011 should wire a **protected manager Next BFF** to the Nest session/role-guarded fictional-only POST, implement a manager-facing status/audit view with real PG test sessions, and test it end to end through Chromium in the disposable stack. Before any shareholder-specific visibility, establish verified Party linkage and separately approved Child06/Child07 source gates. Avoid extending old memory-only broker.
