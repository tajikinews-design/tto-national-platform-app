# Child06/Child07 self-service source contracts — 2026-10-23

**Implementation stage:** source-authority-gated, read-only candidate adapter. The platform is NOT synchronizing real membership or shareholding yet.

**Normative source:** TTO-MEMBER-SHAREHOLDER-IMPLEMENTATION (Child06) and TTO-SHARE-CAPITAL-MARKET-IMPLEMENTATION (Child07), indexed in docs/analysis/CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json.

## Source-of-truth boundaries
- Child06 decides member status and owns ShareholderAccount. CF02 relationship_projections is reference-only; a Party link cannot activate membership.
- Child07 owns append-only ShareOwnershipLedger, not Child06. Source-backed quantity is only a read snapshot, never an authorization for transfer, wallet balance, custody, valuation or money movement.
- Non-member shareholder cases remain **blocked** until the specific Rule Registry rights contract is approved.
- Source ingestion is **not implemented**. Snapshot tables are deliberately private: runtime role has no SELECT, INSERT, UPDATE or DELETE; only reviewed privileged source migration may populate after official owner approval.
- Independent source approvals are required for each tenant/domain, with source reference, CF04 rule snapshot reference and published tenant evidence. No approval seed, automatic enable or data fabrication.
- Authenticated applicant must also have an APPROVED independently decided identity-link case, verified linked Party, active scoped MEMBER role, and an ACTIVE source versioned CF06 relationship matching the canonical CF02 projection.
- Holdings additionally require matching active ShareholderAccount source and latest explicitly sourced Child07 ledger snapshot. Missing source or absent holdings row returns **unavailable**, never an invented zero.

## New read endpoints (no write)
Nest: GET /v1/tenants/:tenantId/me/member-record and /me/shareholding.
Shareholder BFF: GET /api/tenants/:tenantId/me/member-record and /me/shareholding.
All queries use verified revocable HttpOnly session -> Nest -> PG transaction-local tenant -> SECURITY DEFINER narrowly granted read function. Never accept browser Authorization or selected tenant as proof of authority. 401 unauthenticated; 403 unavailable/nonentitled (indistinguishable); 503 backend unavailable. Responses no-store/Vary Cookie.

## Before real data can be connected
Legal approval and independent adjudication for CF02/CF04 identity case, Child06 authoritative relationship and shareholder-account source mapping, Child07 ledger reconciliation and source-version monotonicity, provenance/evidence and retention/privacy review, separate hosted migration and regulated source adapter security acceptance. CI fixture source data is **synthetic only**. All Child06/07 full acceptance remains NOT COMPLETE.

### Extended immutable ledger evidence
Imported Child07 read snapshots are append-only at the DB trigger level (even a mistaken migration-owner UPDATE/DELETE raises); the canonical Child07 share ledger remains unimplemented. Restricted app runtime cannot directly SELECT private source tables. Revoked sessions deny read on both Nest and BFF. These controls are added to the synthetic CI E2E.
