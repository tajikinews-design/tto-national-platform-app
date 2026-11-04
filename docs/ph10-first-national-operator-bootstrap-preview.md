# PH10 — First national operator bootstrap (Preview)

**State:** WAITING_FOR_VERIFIED_IDENTITY_AND_INDEPENDENT_APPROVAL. Not an authorization grant.

## Actual environment evidence (2026-11-04)
- Existing Supabase preview: user_accounts = 0, verified_mobile_identifiers = 0, platform_operator_authorizations = 0.
- The live tto.has_platform_operator() requires an active authorization, distinct approved_by and user_id, and a future expires_at.
- Real OTP delivery in API Preview is not configured. NODE_ENV=test mock must never be enabled in Vercel runtime.
- Workspace address reservation POST already requires a PG-backed authenticated session and has_platform_operator().

## Controlled one-time process
1. Identify the intended first administrator *outside this repository* through a verified authentication ceremony; do not store mobile/OTP/secrets in GitHub.
2. Verify an independent approver and a real, traceable evidence reference. Approval cannot be self-issued.
3. Enable real SMS through protected Vercel environment configuration and confirm an actual user-bound OTP sign-in. This step must be conducted by an authorized environment operator; no secret in PR comments.
4. Issue only one short-lived Preview platform-operator authorization through the approved database governance procedure, in one auditable transaction; use real user and approver UUIDs and a valid evidence_id. Never fabricate a second user to pass approved_by != user_id.
5. Reauthenticate and verify tto.has_platform_operator() as the user, verify unauthenticated actor remains false, then create three workspace slugs via the real national UI; duplicate must be rejected and unknown slug 404.
6. Revoke bootstrap-only privileges and retain an audit trace.

## Release gates
- No direct insertion into user_accounts, verified_mobile_identifiers, or user_sessions to simulate OTP.
- No bypass of RLS, no universal demo admin login, no default password, and no automatic promotion to production.
- DO NOT mark this bootstrap GREEN until identity proof, independent approval, OTP, grant issuance, expiry/revocation tests and user-facing E2E have actual evidence.
