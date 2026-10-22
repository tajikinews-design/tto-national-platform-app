# PHASE 01 — Core ownership boundaries (CF-01 / CF-02)

**Evidence:** Approved `TTO-CORE-IDENTITY-AUTH-IMPLEMENTATION-v1.0.docx`, `TTO-CORE-TENANT-PARTY-IMPLEMENTATION-v1.0.docx`, `TTO-IMPLEMENTATION-SPECIFICATION-MASTER-v1.0.docx`. This is a **source-grounded analysis**, not implemented functionality.

| Concept | Canonical owner | Boundary / mandatory rule |
|---|---|---|
| `USER_ACCOUNT` | CF-01 Identity | Global login account; does not itself confer membership or legal authority |
| `AUTH_IDENTIFIER`, `AUTH_FACTOR`, `AUTH_CHALLENGE` | CF-01 | One-time challenge bound to purpose and account/identifier; atomic consumption; plaintext OTP must not persist/audit |
| `SESSION` | CF-01 | Authenticated session by itself does not grant Tenant access; revocation must be enforced promptly |
| `ROLE_DEFINITION`, `ROLE_ASSIGNMENT` | CF-01 | Role assignment scoped by tenant/resource/time/basis; role does not equal legal authority |
| `JIT_ACCESS_GRANT` | CF-01 policy | Purpose-bound short-lived tenant access, approved and audited; platform admin has no default unlimited tenant access |
| `TENANT`, `TENANT_SLUG` | CF-02 | `tenant_id` immutable and used for authorization; slug change does not change tenant identity; slug is never an authorization key |
| `PARTY` | CF-02 Party Core | Person/organization global identity distinct from user account; merge is not share transfer |
| `COOPERATIVE_RELATIONSHIP` | Member/Shareholder Master (CF-06) | Business truth of membership/shareholder relationship; CF-02 holds validated projection/reference, not workflow ownership |
| `SHARE_OWNERSHIP_LEDGER` | Share Capital & Market (Child 07) | Not owned by CF-02 and not determined by user login, party merge, payment reported, or tenant activation |

## Tenant lifecycle from CF-02

`PROVISIONING → SETUP_PENDING → ACTIVE ↔ SUSPENDED → TERMINATING → TERMINATED` (detailed permitted transitions belong to the approved state contracts, not this summary). `SUSPENDED` does not erase records; `TERMINATED` is not hard-delete; retention/legal hold apply.

## Authentication / authorization invariants from CF-01

1. Challenge Verify is atomic; second Verify fails; OTP plaintext is never written to persistence, audit or logs.
2. Rate limiting and maximum attempts derive from Policy Registry, not hardcoded constants.
3. Stale JWT/session/cache must not let revoked authority persist until token expiration.
4. UI menu visibility is not authorization: API and file download independently deny unauthorized access.
5. Platform admin needs JIT and documented purpose/scope to inspect sensitive Tenant detail.

## Gates

- No identity/tenant database migrations or live API endpoints are authorized yet: technical runtime/DB isolation ADR is **AWAITING_APPROVAL**.
- Next: expand each entity into field-level schema, State transitions, Commands/Queries/Events, legal/basis mapping, negative acceptance scenarios and tests from complete Child docs.
- All implementation status remains **NOT_STARTED** for CF-01/CF-02. This document alone does not pass those Child acceptance tests.
