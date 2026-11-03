# TTO Child06/Child07 existing read-only shareholder view — hardened source contract
**Date:** 2026-11-02. **Scope:** synthetic CI only; source-locked implementation candidate, not live membership/shareholding authorization.

## Decision: reuse the existing view, do not create a second portal
The existing `apps/shareholder/app/tenants/[tenantId]/my-records/page.tsx` already reads **two independent BFF endpoints** and has a real disposable PG17 E2E fixture in `scripts/e2e-cf02-identity-authority.cjs`. A second draft route at `/my-records` was therefore **discarded** on this branch before PR publication. Only the existing page is hardened, avoiding a parallel access pathway.

## New defensive controls
1. Client read keeps `cache:no-store`, same-origin cookies, redirect error, **GET-only** and no client Authorization or Party/role claims. The existing BFF/Nest/PG remain sole access authorities.
2. Canonical UUID tenant parameter checked client side, while server tenant matching, signed identity/session checks and PostgreSQL FORCE RLS remain mandatory; a URL never grants access.
3. Each successful response must have `available:true` **and** well-formed fields: Child06 ACTIVE + PERSON/ORGANIZATION + positive integer sourceVersion + valid sourceAsOf; Child07 canonical **integer string shareQuantity (including '0' as valid), positive integer ledgerVersion, valid ledgerAsOf**. Invalid output fails closed to unavailable.
4. Independent source states: Child06 available does not lift Child07 source gate. HTTP 401 from either clears both; 403, 404 and outages render unavailable, **never 0**.
5. AbortController cancels prior requests on refresh/context changes and component teardown; outdated late responses cannot overwrite current state. A separate `loadedTenantId === tenantId` **render-time guard** prevents any prior cooperative's record from rendering during a client-side tenant navigation *before the next effect runs*. This is a defense-in-depth patch discovered in final candidate review.
6. Keyboard-accessible refresh remains, Persian RTL, live status messages, no storage of personal data or third-party scripts. No workflow, SQL, API controllers, legal authority, official ledger or payment/write endpoints changed.

## Acceptance and scope
- `tests/test_child06_07_readonly_screen.py` guards route consolidation, no cross-origin/new write path, tenant/session/failclosed source validation, **tenant-keyed render freshness**, and existing synthetic regression evidence. These are structural guards, not a substitute for browser interaction testing.
- The pre-existing disposable PostgreSQL E2E covers tenant isolation, two independently approved sources, sourced 37 vs sourced 0, absent-source unavailable, source-approval revocation, revoked session denial and immutable snapshot restrictions. It remains the functional test authority; static tests do not impersonate browser E2E.
- **No original MEMBER-AT or SHARE-AT can be marked complete**, and this does not authorize official data import, nonmember rights, share transfer, voting or production. Current approved TTO source documents govern synthetic-only development; the project owner has deferred final real-data legal/source review. Exact-head CI evidence and a **separate explicit owner decision** on PR #139 are required for controlled development-branch merge; do not claim an independent human security review took place if not recorded.

## Dependency
Fastify security PR #137 was **merged into PH05 development branch** as commit `327a6530c24f2b07fc5b7da5536d8aaf319fd291` following owner approval and exact-head full Release CI `41582320791` PASS; post-merge PH05 full CI `41582745317` PASS. PR #139 was then retargeted to that PH05 branch and post-retarget core CI `41582787677` PASS **before the render-time guard amendment**. New tests must pass on the amended PR head before this candidate is eligible for a separate owner merge decision. No main merge/deploy/live data/financial operations. Browser-based tests and canonical Child06/07 full acceptance are separate gates.
