# Execution plan and non-duplication handoff

## Verified facts / reuse
- Private source repository is already imported and verified: exactly 15 native originals pinned at `5eb6be8edfbb61f2eca740a42c30f572b493f023`. **Do not copy them** into this repo or redo the Google Drive migration.
- The Unified Pack includes **23 Child Specifications**; names indexed in `docs/analysis/CHILD_CATALOG.json`. Existing 108/47 workbook reconciliations are historic, not proof of implementation.
- Previously CI-tested **static RTL review shells** from historic source commit `5945378808532fa2f1603e2eda3ab218ad702e33` are reused here solely to avoid rebuilding an unapproved visual prototype. This code is not a production implementation.
- Existing source images for national and cooperative dashboard are binary-identical by design; their scope and displayed metrics are *not* identical in production.

## Planned sequence / gates
1. **PHASE 00:** Complete read-only source preflight + independent repo access + this branch CI; record evidence and GREEN only after CI passes.
2. **PHASE 01:** Finish complete field-level Entity/State/Command/Query/Event/Permission/Test mapping for all 23; locate unresolved legal gates.
3. **PHASE 02:** Evaluate and seek approval for ADRs (framework, API, DB, multi-tenancy, secrets, queue, storage, provider region and deployment split).
4. **PHASE 03:** Replace temporary review shells with tested production-grade three-panel apps within the approved stack; configure build and environment boundaries.
5. **PHASE 04–09:** Implement core 01–05, business 06–21, data/ops 22–23, all required security/functional tests; green only on concrete evidence.
6. **PHASE 10–11:** After suitable Vercel plan and protected private Git connection, configure isolated preview only and verify rejected unauthorized requests. Never use prod data.
7. **PHASE 12–13:** Real acceptance tests by authorized reviewers; delivery evidence. Owner explicitly approves any move toward Production; **ArvanCloud only** for production.

## External issues
- Vercel connected user is Hobby and no projects/namespaces show. Commercial project cannot assume compliant preview on Hobby. No preview or production deployed.
- GitHub `main` initially unprotected; mandate manual PR gate and add branch protection only with authorized provider tooling and policy approval.

## Evidence standard
A green source snapshot check isn't a functional app test; passing static HTML build isn't proof of auth or tenant isolation. Record all CI run IDs, SHA, screenshots and test traces. Gated decisions are never auto-approved.
