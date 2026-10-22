# TTO National Cooperative Platform — Implementation repository

**SOURCE / immutable:** `tajikinews-design/tto-national-platform` (15 original files, read-only, pinned tree `5eb6be8edfbb61f2eca740a42c30f572b493f023`).

## Real implementation status (2026-10-22)

- **Three Next.js 16 / React / TypeScript apps** now exist at `apps/shareholder/app`, `apps/cooperative-management/app`, `apps/national-admin/app` and share `@tto/ui`. They compile and are RTL UI skeletons only; no operational login or business workflows.
- **NestJS 11 / Fastify API** at `services/api`: valid opaque-session lookup, tenant context and RLS-protected document metadata read endpoints. Session issuance / full authorization authority workflows are **not implemented**.
- **PostgreSQL 17** migration at `database/migrations/0001_cf01_cf03_foundation.sql`: initial subset of CF01, CF02, CF03 logical entities with forced RLS. Real PostgreSQL and Nest HTTP negative integration tests passed (see [checkpoint](docs/reports/CF01_03_FOUNDATION.md)).
- **Draft PR #3**: [Next/Nest/PostgreSQL foundation](https://github.com/tajikinews-design/tto-national-platform-app/pull/3); `main` remains unchanged.
- **Vercel**: internal synthetic protected preview only, not yet deployed. **Production**: ArvanCloud exclusively upon explicit approval; never deploy to Production by automation.

## Commands (developer environment)

- Install Node 22 and pnpm 10.18.0.
- `pnpm install --no-frozen-lockfile` (bootstrap only: reviewed lockfile not yet committed).
- `pnpm build` builds all 3 Next apps and Nest API; `pnpm check` typechecks workspace.
- Migrations run **only** in a disposable PostgreSQL 17 database with a privileged migration owner. API runs under non-owner `tto_app` role that cannot BYPASSRLS, with DATABASE_URL injected from a secure secret manager.
- GitHub Actions run real database+API tests; no production deployments.

See [ADR-001](docs/architecture/ADR-001-FINAL-STACK.md), [Phase status](status/PHASE_GATES.json), [Core mapping](docs/analysis/CHILD23_EXECUTION_REVIEW.md), and [API boundary](services/api/README.md).

The previously imported legacy static HTML prototypes remain in `apps/*/index.html` as historical review resources; the actual Next routes are `apps/*/app/page.tsx`. Never portray read-only HTML as a functional platform.
