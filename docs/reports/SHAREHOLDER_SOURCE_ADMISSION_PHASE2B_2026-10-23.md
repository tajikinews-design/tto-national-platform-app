# Phase 2B — Independent source admission and acceptance evidence

**Project:** TTO National Platform — Shareholder workspace  
**Evidence baseline:** Phase 2A source-gated local Docker Release PASS at `707a45fc3de09e05c0e0ba2b3219d85f66a24981` (Draft PR #25).  
**This milestone:** reviewable legal/source admission package and stronger real-session tests. **NOT** production integration or trading/publication approval.

## Verified contractual ownership (not self-declared approvals)

| Concern | Canonical authority | Relevant scope and constraint |
|---|---|---|
| Session/Party/Tenant | CF01/CF02 | Current session plus a valid tenant context cannot by itself grant membership/share or publishing rights. |
| Member standing and eligibility | Child06 | Membership relationship and ShareholderAccount; Child06 does not own the ownership ledger. |
| Buy/sale case and history | Child07 | SellOrder, BuyRequest, TransferCase and ownership ledger, with seller/buyer own-case visibility and independent policy gates. |
| Communication and formal notices | Child09 | Communication content, audience, versioned publication, notice assurance, frozen recipients; delivery differs from read/acknowledgement. |
| Legal rules and effective versions | CF04 | Unknown policy means denied; tenant-specific source and approval evidence required. |
| Legal evidence and retention | CF03 | Distinct document, publication, audit and evidence packages. |
| Notification transport | CF05 | May deliver only authorized content; never proof of publication or recipient acknowledgement. |

Contract index: `docs/analysis/CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json`.  
Existing data source quarantine: `docs/reports/CHILD06_07_SOURCE_READINESS_2026-10-23.md`.

## Admission dossier

Machine-readable, NON-OPERATIVE review inventory:
`docs/contracts/shareholder-source-authority-readiness-v1.json`.

**15 independent evidence controls** over Child07 (7) and Child09 (8). Every control is `PENDING` with absent evidence IDs and reviewer identities. Every source decision is `BLOCKED`, both connections are `NOT_IMPLEMENTED`, `runtimeActivationSupported=false`, and writes are denied. No secret, live source URL, Party name or real tenant info belongs in this file.

### Child07 — decisions required from external authorized reviewers

1. Identify the authoritative owner and provide independent approval/evidence for the tenant-specific source connection.
2. Resolve CF01/CF02 session and linked Party independently of the browser or selected tenant.
3. Resolve Child06 standing and member/non-member shareholder rights without inferring from login alone.
4. Provide effective CF04 legal-rule version and approved permissions for own-case visibility.
5. Specify canonical query semantics (sell orders, buy requests, cases), immutable source event IDs, strict ordering, source-version monotonicity, correction and retraction handling, replay and idempotency. The Phase 2A list fields are **candidate projection fields**, not binding canonical database field names.
6. Specify CF03 proof, privacy classification, retention and audit responsibilities for each case and attachment.
7. Independently accept tenant/Party isolation tests, stale-event and authorization-revocation handling. Related-party restrictions route to GRC; cases never themselves authorize money flow/ledger writes.

### Child09 — decisions required from external authorized reviewers

1. Identify the Child09 publisher and its separate publication approval; CF03 document status alone is insufficient.
2. Verify tenant and recipient identity/entitlement; public/member/internal notice classes are distinct.
3. Approve the effective CF04 classification and audience-visibility rules, including dissemination channels.
4. Specify `GetCommunicationFeed` projection and exact approved publication version/source event link.
5. For assured/legal notices, freeze and deduplicate recipient snapshot with proper evidence package; a current tenant role does not retrospectively enlarge the audience.
6. Preserve **DELIVERED ≠ READ ≠ ACKNOWLEDGED**; user-facing feed is not legal proof of notice service.
7. Verify CF03 evidence integrity, version retention, and notice withdrawal/correction policies.
8. Independently validate RLS, recipient access including cross-tenant and privileged actors, and revocation.

## Decision lifecycle (requires humans/authorized source; no self-approval)

`NOT_SPECIFIED → SOURCE_OWNER_IDENTIFIED → DOCUMENTED_FOR_LEGAL_REVIEW → INDEPENDENT_DECISION → SECURE_SOURCE_ADAPTER_TESTS → CONTROLLED_ENABLEMENT`

This document is **not a workflow automation**. It does not move any state. Progress beyond review documentation requires written evidence from the respective source owner, legal and data-governance reviewers, appropriate board decisions where applicable and independently verified identity/policy references. An issue comment, CI green check or GitHub merge can never substitute for approvals.

The approved buying/selling Specification remains the governing separate workflow. No auto-trade or wallet; direct buyer→seller payments as specified, and the platform does not become a general accounting system.

## Engineering completed in this slice

The Docker-only `scripts/e2e-cf02-identity-authority.cjs` now exercises **new Child07 and Child09 endpoints against valid, real, synthetic PostgreSQL-backed sessions** after the test user has independently approved Child06 membership plus a Child07 holdings snapshot. The tests verify:

- Nest: 403 source denied with valid entitled actor, 403 for wrong tenant; 401 after session revocation.
- Next BFF: 403 source blocked even with valid first-party cookie, 401 when only forged browser bearer/role/Party headers are supplied; 405 for POST.
- Deny responses never carry 200 empty results or imaginary notices.
- IMPORTANT: The Next BFF candidate stubs do **not** contact upstream and thus do not check session revocation. They return 403 for syntactically valid revoked-cookie values, while Nest validates and returns 401. Both remain closed. Before approved data integration, this discrepancy must be resolved via independently approved upstream-session validation. Do NOT claim BFF 401 revocation recognition now.

CI autodiscovers `scripts/ci/test_source_acceptance_packet.py`, including positive blocked-packet validation, malicious/premature state tampering tests and an assertion that the authenticated E2E verifies these gates. The `scripts/ci/verify_shareholder_source_packet.py` parser explicitly **only validates BLOCKED state**; it is not a signing system, approval validator, data ingestion utility or a way to activate any tenant.

## Current and future gates

| Gate | State | Reason |
|---|---|---|
| Phase 2A local Release | PASS at immutable baseline SHA | User-provided Windows Docker output previously attached to Draft PR #25. |
| Phase 2B source packet and E2E changes | COMMITTED, NEW-SHA RELEASE PENDING | Must be run on new exact SHA in isolated Windows Docker; Phase 2A PASS cannot be borrowed. |
| External Child07 legal/source evidence | BLOCKED | No approved owner feed and tenant-specific review packet. |
| Child09 publisher/recipient evidence | BLOCKED | No certified publication and audience decisions. |
| Actual source reads, external data imports, notices, trade commands, payments, ledger mutation | DISABLED | Deliberate safety boundary, no enabling/migration code. |
| Hosted Vercel/Arvan | NOT DEPLOYED | Independent hosting approval and checks required. |

**No writes to main, hosted Supabase, shared Docker volumes, real shareholder data or live messages** in Phase 2B.
