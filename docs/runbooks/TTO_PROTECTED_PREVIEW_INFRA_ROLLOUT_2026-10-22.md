# TTO isolated Preview rollout — controlled handoff

**Status (2026-10-22): ISOLATED PG17 + PROTECTED PREVIEW RUNTIME GREEN / FULL PRODUCT GATES STILL OPEN.** This is a pre-production runbook, not proof of a connected database or live backend.

## Immutable boundaries

- Canonical reference: `tajikinews-design/tto-national-platform` main pinned `5eb6be8edfbb61f2eca740a42c30f572b493f023`: do not modify.
- Application `tajikinews-design/tto-national-platform-app` main `9eb48b7f06c25e66021adbe0b4386133cdcb3039` stays unchanged; implementation staged on Draft PR #12 and this follow-up Draft PR.
- No migration to or credential reuse from either Supabase BourseAI project (`xknsxkjkoznifegrxawg`, `zgdgjyhqlvitaqniwldl`). A TTO-dedicated Supabase organization and database have NOW been verified; BourseAI is still strictly off-limits.
- No Production/ArvanCloud rollout. Hobby Vercel is Preview-only, internal and noncommercial. No actual recipients, shareholders, public OTP sending or API.ir test delivery.
- Never echo or commit secrets, unprotected connection URLs, authentication cookies, bypass URLs or 2FA tokens.

## Inventory — verified from provider

Vercel team `team_n6CStwBbEYPsdb886A3Xm2Vp` (account `tajikinews-6739`):

| Role | Vercel project | Project ID | Preview status |
| --- | --- | --- | --- |
| Backend | `tto-api-preview` | `prj_dd1k3kjAM05ru7VFFVELnPqEiffB` | **created; no deployment; protected OIDC Trusted Sources configured** |
| Shareholder | `tto-shareholder-preview` | `prj_WWvZY31IsOEZLQLrKG98M9rZQ2q5` | earlier UI READY, backend disconnected |
| Cooperative | `tto-cooperative-preview` | `prj_akvZAPInGMPwy0Am0gOOC4N2RBSz` | earlier UI READY, backend disconnected |
| National admin | `tto-national-preview` | `prj_d0s538suEmpmtIEicOMYdRy6lc1q` | earlier UI READY, backend disconnected |

Backend Vercel settings created: NestJS, `services/api` monorepo root, external repo files included, Node 22, Vercel Authentication for all deployment URLs, OIDC workload identity enabled; Preview-only settings `TTO_MOCK_SMSOTP_PROVIDER=false` and `TTO_ENFORCE_ABUSE_GUARD=true`. NO API.ir, DB connection, or real auth pepper has been configured.

Current Supabase: organization **TTO National Platform** `yorsamvvdcteddkobgpp` (Free) and project **tto-national-preview-db** `zkfwsgrgslxxlusxrwce`, PostgreSQL **17.11**, region **ap-northeast-1 (Tokyo)**, `ACTIVE_HEALTHY`. Direct read-only check: database `postgres`, actor `postgres`, **no `tto` schema**, **no `tto_app` role**, **no migration records**. Both Supabase security and performance advisors returned 0 notices before schema. The prior BourseAI organization and two DBs are separate and untouched. Tokyo residency must be evaluated before any personal/shareholder data.


**Completed on Vercel (2026-10-22):** The backend project `tto-api-preview` accepted an update to its Trusted Sources, expressly listing only the three TTO portal project IDs, with `from:preview` → `to:preview` and `enableVercelCiSameRepository:false`. That provider write succeeded. **A live OIDC round trip has not been verified** (pending Vercel deployment and `@vercel/oidc` caller implementation); do not claim working server-to-server access. The deployment protection remains enabled.

## Phase A — separate TTO PostgreSQL 17

