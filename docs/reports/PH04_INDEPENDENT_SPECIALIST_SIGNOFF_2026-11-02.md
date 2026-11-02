# PH04 independent specialist acceptance packet — 2026-11-02

**Status: REVIEW REQUEST PREPARED / NO INDEPENDENT SIGNATURE / NO FINAL GREEN.**

## Immutable inputs
- Detailed CHILD-01 §17: **18** distinct cases, `docs/analysis/PH04_CF01_18_CF02_8_ACCEPTANCE_TRACEABILITY.json`
- Dedicated CHILD-02 §29: **22** distinct cases, `docs/analysis/PH04_CF02_22_DEDICATED_ACCEPTANCE.json`
- Unified-PACK summary aliases: **8 CF01 + 8 CF02**, **not** replacements for detailed tests
- Frozen all-source 155 IDs: `docs/analysis/PH04_LOCKED_155_SOURCE_EXECUTION_MATRIX.json` (PH04–PH09; 0 independent acceptance signatures)
- Branch: `feat/ph04-identity-tenant-party-contract-parity-20261102`; Draft PR #123
- Synthetic-only tests; no production DB, actual shares, transfer, settlement, SMS, merge, or deployment.

## Required independently attributable decisions
| Discipline | Exact acceptance question | Reviewer GitHub ID | Reviewed SHA | Evidence URL | Verdict | Signed timestamp |
|---|---|---|---|---|---|---|
| Product/Source owner | Are official §17 18 and §29 22 scenarios fully represented, without aliases/renumbering? | UNASSIGNED | NONE | NONE | PENDING | NONE |
| Architecture/DB security | Are Tenant/Party/Role boundary, SOURCE OF TRUTH and RLS upheld for runtime HTTP, PG, job/cache/export and source races? | UNASSIGNED | NONE | NONE | PENDING | NONE |
| Security QA | Does real UI/Next BFF/Nest/PG reject every forbidden action and produce no effects, including adversarial visible controls? | UNASSIGNED | NONE | NONE | PENDING | NONE |
| Legal/Compliance | Do legal authority, maker-checker, retention, source provenance and regulated share actions meet approved contracts? | UNASSIGNED | NONE | NONE | PENDING | NONE |
| Independent test QA | Is each source case linked to exact assertion, **same SHA** CI and auditable artifact, with negative effects covered? | UNASSIGNED | NONE | NONE | PENDING | NONE |

**Signing rules:** Only a distinct authorized human reviewer (not the code author or this assistant) may submit a GitHub PR review or signed evidence identifying their exact acceptance scope and SHA. A PR comment, green workflow or user delegation to engineering does not substitute independent specialist acceptance. No review approval is currently recorded; do not write APPROVED/GREEN into the traceability register without an actual review.

## Scope boundaries and open hard gates
1. CF01 DED-004: HTTP test proves forged role action denied; a separate Chromium exercise with a **synthetic visible control** calls live Nest, but the actual production permission-controlled UI/BFF remains unavailable for end-to-end certification.
2. CF01 DED-006: only unregistered synthetic share/financial POST routes returning HTTP 404 are evidenced. The authorized cooperative share-market transaction endpoint is *not implemented*; full negative coordinator-vs-approved-authority acceptance is **BLOCKED** until the legal domain handler is approved and implemented. Do not create an accounting or wallet route to satisfy this test.
3. CF02 §29 contains 22 tests, not 8. Missing or partial: Tenant termination/retention, identifier masking and duplicate review, maker-checker merge, source membership history, search/export/cache and background job isolation, real source contracts.
4. CHILD06/07 Member Master and Share Ledger are independent truth; Party alias cannot transfer shares. Read-only synthetic snapshots do not constitute legal source authorization.
5. Original frozen 155 formal tests extend to PH09. Neither successful PH04 CI nor a completed source-ID index proves these are implemented.
6. Issue #119 (source parity and 155 exact QA) and #122 (manual assistive tech) remain release blockers.

## Procedure
- Reviewers inspect documents, code and synthetic CI on an exact SHA; record explicit supported evidence per original test ID and exception.
- Any code change invalidates **exact-head run** claims and requires rerun.
- Approve scope by component, with independently attributed verdict. No scope-by-association.
- Update permanent TTO_Master_Execution_Roadmap workbook and GitHub traceability only on verified signed evidence.
- Only after all blocking decisions: consider PH04 GREEN; separate release approval remains mandatory.

**Pending external dependency:** assign authorized independent Product, Architecture, Security, Legal and QA reviewers. Do not fabricate names, timestamps, or signatures.
