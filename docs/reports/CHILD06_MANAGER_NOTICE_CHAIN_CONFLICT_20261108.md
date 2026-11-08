# CHILD06 / PH12 — Manager correction & revocation UI, multi-notice chain ambiguity

**Executed:** 2026-11-08 | **Scope:** disposable CI, synthetic notice changes only
**PR:** #172 DRAFT / unmerged | **Project master:** v4.38

## Objective and delivered changes
The prior as-of engine could handle a single correction, revocation and rival CEO claimant. This checkpoint adds a complete manager-facing correction/revocation workflow and a graph-based chain resolver that **never resolves ambiguous historical claims by choosing the latest notice**.

### Application
- `apps/cooperative-management/app/legal-notice-archive/NoticeTransitionManager.tsx`: accessible Persian RTL source selector; correction or revocation action; target and replacement (for correction), claimed effective date, optional publication date, source reference; append-only submission; read-only transition timeline and prominent unverified legal status.
- Existing `apps/cooperative-management/app/legal-notice-archive/page.tsx` embeds the new form under the existing full registered/Gazette notice import interface.
- New manager session BFF `apps/cooperative-management/app/api/tenants/[tenantId]/notice-transitions/route.ts`: strict tenant UUID, server-side cookie session, source allowlist, fail-closed upstream flags, JSON size/type checks, CSRF Origin checks. In CI standalone, comparison against operator-pinned `TTO_PH12_PUBLIC_ORIGIN` avoids request-URL rewriting without trusting arbitrary Host headers; this lab-only path is gated by `CI`, loopback flag and no Vercel. It is explicitly development-only. Anonymous, invalid-origin and invalid-ID writes are denied.
- Nest `GET /v1/tenants/:tenantId/child06/notice-transition-catalog` via role-bound `tto.cooperative_notice_transition_catalog()`; `POST /notice-transitions` continues the existing immutable append-only record. Only authenticated cooperative manager role can list the manager catalog; no raw table grants.
- New migration `database/migrations/0056_child06_notice_transition_catalog.sql`: tenant-scoped bounded list of notices and transition references, with fixed `sourceAuthenticated:false`, `legalSigningPowerGranted:false`, `tariffActivated:false`. `tto_app` has execute-only access.
- `services/api/src/governance-temporal.ts`: graph-based correction chain projection, with explicit guards for a successor not yet published, consecutive A→B→C corrections, multiple active corrections from A (fork), multiple predecessors to same C (merge), and directed correction cycles. Conflicted connected components are quarantined; their members are not silently projected as definite current signers/board.

### Behavior and limitations
- Time remains bitemporal: declared Jalali effect/publication date plus `knownAt` UTC persisted timing. Unpublished correction cannot silently suppress its target. Missing publication becomes HOLD, not legal inference.
- Correction/revocation is an **immutable source claim**. Two conflicting source claims may both be stored for audit; the temporal projection identifies conflicts and returns `CONFLICT_HOLD`. Nothing grants voting, CEO authority, signature authority, official source verification or tariff activation.
- App is designed for future official documents. Synthetic chain nodes `CI-CHAIN-*` are fictitious. The user-supplied Torghabeh-Shandiz company’s business ID, board and CEO notice remain **source-supplied** and legally unverified; no fake correction is attributed to that real cooperative as an actual registered event.
- The test checks one shared PostgreSQL authority with simulated branch/merge/cycle claims; there is no claim of regulator-approved historical adjudication, complete archival backfill, or operational/legal readiness. The new manager form is development-gated, not deployed.

## Acceptance: actual GitHub Actions
| Check | Final outcome |
| --- | --- |
| [Dedicated PG17 78-migration/typecheck/SQL/lab checks](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42482547392) | SUCCESS; `PH12_LEGAL_SOURCE_DISPOSABLE_PG17_SCHEMA_PASS count=78` |
| [TTO adaptive full build + Nest/Next/PG17 E2E](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42482547389) | SUCCESS; `TTO_CF02_IDENTITY_MANAGER_NATIONAL_E2E_PASS_CHECKS=412` |
| New real HTTP marker | `CHILD06_CHAIN_FORK_MERGE_CYCLE_MANAGER_BFF_REAL_NEST_PG17_PASS` |
| Prior bitemporal E2E | `CHILD06_GOVERNANCE_BITEMPORAL_CORRECTION_REVOCATION_CONFLICT_REAL_HTTP_PG17_PASS` |

**Verified CI head:** `c417728b061473649229e08ce4e94545981f6d78`.

The first attempt of full E2E found a wrong `Origin` match under Next standalone's loopback URL rewriting; it was fixed by comparing the submitted origin to the **operator-pinned local public origin** (never a user-controlled Host). Success is reported only from the final rerun.

## Open release/legal boundary
- Authentic original company registry and Gazette identifiers/files, source publication dates and issuer-bound legal authority remain **HOLD**.
- PH12 real legal acceptance **HOLD**, tariff `ACTIVE` **BLOCKED**. CI mocks have no effect on production entitlements, cooperative financial operations or share ledger.
- This has no Merge, Deploy, production DB migration, real issuance, share transfer or financial transaction.

**Decision:** `CHILD06_CORRECTION_UI_AND_GRAPH_CI_GREEN`, `PH12_REAL_LEGAL_HOLD`, `TARIFF_ACTIVE_BLOCKED`, `PR172_DRAFT_UNMERGED`.
