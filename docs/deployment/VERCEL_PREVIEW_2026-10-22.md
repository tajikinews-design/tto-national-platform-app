# Vercel internal TTO previews — 2026-10-22

## Actual Vercel preview URLs (3 projects; deployment target is Preview/null)

| Portal | Protected preview URL | Vercel Deployment ID | Status checked |
|---|---|---|---|
| Shareholder | https://tto-shareholder-preview-6z7ii6g1f-tajikinews-6739.vercel.app | `dpl_FFehCUdQ6zhQRCXu9eEriBbqEQYR` | READY |
| Cooperative management | https://tto-cooperative-preview-4c6kkuxlk-tajikinews-6739.vercel.app | `dpl_4e7tVdg2HvwzpLgAoNrUYKV58qSE` | READY |
| National administration | https://tto-national-preview-6nk9i22ie-tajikinews-6739.vercel.app | `dpl_2SLFTQAj7mzb33UjkU7P32PZPNE2` | READY |

All three projects have `ssoProtection.enabled=true` and `ssoProtection.deploymentType=all`. Vercel Authentication requires a reviewer with appropriate project access. An independent anonymous-browser security probe did not complete in this environment; until separately tested, do not claim unauthorized user access was independently denied.

**Important:** These specific deployments package the previously reviewed dependency-free `apps/*/index.html` and `packages/ui/assets/*` static dashboard review shells from application branch `feat/apiir-otp-adapter-preview-gates`. The three Next.js 16 builds remain validated by GitHub Actions, but their *Next runtime* was **not** the source deployed in these specific previews due to the Vercel account currently having no linked GitHub namespace. They are **UI-only**, not authenticated operational apps or real-data integrations. All shown business KPIs are intentionally empty/no_data.

## OTP integration (not in browser)

- API.ir endpoint contract: `POST https://s.api.ir/api/sw1/SmsOTP` with Bearer secret, `code`, `mobile`, `template`; source `services/workers/src/apiir-smsotp.cjs`.
- `APIIR_TOKEN` is saved as a **Sensitive** environment variable in Vercel project `tto-shareholder-preview`, target Preview **only**. **No actual token value is committed to GitHub**, and none is passed to browser JavaScript.
- The current static deployment does not execute server-side OTP, and no live SMS request has been submitted. The private preview env variable is reserved for future server-side integration; when a backend is deployed or approved, move/scope secrets to its server runtime appropriately.
- Source & contract tests under `services/workers/test/apiir-smsotp.test.cjs` are no-outbound mocks and do not prove provider balance, secret validity, carrier delivery or SMS acceptance.
- Real provider testing requires a consented test destination phone, rate limits, configured legitimate challenge session, and explicit synthetic test protocol. Do not fake or guess a mobile number.

## Production policy and remaining checks

- Final Production is **only ArvanCloud**, deferred until all 23 modules and three portals have passed acceptance and owner explicitly approves. No ArvanCloud infrastructure touched.
- Vercel projects remain solely synthetic internal evaluation; never upload real shareholder/financial data.
- First-project bootstrap on Vercel may create platform-labelled `production` aliases automatically before a Preview deployment exists; those default aliases are *not* approved as TTO operational Production. They are Vercel-protected synthetic-only and must not be distributed as release endpoints. Only the 3 URLs above are official internal review links.
- Full production-grade Git-connected Next.js protected Preview is not yet achieved; Vercel GitHub integration still lacks access to the private repository. After integration is connected, build from reviewed PR and validate SSO in an incognito browser.
