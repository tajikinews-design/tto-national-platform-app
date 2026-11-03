# TTO Child06 — existing portal form/manager tray integration (2026-11-03)

**Architecture review:** existing source-locked `TTO-MEMBER-SHAREHOLDER-IMPLEMENTATION`, canonical `CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json`, and the original objective of a national multi-tenant cooperative-management ↔ shareholder experience. No new app, identity registry, public registration service or duplicate Party table.

**Prerequisite (stacked, NOT MERGED):** [PR #144](https://github.com/tajikinews-design/tto-national-platform-app/pull/144), Child06 SubmitMembershipApplication + RecordMembershipDecision, SHA `4d092b151e000dfcd87c5f8142830925ba4af8ac`. Both #144 and #143 remain separate, unmerged PH05 feature PRs. No permission to merge any PR is inherited from prior approvals.

## Delivered UI slice
- Existing `apps/shareholder` page `/tenants/{tenantId}/membership-application` provides accessible Persian RTL, documented Party and CF03 evidence reference fields, an explicit request submission action and an owner-only follow-up query with status/version. The confirmed request does **not** create a member or shareholder.
- Existing `apps/cooperative-management` page `/tenants/{tenantId}/membership-applications` renders only server-approved, tenant-scoped pending cases, their **server-returned expected versions**, decision evidence input and explicit confirm/deny actions. Confirmation requires a deliberate dialog. After any decision/denial, it reloads the list; it never assumes membership or source approval.
- Links from the existing manager TenantScopePicker after a tenant-context check and from the existing shareholder verified records screen; no independent navigation/identity service.
- Routes rely on already-implemented authenticated BFF → Nest → PostgreSQL (the sole authority). CSRF origin verification, HttpOnly cookie, same-origin no-store fetches, exact-tenant render binding, AbortController, 401/403/409 fail-closed and no client Authorization/Party authority claims.

## Important existing discovery limitation, not bypassed
The current shareholder tenant-picker lists only current MEMBER-role contexts. A new, not-yet-member applicant cannot discover a tenant through that picker. This slice provides a **tenant-scoped deep link**, intended to be obtained from a verified cooperative invitation/onboarding process. It does **not** grant the MEMBER role, expose unrelated tenant data, create a new discovery API or weaken source authentication. A future approved applicant-tenant discovery/invitation contract is needed for full self-service onboarding. Current UI accepts only CF02 / CF03 reference UUIDs and does not request raw personal identifiers.

## Test and acceptance boundaries
Static source-contract guards plus synthetic PostgreSQL17/Next/Nest HTTP tests from #144. Conditional Chromium E2E test at 390px and 1440px verifies actual applicant submission, independently authorized manager decision, version advancement, applicant status, RTL and no horizontal overflow, using purely disposable accounts.
The *canonical* 7 Child06 MEMBER-AT acceptance records stay **NOT_RUN** until exact source criteria and original official evidence are executed and reviewed. `APPROVED` is a case decision only; **no ActivateRelationship**, vote, account, membership-role, share ownership, transfer, payment, production DB migration or Deploy.
