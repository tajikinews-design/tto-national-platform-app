# PHASE-00 / PHASE-01 — final evidence revalidation, 2026-11-02

**Scope:** independent technical second look at source immutability, original PH-00 five checks, and PH-01 eight *design-phase* exit checks. User requests completion of any unchecked item. No unauthorized declaration that live application acceptance is complete.

## Authoritative anchors
- Original source repository `tajikinews-design/tto-national-platform` (private), main and approved SHA identical: `5eb6be8edfbb61f2eca740a42c30f572b493f023`, **15 blobs**, no truncated Git tree.
- Source SHA/blob/size details pinned in `docs/analysis/PH00_SOURCE_15_BLOB_RECHECK_2026-11-02.json`.
- Execution repository is a separate **private** repo. PH-00 historical preflight run `39756700303` at `f1ca839dd08382910194ceaead9a621b5a54f70b`: job `119750385902` succeeded, logged `TTO_SOURCE_SNAPSHOT_MANIFEST_PASS=15`, **6 tests**, static bundle build **3 panels, 1 hub, 2 assets, no deploy**. That manifest was OFFLINE; today's source-ref GitHub tree read supplements it.
- Original plan `docs/plan/IMPLEMENTATION_PLAN.md`: PH-01 source logical mapping, PH-04–09 actual implementation, PH-12–13 real acceptance. Owner-approved scope rebaseline `docs/architecture/TTO_PH01_PH02_OWNER_ACCEPTED_DESIGN_EXIT.json` explicitly restricts phase GREEN to **DESIGN**.
- Current CI of new offline guards is a tracking-quality check only.

## Phase-00 controls

| Gate | Evidence verified 2026-11-02 | Verdict |
|---|---|---|
| PH00-C01 | Source SHA matches current source `main`; all 15 source blob names, SHA and sizes retrieved (source data not edited) | **GREEN** |
| PH00-C02 | Separate private app repository accessible; read/write proven on isolated Draft PR branches | **GREEN** |
| PH00-C03 | Source HEAD equals frozen approved commit; no mutation performed during review | **GREEN** |
| PH00-C04 | Independent bootstrap branch existed; preflight CI `39756700303` SUCCESS, 6 offline assertions and static build; revalidated by new immutable manifest guard | **GREEN** |
| PH00-C05 | Source status report `docs/reports/PHASE_00_01_STATUS.md` from 2026-10-22 and master tracker present | **GREEN** |

**Residual non-blocking risk:** Original source repo `main` is not branch-protected (GitHub `protected=false`). The SHA-pinned source remains immutable in Git history; configure branch protection/ruleset through authorized repository admin before permitting any future source writes. This is not itself one of the original five PH00 exit controls.

## Phase-01 design controls

| Gate | Direct evidence / important limit | Design verdict |
|---|---|---|
| PH01-C01 | 23 unique CHILD-01…23; `CHILD_CATALOG.json` | **GREEN** |
| PH01-C02 | source extraction 148 entities / 71 states / 165 commands / 90 queries / 89 events; 23-child totals | **GREEN** |
| PH01-C03 | exactly 11 navigation roots; canonical routes/permission policies still not implemented; later delivery | **GREEN DESIGN** |
| PH01-C04 | exactly 155 unique original acceptance IDs (in frozen index each status `NOT_RUN`) | **GREEN DESIGN INDEX** |
| PH01-C05 | 148 source entities + 786 field phrases extracted and candidate SQL comparison; **no live equality claim** | **GREEN DESIGN ONLY** |
| PH01-C06 | 155 expected scenarios and gaps recorded for later tests; **zero 155-case official exact run+signoff mappings** | **GREEN DESIGN ONLY** |
| PH01-C07 | gaps registered; source conflicts and schema/authorization outstanding tracked separately | **GREEN DESIGN TRACKING** |
| PH01-C08 | project-owner-attested specialist/design approval and namespaced dedicated CF01 18-vs-summary-8 precedence; **no independent signed specialist files** | **GREEN OWNER-APPROVED DESIGN**, signatures later |

### Source inconsistencies and non-waivable obligations

1. `CHILD_CATALOG.json` says all 23 `implementation=NOT_STARTED`. This is a **historical source/design inventory**, not a live coding status; partial implementations and tests now exist in CF01–03 and read-only source projections. Do not silently rewrite frozen provenance or use that snapshot for current completion metrics.
2. `ACCEPTANCE_IDS.json` still has 155 `status=NOT_RUN` and null implementation refs. It is correct as an immutable original-index snapshot but must NOT be interpreted as CI never tested any related functionality. The derived `PH01_155_ACCEPTANCE_EVIDENCE_GATE.json` tracks partial technical evidence and 155 missing complete formal acceptance chains.
3. The 148 entity / 786 field-phrase physical candidate audit reports 649 no direct SQL table, 69 no literal SQL column, 28 compound phrases and 40 literal candidates that still require semantic review; these are **not** 148 verified implemented business entities. Full implementation remains downstream.
4. Dedicated Child01 contains 18 detailed acceptance cases; Unified Pack has eight summary tests with numeric ID collisions; preserve both originals and approved design namespace/crosswalk. Do not infer all 18 are formally accepted from a historical release gate.
5. Independent specialist signatures were **owner-attested, not independently cryptographically verified**. Formal regulated release must preserve these as a hard evidence requirement.
6. **Vercel Hobby** remains restricted to genuinely non-commercial synthetic test usage; final platform on an explicitly authorized dedicated server, with no production deployment through these PRs.
7. Issue **#119** remains a **hard PH04–09/PH12–13 release blocker** for actual 148-entity parity, 155 exact tests, legal/authority review and deployment readiness; PH00/01 design GREEN never satisfies this issue.

## Automated follow-up and stop point

`tests/test_ph00_ph01_final_revalidation.py` is the new offline guard, verifying **15 original blobs**, 23 children and all source-table counts, 11 navigation roots, 148/786 items, 155 preserved test IDs and enforceable no-fake-runtime-GREEN metadata. It uses the captured on-date live GitHub evidence, not a GitHub token in CI, and is not a continuous remote integrity monitor. Historical PH00 external proof and live GitHub source recheck are both cited.

**Expected lifecycle after this audit:** PH00 **5/5 GREEN**, PH01 **8/8 GREEN DESIGN / owner-approved**. **PH01 original runtime-parity/155-test/specialist-signature claims remain NOT_CERTIFIED**, but are not PH01 design exit blockers under signed-off owner scope rebaseline. PH02 design 4/4 as previously recorded; subsequent PH03 can proceed only inside synthetic Preview and fail-closed controls.

**Safety:** Source repo unchanged, no merge, real shares, live payments, or production deploy through this audit.
