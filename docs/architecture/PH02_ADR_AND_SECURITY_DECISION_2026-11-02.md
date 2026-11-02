# PHASE-02 — Architecture contracts, gap closure and exit evidence (2026-11-02)

**Status:** Architecture/design candidate; project-owner approval to proceed recorded in conversation. **Not a production signoff.**  
**Baseline:** `ADR-001-FINAL-STACK.md` DECIDED, pinned source `tajikinews-design/tto-national-platform@5eb6be8edfbb61f2eca740a42c30f572b493f023`.  
**Stage rule:** PH-02 may be prepared and tested in parallel with PH-01 open items at owner's request. A sequential workbook GREEN cannot be claimed while PH-01 acceptance gates are incomplete.

## C01 — decided stack [GREEN from historical evidence]
- 3 independent Next.js 16 / React / TypeScript portals, NestJS 11 + Fastify API, PostgreSQL 17, SQL-first + node-postgres/Kysely as needed, pnpm, isolated OCI.
- Vercel protected synthetic nonproduction only if real user/account eligibility and deployment protection verified; ArvanCloud-only Production subject to separate release authorization.
- Code evidence: `package.json`, `services/api/package.json`, `ADR-001-FINAL-STACK.md`. Exact installed versions pinned by lockfile, not by inferred npm ranges.

## C02 — SQL/RLS/multitenancy/security migration [REVIEW WITH RUNTIME TEST]
- Foundation `0001`: `tto_app NOLOGIN NOBYPASSRLS`; PUBLIC grants revoked; trusted `set_config(...,true)` is transaction-local; selected tenant tables have `ENABLE/FORCE ROW LEVEL SECURITY`. Domain tables not direct-selectable solely by their existence.
- `0002` and `0008–0010`: privileged routines restricted, legal authority distinct from software role; selected later source and identity tables use dynamic `ALTER TABLE ... ENABLE/FORCE` (a literal grep alone misses these).
- Test on exact head in ephemeral PG17: `services/api/test/tenant-auth.integration.cjs` now verifies one reused **nonowner** DB connection with scoped A actor and A tenant, clearing both contexts at COMMIT, denial without a new context, and denial under foreign tenant B. Security test must be executed via GitHub release suite.
- Future domain physical schemas must carry `tenant_id` where owned, strict parent-scope FK, both SELECT and mutation controls, applicable FORCE RLS, role privileges, audit, 2-tenant pool negative tests; global Party identity is not globally readable.
- **C02 design contract is testable; 23-domain implementation remains PH04–09, and any failing runtime guard blocks GREEN.**

## C03 — API / event / outbox / canonical ownership [DESIGN READY AFTER REVIEW]
- 23/23 canonical domain owners and 165 commands / 90 queries / 89 events are enumerated in `PH02_23_DOMAIN_OWNERSHIP_EVENT_CONTRACT.json`. Do not infer shared ownership from a UI page or physical read projection.
- JSON-over-HTTPS `/v1/` domain APIs: authenticated scope derived from verified session; never trust public request tenant, role, party, balance or authority. Policy decision before mutation, audit material commands, typed errors and version guards.
- Event envelope fields: `event_id` UUID, `event_type`, `tenant_id` (where tenant-owned), `aggregate_type/id/version`, `occurred_at`, `correlation_id`, `causation_id`, `payload_schema_version`, `classification`, `payload_ref` (no secrets).
- Outbox: **same PostgreSQL COMMIT** as aggregate and audit reference; unique event id + aggregate version; worker leases and retries; at-least-once delivery, idempotent inbox/consumer by `event_id`; dead-letter requires operator review and audit; no arbitrary broker as authoritative source.
- `docs/architecture/sql/PH02_OUTBOX_REVIEW_ONLY.sql` is **design only**, NOT a migration or permission to publish; runtime implementation/test in PH04–09. Missing transactional outbox currently a recorded gap, not hidden.
- Legal invariants: `PAYMENT_REPORTED != PAYMENT_VERIFIED != OWNERSHIP_FINALIZED`, no custody/wallet, source-authenticated shareholder ledger, buyer-to-seller transfer only through separately authorized legal workflow.

## C04 — storage, secrets, preview, Arvan / environment [POLICY DECIDED; PROVIDER PROOF OPEN]
- Secrets in managed environment store, never code, commit history, client bundle, logs, synthetic screenshots, CI artifact, or export. Missing required secret FAIL CLOSED; no actual tokens or passwords handled by this design review.
- Secret rotation (provider token, HMAC key, DB URL) with version references and dual-read/single-write cutover where possible; no logging raw credentials.
- Storage adapter S3-compatible; file checksum, malware scan, classification, evidence version, independent download authorization, retention and legal hold; raw object URL is not permission.
- Vercel preview: production business on Hobby forbidden unless entitlement explicitly permits; protected private preview must return 401/403/SSO challenge to anonymous clients before any sensitive interface, **never a public HTTP 200**. Current live entitlement not proven; preview remains blocked.
- Production: Arvan only, pending real target account/region/service compatibility, production secrets/backups/restore, deployment authorization, and G3; no deploy or DNS/domain mutation from this PR.
- Physical provider access and official source custodianship are later environment/operations gates, not magically accepted by a synthetic CI.

## Open PH-01 carryovers (remain active)
- Project owner states review approved, which is recorded as `OWNER_REVIEW_CONFIRMED_BY_USER`, not fabricated independent Product/Architecture/Legal/QA approvals.
- `ADR-PH01-001` proposed phase-design/runtime split remains unratified by named independent reviewer; immutable 155 source acceptance IDs still require formal scenario evidence in PH04–09 and PH12. CF01 8-summary vs 18-dedicated test namespace needs a named semantics decision.
- Do not auto-green C05/C06/C08 with an architecture test.

## Exact evidence required for PH-02 exit
| Gate | Verdict rule | Evidence |
|---|---|---|
| C01 | existing signed selection and match baseline | ADR-001 + existing package manifests |
| C02 | nonowner, forced RLS and transaction-local test PASS at exact SHA | migrations + `TTO_PH02_TRANSACTION_LOCAL_POOL_CROSS_TENANT_ISOLATION_PASS` in release log |
| C03 | 23 ownership rows / event envelope / idempotent outbox contract reviewed, future runtime gate retained | 23 domain JSON + this ADR + design SQL |
| C04 | storage/secret/provider policy agreed; account entitlement evidence or explicit external blocker classified with owner | this ADR; provider verification separate from production readiness |

**Design decision**: Owner authorized execution and project-level review. Independent specialist review and actual production/environment release authority **NOT RECORDED**. Release guardrail remains fail-closed. No Merge, real shareholder data, share transfer, live payment, or Deploy carried out here.
