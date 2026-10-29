# W1 — Isolated PDP Simulator v0.1 (synthetic only)

Date: 2026-10-29
Baseline: ddacf6807d3d8d4921f8e93ee1c686943a2db5c2 (PR60, test acceptance not yet established)
Status: CODE WRITTEN / LOCAL RELEASE PENDING / NO LIVE RIGHTS

## Scope
This phase adds a **pure Python, no-IO simulator**, not a live authorization engine:
- `scripts/security/w1_pdp_simulator.py`
- `scripts/ci/test_shareholder_w1_pdp_simulator.py`

The existing Release runner already invokes `python3 -m unittest discover -s scripts/ci -p test_*.py -v`, so this test is included on the next exact-SHA Docker Release. No runner, API, Next, Nest, database migration, policy registry or UI code is changed.

## Guarantees
1. Production, live, staging, review, missing environment: DENY.
2. Unknown operations: DENY.
3. Missing session, tenant scope, Party binding, membership provenance, feature/permission, source authority/version/freshness, subject ownership, classification: DENY.
4. Download, export and write have independently checked rights. Writes additionally require re-auth, CSRF, idempotency and optimistic version.
5. Trade/finalize additionally require rule snapshot and finalization requires VERIFIED payment plus separate approval.
6. Only `SIMULATED_ALLOW` can be returned in the fully valid synthetic fixture; its `legalOperationalEffect` is always `NONE` and `canGrantPermission` always false.
7. No real information, data service, network call, secret, persistence, route or runtime integration is introduced.

## Security verification
- 29 synthetic contract matrix cases.
- Six independent unittest methods covering fixture results, non-simulation environments × all operations, absent context, mandatory flag removal, unchanged canonical NAV registry and no-IO isolation.
- **All checks are pending full local Release for the new exact SHA**.
- Passing this simulator does not mean that real server-side authorization, legal/source gates, RLS, production security or trading functionality is approved.

## Next stage, not covered here
Independent security review of a server-facing authorization interface with immutable source-backed approvals; tenant-specific RLS and session negative tests; all required legal/ownership approvals. Those require a separate PR and acceptance, still with no real shareholder data or trading.
