# TTO — CF01 anonymous OTP abuse protection, hardened CI checkpoint
**Date:** 2026-10-22  
**Review:** Draft PR #11 on top of Draft PR #10; no merges  
**Repository:** `tajikinews-design/tto-national-platform-app`  
**Invariant:** source reference repository pinned at `5eb6be8edfbb61f2eca740a42c30f572b493f023`, immutable

## New implementation
- PostgreSQL17 additive migration `0006_cf01_public_otp_abuse_guard.sql`: private `tto.otp_request_throttle_events` stores **only 32-byte HMAC digests** of the socket IP and syntactically valid mobile identifier; no raw IP or unknown mobile values. FORCE RLS, no runtime SELECT/INSERT/DELETE privileges.
- A tightly scoped SECURITY DEFINER capacity function serializes per-digest reservation and enforces preliminary 30/IP and 3/mobile requests per 15 minutes, even for nonexistent accounts. Uses transaction advisory locks. Other CF01 challenge issuance and session flows are unchanged.
- Nest request gateway uses the actual Fastify socket `request.ip`, `trustProxy=false`. Browser `X-Forwarded-For`, arbitrary forwarded/device IDs, body-provided tenant and any raw phone are **not** trusted for security counters.
- Non-test Nest runtime fails closed unless `AUTH_ABUSE_HMAC_SECRET` is an independent >=32-byte runtime secret and migration 0006 is installed. Existing isolated NODE_ENV=test compatibility remains, while new E2E sets `TTO_ENFORCE_ABUSE_GUARD=true`.
- Denied requests return the same generic accepted response without issuing a challenge or sending SMS. An independent 24h expiration maintenance function is owner-only; production scheduling/operations remain **not implemented**.

## Evidence
- [E2E workflow 39793983664](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39793983664), job `119876646557`.
- Job's CI logs include:
  - `CF01_THREE_PORTAL_E2E_SHAREHOLDER_PASS`
  - `CF01_THREE_PORTAL_E2E_COOPERATIVE_MANAGEMENT_PASS`
  - `CF01_THREE_PORTAL_E2E_NATIONAL_ADMIN_PASS`
  - `CF01_THREE_PORTAL_NEXT_NEST_PG17_LOGIN_LOGOUT_E2E_PASS_CHECKS=162`
  - `CF01_TEST_FIXTURE_ONLY_NO_REAL_SMS_NO_PRODUCTION`
- Negative cases: unknown mobile generic response after throttle, 40 simultaneous forged `X-Forwarded-For` requests with total IP digest admission count capped at 30, no raw IP/mobile stored in abuse-event table, denied runtime SELECT and valid session revocation.
- Actual environment: 3 independently built Next.js 16 apps, NestJS 11, disposable PostgreSQL17 with migrations 0001–0006. No real API.ir SMS or real shareholder data.

## Not GREEN yet
- Overall PHASE-04 and PHASE-11 **IN_PROGRESS**. Automated core synthetic sub-gate alone cannot prove real Vercel reviewer SSO, durable HTTPS Preview Nest/Postgres runtime, mobile onboarding, live consented API.ir delivery/receipts, durable transactional notification outbox, policy approvals or legal acceptance.
- `trustProxy=false` intentionally ignores forged forwarded headers. If a future API is behind an authorized ingress/load balancer, the network/proxy trust and source-IP policy MUST be reviewed; shared proxy egress can cause many users to consume one quota. Never turn on global `trustProxy=true` or trust arbitrary hop count.
- No DB rate-control event retention job is scheduled; no live operation or persistent DB provisioned.
- No Vercel SSO protections changed. Attempting authenticated page fetch through the connected Vercel tool returned HTTP 403 at `read_protection_bypass`, requiring project/team permission repair.
- Backend-only CI tests are transient; the current three protected Vercel preview sites still have real login disabled.

**Policy:** test-only synthetic Review on Vercel Hobby subject to terms, Production on ArvanCloud only upon explicit future owner approval. Do not merge PR #11 or deploy a public backend until its security gates and dependent ancestor reviews are approved.
