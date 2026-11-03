# TTO Child06 — first practical application + review workflow (2026-11-03)

**Approved development baseline:** PH05 `f65d7c5a67d833e521a2a4fbcc7b46592627d17d`.
**Frozen normative source:** `5eb6be8edfbb61f2eca740a42c30f572b493f023`, `TTO-MEMBER-SHAREHOLDER-IMPLEMENTATION`, source map `docs/analysis/CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json`.
**Original goal:** national multi-tenant platform linking cooperative management to member/shareholder self-service through trusted identity, authorized source, and tenant isolation; not a separate member registration site.

## Source-owned boundaries preserved
- CF01 owns login and roles; CF02 owns Party and verified identity link; Child06 owns `MEMBERSHIP_APPLICATION` and workflow decision.
- Child06 *decision* ≠ `ActivateRelationship`; the latter is separate approved canonical command.
- Child07 owns share ownership and transfers; an approved application does not create MEMBER role, account, ownership, share ledger entry, wallet or financial rights.
- This slice accepts one published tenant evidence reference in canonical `evidence_refs[]`; does not duplicate personal identifiers.
- No CF04 rule is invented as legally activated. Dedicated reviewer authorization + disabled-by-default evidence/rule-snapshot gate must be populated only in synthetic PG17 fixtures. No live source/approval is presumed.

## Implemented scope
1. Versioned pending application, independently authorized manager decision (approve/reject) and applicant-own status query. Strict row lock and expected-version check; identical retried decision returns `ALREADY_APPLIED`; no second audit/outbox event.
2. New tenant-scoped manager pending query and immutable private outbox, committed with the same application/decision transaction; no consumer or external dispatch.
3. Nest API `/v1/tenants/:tenantId/membership-applications` (POST), `/pending` (GET), `/:applicationId/decision` (POST) and own status `/me/membership-applications/:applicationId` (GET). All authenticated through existing revocable session and transaction-local PG role `tto_app`. No client-supplied role/Party authority.
4. Intended tests: duplicate pending, cross tenant, unlinked Party, missing reviewer role, absent reviewer authority, missing rule gate, self-decision, evidence separation, stale version, idempotent replay, reject/approve path, immutable events and NO membership role/CF02 projection/share creation.
5. Only disposable PostgreSQL17 CI migrations `0001..0010 + 0021` for adaptive core; release uses `0001..0019 + 0021`. Separate PR #143 independently owns migration `0020` for Child07 snapshot history.

## Explicit non-goals
No membership activation or Party merge, no real member imports, no official legal-source approval, no share history/ownership writes, no transfer, no money, no main merge/production deploy. Original `MEMBER-AT-001..007` are `NOT_RUN`; synthetic tests cannot upgrade them.

**Gate:** draft independent PR and project-owner exact-SHA signoff only after actual PG17/HTTP evidence. No deploy/merge without separate owner decision.
