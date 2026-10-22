# TTO — CF01 three-portal synthetic login/logout E2E checkpoint
Date: 2026-10-22

## Scope and boundaries
- Implementation repository only: `tajikinews-design/tto-national-platform-app`.
- Continuation of Draft PR #9 at `7a715b9203c65d7ddf2938fd28e30acccd645f22`.
- All 15 files in source reference repository are immutable and not modified.
- No changes to `main`, Production, ArvanCloud, existing Vercel Preview deployments, DNS, API.ir token, persistent user data or real SMS.
- Technology baseline unchanged: Next.js 16, NestJS 11/Fastify, PostgreSQL 17, tenant RLS.

## Work implemented
1. Three real Next.js BFF `POST /api/auth/logout` routes: `apps/{shareholder,cooperative-management,national-admin}/app/api/auth/logout/route.ts`. Pass opaque session to existing Nest `POST /v1/auth/logout` server-side; delete HttpOnly/Secure/Lax browser cookie **only on successful backend 204**. Reject cross-origin POST and fail closed on backend failures.
2. Shared `packages/ui/src/otp-login.tsx` offers an explicit logout action after successful OTP and displays an error if server session revocation was not confirmed.
3. `scripts/e2e-cf01-three-portal-login-logout.cjs` starts the actual NestJS 11 service and three real Next.js 16 servers against disposable PostgreSQL17 after migrations 0001..0005. Existing simulated provider code is used **only** with NODE_ENV=test and TTO_MOCK_SMSOTP_PROVIDER=true.
4. CI `.github/workflows/cf01-three-portal-login-logout-e2e.yml` builds and typechecks the real apps, provisions ephemeral PG17, performs exact HTTP checks, and destroys the runner/DB after finishing. No secrets, real numbers or external service needed.
5. One CI-only loopback transport exception exists in Next OTP request/verify/logout BFFs. It requires `TTO_LOOPBACK_E2E=1`, `CI=true`, no `VERCEL` variable and a strict `http://127.0.0.1:<port>` backend URL. Normal Preview/Production HTTP endpoints are still rejected.

## Actual verification
Evidence: https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39790001499

- Workflow conclusion: **success**.
- `CF01_THREE_PORTAL_E2E_SHAREHOLDER_PASS`
- `CF01_THREE_PORTAL_E2E_COOPERATIVE_MANAGEMENT_PASS`
- `CF01_THREE_PORTAL_E2E_NATIONAL_ADMIN_PASS`
- `CF01_THREE_PORTAL_NEXT_NEST_PG17_LOGIN_LOGOUT_E2E_PASS_CHECKS=70`
- `CF01_TEST_FIXTURE_ONLY_NO_REAL_SMS_NO_PRODUCTION`
- All **13 of 13** workflows were successful on implementation commit `24127d57747ad0b4af628ff2a439be072bb8ba9b` before adding this evidence checkpoint.
- Mandatory positives: each portal requests an OTP, verifies accepted fake code and receives a Secure HttpOnly SameSite=Lax session cookie without returning token JSON to browser.
- Mandatory negatives: wrong OTP denied; replay denied; wrong-Origin logout denied; session revoked by real Nest+PG17 and the formerly valid bearer is rejected afterward.
- No real SMS sent. Test fixture is discarded with PG17 runner.

## Separately verified Vercel protection
The predecessor independent anonymous check is GREEN 3/3: https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39786443223 . Anonymous access redirects HTTP 302 to Vercel SSO.

### Remaining BLOCKER: authorized reviewer sign-in
`mcp__Vercel__web_fetch_vercel_url` for all three protected deployment URLs returned **403 forbidden**, stage `read_protection_bypass`, on the Vercel deployment aliases API. This does **not** prove the reviewer cannot sign in; it proves the connected tool lacks permission to independently verify authorized access. Reauthorize the Vercel connection for the correct project/team, then conduct interactive reviewer sign-in and page smoke on **each** Preview URL. Do NOT disable SSO or treat a temporary bypass link as proof of authorized reviewer login.

### Remaining BLOCKER: online preview Backend
The CI ephemeral Nest/PostgreSQL environment does not remain online when the job finishes. Three existing Vercel protected Next Preview URLs are still without `TTO_API_BASE_URL` and real login is fail-closed, by design. Do not point them at a public, unprotected Nest API or production database. A future protected synthetic Preview backend + persistent isolated PostgreSQL require approved hosting, runtime secret scope, rate limits, access review and user-approved live testing.

## CF01 unfinished security gates
- Mobile enrollment/ownership evidence, independent real API.ir delivery receipts and consented test number.
- IP/device/cross-account throttling; resilient outbox/retry, transport auth/timeout; safe observability.
- HTTPS Preview-endpoint origin/trust enforcement; real browser persistence and authorized SSO smoke; end-to-end session revocation across processes.
- Full CF01/02/03 source acceptance scenarios and legal authority / JIT tests.

**Gate disposition:** `EPHEMERAL_THREE_PORTAL_LOGIN_LOGOUT_E2E = GREEN`; `VERCEL_AUTHORIZED_REVIEWER_SSO = BLOCKED`; `LIVE_PREVIEW_NEST_POSTGRES = NOT_DEPLOYED`; `CF01 = IN_PROGRESS`. Do not merge Draft PR #10 before review; never deploy Production without approval.
