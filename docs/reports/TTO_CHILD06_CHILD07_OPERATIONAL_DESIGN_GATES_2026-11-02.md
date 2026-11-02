# TTO — Child06/07 implementation-ready design boundary (synthetic-only)
**Date 2026-11-02 · Version 1.0 · State: REVIEW-CANDIDATE, NOT legally approved or implemented.**
Related: #129, #130, PR #134 crosswalk, **`docs/contracts/child06-07-oss-adoption-design-v1.json`** and exact-source consistency tests `tests/test_child06_07_oss_design_contract.py`.

## 1. What is complete, and what is deliberately blocked
The 12 **source-extracted** logical entity definitions (Child06 5 + Child07 7), all 15 commands, 8 queries, 9 events, 15 source IDs, canonical ownership and tenant/RLS/security constraints have a **reviewable design contract**. Every field/paragraph, command/query/event and original acceptance-ID is checked against the pinned source-extraction JSON by isolated tests. This is **design completeness for the mapped inventory**, not full official source-Word clause certification or a live implementation.

Full authorized write workflows, legal voting, financial transfers, source adapters, official shareholder register, non-member shareholder rights, all 155 exact tests and production approval remain BLOCKED. No source mutation.

## 2. Canonical domain separation and existing code reuse
| Owner | Allowed truth | Illegal inference |
|---|---|---|
| CF01 | User/session/role/JIT authority refs | Sign-in or role ⇒ membership/shareholder |
| CF02 | Party and Tenant identity, relationship projection | Party merge ⇒ share transfer |
| **CHILD-06** | MembershipApplication, CooperativeRelationship, ShareholderAccount, MemberProfile, RelationshipDecision | Member profile/account ⇒ confirmed share quantity |
| **CHILD-07** | Append-only official ledger, capital offer, sell/buy case, atomic share lock, transfer case, valid external valuation | payment reported/verified ⇒ transfer completed |
| CF03/04/05 | Evidence/audit, legal rule/SoD, payment verification | technical callback alone ⇒ ownership |

**Do not rebuild existing read stack**: `database/migrations/0009_child06_07_sourced_self_service_reads.sql` defines **private** tenant/versioned source snapshots and read functions; `0010_child06_07_import_quarantine.sql` defines append-only candidate receipt assessment **without promotion**. These are **CI/synthetic** migrations, not proof of a connected official source. `services/api` and shareholder BFF expose limited read-only endpoints with 401/403/503 and no-store. Historical tests do not authorize any live write.

## 3. Proposed request/application/decision workflow (CHILD-06)
**Candidate lifecycle labels only; exact official state machine must be matched by product/legal reviewer before implementation.**
- `SUBMITTED` → `UNDER_REVIEW` requires verified same-tenant Party reference and evidence; `UNDER_REVIEW` → `APPROVED | REJECTED` requires independently authorized approval, audit, evidence, expected version; `SUBMITTED | UNDER_REVIEW` → `CANCELLED` only under approved policy.
- `APPROVED` is not yet `ACTIVE` relationship until authorized `ActivateRelationship` action and source-versioned Member Master update; `EndRelationship` closes with valid-time history, **never deletes**.
- Concurrent decisions on one application must use unique idempotency keys and optimistic revision check; duplicates and stale revisions must **deny**; maker-checker for regulated actions.
- `ShareholderAccount` creation is independent of membership and does not create holdings; user account cannot be auto-promoted. For a non-member shareholder, **do not extrapolate** Member-role from existing `0009` own-only member read: require explicit independent CF04 entitlement and legal source owner rule decision first.

