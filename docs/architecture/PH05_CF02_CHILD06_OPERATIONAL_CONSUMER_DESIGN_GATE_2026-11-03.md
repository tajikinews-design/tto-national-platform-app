# PH05 / CF02 × Child06 — operational consumer design gate (NOT ENABLED)

Date: 2026-11-03
Baseline PH05 SHA: `1755089071bdef9a40cd8a5a10df3b459eb17c25`
Tracking: #154 (consumer), #150 (pre-member invitation), #140 (acceptance)
Source: `docs/architecture/PH02_23_DOMAIN_OWNERSHIP_EVENT_CONTRACT.json`, source SHA `5eb6be8edfbb61f2eca740a42c30f572b493f023`.
Status: **PROPOSED / REVIEW REQUIRED / NO EXECUTION**. This file is a design and acceptance specification, not implementation evidence.

## Verified starting state
- Child06 owns canonical `cooperative_relationships` and immutable `cooperative_relationship_outbox` carrying `MEMBERSHIP_APPROVED`.
- CF02 owns only `relationship_projections`. Migration `0023_cf02_child06_relationship_projector_lab.sql` has an isolated source-version-checked function and immutable receipts, with no `tto_app` EXECUTE, no worker, no delivery.
- Projection does not assign CF01 MEMBER roles, activate Child07 accounts, rewrite shareholder snapshots or create ownership/trade ledger entries.
- PR #155 and PR #156 merged into PH05; the lab proof is not the operational subscriber.

## Proposed adapter boundary — approval gate before runtime
1. Use a dedicated CF02 consumer principal, not a web request principal and never the unrestricted migration owner. Its narrow database and event privileges, credential lifecycle and tenant authorization must be explicitly reviewed. Do not grant `tto_app` EXECUTE on the lab projector.
2. Source Child06 commits event together with the activation transaction. Poll/dispatch only already-committed source outbox events; never project directly from UI requests, applicant callbacks, or untrusted messages.
3. Verify envelope schema/version, source-event identity, tenant_id, party_id, relationship_id, source_version, event_name and immutable source references. Treat broker metadata as untrusted; re-read canonical event from Child06 under authorization.
4. CF02 processing transaction revalidates independently scoped actor authority, current CF04 gate and CF03 evidence, active tenant, CF02 Party, Child06 approved application and active relationship. Keep separation from the applicant, decider and activator. Fail closed on missing/expired/revoked evidence or permission.
5. Process one event atomically: lock tenant/Party/projection in defined stable order; require exact monotonic source version; write CF02 projection, immutable event receipt and audit in one transaction. Duplicate exact event is idempotent, never duplicated or counted as new success.
6. Dispatch may be at-least-once; consumer acknowledgements **only after durable commit**. Failures before commit cause retry; version gaps, stale/conflicting sources, tenant mismatch or bad schema are quarantined with non-sensitive reason codes, not silently skipped or force-upserted. Avoid infinite hot-loop retries for permanent errors.
7. Producer must not mark source delivered solely on attempted delivery. Maintain delivery attempt, backoff, lease recovery and dead-letter reconciliation semantics in a separately reviewed implementation. Never infer success from queue ack alone.
8. Default feature gate is OFF per tenant and environment. No background process begins automatically from this design artifact or migration `0023`. Fail closed if gate, secret, source verification or status store unavailable.
9. Operational telemetry should include event ID, tenant-scoped correlation, safe error reason, projection lag, quarantine count, oldest undelivered age and replay attempts; no secret, member PII, raw evidence or source payload in logs.
10. Maintain explicit downstream non-effects: no CF01 MEMBER/role/JIT change, no Child07 shareholder account/holdings, no share trade/transfer/payment, no public tenant list.

## Unresolved engineering approvals (BLOCKERS)
- Exact approved service identity and mechanism for authenticating/authorizing a non-interactive projector actor; existing SQL lab requires transaction-local actor and DOCUMENT_REVIEWER plus independent authorization. Do not substitute an unrestricted migration-owner login.
- Defined delivery state ownership, lease/retry/quarantine interface and scoped role grants; do not invent a source-owned write path absent approved event/outbox schema.
- Recovery semantics on source version >1, revoked/ended relationships and an already ACTIVE CF02 projection. Existing lab currently rejects active conflicts; do not claim that it implements revoke/end handling.
- The canonical event contract for `MEMBERSHIP_ENDED` / status retraction and current legal-source approval, independently of the demonstrated `MEMBERSHIP_APPROVED` lab.
- Rollout security review, repeatable CI and owner approval for an adapter PR.

## Negative and concurrent test matrix (all NOT_RUN for this next stage)
| ID | Scenario | Required result |
|---|---|---|
| CONS-01 | Forged event_id / wrong tenant / wrong Party | deny, no projection or receipt |
| CONS-02 | Version gap, stale version, same version different event | quarantine, no partial write |
| CONS-03 | Duplicate redelivery after durable commit | one receipt, idempotent ack |
| CONS-04 | Crash before commit / after commit before ack | retry safe, exactly one projected effect |
| CONS-05 | Concurrent deliveries same Party/tenant | serialize, no lost update |
| CONS-06 | Expired/revoked authorization, disabled CF04 gate or invalid CF03 evidence | deny with zero projection mutation |
| CONS-07 | Tenant suspended, actor wrong role, cross-tenant delivery | deny |
| CONS-08 | Unavailable DB, missing secret, desynchronized source | fail closed, no ack |
| CONS-09 | Direct app identity/HTTP request attempts projector execution | permission denied |
| CONS-10 | Audit/redaction and replay observability | no PII, secrets or payload leakage |
| CONS-11 | ACTIVE conflict / unhandled MEMBERSHIP_ENDED event | no silent overwrite, unresolved gate |
| CONS-12 | Downstream role/share/account checks | unchanged after projection |

Execute in disposable PostgreSQL 17 and isolated HTTP harness on exact PR head; include source SHA/CI link and all failure output in #140. Browser flow only when the adapter has a real, approved UI surface. No fabricated acceptance.

## Linked Issue #150 — separate design blocker
The source-extracted Child06 command list contains no invitation issue/redeem/revoke command or issuer identity. Do **not** implement an issuer, invite token, public tenant discovery, or fake MEMBER role. Retain the protected known-tenant membership application path. Obtain an explicit owner-approved source contract specifying issuer authority, tenant-bound reference, expiry, revocation, consent, CF02 actor→Party linking and replay semantics before creating any endpoint or migration. This invitation decision is independent from the CF02 event consumer.

## Merge / release policy
- This design-only branch may be reviewed as a Draft PR against PH05. It does **not** satisfy #154 or #150.
- No direct PH05/main merge, hosted migration, deployment, live event dispatch or real-data ingestion from this step.
- Original `MEMBER-AT-001..007` and `SHARE-AT-001..008` remain NOT_RUN.
- CF03 independent failed workflow and Vercel previews stay separately red until individually diagnosed and retested.