1. **DONE:** Separate TTO organization `yorsamvvdcteddkobgpp` has been created and is reachable.
2. **DONE, independently verified:** User created `tto-national-preview-db` (`zkfwsgrgslxxlusxrwce`), region **Tokyo**. This free project currently has no TTO schema or migration, and must not be used for real personal data before reviewing data residency. Do not recreate it or assume Frankfurt.
3. **HEALTH CHECK DONE:** `ACTIVE_HEALTHY`. Migration governance still pending. Restrict Supabase Data API exposed schemas: `tto` remains private; never grant public/anon/authenticated roles access to internal business tables. Configure retention / backups per plan.
4. Review SQL in `database/migrations/0001_...` through `0006_...` against actual fresh PostgreSQL 17. Apply **in increasing order** as authorized migration owner, with a migration history/rollback snapshot. This schema contains tightly scoped SECURITY DEFINER routines, so review ownership, `search_path`, `PUBLIC` revocations and EXECUTE grants before applying.
5. Create a **new long random password** for the nonowner `tto_app` role. The first migration defines it `NOLOGIN`; provision LOGIN and secret through secure platform SQL and secret manager, not a GitHub file. Enforce `NOSUPERUSER NOBYPASSRLS`. Verify `SELECT current_user` is `tto_app` and test denied cross-tenant access, source RLS and revoked session. Use the Supabase **session pooler** if IPv4 is required with a persistent Nest service, as described at https://supabase.com/docs/guides/database/connecting-to-postgres. PostgreSQL TLS with CA verification should be configured before use.
6. Do NOT attach BourseAI database URLs, users, or SMS credentials. Do not seed actual natural persons.

## Phase B — protected backend Preview

1. Backend source: reviewed Draft PR #12 on `feat/cf01-session-recovery-cross-portal` (not main). Freeze SHA and run all CI gates before deploy. Existing `main.ts` starts a Fastify-backed Nest server using `services/api` as monorepo root. Validate real Vercel NestJS runtime build (https://vercel.com/docs/frameworks/backend/nestjs).
2. Set secret Preview environment variables **only on `tto-api-preview`**:
   - `DATABASE_URL` => **tto_app** nonowner, TLS-pinned TTO-only PostgreSQL connection.
   - `AUTH_CHALLENGE_HMAC_SECRET`, `AUTH_ABUSE_HMAC_SECRET` => distinct cryptographic random values of 32+ bytes, using a secret manager; no values in repository.
   - `TTO_ENFORCE_ABUSE_GUARD=true` and `TTO_MOCK_SMSOTP_PROVIDER=false` (already set).
   - No `APIIR_TOKEN` for Preview until explicit test recipient and provider authorization; the UI must report fail-closed delivery.
3. Protect every backend Preview endpoint with Vercel Authentication. Set `TTO_API_BASE_URL` only after authenticated `GET /ready` confirms the TTO database and role. `GET /health` alone is insufficient.
4. Do not promote production, assign a public alias, relax SSO, or create a static bypass token.
5. The permanent backend Preview endpoint will be a **verified** Vercel deployment URL returned by the provider. Do not invent or assume a URL.

## Phase C — OIDC between three protected Next BFFs and protected Nest Preview

**The current BFF endpoints do not forward a Vercel workload identity to the backend.** Simply adding `TTO_API_BASE_URL` to the three Next projects is insufficient: Vercel's protected cross-project requests fail without a trusted source.