## 4. Proposed share requests and ownership finalization (CHILD-07)
**No operational POST endpoints will be enabled by this design**.
- `CreateSellOrder`: legal seller eligibility, official Child07 ledger balance and approved current valuation needed. Only a case/request record, not a transfer.
- `LockShares`: atomically check `availableShares = officialOwned - activeLocks`; reject negative or double-lock races under PG transaction; lock != cash reserve.
- `SubmitBuyRequest / SelectBuyer`: approved buyer/right/related-party checks and tenant consistency. No public matching engine implied.
- `RecordApproval`: actor authority, delegation scope, maker-checker and legal resolution/evidence, protected audit.
- `AttachPaymentEvidence`: quarantine/document classification; payment report is **not** verification.
- `MarkPaymentVerified`: only trusted CF05 reconciliation; no ledger append.
- `FinalizeTransfer`: future gate requires current valid external valuation, ownership cap post-transfer, approved ledger source, SoD, verified payment, source case/version, idempotency; append-only ledger mutation and case completion/audit/outbox in one atomic reliable transaction; unauthorized role or audit failure → ROLLBACK/NO EFFECT.
- `CancelTransfer`: safely release lock and preserve event history; cancellation cannot erase already-finalized ownership.
- OCF's stakeholder/issuance/transfer schemas are **references**, not Iranian cooperative law and not a live capital-market implementation. Tapir/MemberMatters profile workflows are UX inspiration, never identity/legal authority.

## 5. Read models and failure contract
- Existing `GET /v1/tenants/:tenantId/me/member-record`, `/me/shareholding` and Next BFF equivalents are reused. Both require a verified and revocable server session, tenant context, Party link, authority and two independent source approvals where holdings needed.
- Cross-tenant, cross-person, absent approved source, historical/stale ledger, idempotency conflict, bad Rule Registry, expired evidence or compromised session → DENY without side effects.
- A **real authenticated official zero** is a valid holding value; missing source, no row or outage is `UNAVAILABLE` and must **not** be rendered as `0`.
- `sourceVersion`, `ledgerVersion`, `asOf`, `sourceRef` (classified), and effective date provide traceability. No `NaN`, floating-point rounding, or share quantity derived from displayed KPI. Transfer outcomes must not be generated from read snapshots.
- `SHARE_OWNERSHIP_LEDGER_ENTRY` stays append-only; immutable canonical records and approval evidence must survive any Party deduplication/merge. Platform admin is not a tenant superuser.

## 6. Proposed reviewable acceptance matrix — supplemental, not canonical IDs
| Candidate test | Synthetic setup | Must prove |
|---|---|---|
| DES-C06-01 | account exists, no approved membership | no implicit membership or shareholder account |
| DES-C06-02 | duplicate/concurrent decisions | one valid authorised decision, others conflict/deny |
| DES-C06-03 | Party merge request | holdings unchanged; no official transfer |
| DES-C06-04 | own/cross-tenant manager and shareholder read | own-only, cross-tenant and object-ID denial at API/PG/export |
| DES-C06-05 | non-member shareholder request | no inferred vote/member status, explicit CF04 gate |
| DES-C07-01 | missing/unapproved official ledger | `UNAVAILABLE` not `0` |
| DES-C07-02 | two concurrent locks exceed official balance | at most allowed lock qty, no oversell |
| DES-C07-03 | `PAYMENT_REPORTED` or `PAYMENT_VERIFIED` only | no ledger entry or transfer finalized |
| DES-C07-04 | expired valuation, cap breach or related party | transfer denied before ledger append |
| DES-C07-05 | retry after ambiguous commit/crash | one idempotent finalized outcome, immutable audit chain |
| DES-C07-06 | failed audit/approval/authority or write race | full rollback, no partial ownership mutation |
| DES-C07-07 | time-late source rollback/replay or stale session | fail-closed read and no shares write |

Formal immutable source IDs **MEMBER-AT-001..007**, **SHARE-AT-001..008** remain `NOT_RUN`, with meanings/expectations to be reconciled from the original Word paragraphs by an authorized reviewer; none of these proposed tests substitutes them.

## 7. Separation of implementation gates (not waived)
1. Source/legal reviewer verifies original Child06/07 *full text*, acceptance expected results, nonmember legal rules, rights and document retention.
2. Official separate member data and share ledger custodians approve authentic source refs and legal scope. No user data uploaded until both approvals.
3. Codeowner approves SQL/REST ADR and any future writes; only then implement narrow vertical slice on a new independent Draft PR.
4. Independent security/QA tests real PG17 with FORCE RLS, idempotency and expiry, real authorized fixture with no real PII; exact SHA + run + reviewer signoff.
5. No Merge or Arvan production deployment, live payments or official share transfers before regulated release gates.

**Result:** blueprint and automated source-alignment tests prepared. **No real source activation, write routes, code migration or acceptance GREEN claimed.**
