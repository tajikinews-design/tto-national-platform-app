# TTO — CF-01 validated session restoration and Vercel scope diagnosis

**Date:** 2026-10-22  
**Implementation:** Draft PR #12, stacked on Draft PR #11, no merge  
**Invariant:** no changes to source baseline repo, app `main`, Vercel deployed Preview URLs, API.ir real SMS, ArvanCloud Production or external user records.

## Implemented
- Existing PostgreSQL17 session revocation/expiry/epoch validation via `tto.resolve_session` is now exposed to authenticated NestJS callers only as `GET /v1/auth/session`. The endpoint never returns user IDs, tenant IDs, role claims or authorization scope—only `{authenticated:true}` for active sessions; otherwise HTTP 401.
- Three server-only Next.js BFF routes `GET /api/auth/session` accept only the HttpOnly session cookie and call Nest with the bearer token **server-side**. The BFF returns only `{authenticated:boolean}`; no token to client JavaScript. Cache is private/no-store and `Vary: Cookie`.
- Expired/revoked/malformed cookies receive `{authenticated:false}` with an expired secure HttpOnly cookie; genuine transport/backend outages receive 503 **without discarding the cookie**.
- Shared `@tto/ui` OTP component checks session state after reload. The initial SSR state is neutral, with no unauthenticated form flash; a backend outage fails closed with explicit retry. Existing logout remains backend-confirmed before cookie clearing.

## Actual evidence
- [GitHub Actions 39799602780](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39799602780), job `119896216205`, **success**.
- Logs show `CF01_THREE_PORTAL_E2E_SHAREHOLDER_PASS`, `CF01_THREE_PORTAL_E2E_COOPERATIVE_MANAGEMENT_PASS`, `CF01_THREE_PORTAL_E2E_NATIONAL_ADMIN_PASS`.
- `CF01_THREE_PORTAL_NEXT_NEST_PG17_LOGIN_LOGOUT_E2E_PASS_CHECKS=207`.
- All requests ran against actual Next.js 16 servers, NestJS 11 and disposable PostgreSQL17 with migrations 0001–0006 using test-only mock SMS. No real recipient or network SMS transport.
- New negative/positive coverage across each portal: unauthenticated session, malformed cookie expiry, authenticated restore, absence of bearer in JSON, cache directives, direct Nest auth validation, post-logout stale-token rejection, existing OTP abuse-guard concurrency checks.
- These are **HTTP route and SSR-shell tests**, not a completed Playwright/browser UI or third-party authorized Vercel reviewer sign-in.

## Scope-specific Vercel blocker discovered after reconnect
1. User reconnected the Vercel plugin; `get_auth_user` reports `tajikinews-6739` (defaultTeamId `team_n6CStwBbEYPsdb886A3Xm2Vp`), and `get_project` without a team scope can still read project metadata with `ssoProtection.enabled=true`.
2. All three `web_fetch_vercel_url` calls fail with HTTP 403 at `read_protection_bypass`. All three `get_access_to_vercel_url` calls fail with HTTP 403 at `lookup_deployment`.
3. Explicitly team-scoped `get_project`/`get_deployment` fail with: **Not authorized: Trying to access resource under scope "tajikinews-6739". You must re-authenticate to this scope or use a token with access to this scope**.
4. That Vercel API response advises `authorize_team_access` / `authorize_team_sso`, but neither action is exposed by the current connected Vercel tool namespace. Only account/project metadata reads succeed.
5. This is **connector scope authorization**, distinct from the Vercel Authentication page, backend OTP and actual reviewer permission. No temporary share link or disable-protection workaround was used. User needs to grant the connector access **specifically to the tajikinews-6739 team/scope** and authorize the three projects, then we must retest.

## Remaining infrastructure and acceptance gates
- A dedicated, explicitly approved TTO-only PostgreSQL Preview project and an independently protected HTTPS Nest runtime must be provisioned. Two known connected Supabase projects are BourseAI projects, **not** acceptable substitutes. No TTO database provisioned in this change.
- `TTO_API_BASE_URL` in each existing protected Vercel Next Preview is intentionally absent; a successful CI E2E is not evidence of a working online login.
- Need full browser reviewer SSO and browser session E2E, persistent session/DB tests, independently consented real mobile enrollment and API.ir delivery, rate-limit/proxy trust review, durable outbox/retry, remaining CF-01 security/legal acceptance.
- Keep `PHASE-03`, `PHASE-04`, `PHASE-11` **IN_PROGRESS** and PR #12 **Draft**. No Production/ArvanCloud and no `main` merge.

**Review status:** E2E session restoration sub-gate green (207 tests), platform CF-01 and live protected Preview gates not green.
