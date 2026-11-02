# PH02 Preview access verification — 2026-11-02

Scope: anonymous, read-only requests to four TTO Preview projects, on currently READY deployments. No authorization credentials or test shareholder records used.

| Project | Public page | API endpoint | Provider setting |
|---|---|---|---|
| API | Vercel login page | /health: Vercel login page | SSO enabled on all deployments |
| Shareholder | HTTP 302 to Vercel SSO | /api/auth/session: Vercel login page | SSO enabled on all deployments |
| Cooperative | Vercel login page | /api/me/tenant-options: Vercel login page | SSO enabled on all deployments |
| National | Vercel login page | /api/me/tenant-options: Vercel login page | SSO enabled on all deployments |

**Verified:** An anonymous request to the tested READY previews reached Vercel authentication rather than application content. Where redirects were followed, the final login page returned 200; this is not an application's 200 response.

**Still open:** account plan eligibility, authoritative deployment ownership and full environment policy acceptance. Therefore the Preview SSO test is passed but PH02-C04 remains PENDING. Other source and PH01 gates are unchanged. No Production deployment or real shareholder transaction was performed.
