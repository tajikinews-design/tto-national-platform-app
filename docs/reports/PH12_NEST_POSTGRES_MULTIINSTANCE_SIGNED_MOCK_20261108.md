# PH12 — Mock issuer connected through real NestJS, shared PostgreSQL 17, two instances
**Checkpoint date:** 2026-11-08 | **PR #172:** Draft, unmerged | **Issue #171:** legal HOLD | **Project master:** v4.32.

## What actually runs
1. `scripts/ci/ph12-mock-official-issuer.cjs` runs a synthetic HTTP issuer on loopback, ephemeral Ed25519 signing keys. No official institution or real cooperative is contacted.
2. A new `Ph12MockIssuerBridgeController` in `services/api/src/module.ts` accepts `POST /v1/tenants/:tenantId/ph12/lab/signed-issuer-recheck` with only `{entityId:"SYNTHETIC_..."}`. It runs **only** when `NODE_ENV=test`, `TTO_LOOPBACK_E2E=1`, `TTO_PH12_MOCK_ISSUER_LAB=1`, and `VERCEL` is absent; otherwise 503. A valid authenticated session and permitted independent `LEGAL_REVIEWER` role are required; a manager or document reviewer with added legal role is denied.
3. `tests/sql/ph12-mock-issuer-bridge-ci-schema.sql` creates `tto.ph12_mock_lab_trust` (approved synthetic issuer URL, key ID, version/epoch, PEM) and `tto.ph12_mock_lab_checkpoints` (per-tenant+synthetic-entity version/hash, revoked flag, trust epoch) **only inside disposable CI PostgreSQL17**. It is NOT a migration; production DB never receives it. Tables enforce FORCE RLS, lack `tto_app` raw-table privileges; functions are tenant-role-bound SECURITY DEFINER.
4. The bridge calls `ph12_mock_lab_lock_trust()`, locking the per-tenant trust row `FOR UPDATE` throughout the PostgreSQL transaction; therefore separate NestJS processes and administrator fixture key rotation share one transaction-serialized trust decision. HTTP fetch is only to a DB-pinned 127.0.0.1 URL and carries a fresh random nonce.
5. The Nest adapter validates exact protected header (alg Ed25519, expected kid, expected synthetic format), signature with the pinned public key, issuer ID, tenant UUID, synthetic entity and nonce, source version, SHA-256 hash syntax and observation/expiry. No caller-supplied issuer URL or key can change the decision.
6. After cryptographic verification, `ph12_mock_lab_accept` serializes source version/hash per tenant/entity, rejects rollback, same-version equivocation and trust-epoch rollback, and persists sticky signed revocation. The function returns either a HOLD code or `MOCK_ELIGIBLE_IN_LAB_ONLY`, *never* a legal approval. All API responses include `syntheticOnly: true`, `officialSourceAuthenticated: false`, `signerAuthorityAuthenticated: false`, `boardLegallyApproved: false`, `tariffActivated: false`.
7. Existing original `tto.ph12_tariff_drafts` stays `DRAFT_UNVERIFIED`, and the 0049–0053 issuer candidate/legal evidence tables are not promoted or edited by the bridge.

## Implemented integrated E2E
- Full real NestJS HTTP authentication and authorization: 401 anonymous, 403 member, 403 manager even if manager also has a LEGAL_REVIEWER assignment, 400 for non-synthetic entity.
- Post/GET through actual Nest+PG17 transaction with pinned off-band Ed25519 key; POST creates durable *synthetic-only* tenant-specific checkpoint.
- Wrong tenant without pinned trust HOLD, signed response tampering HOLD.
- Temporary issuer outage HOLD; recovery requires new valid signed response. Signed revision v2 accepted; old v1 prevented from overwriting the shared PG checkpoint.
- Two independently launched NestJS processes (ports 31997/31998) concurrently accept consistent v2 signed responses; one shared checkpoint/version persists.
- Rotated fixture trust record to epoch 2 with **different ephemeral key ID and Ed25519 public key**, then second Nest instance accepts signed v3; old signer response rejects even when old issuer is accessible and returns a signed reply. **Rotation is administered by disposable test DB fixture, not authenticated official trust onboarding or a root-signed production key rollover.**
- Revoked signed v4 persists in PostgreSQL and is HOLD; later signed CURRENT v5 remains HOLD when processed through the other Nest instance (sticky revocation).
- Checked existing tariff draft remains `DRAFT_UNVERIFIED`.

## Real GitHub Actions evidence (after fixing TypeScript and mixed-role authorization)
| Run | Status | Evidence |
| --- | --- | --- |
| https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42466516701 | SUCCESS | Dedicated PG17 replay of **75 migrations**, earlier SQL 17/17 synthetic cases, 21/21 independent signed HTTP tests, Nest typecheck |
| https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42466516678 | SUCCESS | Original full E2E extended from **289 to 321 checks**, marker `PH12_NEST_PG17_TWO_INSTANCE_SIGNED_ISSUER_ROTATION_REVOCATION_PASS` |

Earlier first-pass attempts uncovered a TypeScript type guard and mixed manager/legal role privilege escalation. Both were fixed before the GREEN runs; failure evidence remains inspectable in earlier GitHub workflows. Final executed head at successful run: `76dcd83140bd2b0eb8e6e478b69f757c08aed457`.

## Honest limitations and next boundary
- This tests two independent **NestJS processes sharing one disposable PG17 instance**, *not* two different PostgreSQL nodes, failover clusters, distributed issuer replicas or certified durable revocation feeds.
- `FOR UPDATE` transaction locks serialize only within the shared PostgreSQL authority domain. Availability during failure of PostgreSQL, disaster recovery, backup integrity, monotonic trusted-time, signed root key rotation, transaction retries and multi-DB consensus remain out of scope.
- The local synthetic issuer can restart but no real issuer root of trust has been authenticated. Public/private test keys are ephemeral; the key update was performed by a trusted test administrator in CI.
- The lab SQL is **not** part of the 75 production migrations. It is intentionally not deployed and must never be copied into production.
- No official source or real company ID, no live cooperative permission, no legal approval, no price/fee activation and no financial/share operations.

**Final:** scoped Nest+PG17 synthetic bridge GREEN; PH12 legal HOLD; tariff ACTIVE BLOCKED; PR #172 Draft/unmerged; Issues #171/#173 open; no Merge, Deploy or real data.
