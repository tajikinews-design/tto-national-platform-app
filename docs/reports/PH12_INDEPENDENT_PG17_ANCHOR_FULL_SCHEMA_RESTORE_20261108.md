# PH12 — independent PostgreSQL witness authority + full-schema backup/restore rehearsal
**Date:** 2026-11-08 · **PR #172:** Draft/unmerged · **Issues #171/#173:** open · **Workbook:** 4.35

## Goal and actual result
PASS in a completely disposable **synthetic** environment: a revoked issuer result survives restoration of a stale **full TTO PostgreSQL database backup** because the highest certified witness resides in a distinct PostgreSQL 17 database with its own persistent Docker-managed volume, not in the main DB backup, a Node process or a local witness file.

## What changed
1. `tests/sql/ph12-independent-pg17-anchor-ci.sql`: separate PostgreSQL 17 `ph12_anchor.signed_highwater` storing root-signed synthetic witness JSON with tenant, synthetic entity, per-entity sequence, source version, trust epoch and irreversible revoked state. PostgreSQL trigger denies modifications, deletion, skipping sequence and version/revocation rollback. **The DB itself does not validate Ed25519; the independent consumer validates against a pinned test root.**
2. `scripts/ci/ph12-independent-anchor-full-pg17-restore.test.cjs`: uses existing CI instance `tto-ph12-legal` with all **75 real product migrations** and lab-only trust/checkpoint SQL. Creates a fictional tenant, user, actual `tto.documents` row and actual `tto.ph12_cooperative_source_issuer_candidates` row (always `PENDING_ISSUER_AUTHENTICATION`), plus synthetic pinned trust and checkpoint/history rows. All synthetic.
3. Starts separate witness PostgreSQL instance with a **Docker named persistent volume**. Validates pinned-root witness, stores pre-revocation v2 in witness DB and then takes a **binary full database** `pg_dump -Fc` backup in memory (no local trust file).
4. Records newer v3 **revoked** checkpoint in main DB and separately stores root-signed v3 revoked witness in independent PG. Verifies that deleting witness history or appending v2 after revocation is forbidden.
5. Force kills BOTH PostgreSQL processes: primary and independent witness. Restarts witness against its **same durable named volume**, then starts a fresh main PostgreSQL instance and restores the **full database backup** using `pg_restore --no-owner --no-acl --exit-on-error`.
6. Verifies restored actual PH12 candidate, document, trust audit and the presence of PH12 tables after restoration; restored v2 non-revoked state is stale against external independent v3 revoked witness.
7. Starts **two separate Node OS processes** for validation. Both obtain fresh witness from restarted independent PostgreSQL and must output `HOLD_RESTORE_BEHIND_SIGNED_WITNESS`. When anchor is killed/unreachable both fail closed, not trusting restored DB. After anchor restarts, still HOLD. After reinstating v3 revoked (following pinned-root verification) both return `MOCK_HOLD_REVOKED`.
8. Both the dedicated and general GitHub Actions workflows pass. No production migration/DB/tenant deployed; existing `services/api` code unchanged in this checkpoint.

## Observed GitHub evidence
| Run | Result | Marker |
| --- | --- | --- |
| Dedicated PH12 PostgreSQL17, full 75 migration replay, 17 fictional SQL cases, 21 synthetic signed HTTP tests, older root-signed crash drill and **new independent anchor/full-backup recovery drill** | SUCCESS, https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42471152337 | `PH12_INDEPENDENT_DURABLE_ANCHOR_FULL_PG17_RESTORE_TWO_CONSUMERS_HOLD_PASS` |
| Full adaptive Next/Nest real HTTP PostgreSQL security suite | SUCCESS, https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42471152346 | `TTO_CF02_IDENTITY_MANAGER_NATIONAL_E2E_PASS_CHECKS=328` |

Verified CI source SHA: `ed02b46af05cce6c937aae05c72e049bc9295e7d`.

## Precise scope and remaining blockers
- **Real DB schema** was restored and a synthetic PH12 candidate/document and trust/checkpoint were checked; this is **not an exhaustive complete-population PH12 recovery** nor a distributed production disaster-recovery exercise.
- The source-root witness is signed in Node/test and validated by a pinned root in two separate OS processes. **No native signature enforcement at independent PostgreSQL storage**, cryptographic hardware root, independent organizational dual control, mutually distrustful anchor operators, or tamperproof volume attestation is claimed.
- The external anchor database **itself remains a single availability domain**; an unavailable anchor produces HOLD (safe but unavailable). Production requires high-availability replicated and independently governed anchors, constrained credentials, secure credential rotation, retention and measurable RPO/RTO.
- The restored database can be reconciled with authenticated synthetic external witness in this CI, but **no production automated recovery coordinator** or read barrier across every live PH12 API call is installed. A mock-only PASS is not a legal or deployment green light.
- This was run without real company IDs, share transfers, bank/payment or tariff active transition. No approved or ACTIVE state introduced.

**Decision:** `PH12_MOCK_DR=GREEN_TESTED_SCOPE`; `PH12_REAL_OFFICIAL_SOURCE=HOLD`; `PH12_LEGAL=HOLD`; `TARIFF_ACTIVE=BLOCKED`; `PR172=DRAFT_UNMERGED`; `NO_MERGE`; `NO_DEPLOY`.
