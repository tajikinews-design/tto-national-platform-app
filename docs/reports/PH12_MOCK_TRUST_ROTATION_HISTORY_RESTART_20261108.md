# PH12 — Synthetic trust rotation fencing, immutable key history and Nest restart recovery
**Date:** 2026-11-08 | **Issue:** #171 | **Draft PR:** #172 | **Scope:** disposable CI-only lab.
**Head verified:** `21daef9d09f47a0d527c1143eaab26cd16ab6e11`.

## Delivered
1. Updated `tests/sql/ph12-mock-issuer-bridge-ci-schema.sql` (intentionally NOT a production migration) with append-only `tto.ph12_mock_lab_trust_history`, a `BEFORE UPDATE OR DELETE` guard on the pinned trust record, and a trigger recording `BOOTSTRAP` and `ROTATION` transitions. Distinct keys and strictly sequential epochs are mandatory; reuse of an earlier pinned key and changes to issuer/tenant identity are denied.
2. Existing synthetic `tto.ph12_mock_lab_checkpoints` remains authoritative across two Nest processes for signed issuer version, record hash, sticky revocation and trust epoch. No `tto_app` direct table privileges, FORCE RLS.
3. Extended `scripts/e2e-cf02-identity-authority.cjs` to assert:
   - invalid epoch zero and epoch rollback fail;
   - discarded signing key cannot be reintroduced even with a fresh epoch;
   - response signed by retired key fails while the new endpoint is available, independent of outage;
   - two historical transitions are recorded, with old key/epoch and new key/epoch, and the audit rows cannot be deleted;
   - after a newly signed source revocation, a **fresh Nest process** reads the persisted revocation checkpoint from shared PG17 and still returns HOLD;
   - all returned results include `syntheticOnly:true`, `officialSourceAuthenticated:false`, `boardLegallyApproved:false`, `tariffActivated:false`.
4. No network connection to Iranian registry, real cooperative, shares, financial records, production tenants, or tariff approval. No application migration changed.
5. Fixed two test-only implementation errors before acceptance: string-substitution corruption of an SQL mock file, and missing `digest` in its restricted search path (replaced by built-in PostgreSQL17 `sha256(bytea)`). Existing historical failed runs remain available in GitHub.

## Evidence — PASS
| Workflow | Final verified run | Outcome |
| --- | --- | --- |
| PH12 isolated PG17, all 75 migrations, 17 fictional SQL cases, 21 signed mock HTTP tests, API typecheck | https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42467137977 | SUCCESS |
| Full adaptive API and security real Nest+PG17 E2E, two Nest instances, durable mock key history, restart and revocation | https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42467138046 | SUCCESS: `TTO_CF02_IDENTITY_MANAGER_NATIONAL_E2E_PASS_CHECKS=328` |

Specific marker: `PH12_NEST_PG17_TWO_INSTANCE_SIGNED_ISSUER_ROTATION_REVOCATION_PASS`.

## Limits and release gates
- This confirms **shared PG17 fencing for two Nest processes** and test-only issuer key update history; it does NOT implement cryptographically root-authorized rotation, quorum-controlled trust administrators, multi-region PostgreSQL consensus, database crash/restore, or official real-world registry attestation. A superuser can bypass lab-only controls; no such administrative privileges are granted to `tto_app`.
- Key update is performed by the disposable CI fixture acting as a trusted administrator. The application API accepts no key material from callers.
- The lab-only trust tables are not part of the 75 product migrations; no production persistence, connector or release path is established.
- Positive response is `MOCK_ELIGIBLE_IN_LAB_ONLY`, **not legal verification**. Existing tariff remains `DRAFT_UNVERIFIED`.
- PR #172 stays Draft and unmerged; Issues #171 and #173 stay open; PH12 legal HOLD; tariff ACTIVE blocked; no Merge, Deploy, real transactions, live data or transfers.

**Next bounded engineering candidate:** signed and independently governed trust-root rotation protocol with replay/rollback protection and database-failure/recovery test, still in CI-only lab. Any production adapter requires separate review and legally authoritative issuer mapping.
