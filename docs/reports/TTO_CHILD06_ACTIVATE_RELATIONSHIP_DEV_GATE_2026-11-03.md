# Child06 — source-owned ActivateRelationship, separate gated command (2026-11-03)

**Baseline:** PH05 `bb51877ce36de497d9972985847d33a091a6b47c` with owner-approved PR #144 application/decision and PR #146 existing-portal UI. Frozen original source `5eb6be8edfbb61f2eca740a42c30f572b493f023` and `TTO-MEMBER-SHAREHOLDER-IMPLEMENTATION`.

## Source boundaries maintained
Child06's `RecordMembershipDecision(APPROVED)` is NOT `ActivateRelationship`. This new separate activation command creates *Child06 source-of-truth* `cooperative_relationships` with monotonic per-party source version and an immutable un-dispatched local `MEMBERSHIP_APPROVED` event, only if independently authorized and policy-gated. The CF02 `relationship_projections` is a **separate downstream consumer read-model**, not updated here; no actor receives a CF01 MEMBER role or shareholder account/Child07 shares.

## Concurrency and fail-closed model
- Activation only against a source-verified, independently approved application. A third actor who did not request or decide must hold same-tenant COOPERATIVE_MANAGER role **and** separate active activation-authorization evidence approved by another actor **and** explicit rule gate, which is **disabled by default**. All three independent evidence references (request, decision, activation) differ.
- Application row locked with expected version, Party row locked to serialize competing approved cases. Only one ACTIVE relationship per tenant/Party (partial unique index), history retained (never hard-deleted); source_version MAX+1. Matching retries are idempotent and never duplicate events/audit; conflicting/stale or cross-tenant attempts fail.
- Revoked role/authority/rule, missing evidence, inactive tenant, active imported member source or CF02 projection all reject. No direct app table SELECT/WRITE; function is granted to `tto_app` and uses existing session-bound transaction-local actor/tenant.
- Nest command + existing cooperative manager BFF POST and applicant-only relationship status GET (no fake membership role). No automated button in UI: authorization source-gate is not operational yet.

## Not part of this source-locked slice
No automatic CF02 projector dispatch, MEMBER role grant, shareholder account, share acquisition, transfer, payment or voting. Outbox has no consumer. No production or hosted migrations, real data connection, registry authority, Deploy or main merge. Synthetic PostgreSQL17 E2E passes do not complete canonical `MEMBER-AT-001..007` acceptance; those remain **NOT_RUN**.
