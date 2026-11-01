# TTO-PCS-013 — Owner-only shareholder source read screen (bounded)
Date: 2026-11-01

## App candidate and scope
- Draft app PR #105, branch feat/tto-pcs-013-shareholder-own-read-20261101, initial HEAD f7c2fe7310cee4111d32b346a49d51c5c45939b0, based on PR #103.
- New route: apps/shareholder/app/tenants/[tenantId]/my-records/page.tsx.
- This is a real read-only UI consuming **existing** BFF GET endpoints for `/api/tenants/[tenantId]/me/member-record` and `/api/tenants/[tenantId]/me/shareholding`. The BFF obtains the opaque session from the browser's same-site cookie, sends it server-side to Nest, and Nest maps the actor to a verified Party / tenant and two independently approved sources.
- The page renders membership ACTIVE and its sourceVersion/sourceAsOf only on successful independent Child06 response; it renders the shareQuantity string and ledgerVersion/ledgerAsOf only on successful independent Child07 response.
- Explicit statuses: loading, session required, and independent unavailable; missing ledger/source **NEVER zero**. No read of PCS007-012 synthetic fixture approval or manager event count, no POST/transfer/trade.

## Existing tests reused
- The pre-existing real Nest/Next/PG integration test scripts/e2e-cf02-identity-authority.cjs already covers blocked source, valid approved member read, independently unapproved share read, absent holdings distinct from zero, sourced share count, explicit official zero, source revocation, cross-tenant denial and BFF session checks with fictional data in disposable PG.
- New scripts/ci/pcs013-shareholder-guard.test.cjs checks the new page does not synthesize holdings and relies on both independent existing source-gated routes. GitHub Actions PR branch scope runs it, in addition to the existing full suite.
- This increment does not claim a Chromium clickthrough, a completed real-data source integration, product signoff or a legally approved cooperative pilot.

## Blocking decisions — no unilateral promotions
1. Owner review of candidate and Wave-0 G3 acceptance; no automatic merge or deploy.
2. Official Child06 membership and Child07 share-register data stewards legally authorize data processing and provenance separately.
3. Verified actor↔Party binding and the legally authorized tenant/pilot must be accepted before any real shareholder data.
4. UX reviewer validates own-only screen, RTL, accessibility, source statuses, mobile and desktop on a protected preview with fictional data.
5. Keep marketplace Wave 3 disabled; no general accounting, payment custody, transfer or share trades in this read-only module.

## Acceptance state
At creation, app PR #105 is DRAFT, exact-head CI run 41312820232 was in progress. Only mark technical PASS after verifying job completion. Wave-0 G3 pending, Wave-1 first real data source still blocked.
