# Phase 2C — Verifiable session and tenant scope on source-closed shareholder reads

**Base (verified)**: Phase 2B Draft PR #26, exact locally Release-passed SHA `09c8ae59956b98e262b95b8d0658d1e5370e4241` (23 October 2026).  
**New changes**: next sibling work as stacked Draft PR. **No live trades, publication or source adapter is enabled.**

## Security issue addressed

Phase 2B Nest GET candidate routes independently checked a real revocable PG-backed session. The Next BFF candidate read stubs did **not** contact Nest, instead mapping any 32–256-character structurally valid cookie to 403. That prevented data leakage, but it did not distinguish a revoked session from an authorized actor who lacked independently approved data sources.

Phase 2C adds **one shared scoped-authentication helper**:

`apps/shareholder/lib/source-read-access.ts` — `verifySessionTenantForClosedRead(request,tenantId,token)`.

Both shareholder read BFF endpoints call that helper after UUID and first-party HttpOnly cookie-format checks:

- `GET /api/tenants/:tenantId/me/trade-requests` (Child07 candidate)
- `GET /api/tenants/:tenantId/me/notices` (Child09 candidate)

The helper uses the existing protected Nest `GET /v1/tenants/:tenantId/context` contract, passing a server-generated Bearer from the cookie and the existing signed Vercel workload identity where required. It forwards **none** of the caller-controlled browser Authorization, tenant, role, Party or source-approval headers. Upstream transport is HTTPS, except for explicitly isolated CI/local loopback, follows no redirects, never caches, and is timeout-limited.

| Condition | BFF | Safety |
|---|---|---|
| Malformed tenant UUID | 400 INVALID_TENANT_ID | No upstream lookup |
| Cookie absent/malformed | 401 SESSION_REQUIRED | No upstream lookup |
| Upstream session revoked, absent or expired | 401 SESSION_REQUIRED | Live Nest PG check |
| Tenant scope denied or unknown (Nest 403/404) | 403 SOURCE_OR_PERMISSION_NOT_APPROVED | No existence oracle |
| Backend unconfigured, unavailable, unexpected/malformed status | 503 SOURCE_UNAVAILABLE | No made-up empty feed |
| Valid session + ACTIVE scoped tenant (Nest 200, matching UUID) | **403 SOURCE_OR_PERMISSION_NOT_APPROVED** | Neither Child07 nor Child09 authority approved |
| Nest 200 with wrong tenant, inactive status or unexpected body | 403 or 503 | Never grants access |

**There is intentionally no positive/source-enabled state in this helper.** Child07 trade-request history and Child09 notices remain blocked for every actor, including an independently approved Child06 member or user with sourced Child07 holdings. No 200 records or 200 empty lists, no publication, no payment, no trading command, no changes to ledger.

## Test modifications

- No-credentials Next runtime smoke continues to assert anonymous/forged headers 401 and invalid tenant 400. New expectation: a syntactically valid cookie when upstream is absent now returns **503** instead of the old unverified 403.
- Existing disposable PG17 E2E with a real session verifies valid actor still 403 and cross-tenant 403, and **revoked cookie 401 on BFF and Nest** for both Child07 and Child09 read endpoints. No external source data.
- Offline Python policy checks verify that the new BFF routes delegate to the shared helper and its transport/revocation is closed by default. Static checks alone are not evidence of runtime success.

## Scope, remaining gates and acceptance

- All **Phase 2A and 2B exact-SHA local Release PASS evidence remains preserved**; no reason to repeat on unchanged commits.
- Phase 2C introduces new commits and thus needs its own exact-SHA isolated Docker Core/Release run. Mark **PENDING** until the user-provided terminal log confirms it.
- Child07 and Child09 external legal approvals, authoritative versioned source events, tenant recipient authority, CF04 rules and CF03 audit/retention remain **PENDING** and cannot be approved by tests or GitHub.
- Existing 15-control blocked readiness packet remains inert and unchanged.
- Four independent hosted Vercel checks previously showed build-rate-limit failure; local Docker success would not make those hosted checks PASS.
- Do not touch `main`, hosted Supabase/production, share ledger, wallets, real SMS, official published communications, other project's Docker volumes, Arvan deployment or user data.
