# TTO Child06/Child07 existing read-only shareholder view — hardened source contract
**Date:** 2026-11-02. **Scope:** synthetic CI only; source-locked implementation candidate, not live membership/shareholding authorization.

## Decision: reuse the existing view, do not create a second portal
The existing `apps/shareholder/app/tenants/[tenantId]/my-records/page.tsx` already reads **two independent BFF endpoints** and has a real disposable PG17 E2E fixture in `scripts/e2e-cf02-identity-authority.cjs`. A second draft route at `/my-records` was therefore **discarded** on this branch before PR publication. Only the existing page is hardened, avoiding a parallel access pathway.

## New defensive controls
1. Client read keeps `cache:no-store`, same-origin cookies, redirect error, **GET-only** and no client Authorization or Party/role claims. The existing BFF/Nest/PG remain sole access authorities.
2. Canonical UUID tenant parameter checked client side, while server tenant matching, signed identity/session checks and PostgreSQL FORCE RLS remain mandatory; a URL never grants access.
3. Each successful response must have `available:true` **and** well-formed fields: Child06 ACTIVE + PERSON/ORGANIZATION + positive integer sourceVersion + valid sourceAsOf; Child07 canonical **integer string shareQuantity (including '0' as valid), positive integer ledgerVersion, valid ledgerAsOf**. Invalid output fails closed to unavailable.
4. Independent source states: Child06 available does not lift Child07 source gate. HTTP 401 from either clears both; 403, 404 and outages render unavailable, **never 0**.
5. AbortController cancels prior requests on refresh/context changes and component teardown; outdated late responses cannot overwrite current state.
6. Keyboard-accessible refresh remains, Persian RTL, live status messages, no storage of personal data or third-party scripts. No workflow, SQL, API controllers, legal authority, official ledger or payment/write endpoints changed.

## Acceptance and scope
- `tests/test_child06_07_readonly_screen.py` guards route consolidation, no cross-origin/new write path, tenant/session/failclosed source validation and existing synthetic regression evidence.
- The pre-existing disposable PostgreSQL E2E covers tenant isolation, two independently approved sources, sourced 37 vs sourced 0, absent-source unavailable, source-approval revocation, revoked session denial and immutable snapshot restrictions. It remains the functional test authority; static tests do not impersonate browser E2E.
- **No original MEMBER-AT or SHARE-AT can be marked complete**, and this does not authorize official data import, nonmember rights, share transfer, voting or production. Exact-head CI evidence and independent codeowner/security/legal review required.

## Dependency
Built on the **unmerged Fastify security PR #137** candidate `f96c1a07b75e39e9deaad83521235664adc0e185`. Do not merge this feature alone into main or deploy. Full release isolated validation run `41496926137` succeeded using the parent Fastify code with only a separate one-shot workflow added; no live services accessed.
