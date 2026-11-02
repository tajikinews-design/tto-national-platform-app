# PHASE-04 — CHILD-01/CHILD-02 real HTTP + PostgreSQL acceptance audit

**Status 2026-11-02:** substantial technical implementation and runtime PASS, **NOT the original full Phase-04 acceptance**. This report distinguishes executable evidence from source and human approval.  
**Code SHA actually executed:** `889fa8122284e1d687adb81eb14b2f9dee7f16ca` (no source-code changes in this report update).  
**Draft PR:** #123, `feat/ph04-identity-tenant-party-contract-parity-20261102`; no Merge/Production migration/real-share operations.

## Actual successful CI at pinned code SHA

| Gate/evidence | Run | Measured |
|---|---|---|
| Isolated PH04 physical contract + CF02 + race + replay + fresh step-up | [41447724392](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/41447724392) | SUCCESS, migrations 0001–0014, FORCE RLS, role revocation, same-tenant FK, true two-transaction slug race, duplicate source-event no second effect, same-session short-lived SMS challenge, denial on stale epoch and non-authorized legacy role grant |
| Full Nest + PostgreSQL release/historical HTTP security suite | [41447724483](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/41447724483) | SUCCESS, 165 core E2E checks, **48 actual historical HTTP workflow assertions**, complete historical OTP/security regression, four OCI smoke builds PASS |
| Immutable source identity | `5eb6be8edfbb61f2eca740a42c30f572b493f023` | 18 detailed §17 CF01 test IDs plus 8 original CF02 IDs and 8 namespaced CF01 summary aliases retained |

## What was implemented

- Migration `0014`: verified-current-session fresh SMS step-up challenge with one independently enrolled mobile; per-session challenge binding; controlled delivery attestation; one-time consumption; no bearer token minted by step-up; five-minute elevation TTL; stale security/authorization epoch and replay denial.
- `POST /v1/auth/step-up/request` and `POST /v1/auth/step-up/verify` on the API; no code or mobile returned. Mock SMS permitted only in isolated `NODE_ENV=test`, not unrestricted in other environments.
- `POST /v1/tenants/:tenantId/roles/assign` now requires `requestId` UUID, verified actor/tenant context, separate role permission + legal authority and current elevated session; exact `AUTHORITY_REQUIRED`, `STEP_UP_REQUIRED`, `IDEMPOTENCY_CONFLICT` decisions. Duplicate matching key produces `ALREADY_APPLIED` without an additional role or audit.
- Deprecated `tto.assign_tenant_role(uuid,uuid,text,uuid)` direct execute privilege revoked from `tto_app`: the HTTP endpoint cannot silently fall back to weaker SQL.
- HTTP regression explicitly tests a wrong OTP, replay, regular login repurposing, a second live session of the same actor, and idempotency payload drift.
- CHILD-02: accepted synthetic tenant lifecycle, versioned slug/redirect, concurrent slug collision, independent Party, no implied membership/holdings, Party alias without share transfer, source-approved idempotent relationship ingestion and non-public Party table.

## Original source → executable assertion trace register

File: `docs/analysis/PH04_CF01_18_CF02_8_ACCEPTANCE_TRACEABILITY.json`. It preserves:
- 18 `CF01.DED.CORE-AUTH-AT-001..018`, original detailed scenarios.
- 8 `CF02.PACK.CORE-TENANT-AT-001..008`.
- All 8 original Unified CHILD-01 summary aliases, including the five numeric conflicts, without renumbering or silently conflating them.
- Exact code path, technical SHA and CI run per case, with `exactCiRun` and `independentQa` still null for **formal independently accepted source** evidence.

**Remaining technical-scope gaps:** `CF01.DED.004` requires an actual permission-displayed UI negative test with a verified role; `CF01.DED.006` requires the later Child share/financial command (not activated, deliberately 404/fail-closed); `CF01.DED.002` currently proves HTTP 403 but not the separately sourced exact `CROSS_TENANT_ACCESS_DENIED` decision code. `CF02.PACK.008` proves DB table privilege denial, not an independently audited external Party enumeration service.

**Remaining source-model gaps:** full dedicated 9 CF01 entity status transitions/fields, full CF02 tenant/legal/Party state compatibility, source-of-authority and legal attestations, policy-set versioning and independent Product/Architecture/Legal/QA approval. Fresh SMS of the same enrolled phone proves **recent possession**, not a distinct factor/MFA; assurance policy and risk acceptance are separately required before any regulated-sensitive use.

## Gate classification and hard release safeguards

- **PH04-C02: GREEN (technical security baseline scoped to disposable PG17 and synthetic HTTP).**
- **PH04-C01: PENDING** until every original Child01/02 field/state/constraint is reconciled to implementation.
- **PH04-C03: PENDING** until all source cases including the UI/financial scenarios, exact decision codes and attributed independent QA/Legal acceptance are complete.
- Parent project owner authorized engineering and design decisions; independent named signed specialist evidence is not fabricated.
- Issue #119 continues to block regulated production until original 148 entities and 155 source acceptance scenarios have exact code/SHA/CI/QA evidence. Issue #122 keeps manual screen reader/role UAT obligations.
- No local Docker used, no merge, no deployment, no real identity/share/payment processing.
