# PH-01 / CHILD-01 — traceability and isolated regression evidence (DRAFT)

**Status:** PREPARED_FOR_REVIEW; **not** formal source approval, independent QA acceptance, or production authorization.

**Immutable sources**
- Dedicated LOCKED / CODE-READY child: `tajikinews-design/tto-national-platform@5eb6be8edfbb61f2eca740a42c30f572b493f023/TTO-CORE-IDENTITY-AUTH-IMPLEMENTATION-v1.0.docx` §§3–5, 7–10, 13–18. Nine entities, six enumerated field blocks, **18** detailed acceptance tests.
- Unified pack: same frozen source SHA, `TTO-UNIFIED-IMPLEMENTATION-PACK-v1.0.docx`. Its **8** summary `CORE-AUTH-AT` test assertions are a smaller synopsis and contain five numeric ID semantic collisions.

**Proposed provenance policy — approval pending:** preserve both locked source ID sequences; use namespaced keys `CF01.DED.CORE-AUTH-AT-NNN` and `CF01.PACK.CORE-AUTH-AT-NNN`; record 8 semantic one-to-one aliases, do not use numeric equality alone. Dedicated 18-test list is the proposed detailed acceptance baseline **only after Product/Architecture/QA source signoff**.

## 18-case checkpoint (no PASS claimed from code presence)

| Dedicated source ID | Source scenario / expected | Located evidence or explicit gap | Status |
|---|---|---|---|
| 001 | One account, two tenants / independent permissions | This PR adds real HTTP synthetic distinct tenant-role isolation, but not full per-permission PDP comparison | PROPOSED_TEST_PARTIAL |
| 002 | Cross-tenant URL/API / CROSS_TENANT_ACCESS_DENIED | `tenant-auth.integration.cjs:69,75` checks HTTP 403, not exact reason code | EXISTING_TEST_PARTIAL |
| 003 | Expired role, active session / action rejected | This PR adds live session role expiry then recovery regression | NEW_TEST_NOT_RUN |
| 004 | UI shows control without permission / server rejects | Dedicated UI-plus-server negative scenario not located | MISSING |
| 005 | Platform admin without JIT / tenant data rejected | `identity-workflows.integration.cjs` exercises 403 before JIT, 200 after approval | EXISTING_TEST |
| 006 | Setup coordinator attempts share/financial action / rejected | No matching authoritative share/financial finalization endpoint assertion | BLOCKED_NOT_AVAILABLE |
| 007 | OTP replay / second rejected | `identity-workflows.integration.cjs` original verify sequence; atomic consumption in SQL `0005` | EXISTING_TEST |
| 008 | Expired OTP / rejected | This PR adds expired challenge HTTP negative | NEW_TEST_NOT_RUN |
| 009 | Session revoked / next request rejected | `identity-workflows.integration.cjs` logout then 401 | EXISTING_TEST |
| 010 | Revoked role, stale token/cache / permission unusable | `tenant-auth.integration.cjs` and `identity-workflows.integration.cjs` existing 403 | EXISTING_TEST |
| 011 | JIT expired / support access rejected | This PR adds approved then expired JIT HTTP 403 | NEW_TEST_NOT_RUN |
| 012 | Creator = final approver / SoD blocked | `identity-workflows.integration.cjs` self-approval 403 | EXISTING_TEST |
| 013 | Resource tenant B with role in A / rejected | Related tenant boundary tests exist; full resource-PDP assertion not established | PARTIAL |
| 014 | Audit challenge / no plaintext secret | Audit/sensitive logging coverage has not been shown by an exact full-path assertion | MISSING |
| 015 | Duplicate AssignRole with idempotency key / one effect | SQL unique + ON CONFLICT exists, **not equivalent to idempotency-key command contract** | GAP |
| 016 | Two parallel Verify on one challenge / max one success | This PR adds Promise.all concurrent HTTP requests and checks [200,401] | NEW_TEST_NOT_RUN |
| 017 | Permission present, no legal authority / AUTHORITY_REQUIRED | SQL role/authority denial exists; exact result reason/decision code absent | GAP |
| 018 | Assurance below policy / STEP_UP_REQUIRED | Canonical assurance/policy decision and dedicated test not located | GAP |

## Source reconciliation decision requested

Product Owner, Architecture Owner, and independent QA review the proposed namespaced alias table, accept or reject the dedicated **18** acceptance assertions as the detailed baseline, and document any higher-level legal/product override. **Approval not inferred from this PR.** The original 155-index remains unchanged pending broader 23-Child reconciliation.

## Change and evidence policy
- Added isolated SQL+HTTP synthetic negative scenarios to the **existing** `identity-workflows.integration.cjs` (IDs 001, 003, 008, 011, 016). Some scenarios are **partial** as noted.
- Target `integration/tto-pcs-015-wave0-candidate-20261101` at parent `e87f2a874200f7694faa3959d03bdeeb0890ba6f`.
- No production data, real shares, actual SMS delivery, migration, merge, deploy, source-doc edit or legal signoff.
- A PR or previous successful release suite is **not** direct evidence that these new tests passed. Run isolated disposable PostgreSQL CI and inspect exact test outcomes first.
- PH-01-C05/C06/C08 remain **PENDING**; PH-01 must remain **IN_PROGRESS**.
