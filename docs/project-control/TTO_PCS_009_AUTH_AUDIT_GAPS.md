# TTO-PCS-009 — Fictional actor boundary and source-admission audit
Date: 2026-11-01 | App Draft PR #97, baseline PR #95 SHA f3d14eef7a449888b244c7b83a8c76e35431ce60.

## Implemented in this increment
- Existing private, CI/test-only PCS007 broker extended with optional PCS009_LAB role separation: two independent fictional manager/shareholder credentials, strict test tenant+Party checks; manager-only approval, shareholder read-only, duplicate review denial (409); immutable in-memory audit event containing action, demo actor, tenant, Party, revision and timestamp; no official legal effect.
- Synthetic cooperative and shareholder page adapters use separate test actor credentials only when PCS009_LAB is explicitly enabled. Existing PCS007/008 demo behavior preserved in ordinary lab mode.
- New executable Node regression scripts/ci/pcs009-role-audit.test.cjs proves unauthenticated denial, wrong-tenant/Party denial, no shareholder approval, duplicate denial, independent read, fake audit event and trade/transfer always disabled.
- GitHub Actions branch-scoped PCS009 test plus prior PCS007 regression. The isolated real PostgreSQL suite is not a test of the fictional identity provider.

## Crucial trust distinction
**PCS009 lab credentials are NOT actual authentication, authoritatively linked Party identities, signed official records or durable audited source-admission.** They are fixed fictional tokens only inside a disposable CI-only process. The in-memory events are not crash-proof, nonrepudiable or valid cooperative board approvals. No actual database writes, official share count, share transfer or money custody may be inferred.

## Requirements for the actual authenticated workflow
1. Do not expand lab token broker for production. Create a real Nest module binding opaque session to verified user, tenant, Party and the cooperative-authorized reviewer delegation, with independent manager permission check for action (not tenant membership alone).
2. Child06 official membership source and Child07 official share ledger require distinct issuing authorities, reviewed provenance, valid as-of and sourceVersion, explicit official zero, anti-replay/idempotence, revocation and retention policy; no source gate can be bypassed by a fake role token.
3. Persist immutable-append audit metadata in PostgreSQL via a legally reviewed model and transaction, redact secrets/PII; audit write failure must deny approval.
4. Implement manager admission state machine: QUARANTINED -> VALIDATED -> PENDING_AUTHORIZED_REVIEW -> APPROVED/REJECTED; never update canonical holdings directly from an unverified browser form.
5. Shareholder view requires independently verified session + tenant/Party linkage, approved source projections and cross-tenant/owner negative tests. Missing source is UNAVAILABLE, not zero.
6. Obtain explicit product/owner code consolidation acceptance, legal authority and pilot source approval before real data or any deployment.

## Acceptance status
Wave-0 G3 owner review pending. Wave-1 PCS009 scope is **synthetic trust-boundary prototype only**, NOT real operational manager+shareholder acceptance. Record exact SHA and CI result in CURRENT_CHECKPOINT after review. No merge/deploy.
