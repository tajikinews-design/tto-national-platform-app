# TTO CF-01..CF-03 first executable foundation checkpoint — 2026-10-22

## Scope / verified completion

Repository: `tajikinews-design/tto-national-platform-app`. Branch: `feat/cf01-03-next-nest-postgres-foundation`. Draft PR: https://github.com/tajikinews-design/tto-national-platform-app/pull/3

**Reference repo `tajikinews-design/tto-national-platform`: unchanged, 15 originals at `5eb6be8edfbb61f2eca740a42c30f572b493f023`.** No document contents are duplicated in application source.

| Component | Evidence | Status |
| --- | --- | --- |
| Next.js 16 shareholder app | Compiled with GitHub CI | **BUILD PASS** |
| Next.js 16 cooperative-management app | Compiled with GitHub CI | **BUILD PASS** |
| Next.js 16 national-admin app | Compiled with GitHub CI | **BUILD PASS** |
| NestJS 11/Fastify backend | TypeScript compile and typecheck | **BUILD PASS** |
| PostgreSQL 17 initial CF01/CF02/CF03 migrations | Actual database service / one-shot migration | **MIGRATION PASS** |
| Postgres tenant RLS | Real-role positive+negative read/write/revocation/test | **PASS** |
| Nest HTTP/API & Postgres integration | 10 real HTTP positive/negative requests against ephemeral PG17 | **10/10 PASS** |
| Previous structural regressions | Existing 11 Python tests | **PASS** |

Actions:
- All build / SQL jobs: https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39762676001
- API/DB integration: https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39762676049
- Foundation test: https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39762676327

## What actually works

- API `GET /health` for process readiness only (not DB health).
- Verified opaque Bearer session hash lookups in database via security-definer function and account security epoch. User identity is never inferred from untrusted HTTP tenant headers.
- API `GET /v1/tenants/:tenantId/context`: 401 without a valid session; 403 if actor lacks that active tenant role.
- API `GET /v1/tenants/:tenantId/documents`: returns only tenant-permitted document metadata; restricted classifications fail closed.
- Database transaction-local tenant + actor context with FORCE RLS, no BYPASSRLS app role, and no direct app read access to role assignments, session hashes, storage keys or audit events.
- Revocation of role denies subsequent requests; incrementing security epoch revokes existing tokens. Test data are synthetic and ephemeral.

## Explicitly NOT finished

- Full CF-01: login issuance / OTP rate limiting & consumption / JIT approval / SoD / legal authority / full session lifecycle / every normative acceptance test.
- Full CF-02: tenant lifecycle/provisioning, global Party merge, membership projection consumer, and complete legal business handoffs.
- Full CF-03: file upload/scanning, immutable evidence seal, version supersession, retention/hold, **durable append-only audit ingestion** and classification approval flows.
- 23 Child complete: NO. All critical domain acceptances NOT_RUN except these narrow foundation tests. Missing user-facing real data is intentional.
- No lockfile pinned yet; transient CI resolves packages using semver ranges. Dockerfile is drafted but OCI image not built/pushed; Node/Arvan compatibility not yet proven.
- No Vercel project, no protected preview online; no Production changes or actual business data.

## Next security/workflow milestones

1. Generate + commit reviewed `pnpm-lock.yaml`, run frozen deterministic installation and verify Next/Nest builds.
2. Define legal authority/JIT and CF-01 issuance flows, challenge rate-limit/read/write policy and full actor/tenant service tests including token theft and SQL-injection tests.
3. Add migration version ledger and rollback dry-run; validate tenant cross-table constraints and document-to-file same-tenant referential integrity.
4. Implement CF-03 append-only event persistence with strong audit failure semantics before business mutations; retention/hold Child-22 contract integration.
5. Prove OCI image builds and ArvanCloud runtime compatibility before Production gate. Vercel Hobby synthetic internal preview only when authentic protection and compliance verified.

**Overall PHASE-03 / PHASE-04 = IN_PROGRESS; do not set whole Child CF01..03 GREEN.**
