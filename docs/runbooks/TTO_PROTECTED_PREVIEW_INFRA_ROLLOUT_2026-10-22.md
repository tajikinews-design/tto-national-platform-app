# TTO isolated Preview rollout — controlled handoff

**Status (2026-10-22): PREPARED / NOT DEPLOYED.** This is a pre-production runbook, not proof of a connected database or live backend.

## Immutable boundaries

- Canonical reference: `tajikinews-design/tto-national-platform` main pinned `5eb6be8edfbb61f2eca740a42c30f572b493f023`: do not modify.
- Application `tajikinews-design/tto-national-platform-app` main `9eb48b7f06c25e66021adbe0b4386133cdcb3039` stays unchanged; implementation staged on Draft PR #12 and this follow-up Draft PR.
- No migration to or credential reuse from either Supabase BourseAI project (`xknsxkjkoznifegrxawg`, `zgdgjyhqlvitaqniwldl`). There is **no** currently connected TTO organization or project on Supabase.
- No Production/ArvanCloud rollout. Hobby Vercel is Preview-only, internal and noncommercial. No actual recipients, shareholders, public OTP sending or API.ir test delivery.
- Never echo or commit secrets, unprotected connection URLs, authentication cookies, bypass URLs or 2FA tokens.

## Inventory — verified from provider

Vercel team `team_n6CStwBbEYPsdb886A3Xm2Vp` (account `tajikinews-6739`):

| Role | Vercel project | Project ID | Preview status |
| --- | --- | --- | --- |
| Backend | `tto-api-preview` | `prj_dd1k3kjAM05ru7VFFVELnPqEiffB` | **created, no deployment** |
| Shareholder | `tto-shareholder-preview` | `prj_WWvZY31IsOEZLQLrKG98M9rZQ2q5` | earlier UI READY, backend disconnected |
| Cooperative | `tto-cooperative-preview` | `prj_akvZAPInGMPwy0Am0gOOC4N2RBSz` | earlier UI READY, backend disconnected |
| National admin | `tto-national-preview` | `prj_d0s538suEmpmtIEicOMYdRy6lc1q` | earlier UI READY, backend disconnected |

Backend Vercel settings created: NestJS, `services/api` monorepo root, external repo files included, Node 22, Vercel Authentication for all deployment URLs, OIDC workload identity enabled; Preview-only settings `TTO_MOCK_SMSOTP_PROVIDER=false` and `TTO_ENFORCE_ABUSE_GUARD=true`. NO API.ir, DB connection, or real auth pepper has been configured.

Current Supabase visibility: only organization `ttixeequmvxsuizyxxce` named **BourseAI**, on Free plan; two prior BourseAI projects only. Tool contract requires user choice of organization and explicit approval of any positive project cost. Do not infer consent to use BourseAI organization or to purchase a paid tier.

## Phase A — separate TTO PostgreSQL 17

1. User creates or selects a distinct TTO organization in Supabase Dashboard (organization creation is not exposed by available connector actions). Recommended name `TTO National Platform` and plan Free if eligible. User explicitly selects the organization ID for the new DB project.
2. Discover organization ID via `list_organizations` and obtain project quote via `get_cost({type:"project", organization_id})`. Present nonzero cost and obtain explicit agreement. Create `tto-national-preview-db` in the approved region (e.g. `eu-central-1`, only after confirming data residency requirements); do not choose another app's existing project.
3. Get provisioning status `ACTIVE_HEALTHY`. Restrict Supabase Data API exposed schemas: `tto` remains private; never grant public/anon/authenticated roles access to internal business tables. Configure retention / backups per plan.
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

1. Implement and pin `@vercel/oidc` in the three Next packages (include revised `pnpm-lock.yaml`). Server-only Next BFFs must call `getVercelOidcToken()` and attach the short-lived token via `x-vercel-trusted-oidc-idp-token` on requests to the trusted exact backend Preview URL. Never expose it to browser code or logs. Strictly verify `https`, host/project allowlist, non-redirecting fetch and no dev fallback in Vercel.
2. In backend project **Settings → Deployment Protection → Trusted Sources → Vercel Projects**, explicitly authorize ONLY `tto-shareholder-preview`, `tto-cooperative-preview`, and `tto-national-preview`, each with `from: preview -> to: preview`. Do not grant other environments, production, or future projects. This access-control change requires explicit review. See https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources
3. Negative tests: arbitrary unauthenticated Internet traffic cannot reach backend; a nontrusted Vercel project is denied; unrecognized OIDC tokens are denied; disabled/mock API.ir cannot send real messages. Positive tests: each Vercel Next BFF can call backend readiness and session endpoints from its own Preview context.
4. Then set secret-independent `TTO_API_BASE_URL` with exact verified backend URL in **Preview** scope of three existing projects and redeploy the three approved branch SHA previews; no changes to production targets.

## Acceptance criteria (do not misreport)

- Isolated dedicated PostgreSQL17 project created in selected TTO organization, no BourseAI linkage: **PENDING**.
- All six migrations, tto_app isolation, SSL, expired/revoked sessions, grants and RLS security: **PENDING live check**.
- Backend `/ready` with true database connection behind Vercel Authentication: **PENDING**.
- Per-project scoped OIDC for three BFFs and backend Trusted Sources: **PENDING**.
- Three protected Vercel previews of reviewed branch with real BFF→Nest→TTO PostgreSQL integration: **PENDING**.
- Cross-tenant denial, unauthorized SSR, fake/real SMS guard, no PII/secret egress: **PENDING**.
- PR #12 Github E2E against *ephemeral* PostgreSQL17: **207/207 PASS**, its CI **13/13** — verified, but is not live Preview acceptance.
- Full CF-01 `PHASE-04` and `PHASE-11` stay **IN_PROGRESS**. No `main` merge and no external user onboarding.

## Safe rollback

The current three protected Frontend Preview deployments remain unchanged until new deployment URLs independently pass all gates. If any new deployment fails, keep existing URLs in place; do not modify production aliases. Revoke only newly added Preview environment variables / Trusted Sources when authorized. Keep migration history and backup; never run destructive drop/reset on mixed or unknown projects.
