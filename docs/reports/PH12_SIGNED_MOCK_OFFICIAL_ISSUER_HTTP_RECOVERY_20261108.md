# PH12 — Signed synthetic official-issuer simulator, HTTP E2E, recovery and trust limits
**Date:** 2026-11-08 | **PR:** #172 Draft | **Issue:** #171 | **Scope:** development laboratory only.

## Implemented, tested
- `scripts/ci/ph12-mock-official-issuer.cjs`: standalone HTTP server exclusively on `127.0.0.1`, with an ephemeral Ed25519 issuer key and a pinned public key passed **out of band** to the simulated verifier. Requires `TTO_PH12_MOCK_ISSUER_LAB=1`. Not imported by Nest, not reachable in an actual deployment, and makes **no real government request or DB update**.
- Signed envelope covers `issuerId`, `tenantId`, `entityId`, unique request `nonce`, `version`, `recordHash`, `status`, `observedAt` and `expiresAt`. Strict protected header and envelope fields, Ed25519 signature verification before processing, subject/nonce binding and expiry/future-clock checks.
- `CheckpointStore` writes a test-only local monotonic revision checkpoint with a temporary file, fsync and atomic rename; rejects malformed state instead of silently recreating it. The verifier serializes parallel requests per entity. Signed revoked status is sticky across verifier recreation; an attempted later CURRENT state is still HOLD.
- Any outage, non-200 HTTP response, invalid signature, mismatched issuer/tenant/entity, expired or future-issued payload, version rollback, same-version content equivocation, signed revocation or corrupt checkpoint is HOLD. The mock result `MOCK_ELIGIBLE_IN_LAB_ONLY` has `official:false`, `active:false` and **is never an approval or activation**.
- `scripts/ci/ph12-mock-official-issuer.test.cjs`: **21 actual HTTP tests** with real socket/Ed25519 signatures and fresh temp checkpoint files, including wrong key, tamper, replay, cross-tenant, expiry, stale version, revocation, outage and recovery, concurrency and test-only loopback enforcement.
- Existing `tests/sql/ph12-synthetic-official-authority-lab.sql`: separate **17 fictional SQL scenarios**, 1 mock-only eligible and 16 HOLD; rolled back. **75 migrations** run in disposable PostgreSQL 17; no new migration.
- CI integration: both `.github/workflows/ph12-board-legal-source-pg17.yml` and `.github/workflows/tto-adaptive-ci.yml` run the HTTP test suite and preserve legacy E2E regression.

## Verified GitHub Actions on head `f20a06c91058484819d923837a9c2d064f6d987e`
| Workflow | Run | Result |
| --- | --- | --- |
| PH12 board legal PG17 and API compile (NO DEPLOY) | https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42464719793 | SUCCESS, 75 migrations, 17 SQL mock cases, 21 HTTP signature/recovery tests |
| TTO adaptive security CI (NO DEPLOY) | https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42464719804 | SUCCESS, 21 signed-provider HTTP tests + existing 289 Nest/PG17 E2E checks |

Markers: `PH12_SIGNED_MOCK_HTTP_ED25519_RECOVERY_TESTS_PASS`, `PH12_MOCK_AUTHORITY_DISPOSABLE_PG17_PASS`, `TTO_CF02_IDENTITY_MANAGER_NATIONAL_E2E_PASS_CHECKS=289`.

## Boundaries and remaining future engineering
1. The simulator is **not integrated into a production-facing Nest service**, issuer adapter or persistent PostgreSQL source registry. This phase deliberately verifies a separate loopback issuer/consumer protocol and protects existing service from accidental trust promotion. Full real app-to-adapter E2E requires a **subsequent independently scoped gate**.
2. Temporary checkpoint stores offer lab-level durability against consumer re-instantiation and simulated outage. No HA, multi-instance coordination, durable distributed revocation channel, issuer key rotation or crash/power-loss recovery guarantee is claimed.
3. The test key is generated on each lab start. Real issuer root-of-trust onboarding/rotation requires independent credentials and policy, not a key furnished by the response.
4. Verifying a signed registry assertion is **not sufficient** for a valid cooperative board tariff resolution; historical appointments, joint signatory authority, quorum and qualified independent legal review remain separate. No automatic `APPROVED` or `ACTIVE` state is introduced.
5. For a production path, design an isolated signed issuer adapter, persistent per-issuer trust ledger, signed revocation checkpoint, rollout/rollback semantics, key rotation and app-level HTTP/DB tests under legal/operational release controls. Until then, PH12 is GREEN **only for the tested mock boundary**, legal/production HOLD.

**No Merge; no Deploy; no live tenant, personal, payment or stock data processed. PR #172 stays DRAFT; #171 and #173 stay OPEN, tariff ACTIVE BLOCKED.**