1. **CODE IMPLEMENTED ON THIS BRANCH (NOT LIVE):** All 12 auth BFF routes (4 per each of 3 Next portals) now forward the *Vercel-injected request header* `x-vercel-oidc-token` as `x-vercel-trusted-oidc-idp-token` to the protected backend. It only forwards a structurally valid short-lived JWT in Vercel Functions and fails closed when missing; no external npm dependency or lockfile change. This is the documented native Vercel Functions context mechanism (https://vercel.com/docs/oidc); do not use build-time `VERCEL_OIDC_TOKEN` as the runtime token. Verify that the gateway overwrites/injects the actual signed token and that cross-project trusted-source checks reject forged/untrusted callers in live negative tests.
2. Already configured backend Trusted Sources through Vercel API; inspect them in **Settings → Deployment Protection → Trusted Sources → Vercel Projects** before deployment. The configured set contains ONLY `tto-shareholder-preview`, `tto-cooperative-preview`, and `tto-national-preview`, each with `from: preview -> to: preview`. Do not grant other environments, production, or future projects. Validate its exact membership and effective rules; this was explicitly part of the requested Preview-only three-panel connection. See https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources
3. Negative tests: arbitrary unauthenticated Internet traffic cannot reach backend; a nontrusted Vercel project is denied; unrecognized OIDC tokens are denied; disabled/mock API.ir cannot send real messages. Positive tests: each Vercel Next BFF can call backend readiness and session endpoints from its own Preview context.
4. Then set secret-independent `TTO_API_BASE_URL` with exact verified backend URL in **Preview** scope of three existing projects and redeploy the three approved branch SHA previews; no changes to production targets.

## Acceptance criteria (do not misreport)

- Isolated dedicated PostgreSQL17 project created in selected TTO organization, no BourseAI linkage: **PASS (read-only provider verification)**.
- All six migrations, tto_app isolation, SSL, expired/revoked sessions, grants and RLS security: **PENDING live check**.
- Backend `/ready` with true database connection behind Vercel Authentication: **PENDING**.
- Per-project scoped OIDC for three BFFs and backend Trusted Sources: **CODE + TRUSTED SOURCES CONFIGURED; live cross-project verification PENDING**.
- Three protected Vercel previews of reviewed branch with real BFF→Nest→TTO PostgreSQL integration: **PENDING**.
- Cross-tenant denial, unauthorized SSR, fake/real SMS guard, no PII/secret egress: **PENDING**.
- PR #12 Github E2E against *ephemeral* PostgreSQL17: **207/207 PASS**, its CI **13/13** — verified, but is not live Preview acceptance.
- Full CF-01 `PHASE-04` and `PHASE-11` stay **IN_PROGRESS**. No `main` merge and no external user onboarding.

## Safe rollback

The current three protected Frontend Preview deployments remain unchanged until new deployment URLs independently pass all gates. If any new deployment fails, keep existing URLs in place; do not modify production aliases. Revoke only newly added Preview environment variables / Trusted Sources when authorized. Keep migration history and backup; never run destructive drop/reset on mixed or unknown projects.

## Live database migration record — 2026-10-22

On the user-created independent **TTO** Supabase project `zkfwsgrgslxxlusxrwce` (Tokyo, PostgreSQL17.11), applied all six checked-in SQL migrations in source order using the connected Supabase migration tool: `0001_cf01_cf03_foundation.sql`, `0002_cf01_03_secure_flows.sql`, `0003_cf01_03_role_jit_party_document.sql`, `0004_cf02_privileged_lifecycle_cf03_hold_release.sql`, `0005_cf01_smsotp_login.sql`, `0006_cf01_public_otp_abuse_guard.sql`. All six returned success and all six are recorded in Supabase migration history with matching order. This schema is for an isolated Preview, not approved production or real users.

Post-install read-only SQL confirmed **25** tables under schema `tto`; **17** tables have FORCE RLS; role `tto_app` is `NOLOGIN NOSUPERUSER NOBYPASSRLS`. The runtime login role has **not been provisioned**, no `DATABASE_URL` or auth HMAC secrets were added to Vercel, and the Backend has **not been deployed**. This is not an end-to-end functional approval. After applying, Supabase advisers returned informational security findings (`rls_enabled_no_policy`, 14 entries consistent with default-deny or purpose-specific privileged operations; each must be reviewed) and performance findings (including 27 `unindexed_foreign_keys`); review before opening up to users. Do not blindly add permissive policies to silence lints. No BourseAI project touched.

**Required next**: TTO-only nonowner `tto_app` login credential via secure secret manager and verified TLS pooler connection; migration checks with restricted credential; OIDC-gated Backend Preview deployment and three Next projects' integration; protect all URLs; confirm Tokyo data residency before any actual personal information.

## 2026-10-22 runtime credential reconciliation checkpoint

- API code was updated on this branch to support secret-split Vercel Preview PG pooler configuration (commit `0f89fa8e5c100e58998d700cb25859d5f12a1622`), without embedding the password in source control.
- Vercel Preview shows secret-name entries `TTO_DB_APP_PASSWORD`, `AUTH_CHALLENGE_HMAC_SECRET`, `AUTH_ABUSE_HMAC_SECRET`, plus project ref `TTO_DB_PROJECT_REF`. Do not print their values.
- **Supabase role `tto_app` remains `NOLOGIN`** per live read-only check. A connector security gate prevented completion of assigning the generated password to this role. DO NOT declare backend connected, even though Vercel secret entries exist. A secure manual secret reconciliation/rotation is required to put the same password in `tto_app` and the Vercel secret manager. The missing `TTO_DB_POOLER_HOST` must be obtained from the correct project's Supabase Connect dialog, not guessed.
- The latest checked commit `0f89fa8...` completed all 13 GitHub Actions workflows green. This is NOT a live Preview test.

## Verified TTO transaction pooler — 2026-10-22

User-provided Supabase **Connect → Direct → Transaction pooler** confirmed:

- Host: `aws-0-ap-northeast-1.pooler.supabase.com`
- Port: `6543`
- Database: `postgres`
- Example privileged username in Supabase UI: `postgres.zkfwsgrgslxxlusxrwce` **(DO NOT use this for the application)**.
- Expected nonowner runtime username for our secure configuration: `tto_app.zkfwsgrgslxxlusxrwce` (verify with successful connection test; do not infer success from naming alone).

The backend Vercel project `tto-api-preview` received `TTO_DB_POOLER_HOST` with the exact host above, **Preview scope only**. Subsequent `filter_project_envs` confirms it exists and other Preview-only secret variables remain present (values not displayed).

A read-only SQL check confirms `tto_app`: `rolcanlogin=false, rolsuper=false, rolbypassrls=false`. **Do not deploy or claim a live database connection** until a securely generated credential has been assigned to this nonowner role, and the same credential has been entered into Vercel Preview `TTO_DB_APP_PASSWORD` through protected settings. Previous attempt to synchronize secrets across tools was blocked by the safety boundary; do not attempt to circumvent it. The operator must rotate both ends to one matching randomly generated password and test `current_user='tto_app'` through the actual serverless pooler. Never share that password in chat or version control. Transaction pooler is the correct serverless mode; do not order or enable the optional dedicated IPv4 add-on.

## Backend Preview deployment safety gate — 2026-10-22

- User states that the same independently generated >=60-character `tto_app` password was set in Supabase and in Vercel **Preview-only** `TTO_DB_APP_PASSWORD`. A read-only provider check confirmed `tto_app LOGIN=true`, `rolsuper=false`, `rolbypassrls=false`, and the Vercel secret name present. Equality of secret values can ONLY be established by a successful actual restricted-role runtime connection, not by reading their existence.
- Attempt A, GitHub `gitSource` targeting project `prj_dd1k3kjAM05ru7VFFVELnPqEiffB` from PR #13 branch: `400 incorrect_git_source_info`: Vercel does not currently resolve private `tajikinews-design/tto-national-platform-app`. No deploy from this call.
- Attempt B, Vercel REST inline file source, explicitly requested Preview, deployment ID **`dpl_4cujaXjeiNYVaSHCcXukpd8YUyfs`**: Vercel unexpectedly classified the **first** deployment as `target=production`. Its build failed (`ERROR`, code `lint_or_type_error`) because `src/apiir-provider.ts` had two `Response` type errors under the standalone TypeScript lib. No successful deployment, no active alias (`list_deployment_aliases` empty), `get_project.live=false`. DO NOT retry creation on this new project until preview-only semantics are guaranteed by provider or a specifically approved bootstrap process.
- Fixed standalone TS build `services/api/tsconfig.json` to include `DOM` alongside `ES2022` on PR #13 only.
- Added **fail-closed protection** via `services/api/scripts/require-vercel-preview.cjs` and invoked it from API package `preinstall` and `build`. It exits with code 44 when running on Vercel unless `VERCEL_ENV === "preview"`, preventing an accidentally Production-targeted API artifact from finishing installation/build. Does not interfere with local or GitHub tests.
- Provider documentation says an omitted deployment `target` means Preview, but Vercel staff publicly acknowledged first deployments can be Production (https://community.vercel.com/t/vercel-cli-ignores-target-preview-and-creates-production-deployment/46384/7). GitHub issue https://github.com/vercel/vercel/issues/17069 documents reproducibility with explicit Preview target even with REST API. Hence do not treat a nominal target argument as sufficient protection.
- NEXT GATE: explicit authorized exception for a temporary protected initial production bootstrap, or a Vercel-supported first-preview-only path. Neither has been authorized. The standing **No Production** rule remains binding. Never add actual shareholder data or Production DB credentials.
- The BourseAI projects, TTO application `main`, reference repository, existing 3 Preview URLs, and ArvanCloud production were never changed.

## Completed Vercel protected four-project Preview deployment — 2026-10-22 (supersedes earlier pending checkpoints)

**This section supersedes earlier "not deployed" or first-deploy-blocker notes. All real application deployments are Preview, and no app code is deployed to Production.**

### Root-cause and security resolution
- Vercel's first deployment of backend was classified Production despite preview intent, so an approved **neutral HTML-only, no DB, no API, no user data** bootstrap was created as `dpl_Bt8qGgvfyNMCB3HqTSW8Qt3M1bb9`, `READY`, while the project stayed protected with Vercel Authentication for **all** deployments. This technical Production bootstrap is **not** a business/backend deployment.
- Full backend Preview `/ready` initially failed because PostgreSQL Supavisor transaction pooler presented a certificate chain with `SELF_SIGNED_CERT_IN_CHAIN` when the Node PG driver used strict TLS without the Supabase root CA. **Do not disable TLS verification.**
- Retrieved verified public `prod-ca-2021.crt` / Supabase Root 2021 CA (HTTP 200) from Supabase's public certificate distribution URL `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`. Set `TTO_DB_CA_PEM` in backend **Preview-only**, used `ssl: { ca: rootCA, rejectUnauthorized:true }` with the exact Supabase transaction pooler endpoint.
- A temporary independent **read-only DB connection probe**, protected by the same project access controls, returned **HTTP 200** with `{"ready":true,"restrictedRole":true,"noTenantRecords":true}` (without exposing tokens/passwords/person records). This establishes credential equality, verified TLS handshake, `current_user=tto_app`, and no authorized tenant visibility on the fresh DB. Separate probe deployment: `dpl_526UNfVNXK2nnYTS2R23VxoGHHhf`, not the application Backend.
- Backend actual NestJS Preview `dpl_7ubTFVhygepQo2ZxEjvhwHRn4vbX` **READY**, `https://tto-api-preview-6ok591xqv-tajikinews-6739.vercel.app`. `GET /health` returns HTTP 200; `GET /ready` returns HTTP 200 `{"status":"ready","database":"reachable"}`. Runtime uses strict CA validation, `tto_app` least-privileged credentials, Preview-only env vars. Backend source commit `dba0d2deab3138dc2a7995263304126ad8d8fc4d`, packaged from reviewed Draft PR #13.
- Real Backend deployment `target=null` means Preview (the deployment API's explicit `target:"preview"` is INVALID; omit the target). No app deployment has Production target.

### Protected three-portal Next 16 rollouts

Each portal: NextJS Node 22; Vercel Authentication on all deployment URLs; OIDC federation enabled; `TTO_API_BASE_URL` references the exact protected Backend Preview URL in `Preview` env only. Backend Trusted Sources limits accepted workload OIDC to exactly three source Vercel projects in Preview→Preview. Built from Draft PR #13 `df8255e2670702518a0b2b40d2926cfb350828aa` source snapshot, via API inline files because Vercel Git integration currently cannot resolve the private repository; these are **manual, immutable** Preview deployments (not auto synced on Git pushes).

| Role | Vercel deployment | Verified protected Preview URL | Runtime checks |
| --- | --- | --- | --- |
| Shareholder | `dpl_7w7ja977V17UdqoRzBB2Q6Z19XyD` | `https://tto-shareholder-preview-4chlyjht7-tajikinews-6739.vercel.app` | page=200, anon session=200 unauthenticated, `/api/internal/backend-ready`=200 `{"ready":true,"oidcTrusted":true,"restrictedDatabase":true}` |
| Cooperative | `dpl_BYEYhz34Pv6sX3FHVnF4CZEZB44W` | `https://tto-cooperative-preview-jj5sxvkwo-tajikinews-6739.vercel.app` | same 3 checks passed |
| National admin | `dpl_7BKnd8rUP7xjfx7LWehocoMu2RAr` | `https://tto-national-preview-9gyj9q9qx-tajikinews-6739.vercel.app` | same 3 checks passed |

All 4 provider projects' last deployments were checked `READY`, `ssoProtection.enabled=true, deploymentType=all`; each new deployment had Preview target (`null` from API) and NO production alias. Earlier 3 preview URLs remain independently available. The new `/api/internal/backend-ready` endpoints refuse to operate outside `VERCEL_ENV=preview`, return only Boolean readiness/OIDC trust/DB reachable and no tokens or personally identifying records. This endpoint is internal-diagnostic and should be removed/disabled before real-user launch.

### Remaining gates, not part of this phase's success
- Real SMS OTP is **NOT** live: `APIIR_TOKEN` deliberately absent, mock provider disabled, no actual SMS recipient. Do not report completed CF01 user login until explicit approved test recipient and provider/delivery validation.
- Empty test database; no authentic shareholder/coop/operator records; authorization and tenancy must undergo separate live negative tests using anonymous/synthetic actors before real use.
- `tto` schema RLS default deny, migration 0001..0006, 25 tables/17 FORCE RLS. Security/performance advisors informational findings require issue-by-issue review; don't silence no-policy warnings by adding broad access.
- Tokyo (`ap-northeast-1`) data residency decision pending before real personal data.
- GitHub→Vercel private repo integration currently absent; current Preview builds were passed as inline snapshots from the Draft PR. Do not claim automatic deployment on PR updates.
- No changes to TTO canonical reference repository, app `main`, BourseAI databases, public/Production Backend code, or ArvanCloud.
- Phase CF01/03 overall still **IN_PROGRESS**.


## 2026-10-22 three requested follow-up workstreams

### A. GitHub private repo ↔ Vercel automatic Preview linking — BLOCKED ON EXTERNAL GITHUB APP APPROVAL

- Checked Vercel's Git integration directly. `git_namespaces({provider:"github"})` returns `[]`. `search_repo({provider:"github", query:"tto-national-platform-app", teamId:"team_n6CStwBbEYPsdb886A3Xm2Vp"})` returns `repos:[]` and `namespaceId:null`. Thus native Vercel Git authentication for the private source is not installed/authorized on this scope. **ChatGPT→GitHub and ChatGPT→Vercel connectors do NOT by themselves authorize GitHub→Vercel integration.**
- Vercel documentation: https://vercel.com/kb/guide/unable-to-find-github-repository and https://vercel.com/docs/git/vercel-for-github. An authorized repository owner must use GitHub Settings → Applications → Installed GitHub Apps → Vercel → Configure and grant *only* `tajikinews-design/tto-national-platform-app`; then connect the repository to each existing Vercel Project under Settings → Git. The available Vercel MCP tools cannot install the GitHub App or attach an existing unlinked project (`create_git_project` explicitly does not reconnect existing unlinked projects). **Do not create duplicate projects.**
- **Critical noncommercial Preview safeguard:** Git-native deployments from `main` normally target Production. Three Vercel projects (`tto-api-preview`, `tto-shareholder-preview`, `tto-cooperative-preview`) accepted `commandForIgnoringBuildStep = if [ "$VERCEL_ENV" = "preview" ]; then exit 1; else exit 0; fi` via their project API to skip non-Preview builds. Vercel's API projection does not echo that setting for an independent read verification. The identical change on `tto-national-preview` was BLOCKED by connector safety controls, so **do not link/enable auto-deploy on any project until all four controls are verified in Vercel Dashboard**. The existing private protected Preview deployments remain healthy and may be manually redeployed from pinned SHA.
- No git connection or automatic workflow is claimed. No Production code release/merge permitted.

### B. Reciprocal synthetic tenant security — PASS in disposable PostgreSQL17 CI

- Strengthened `tests/sql/tenant-isolation.sql` to add separate identity **B** and cooperative **B**, assert B sees only its own `MEMBER` document, B cannot read cooperative A, B's MEMBER role cannot insert its own managed documents, and B cannot escalate by selecting A's tenant scope. Previous tests also cover A→B denial, A's classified RESTRICTED/HIGHLY_RESTRICTED records, role revocation, transaction rollback, empty unscoped access, and unauthorized writes.
- Test was executed in GitHub Actions `TTO CF01-03 security and lifecycle v2 (NO DEPLOY)` `Initial Tenant RLS tests` step: **success**; disposable PostgreSQL17 CI only, **no** synthetic tenant/user/phone/document records written to the hosted Supabase TTO project.

### C. OTP end-to-end without enabling real SMS — PASS in disposable CI and protected Preview

- Added `TTO_ENABLE_REAL_SMSOTP_DELIVERY` as an independent explicit permission gate at both POST challenge issuance and the server-only `ApiIrSmsOtpProvider.send`. It must equal exact string `"true"`; absent/false fails closed even if a provider token were accidentally present. The synthetic mock still works ONLY when `NODE_ENV=test` AND `TTO_MOCK_SMSOTP_PROVIDER=true`. No real SMS to be sent until an approved test plan/recipient and protected provider secret are set.
- Added `services/api/test/sms-delivery-opt-in.test.cjs`, which installs an in-process fetch spy, tries multiple disabled flag values *with a fake provider token*, asserts HTTP-level ServiceUnavailableException 503 and **zero outbound fetch calls**, then tests permitted isolated CI fake code with zero network. Its dedicated CI workflow step `No real SMS without independent authorization (no network)`: **success**.
- GitHub Actions real (ephemeral) Next→Nest→PG17 test still covers OTP request, incorrect code, correct synthetic code, HttpOnly/Secure/SameSite cookie, session restoration, replay denial, CSRF origin denial, logout/revocation, public throttle and IP spoofing. **No real SMS**.
- Latest executable CI SHA `81f784bfde319cdb95396745c987de45b3f1ddcc` returned **13/13 completed success**.

### Newly deployed, protected Preview (updated SMS guard, strict TLS)

| Component | Vercel immutable deployment | Verified URL |
| --- | --- | --- |
| NestJS Backend (updated SMS guard, strict TLS, PG17) | `dpl_876rkvZrD6g62kWo2PZFNSh68q1h` | https://tto-api-preview-6l9c3huqs-tajikinews-6739.vercel.app |
| Shareholder Next16 | `dpl_9RW9rQryMDN6Esf6Zct3UeroHtFk` | https://tto-shareholder-preview-o3c7n37jy-tajikinews-6739.vercel.app |
| Cooperative Next16 | `dpl_7R3GW3Z1qjaddcb7bYAmciqWutGo` | https://tto-cooperative-preview-mrk344tn1-tajikinews-6739.vercel.app |
| National admin Next16 | `dpl_FubKx89uXj4HX7kCwCi7uUAkciGx` | https://tto-national-preview-3i8h7vz82-tajikinews-6739.vercel.app |

- Backend `GET /health` and `GET /ready` returned HTTP 200 with PostgreSQL `reachable`.
- Three new panels `GET /api/internal/backend-ready` returned HTTP 200 with `{ready:true,oidcTrusted:true,restrictedDatabase:true}` after re-pointing their Preview-only `TTO_API_BASE_URL` to updated protected Backend. All four project SSO protections remain enabled; no Production application deployed.
- These are **manual immutable Preview releases**, not automatic Git deployments. Do not mistake protected private diagnostic URLs for publicly accessible endpoints, and do not claim end-user SMS delivery/role authorization is complete.
