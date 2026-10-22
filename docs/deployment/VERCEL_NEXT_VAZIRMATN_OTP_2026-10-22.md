# TTO — Vazirmatn + Next.js protected previews + server-side CF01 SMSOTP — 2026-10-22

## Approved typography

**Vazirmatn / وزیرمتن** is the sole default font for all three portals, defined in `docs/design/FONT_STANDARD_VAZIRMATN.md` and their Next.js layouts with `next/font/google` (Arabic+Latin subset, optimized build-time self-hosting). All shared UI and form controls honor `--tto-font`. Legacy static review shells have matching CSS only; they are superseded by REAL Next deployments.

## New READY protected Vercel deployments

| App | URL | ID | Framework / protection |
| --- | --- | --- | --- |
| Shareholder | https://tto-shareholder-preview-kr6ps1j9u-tajikinews-6739.vercel.app | `dpl_smfdz9Kvoye9zWeRkoZFM45RQTXN` | Next.js 16, READY, target Preview/null, Vercel Authentication all |
| Cooperative management | https://tto-cooperative-preview-ipocq22t7-tajikinews-6739.vercel.app | `dpl_5Zrgm5PrmwHbkJ7FtXDQ5zep3Ywc` | Next.js 16, READY, target Preview/null, Vercel Authentication all |
| National admin | https://tto-national-preview-1er7r06ce-tajikinews-6739.vercel.app | `dpl_HmRLAiJdYTR6FkCPDcQhjNiK2pNX` | Next.js 16, READY, target Preview/null, Vercel Authentication all |

Packages delivered from feature branch `feat/vazirmatn-next-preview-otp` as source-file Vercel uploads (no Vercel GitHub namespace available). These are actual Next.js App Router builds with server proxy routes and shared UI; NOT static HTML review shells. Configured API env `TTO_API_BASE_URL` is deliberately absent in Preview, so the browser form is disabled and Next server OTP proxy returns HTTP 503 (rather than fake success). No OTP secret is exposed to the browser.

**Independent browser / anonymous protection probing was NOT completed**. Vercel project API confirms All Deployments protection enabled. Reviewer must log into authorized Vercel account. No shareholder data, payment or real SMS is used.

## Actual OTP implementation and CI

- New PG17 SQL migration `database/migrations/0005_cf01_smsotp_login.sql`: verified mobile-to-user binding; transactionally enforced 3 requests per 15 minutes per enrolled mobile; server-generated HMAC OTP; PENDING vs provider ACCEPTED/FAILED; session verification blocked without accepted delivery; privileged sensitive tables inaccessible to `tto_app`; missing policy fails closed.
- Nest API `POST /v1/auth/challenges/request` issues generic request ID for known or unknown mobile. Secure API.ir transport only server-side with Bearer secret injected through runtime; existing `POST /v1/auth/challenges/verify` atomically consumes verified challenge, returns session to BFF Next proxy. Test-only fixed OTP/mock delivery requires NODE_ENV=test **and** TTO_MOCK_SMSOTP_PROVIDER=true.
- Three Next client form components and 6 BFF route files; HttpOnly Secure SameSite=Lax cookie on successful verification. Tenant authorization remains enforced by Nest/PostgreSQL; merely signing in never grants cross-Tenant access.
- Latest GitHub actions for source snapshot `bb6c678ed49a3d1fb7e5672574f66c6f998c17be`: **12/12 workflows passed**, including [PG17+Nest SMSOTP issuance/verify/abuse tests](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39779478115), [3 Next runtime and 503 fail-closed route smoke](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39779478142), [Next/Nest compilation, typecheck and PG17 RLS](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39779478202).
- **No real API.ir SMS sent or proven delivered**. APIIR_TOKEN remains a Sensitive Vercel Preview variable on shareholder project, but the Nest server is not deployed/connected in Vercel, so no live gateway call was performed. Before real integration: approved test phone, backend secret injection, IP/device throttles, durable outbox & security review.

## Runtime availability security correction — tested 2026-10-22

- `apps/{shareholder,cooperative-management,national-admin}/app/page.tsx` now declares `dynamic = "force-dynamic"`, so OTP enablement depends on the Node **runtime** trusted `TTO_API_BASE_URL` rather than accidental build-time prerendering.
- This does NOT enable real login on Vercel: no approved backend URL, API service, or synthetic shared PostgreSQL deployment exists.
- CI `TTO three Next.js preview runtime and OTP fail-closed smoke` run [39781753954](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39781753954) verified 12 runtime checks: each portal with missing backend denies OTP routes and with a dummy HTTPS server value shows the login form, without contacting the dummy hostname.
- The source code at `0ac928b2567f62154aaa8229b4d2a538afe4bc6a` passed 12/12 workflows; Vercel fresh Next deployments `dpl_smfdz9Kvoye9zWeRkoZFM45RQTXN`, `dpl_5Zrgm5PrmwHbkJ7FtXDQ5zep3Ywc`, `dpl_HmRLAiJdYTR6FkCPDcQhjNiK2pNX` reported READY, target Preview/null and project SSO ALL enabled. No anonymous-browser login/denial probe completed due Vercel scope restriction on log events; do not claim browser acceptance tested.
- Changes are pending review in **Draft PR #8**; 15-file reference repo untouched and Production deployment not authorized.

## Future phases

CF01–03 remain IN_PROGRESS; 23 domain modules overall not complete. Project Owner requires production ArvanCloud only AFTER all modules and three portals final acceptance. No ArvanCloud provisioning/deployment and no Vercel operational Production deployment was authorized or attempted. The immutable 15-file GitHub reference repository remains unchanged (source pin `5eb6be8edfbb61f2eca740a42c30f572b493f023`). Draft PR #8 pending review.
