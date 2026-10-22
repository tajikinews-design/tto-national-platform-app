# TTO — Independent anonymous Vercel Preview access acceptance

**Date:** 2026-10-22  
**Scope:** Three synthetic Next.js Preview deployments only, no Production/ArvanCloud activity  
**Parent source branch:** `feat/vazirmatn-next-preview-otp` at `d1d3f6f41ca00560bb56e5dcb2c42acae77b42e8`  
**Review:** Draft PR #9 based on Draft PR #8, not `main`

## Actual evidence

- GitHub Actions: https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39786443223 — **success**.
- All **7/7** verifier unit tests passed.
- **Shareholder:** HTTP **302**, recognized Vercel SSO redirect, PASS.
- **Cooperative management:** HTTP **302**, recognized Vercel SSO redirect, PASS.
- **National admin:** HTTP **302**, recognized Vercel SSO redirect, PASS.
- Live anonymous probe executed on a standard GitHub Actions runner without Authorization, cookies, secrets, Vercel bypass tokens or redirect following. No response body or redirect query string printed.
- Vercel project API already showed `ssoProtection.enabled=true`, `deploymentType=all` for all three projects.
- No Vercel configuration, deployment, production resource, API.ir credential or reference repository was changed.

## Exact acceptance boundary

`ANONYMOUS_VERCEL_SSO_REDIRECT = GREEN` applies **only** to the three deployment URLs recorded in `docs/deployment/VERCEL_NEXT_VAZIRMATN_OTP_2026-10-22.md`.

Not yet proven:

- Authorized reviewer can complete SSO and load each protected Next.js page; interactive browser acceptance pending.
- A live NestJS preview backend, PostgreSQL runtime, real API.ir SMS or authenticated OTP E2E.
- Comprehensive tenant / JIT / CF01-03 integration and 155 formal acceptance scenarios.
- GitHub-to-Vercel automatic integration; existing Preview deployments remain manually packaged.
- Some earlier Vercel deployment history shows `target=production` despite preview project names. Current latest deployments are `target=null` and all project `live=false`; investigate configuration/history before any future release. This is not an ArvanCloud deployment.

**Gate outcome:** anonymous denial proof GREEN; `PHASE-10` and `PHASE-11` remain `IN_PROGRESS`, not GREEN. PR remains Draft and must not be merged without approval.
