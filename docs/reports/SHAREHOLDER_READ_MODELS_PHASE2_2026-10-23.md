# Shareholder Phase 2A — Source-gated read-model contract and closed-by-default UI

**Date:** 2026-10-23  
**Parent baseline:** Draft PR #23, SHA `07b5efcc7cc0a6341f51fc7733ec4643fecff6d5`  
**Issue:** #24  
**Current stage:** IMPLEMENTED CANDIDATE INTERFACES / **UNAPPROVED SOURCE INTEGRATION**. This is NOT permission to publish notices, accept securities orders, connect real shareholder data, transfer ownership, handle money, or deploy to production.

## Authority boundary

| Domain | System of record | Policy |
|---|---|---|
| Verified session and tenant/Party scope | CF01/CF02 | OTP and selected tenant are not ownership or publishing authority. |
| Membership and ShareholderAccount | Child06 (`TTO-MEMBER-SHAREHOLDER-IMPLEMENTATION`) | Independent membership source approval; active role is insufficient. |
| Buy/sell requests, share-lock and transfer case | Child07 (`TTO-SHARE-CAPITAL-MARKET-IMPLEMENTATION`) | Read history is NOT a trade submission, lock, transfer or settlement. |
| Communication content, audience and notice publication | Child09 (`TTO-COMMUNICATIONS-NOTICE-IMPLEMENTATION`) | CF03 document existence and CF05 delivery alone are NOT publication or acknowledgement. |
| Legal rule and source gate | CF04 | UNKNOWN / PENDING = DENY. |
| Audit and evidence | CF03 | Version/provenance must remain independently reviewable. |

### Implemented paths

- Shareholder Next BFF: `GET /api/tenants/:tenantId/me/trade-requests`
- Shareholder Next BFF: `GET /api/tenants/:tenantId/me/notices`
- Nest candidate: `GET /v1/tenants/:tenantId/me/trade-requests`
- Nest candidate: `GET /v1/tenants/:tenantId/me/notices`
- NAV-03 and NAV-05 display a common read-only, source-provenance-aware interface. It mounts after validated session/tenant selection and does not accept a Party ID from the browser.

**All four endpoints are intentionally denied for authenticated callers.** A malformed tenant UUID returns 400; missing/invalid BFF cookie returns 401; a syntactically valid cookie returns 403 (`SOURCE_OR_PERMISSION_NOT_APPROVED`) **even if the caller supplies fake Authorization/role/Party/tenant headers**. Nest independently validates the current session, then denies any candidate read. No flag or tenant role bypass, no persistence and **no backend import, DB read or new SQL migration**. The BFF never proxies document lists as notices.

## Candidate response shape (NOT enabled)

The UI can parse a future source-approved `200` only after the backend is separately reviewed and enabled. A read-model response must pass ALL of:

- `{available:true,sourceDomain:"CHILD07"|"CHILD09",approvalRef:UUID,sourceVersion:positiveSafeInteger,sourceAsOf:parseableDate,items:array}`.
- Maximum 20 items; unique UUID keys; no unknown status enumerations. Bad/mismatched/unversioned `200` becomes **unavailable**, not empty, in the UI.
- Child07 candidate: `{requestId,kind:BUY_REQUEST|SELL_ORDER,state:SUBMITTED|UNDER_REVIEW|CLOSED,sourceEventId,eventVersion,lastEventAt}`. These labels do not assert payment verification, share approval or completed transfer.
- Child09 candidate: `{noticeId,title(1..160),category:GENERAL|ASSEMBLY|SHAREHOLDER,publicationVersion,publishedAt,audienceApproved:true}`. Content has been explicitly selected for the current recipient in the authoritative publisher; it is not inferred from generic documents or push delivery.
- An empty list is displayed only after an explicitly **approved versioned source** response, never after 403/404/503, revoked membership, or missing source.

These types are candidate projections for reviewer sign-off: **not authoritative source schemas**. Source event mapping, true approval evidence, rights and publication classifications must be approved before any server code returns `200`.

## UI safety behavior

- No context or unverified session: displays the selection/permission boundary only.
- Loading / 403 / 503: shows distinct statuses; does not report zero outstanding requests or zero notices.
- Tenant switch: previous scope invalidated in Phase 1; Phase 2 list fetch uses abort-on-unmount/tenant-change and a tenant-id result match to block stale cross-tenant render.
- Future verified 200: whitelist fields, maximum records, escaped React text, no dynamic raw HTML. No payment information, voting power, share quantity or transfer control.
- Home stats remain unknown (`—`); no synthetic counts.
- Security responses have `Cache-Control: private, no-store`, `Vary: Cookie`, `X-Content-Type-Options: nosniff`; all candidate paths are GET only.

## Verification

Phase 2 introduces offline Python contract tests (`scripts/ci/test_source_gated_readmodels.py`), expands prebuild TypeScript AST coverage to both shareholder TSX files, and extends three-portal no-credential smoke tests with 8 negative BFF checks (anonymous, forged browser headers, unapproved-cookie, invalid tenant for each read model). Existing Phase 1 tests remain part of Core/Release.

**Acceptance status** on the NEW Phase 2 branch:
- Code and safety contracts committed: yes.
- Python contract tests, TypeScript build, Next BFF smoke, Nest integration on Phase 2 SHA: **PENDING EXTERNAL RUN**, no success claimed.
- Full `run-local-docker.ps1 -Suite Release -ExpectedCommit <NEW_PHASE2_SHA>`: **PENDING**.
- GitHub/Vercel hosted checks: independent of Docker; rate-limit failures do not become PASS via local run.
- Legal source onboarding, real records, notification publication, actual buy/sale workflow, payments, ledger writes: **BLOCKED, NOT IMPLEMENTED**.

## Later phase / explicit dependencies

Before implementing any real source adapter, require: owner-authorized Child07 request event feed and recipient-scoped Child09 publication feed; CF04 rules and evidence references with immutable/versioned source epochs; Child06/CF02 identity+relationship adjudication; complete cross-tenant/RLS security and source revocation tests; published notice audience proof, retention requirements and reviewer acceptance. The approved purchase/sale Specification governs any *separate* write workflow. Buyer pays seller directly; the platform is not a cash wallet or cooperative general ledger.

**Review rule:** PR #23 remains Draft with its already verified SHA untouched. Phase 2 is a separate Draft PR stacked on that exact SHA. No `main`, hosted Supabase, production Docker or Arvan deployment changes.
