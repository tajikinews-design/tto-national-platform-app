# W1 Synthetic Server Enforcement — implementation boundary v0.1

**Status:** DESIGN_ONLY / NON_RUNTIME / NO_SOURCE_ADMISSION  
**Baseline:** 41b5655b4f6573cf499f03d8e8cfee20ddd11c42  
**Date:** 2026-10-29

## Purpose
Translate the 29 synthetic policy fixtures and nine contract-test suites into a future BFF (Next) and API (Nest) enforcement design, **without creating a real route, real permission, or source connection**.

## Proposed enforcement sequence
1. BFF validates first-party revocable session cookie; ignores browser-provided tenant/role/party/authorization headers.
2. API resolves actor from authenticated server session, independent of client assertions.
3. API resolves tenant scope and verified user–Party binding in the same request.
4. API checks separately: NAV permission, per-operation right (read, download, export, write), feature availability, source/legal admission and data owner.
5. PostgreSQL uses a non-owner app role, transaction-local actor/tenant context, RLS with cross-tenant and pooled-connection negative tests.
6. Mutations require documented business workflow approval, CSRF/re-auth/MFA as appropriate, idempotency, version checks, audit and outbox.
7. Missing, revoked, expired, mismatched or ambiguous approvals => DENY. No empty-list or zero-balance substitute for unavailable sources.
8. Decisions and denials are audited without leaking token, protected record or sensitive payload.

## Existing seams reviewed
- `apps/shareholder/lib/source-read-access.ts`: fail-closed helper for source-closed read paths.
- `apps/shareholder/app/api/tenants/[tenantId]/me/member-record/route.ts`: candidate source-gated read.
- `apps/shareholder/app/api/tenants/[tenantId]/me/trade-requests/route.ts`: explicit closed read pending legal authorization.
- `services/api/src/module.ts`: revocable session actor and transaction-local tenant context.
- `docs/contracts/shareholder-w1-security-test-matrix-v0.1.json`: 29 synthetic cases.
- `scripts/ci/test_shareholder_w1_operational_gates.py`: standalone contract tests.

## Required negative tests before implementation
- Revoked/expired/missing session; tenant substitution in route/query/header; browser-forged role/party/authorization.
- User can access tenant A but not B; tenant membership does not authorize holdings without separate source approval.
- Other shareholder's record identifier must never return data.
- Document list permission does not grant download; report read does not grant export.
- Change requests without re-auth/CSRF/idempotency/version matching are denied.
- Trade submission and ownership transfer remain blocked without independently approved Rule Registry and governing legal basis.
- Source revoked, unknown, stale, replayed, mismatched version, missing classification or expired approval => deny with audit.
- Engine/test-case success must never enable `authoritative_routes`, `permission_policy` or production flags.

## Go/No-go
**GO:** design review, static contract checks, mock/fixture-only verification, isolated local simulations.  
**NO-GO:** route registration, enabling a policy engine for production, real identities/PII, live Child06/Child07 source reads, writes, uploads, funds, share transfers, real OTP/MFA, merge or deploy.

## Independent decisions still needed
Security, per-tenant legal source owner, data governance, user–Party binding, Child06 9 controls, Child07 10 controls, operations and privacy custodian, and separate release authority.

**No engineering success is equivalent to legal permission.**
