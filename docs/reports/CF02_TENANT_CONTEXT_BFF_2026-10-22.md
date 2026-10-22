# CF02 Tenant context BFF — read-only security tranche (2026-10-22)

Parent: Draft PR #14 (NAV-01..11 UI shell), stacked on Draft PR #13. This work adds **one BFF authorization probe per Next.js portal**:
`GET /api/tenants/:tenantId/context`.

- Validates canonical UUID, reads only the HttpOnly `tto_session` cookie, ignores incoming Authorization/X-Role/X-Tenant headers.
- Runs strictly server-side using Vercel workload OIDC forwarding (or CI loopback) to existing Nest `GET /v1/tenants/:tenantId/context`.
- Nest authenticates a live, revocable PG-backed session and uses transaction-local actor+tenant with forced PostgreSQL RLS. A role or approved JIT must authorize active tenant context; no global superuser privileges.
- Exposes only `{tenantContextVerified:true,tenantId}` on authorization; otherwise generic 400, 401, 403 or 503 with `private,no-store` and `Vary:Cookie`. No tenant slug, shares, party, balance, legal signing authority, or personal data exposed.
- Does **not** grant membership, shareholder entitlement, manager authorization, share access, user-specific module rendering or approve national detail access. These remain separate Child01/02/06/07 and Child23 gates.
- Offline Next smoke checks anonymous, forged headers, malformed UUID and unavailable backend on **all three** portal builds.
- Real ephemeral PG17 Next→Nest E2E fixture checks authorized same-tenant, cross-tenant denial, revoked session denial, forged bearer denial across **all three** portals. No actual users, real SMS, hosted DB writes, new migrations or production changes.
- Source-of-truth NAV and PHASE_GATES files are unchanged; acceptance gate remains IN_PROGRESS until all Child contract tests complete.

Manual evidence must be attached from CI and protected Preview after push. A green CI does not establish business feature readiness.
