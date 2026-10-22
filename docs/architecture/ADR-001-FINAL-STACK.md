# ADR-001 — Approved engineering Framework / Database / deployment portability

**Date:** 2026-10-22. **Decision authority:** project owner explicitly delegated final Framework and Database selection. **Status:** DECIDED (selection authorized); **runtime not yet built/provisioned/tested**. The 15 approved source documents remain in the separate immutable repository `tajikinews-design/tto-national-platform` at `5eb6be8edfbb61f2eca740a42c30f572b493f023`.

## Final selection

| Concern | Final choice | Rationale / implementation gate |
| --- | --- | --- |
| Shareholder, cooperative management, national administration web surfaces | **Next.js 16 stable**, React, TypeScript, 3 independently buildable frontends + shared UI | RTL NAV-01..11, one design system, protected Vercel previews; portable Node/Docker runtime for Arvan |
| Business API and 23 ownership boundaries | **NestJS 11 + Fastify**, TypeScript modular monolith | Preserve canonical domain boundaries and transactional correctness while avoiding premature distributed-microservice infrastructure |
| Relational transactional store | **PostgreSQL 17**, latest patched minor supported by target, SQL-first migrations | ACID/locking for share ownership, legal evidence, tenant foreign keys and privacy controls |
| Query layer | **node-postgres + Kysely** where typed queries beneficial; reviewed SQL migrations and RLS policy scripts | Do not hide RLS/privilege behavior behind ORM defaults |
| Tenant data isolation | tenant_id scoped tables + server checks + **PostgreSQL RLS** `USING`/`WITH CHECK`, `FORCE ROW LEVEL SECURITY` as applicable | Separate non-owner app DB role, no superuser/BYPASSRLS; explicit transaction-local subject/tenant context; pooled connection bleed/negative tests |
| API/events | versioned HTTPS JSON REST/OpenAPI; transactionally persisted outbox and domain events | `PAYMENT_REPORTED != PAYMENT_VERIFIED != OWNERSHIP_FINALIZED`; idempotent callbacks, optimistic version checks |
| Deferred async infrastructure | outbox baseline; Redis/BullMQ only when justified by jobs | No broker lock-in or Kafka-first microservices |
| Files and evidence | S3-compatible storage adapter, versioned immutable evidence, authorized downloads | Content classification/legal hold and audit outside file URL |
| Dev/release | pnpm workspaces, OCI Docker images, Docker Compose for isolated tests | Deterministic installs, version-lock, no platform-specific production source code |
| Preview | **Vercel Hobby**, only genuine personal/noncommercial *internal synthetic* evaluation if actual Hobby terms allow it, behind verified Deployment Protection | Hobby alone does not block development; missing project, Git linkage/auth guard or real terms mismatch can block deployment |
| Production | **ArvanCloud exclusively, upon explicit owner approval** | OCI/Node runtime portability, Arvan deployment spike before release; Vercel must never own Production data/runtime |

## Alternatives rejected for initial baseline

- Three Vite-only static SPAs: possible but less unified full-stack routing/SSR evolution; Next portable with Docker/Node.
- Microservices-first or Kafka-first platform: higher distributed transaction/audit complexity and operating costs before proof.
- Document-first MongoDB for ownership ledger: relational constraints and stronger SQL transaction/RLS controls required.
- PostgreSQL database per tenant by default: may later serve special isolation tiers but early operations/upgrade complexity is excessive for 500+ tenants.
- ORM-generated schema as exclusive truth: SQL-first policy/locking/constraints inspection is mandatory for RLS/legal invariant testing.
- Vercel-specific backend runtime for live Production: violates explicit Arvan-only plan.

## Explicit controls and uncompleted tasks

1. Confirm **physical** schema and per-domain migration plan before exposing APIs; first logical table analysis is available at `docs/analysis/CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json`. 148 logical entities are not 148 built physical tables.
2. CF-01/02/03 design dependency cycle resolved by versioned interfaces and fail-closed policy placeholders; CF-03 audit and Child-22 retention handoff proven before irreversible data operations.
3. Prove RLS policies and tenant variables under pooled connections. PostgreSQL table owners can bypass RLS unless appropriately forced; trusted app roles must not bypass.
4. Implement legal authority separately from software role; audit JIT for national access. Default deny cross-tenant API/export/file/job reads.
5. Exact patched package versions and Node LTS selected during dependency installation. No canary or unverified binary deployments.
6. Re-run ArvanCloud CaaS/OCI/region/secrets/db backup compatibility on *current* authorized account; archived examples are not evidence of active current-service support.
7. Vercel protected preview needs project+source connection, actual reviewer SSO entitlement and unauthorized-request-denied smoke tests. No real shareholder personal/financial data or real payments.
8. **No Production provision, domain change or release approved.** Source 15 originals are read-only.

## Authoritative technical references

- Next.js: <https://nextjs.org/docs/app/getting-started/deploying> and <https://nextjs.org/docs/app/guides/self-hosting>
- PostgreSQL support: <https://www.postgresql.org/support/versioning/>
- PostgreSQL RLS owner/bypass safeguards: <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
- Vercel Hobby terms: <https://vercel.com/docs/limits/fair-use-guidelines>
- Vercel auth protection: <https://vercel.com/docs/deployment-protection>
- Arvan CaaS sample (archived, not live compatibility proof): <https://github.com/arvancloud/paas-examples>

**Do not mark implementation, database setup or Phase 02 runtime verification GREEN solely because this ADR exists.**
