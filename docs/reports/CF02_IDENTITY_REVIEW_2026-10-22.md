# CF02 — Evidence-gated identity linkage (CI-only)

Based on Child01/02 LinkUserToParty, Child03 document/evidence/audit, Child04 legal policy and SoD. The exact legal validation provider and approved policy are not present; DO NOT claim legal acceptance.

- User requests linking their authenticated account to a Party, with tenant-scoped evidence from an already published document. A pending case never asserts a verified link.
- Reviewer cannot be requester or target. Must have a separately authorized platform-operator grant **and** an independently issued tenant-specific identity-review authorization.
- Review requires distinct published evidence, unexpired policy explicitly enabled by a privileged governance operator (no seed/default), active tenant, version match, row lock, durable audit; otherwise deny. Only approved review creates the User↔Party link.
- No membership decision, shareholding, shareholder account, financial balance, governance authority or real user data is written by this operation.
- Migration 0008 runs on disposable PG17 in CI only. Production/hosted Supabase forbidden pending owner approval of CF04 legal policy, evidence validation, reviewer designation, privacy and Child06/07 business ownership contracts.

## Nest API (Preview review surface, real activation denied without legal rule)
- POST /v1/tenants/:tenantId/identity-links {partyId,evidenceId} — authenticated applicant only; pending case, no verified link.
- GET /v1/tenants/:tenantId/identity-links/:caseId — only the applicant reads status.
- POST /v1/tenants/:tenantId/identity-links/:caseId/decision {approve,expectedVersion,decisionEvidenceId} — independent reviewer, rule & evidence checks inside transaction.
No browser BFF write-proxy is exposed: public onboarding must await policy/evidence/provider approval.
