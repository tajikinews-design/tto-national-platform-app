# TTO-PCS-002 — Draft PR integration audit and safe candidate plan
Date: 2026-11-01 | Evidence: GitHub REST /pulls, tree at W2.14 SHA, branch ancestry from PR base/head. Scope: READ-ONLY investigation of application code, documentation-only deliverable.

## Proven inventory
- Open at snapshot: 81 Draft PRs incl. PCS #85. Main HEAD 9eb48b7f06c25e66021adbe0b4386133cdcb3039 (README-only).
- App chain #1 to #84: 80 open Draft PRs with a single root PR #1 to main. PR #84 head a5e211ec9933055657055d2bf64712d558fe6c0e is a **candidate**, not an accepted integration baseline.
- Following actual PR base/head names from #84 to #1 traverses **76** PRs. Four open side PRs **not on that ancestry**: #43 and #44 (NAV03 browser QA, NAV04 UI/visual tests), #64 (offline Vazirmatn font pin fix), #73 (alternative W2.4 journal). Their changes may have been reimplemented downstream, but cannot be considered incorporated without explicit diff/test review. Do not merge blindly.
- Branch points: #42 -> #43 versus #45, #63 -> #64 versus #65, #72 -> #73 versus #74. Branch naming and numeric PR order alone are not evidence of inheritance.
- Candidate #84 Git tree: 436 files; apps 111, scripts 134, docs 106, database 11, services 21, packages 17; includes 3 Next portals, Nest API, migrations 0001..0010 and review-only NAV01..NAV11.
- Historical W2.14 exact SHA run 41298703121 success with six Docker/SQL/OCI stages skipped; it does NOT verify production E2E or validate all integrated real PostgreSQL paths.
- Existing control PR #85 from main contains project-control registers only and must not be mistaken for the app codebase.

## MVP reuse decision matrix
| Scope | Reuse | Evidence and work remaining | First release gate |
|---|---|---|---|
| 3 Next16 portals and shared RTL/Vazirmatn UI | KEEP / VERIFY | Next code and mock nav paths exist; verify shared font and accessibility on integrated SHA | actual 3-portal build, responsive keyboard check |
| Nest11 API, PG17 RLS, migrations 0001..0010 | KEEP WITH AUDIT | actual API code and migrations exist; schema not 23-domain completed | full disposable PG migrations, RLS-negative and Next/Nest HTTP |
| Session/OTP tenant context | KEEP WITH HARDENING | historical ephemeral integrated E2E; live hosting and provider checks unavailable | revocation, cross-tenant and real protected test environment |
| NAV01..NAV11 shareholder review screens | KEEP AS DESIGN ASSETS | synthetic routes explicitly noindex/review; not operational sources | accessible mobile RTL and feature-specific signed-off integration |
| Cooperative-management portal | EXTEND, NOT REBUILD | generic PortalModulePreview module pages | manager source-admission/approval workflow, role/audit |
| National portal | DEFER FULL DOMAIN | generic PortalModulePreview | safe aggregated monitoring after source model |
| Child06 membership + Child07 shareholding BFF | REUSE CLOSED BOUNDARIES | candidate endpoint signatures and validators; source/legal ownership not approved | source provenance, scoped identity, negative read tests |
| Child07 case and Child09 notices | KEEP CLOSED | trade/notices candidate GETs deliberately deny; no official feed approved | legal publisher, audience and case source decisions |
| NAV03 trade state model | KEEP DESIGN, NOT ACTION | 21-state review sample; no real share transfer/payment | approved rules and authorized ledger |
| W2.7–W2.14 offline experimental fencing | ARCHIVE AS SAFETY EVIDENCE | useful synthetic regressions but no proven cross-process real effect | focus review on actual feature risk; keep in separate test suite |

## Mandatory tests to retain (not claimed re-run by this audit)
- Node/pnpm install reproducibility, TypeScript checking and all three Next/Nest builds.
- Real ephemeral PG17 apply all 10 migrations, fail-closed nonowner role and tenant isolation/RLS.
- Three-portal login/logout/OTP fake-provider E2E, anti-replay, rate limits and cookie/session revocation.
- Cross-tenant, wrong actor/Party, forged browser headers, unauthorized member/holdings/trades/notices negative API tests.
- Protected reviewer preview SSO and authorized reviewer browser acceptance; responsive RTL keyboard/contrast.
- Eleven NAV review routes and their no-data/no fake holding assertions; legal prohibition on preview POST/trading.
- W2 offline synthetic tests remain supplemental. Never replace the DB+HTTP suite with W2 synthetic-only green.

## Defects / risks requiring remediation
1. Main is documentation-only; no integrated app release baseline, and #85 PCS docs diverge from #84 app candidate.
2. Four side PRs are not ancestors of #84. Compare individual patches against candidate, classify equivalent/superseded/unique before merge closure.
3. Decision and phase-gate documents contain stale states relative to later PR CI; regenerate evidence map, do not overwrite provenance.
4. Tenant and legal source for live membership/shareholding not approved; no real share trades, money or uploads allowed.
5. Cooperative and national operational modules are still generic preview shells.
6. No exact-SHA final full test of consolidated candidate yet, and no approved pilot or data owner.

## Safe proposed baseline approach (NO MERGE authorized)
A. Review PR #85 control docs separately and accept a versioned docs baseline only after approval.
B. Freeze W2.14 head SHA as *candidate for comparison*, NOT target for blind merge.
C. Independently inspect #43, #44, #64, #73 patches: cherry-pick only unique fixes with verified static and runtime tests; avoid importing duplicate synthetic features.
D. Create a new integration candidate branch from the reviewed final app candidate, and selectively reconcile control docs from PCS. Do not merge main or PR chain as a side effect.
E. Exact-head run full disposable-db + HTTP/RLS/OTP, typecheck/build, reviewer preview and visual tests. Record PASS/FAIL/SKIPPED per step. Require product, data and legal source signoff before accepting Wave-0 G3.
F. First MVP vertical slice: approved cooperative membership -> authorized Child06 source -> separate official Child07 ledger -> BFF scoped own read -> shareholder NAV02. No data authorization means remain BLOCKED, do not invent records.

## Gating status
PCS-002 DOCUMENTED / REVIEW REQUIRED. Wave-0 IN_PROGRESS, Wave-1 BLOCKED, Wave-2/3 NOT_STARTED. This audit does not execute code tests or approve production.
