# PCS-007 — First fictional cooperative-to-shareholder vertical slice
Date 2026-11-01
App Draft PR #93, head at initial report 13d75daf9425f35f8beeae0e7c7b817ae1e9538a. Parent app Draft PR #90, release-tested SHA 064ef8b27b280526468b540291299d49e08347d6.

## Delivered in source
- In-memory localhost-only broker: scripts/security/pcs007-synthetic-cooperative-broker.cjs; requires CI=true, NODE_ENV=test, TTO_PCS007_LAB=1, denies production and real sources, token guarded.
- Cooperative reviewer: apps/cooperative-management/app/review/pcs007/page.tsx and POST review/pcs007/approve/route.ts. It grants a **synthetic-only** review status; cannot change official data.
- Shareholder consumer: apps/shareholder/app/review/pcs007/page.tsx. It reads the same synthetic broker and shows 125 fictional shares only after demo approval, explicitly no ownership/trading authority.
- Node flow test: scripts/ci/pcs007-synthetic-flow.test.cjs; checks initially empty, token gate, wrong method, approved fake data and canTrade/canTransfer false.
- CI: branch-scoped test only.

## Safety and product boundaries
No auth/real roles, no tenant mapping beyond static fake IDs, no real source, no PostgreSQL writes, no official shares, no transfer/payment. This is an educational integration skeleton, NOT a feature accepted by actual cooperative or shareholder. Broker state is process-local and deliberately non-durable; should not be adapted directly to production.
The Next reviewer routes are additionally CI/test-only gated, not on production routes. Test passing does not assert a true authenticated manager-to-shareholder journey until a separate cross-Next browser test runs.

## Outstanding for genuine Wave-1 G1–G3
- Build and tests exact PR HEAD and capture CI.
- Explicit signed/authorized Child06/Child07 source specs and pilot.
- Replace synthetic broker with production-domain service and persistent authorized data source, after source/legal approval.
- Real manager workbench with authentication, provenance validation, approval audit and role enforcement.
- Real shareholder scoped read with Party link and source version; no-data != zero; tenant isolation, revocation and negative tests.
- Full Chromium cross-portal workflow, accessible RTL review, product acceptance.
- Wave 0 owner acceptance / code consolidation decision still PENDING. No merge/deploy.

## Checkpoint
PCS-007 = IMPLEMENTED_SYNTHETIC_CODE; status VERIFIED only if exact GitHub Actions green. Wave-1 official source capability BLOCKED, Wave-0 G3 NOT ACCEPTED.
