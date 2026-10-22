# CF02 verified tenant selector — security tranche, 2026-10-22

Stacked on Draft PR #15, with all earlier PRs left unchanged and unmerged.

1. SQL 0007 adds a restricted, read-only SECURITY DEFINER function enumerating only the authenticated actor's active tenant assignments or independently approved unexpired JIT. No broad table read to tto_app, and no national unlimited access.
2. Nest GET /v1/me/tenant-options derives the actor from a live revocable session, then executes the function under transaction-local identity. No party creation, link mutation or membership approvals.
3. All three Next BFF routes GET /api/me/tenant-options derive Authorization only from HttpOnly tto_session and filter by portal: shareholder = MEMBER role; cooperative = COOPERATIVE_MANAGER role; national = independent platform-operator authorization AND approved document-review JIT. Response only tenantId, displayName and evidenceStatus; protected no-store.
4. On the login screen, selection is possible only after successful restored/OTP session. The selected tenant is rechecked via existing /api/tenants/:id/context. No tenant credential, shares, managerial data or member records are loaded.
5. A verified User↔Party link plus current ACTIVE CF06 relationship projection is labeled as evidence only, not final membership/shareholding; legal ROLE_MANAGEMENT authority does not imply universal cooperative management.
6. CI-only ephemeral PG17 migration + synthetic three-portal E2E tests cover anonymous bearer forgery, scoped role filtering, matching Party link, false-Party/cross-tenant exclusion, session revocation, and anti-cache. Never apply schema changes to hosted Supabase, production, Arvan or main without separate approval.

Await CI, Vercel Preview and manual security review. This is **not** a pass for Child01/02/06/07 full acceptance. It does not activate financial operations, real SMS or any private customer data.
