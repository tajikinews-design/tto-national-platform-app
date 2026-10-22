# TTO coding-agent instructions

Read `docs/source/SOURCE_BASELINE.json` before changing code. This is an **implementation** repository, not the approved reference repository. Source repo `tajikinews-design/tto-national-platform` at commit `5eb6be8edfbb61f2eca740a42c30f572b493f023` contains exactly 15 immutable files; never write to it or copy source binaries here.

Baseline: national multi-tenant cooperative SaaS, 3 surfaces (shareholder, cooperative management, national administration). Single source of truth for all shared business concepts; strict server-side tenant isolation; platform admin is not a tenant superuser. Party != user account; relationship != shareholding; payment reported != verified != finalized. No cash wallet/top-up/withdrawal or general accounting ledger. Official ministerial e-voting not replaced in MVP.

Approved root menu taxonomy: NAV-01..NAV-11, derived from TTO Navigation document. UI references: three source PNGs plus Dashboard Handoff; management/national visual PNGs intentionally byte-identical but semantic scopes differ. KPI no_data must not be rendered as zero or invented values.

Current `apps/*` HTML is **reused historical static UI review prototype, not approved production code**, and is strictly read-only, unauthenticated, and has no backend. Never call these portals functional before API/Auth/Tenant data layers and tests exist. Framework/DB/API/Broker decision remains **AWAITING_APPROVAL**: do not select a stack or implement irreversible schema before ADR.

Use isolated branches + PR, commit, CI artifacts and acceptance evidence. No merge to main without review. No GitHub Pages, no public deployment. Vercel only for protected preview on a compliant plan; production hosting only ArvanCloud after explicit owner approval. No production database or tokens, real shareholder PII, credentials, .env, signing keys, traces or secrets in repo/CI logs. Do not configure production or auto-deployment. Keep environment targets separate.

Report every phase with status `NOT_STARTED / IN_PROGRESS / GREEN / FAILED / BLOCKED / AWAITING_APPROVAL`; never mark GREEN without verified checks, runtime evidence and any mandatory approval. Long-running work needs durable checkpoint in `status/PHASE_GATES.json` and exact handoff on interruption.
