# TTO-PCS-011 — Authenticated Manager Next → Nest → PostgreSQL Fixture Review
Date: 2026-11-01 | Application Draft PR #101 | Product scope: fictional, CI-gated only.

## Delivered code
- Next.js cooperative management route /review/pcs011/[tenantId] displays fictional review count, explicit no-legal-effect disclaimer, submit-review and refresh controls in Persian RTL.
- Server BFF GET/POST /api/pcs011/tenants/[tenantId]/reviews requires real opaque tto_session cookie, valid tenant UUID, exact private CI loopback Nest upstream, same-origin POST, validated fictional reference and fail-closed upstream response.
- Nest GET /v1/pcs010-lab/tenants/:tenantId/fixture-reviews uses real PG-backed session, tenant and manager role and reads count from nonofficial append-only fixture review table; POST remains PCS010 real session/role-protected fake append.
- Real integration test added to PCS010 PG17 fixture: starts cooperative Next, exercises Next BFF unauthenticated / wrong-role / manager GET, manager POST, subsequent persisted review count, and attacker-origin rejection.
- Existing official Child06 / Child07 read gates, ownership registry, payment flow and trading unchanged.

## Limits
- This is NOT an official cooperative admission workflow. Sessions are genuine sessions in an isolated PostgreSQL test database, but users are synthetic and review records carry no legal significance.
- Next screen not guaranteed visual/Chromium-accepted by BFF HTTP test. No official membership, share balance, source ownership or linked Party is exposed.
- Design requires later source owner/legal acceptance and owner Wave-0 G3 baseline decision before production integration.
- No Merge/Deploy/real shareholder input/share transaction.

## CI
- Initial candidate app SHA 9210d09080f5ede1721b1b7fb5ae66539cf9d47a, GitHub Actions run 41310689316 — status must be checked; never infer success from PR creation.
- Resume on verified final app HEAD and exact workflow conclusion. If failing, repair narrowly, rerun and update checkpoint and evidence register.

## Final validation
- App Draft PR #101 exact SHA 34f9ad6dcf14f008e6e96684d292b74f1abb844c. Run 41310870892, job 124860764292, COMPLETED SUCCESS, all steps passed. Workspace Next/Nest builds and TypeScript, temporary PG17 migrations 0001–0010, PCS010/011 real session and PG audit test, existing identity/source/share quarantine E2E and teardown passed.
- Earlier run 41310689316 failed only at newly added Next BFF POST origin strict host mismatch (localhost versus 127.0.0.1); fixed by restricting allowed origins to both exact loopback names on port 32711 in the CI-only BFF. Failed run preserved as evidence.
- HTTP E2E shows Next BFF GET/POST to Nest with PG session manager, count after approval = 2 synthetic events, member denied, anonymous denied and cross-origin POST denied. This is not a complete Chromium click-through of the new manager screen nor an authorized official-member/holding projection.
- Gate: TECHNICAL_PARTIAL_VERIFY, not Wave-1 operational acceptance. NO merge, deploy, real Child06/07 data, live trading or legal owner signoff.
