# PH12 / 2026-11-08 — Root-signed synthetic trust rotation and actual PostgreSQL 17 crash-restore rehearsal

## Delivery scope and immutable separation
**Engineering outcome:** GREEN in disposable synthetic laboratory; real legal issuer identity **HOLD**; tariff ACTIVE **BLOCKED**; PR #172 remains **Draft**, no Merge or Deploy.

This change adds **no production migration** or live cooperative records. The recovery test creates isolated PostgreSQL 17 Docker containers within GitHub Actions. The trusted lab root key, both issuer signing keys and synthetic tenant/entity are generated fresh per CI run. The root public key is passed directly to the test verifier rather than being learned from an untrusted issuer response.

## Implemented
- `scripts/ci/ph12-synthetic-root-trust-protocol.cjs`: independent Ed25519 root-signed, domain-separated synthetic rotation mandate `TTO-PH12-SYNTHETIC-ROOT-ROTATION-V1`. The validator checks exact shape, pinned root signature, tenant/issuer identity, key type/ID and loopback location, old public-key SHA256 fingerprint, strictly sequential trust epoch, retired key reuse, duplicate request ID, `notBefore` and short expiry. Both invalid root signature and replay/rollback fail closed.
- Same module verifies separately domain-separated **root-signed external recovery witness** `TTO-PH12-SYNTHETIC-RESTORE-WITNESS-V1`, with tenant/entity, trust epoch, key fingerprint, source version/hash, revoked state, issued/expiry times. A restored database whose checkpoint predates a signed witness **must return HOLD**. A missing/expired/bad witness cannot be treated as trust clearance.
- `scripts/ci/ph12-root-signed-pg17-crash-recovery.test.cjs`: one end-to-end Node test that launches **two real and distinct PostgreSQL 17 containers**. First initializes minimal actual `tto.ph12_mock_lab_*` tables and triggers from the existing CI-only SQL (rather than reapplying product migrations inside this subtest). It verifies the pinned-root rotation mandate, applies new synthetic key/epoch, records append-only history, and makes a binary `pg_dump -Fc` backup **before a later signed source revocation**.
- The lab validates a fresh signed revocation with issuer key 02, persists revocation, creates an **out-of-DB** signed high-watermark, force-kills the first PostgreSQL container, initializes a second fresh PG17 container, and restores the real binary backup using `pg_restore` under a new database process.
- Since restored checkpoint v2 is older than signed outside witness v3/revoked, it returns `HOLD_RESTORE_BEHIND_SIGNED_WITNESS`; forged witness is refused. Then it verifies the source-signed revocation and updates recovered checkpoint to revoked v3; result remains `MOCK_HOLD_REVOKED`. The key audit has two historical epochs and is not editable/deletable.
- Uses a persistent **file outside the destroyed database** to hold signed external witness, with temp-fixture cleanup. Files are synthetic and ephemeral; no secrets or private keys committed to GitHub.
- Dedicated workflow `.github/workflows/ph12-board-legal-source-pg17.yml` runs this test after replaying 75 existing migrations and previous 17 mock SQL + 21 mock HTTP tests; no production database, tenancy or tariff is changed.

## Actual evidence
| Check | Verified result |
| --- | --- |
| New root-signed PG17 crash and restore (actual `docker rm -f`, binary `pg_dump -Fc`, fresh `pg_restore`) | **PASS** — `PH12_ROOT_SIGNED_ROTATION_PG17_CRASH_RESTORE_WITNESS_HOLD_PASS` |
| Dedicated GitHub Actions | **SUCCESS** https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42468600658 |
| Dedicated: all existing project migrations | **75 migrated in disposable PG17** |
| Existing fictional SQL and synthetic issuer HTTP tests | **17/17 SQL + 21/21 HTTP PASS** |
| Full adaptive CI with real Nest and shared PG17 | **SUCCESS** https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42468600699 ; **328** controls, no regressions |

Validated code head: `f0036118b782d1b2d5c5a525c40a92f201e26f39`. Follow-up report commit appended after CI.

## Explicit claims NOT made
1. This is a **mock root-signed verifier on a lab-operated rotation pathway**, not a productized multi-party root trust authority. CI's database superuser is assumed to be trusted for the test, and root validation is performed by the separate Node verifier *before* this administrator updates the lab trust table. PostgreSQL does not independently validate Ed25519 root signatures, so an authorized DB superuser remains capable of bypassing this lab gate.
2. Demonstrates stale backup detection against a signed **external witness**; not a comprehensive multi-region/high-availability/recovery-time-objective benchmark. A lost external witness means **HOLD**, not safe acceptance. Witness retention/availability and rollback-resistant externally managed anchors require separate release design.
3. The new PG17 crash test uses a **minimal lab schema and actual checkpoint tables** in isolated containers, not a complete 75-migration database disaster-recovery exercise. The 75 migrations are independently replayed in the preceding dedicated CI step.
4. No legal existence, signing powers, actual board resolution or tariff may be inferred from synthetic Ed25519 success. Real official source attestations and supervised regulatory review remain strictly HOLD.

## Release decision
**PH12 LAB: GREEN** for the executed root signature / PG17 crash restore scenarios. **PH12 LEGAL: HOLD**. **TARIFF ACTIVE: BLOCKED**. **PR 172: Draft, unmerged**. No Deploy, production database writes, real issuer integration, share transfer, or financial actions. Issue #171 and pilot #173 remain open.
