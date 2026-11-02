# ADR-PH01-001 — Make PHASE-01 exit criteria match the approved implementation sequence

**Status: PROPOSED; independent Product/Architecture/Legal/QA ratification required.**  
**Date:** 2026-11-02  
**Baseline:** immutable master source `tajikinews-design/tto-national-platform@5eb6be8edfbb61f2eca740a42c30f572b493f023`; implementation plan `docs/plan/IMPLEMENTATION_PLAN.md`.

## Problem and controlling source

The implementation plan explicitly states that PHASE-01 is the **field-level logical contract map** (Entity / State / Command / Query / Event / Permission / Test and legal gates) for all 23 Child specifications. PHASE-02 concerns architectural/technology decisions. PHASE-04–09 implement and test domains; PHASE-12–13 are human acceptance and delivery.

The initial spreadsheet defined PH-01-C05 as **complete parity of all 148 logical entity fields/constraints with implemented code**, and C06 as **155 individually executed accepted tests, SHA+CI evidence, and independent QA**. Requiring final business implementation and human acceptance before PHASE-02 contradicts this published phase sequence and creates an execution deadlock. **A passing CI for selected foundation paths is not evidence that all 23 domains are implemented or 155 acceptance tests have passed.**

C08 also combines technical source-semantic reconciliation, which can happen during design, with independent legal/product approval, which cannot be fabricated by an engineering agent.

## Proposed decision (NOT APPLIED TO LOCKED GATES)

1. **PH-01-C05 design-gate wording:** Every one of 148 entities has its exact source field, invariants/constraints, identity and source reference, proposed owning service/data boundary, implementation-status classification `PRESENT / PARTIAL / NOT_IMPLEMENTED / AMBIGUOUS`, and separately tracked physical/code gaps. **No requirement that future domain tables already be built**. Move full physical parity and source-driven implementation to PH-04–09, with an explicit fail-closed counterpart release/acceptance checklist.
2. **PH-01-C06 design-gate wording:** Preserve all 155 source test IDs, original scenario, expected result, explicit source-contract requirement anchor, proposed test layer/owner, intended assertion and gap/implementation phase. Record already-executed evidence *only where exact assertion matched*. Move **155/155 actual scenario execution and signoff** to PH-04–09 and human PH-12 gate. Not a waiver of any test.
3. **PH-01-C08:** Independently accept/reject semantic precedence and source conflicts (especially 8-summary vs 18-dedicated CF01 scenarios and five duplicate-number collisions). Keep both source IDs namespaced and originals immutable. An owner authorization for automation is not a signed independent QA/legal decision. This review must be performed by an identifiable authorized reviewer distinct from the implementation author, on an exact reviewed commit SHA.
4. **Release guardrail:** PH-04–09 / PH-12 gates MUST contain full implementation parity and 155-test executable evidence as hard blockers, including cross-tenant isolation, explicit legal authority, policy conditions and share-market constraints. No automatic GREEN by changing stage boundaries.
5. **Change control:** Changing official exit criteria needs a dated project-owner baseline approval plus separate independent review; do not edit existing frozen source docs. The tracker must retain the original C05/C06 text, proposed new wording and a dated approval trail.

## Current evidence / missing evidence

- `docs/analysis/PH01_SOURCE_148_ENTITY_FIELD_INDEX.json`: all 148 source entities and verbatim field contracts extracted.
- `docs/analysis/PH01_148_ENTITY_FIELD_PHYSICAL_CANDIDATES.json`: 786 field phrases independently enumerated, 32 SQL tables, no semantic parity claim; **649** field phrases have no direct SQL table, **69** lack literal columns, **28** are compound/qualified, **40** literal candidates still require semantic review.
- `docs/analysis/PH01_155_ACCEPTANCE_EVIDENCE_GATE.json`: locked 155 IDs, eight partially related CF01 technical assertions; **155 missing full formal approval/exact-run mapping**.
- `tests/test_ph01_acceptance_integrity.py` passes 4/4 tracking integrity checks in CI #41405958422; this is not 155/155 domain acceptance.
- CF01 8-summary vs 18-dedicated discrepancy remains formally unresolved and source hierarchy must be ratified.

## Decision and signatures

| Role | Named reviewer | Explicit choice | Signed SHA / date |
|---|---|---|---|
| Project / Product owner | **NOT RECORDED** | Approve / reject proposed phase-boundary correction | **PENDING** |
| Architecture / Code Owner (independent) | **NOT RECORDED** | Approve / reject mapping and migration of physical parity | **PENDING** |
| Independent QA Lead | **NOT RECORDED** | Approve / reject move of executable 155-test acceptance to implementation and PH12 | **PENDING** |
| Legal / Rule Authority | **NOT RECORDED** | Source hierarchy / CF01 alias / regulatory gates only | **PENDING** |

**Current official state until approved:** PH-01-C05 PENDING; PH-01-C06 PENDING; PH-01-C08 PENDING; PH-01 **5/8 GREEN**, no PH-02 advancement.

**No Merge, deployment, real share purchase/sale/transfer, new accounting/custody, or production data operation.**
