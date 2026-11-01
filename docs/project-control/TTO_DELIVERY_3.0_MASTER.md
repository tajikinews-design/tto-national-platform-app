# TTO Delivery 3.0 — Project Control System v1.0
Date: 2026-11-01 | Mission: TTO-PCS-001 | Status: PROPOSED / DRAFT

## Mission
Deliver an approved, legally bounded, source-backed national cooperative development platform. GitHub versioned project-control records are the execution record, not chat memory or tests alone.

## Waves
- WAVE-0: establish evidence inventory, reconcile stacked Draft PRs, approved source and safety gates; NO merge without owner review. State: IN_PROGRESS.
- WAVE-1: cooperative-to-shareholder validated membership and holdings vertical slice, one pilot cooperative with approved source. State: BLOCKED_BY_SOURCE_AND_INTEGRATION.
- WAVE-2: cooperative communications, approved notices, disclosures, personal reporting; proper publication and audience authorization. State: NOT_STARTED.
- WAVE-3: legally permitted share request tracking and national monitoring; trading activation strictly gated; no automated ownership transfer without independent approval. State: NOT_STARTED.

## Five cross-cutting workstreams
PRODUCT, ENGINEERING, DATA, TRUST, GOVERNANCE. All must produce evidence for each applicable vertical slice. Build passing is not product acceptance.

## Capability states and four gates
NOT_STARTED / DESIGNED / IMPLEMENTED / INTEGRATED / VERIFIED / ACCEPTED / BLOCKED.
G0 specification, owner, source and permission plan; G1 implementation; G2 integrated negative, tenant and functional tests; G3 authorized product/legal/data acceptance. BLOCKED overrides progression when any critical dependency is absent.

## Fixed boundaries
- The platform is a shareholder-information and authorized share-request platform; NOT the cooperative general ledger, wallet, custodian or accounting ERP.
- Financial and statutory information is disclosure-only, with lawful audience controls.
- Buyer-to-seller payment flow and board/legal decisions remain within approved Share Market Specification v3.0; pending legal authority is NEVER implicitly granted.
- Review-only UI, preview tests, synthetic mock identity or synthetic records cannot be called operational.
- Source repository tajikinews-design/tto-national-platform remains immutable. No edits to production, live shares or secrets.
- Existing Draft PR stack is not merged or deployed by creation of this control documentation.
- Do not overwrite historical accepted checkpoints; record exact SHA/run and provenance.

## Execution protocol for Codex / Work
1. Read CURRENT_CHECKPOINT.md, ROADMAP.json, CAPABILITY_REGISTRY.json and DECISION_REGISTER.md at start.
2. Inspect GitHub PR HEAD/base/main and existing work; never repeat finished verified tasks.
3. Select one capability and state its G0-G3 acceptance evidence before coding.
4. Work in isolated branch/Draft PR, test exact HEAD. No merge/deploy absent explicit separate authorization.
5. Record evidence, blockers, SHA, handoff, and next single action. New stage is not ACCEPTED based on synthetic tests.
6. If blocked by source/legal/owner decision, work on independent safe pieces or stop the blocked action; never invent approvals.

## Wave-0 exit criteria
Complete paginated PR inventory and dependency graph; reconcile 23 child contracts and 11 navigation roots with code on candidate branch; select safe consolidation path; approve technical baseline and acceptance smoke, select pilot cooperative/source authorities; resolve G0 blockers and owner sign-off. Until then Wave-0 must stay IN_PROGRESS.
