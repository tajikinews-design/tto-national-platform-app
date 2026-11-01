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
