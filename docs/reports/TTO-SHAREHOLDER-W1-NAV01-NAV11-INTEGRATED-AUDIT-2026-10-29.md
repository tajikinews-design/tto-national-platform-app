# TTO W1 NAV-01…NAV-11 — Integrated Audit & Traceability
Date: 2026-10-29
Branch: audit/shareholder-nav01-nav11-integrated-20261029
Baseline: 93cef2172cb0f3c6a5086823c08ac73b58a2a127 (accepted synthetic NAV11)
Status: CODE REVIEW/REPAIR COMPLETE — NEW EXACT-SHA LOCAL RELEASE AND VISUAL QA PENDING

## Authoritative sources
- TTO-NAVIGATION-INFORMATION-ARCHITECTURE-v1.0: 11 root entries (APPROVED)
- TTO-UNIFIED-IMPLEMENTATION-PACK-v1.0: 23 Child specifications and source-boundary contracts
- docs/analysis/NAVIGATION_CONTRACT.json: NOT_IMPLEMENTED, all 11 REVIEW_SHELL_ONLY, authorized routes/permissions null
- docs/reports/SHAREHOLDER_ARCHITECTURE_CONSOLIDATION_PHASE4C_4G_2026-10-27.md: synthetic-only UI GO; real identity/holdings/trades/settings gated
- packages/ui/src/shareholder-navigation.ts: canonical 11 display labels
- SHA-pinned NAV10/NAV11 local Docker/Chromium and human visual acceptance: prior evidence, not transferable to modified SHA

## Findings
| ID | Severity | Evidence | Resolution | Verification |
| --- | --- | --- | --- | --- |
| W1-F01 | HIGH | NAV04 SIDE_MENU had empty href for NAV10 and NAV11 | Replaced with /review/interactive/nav-10 and nav-11; no page geometry change | Python cross-nav + private Chromium |
| W1-F02 | HIGH | NAV01 synthetic-dashboard navPath mapped NAV10/11 to /review/nav-10, /review/nav-11; NAV01 itself to /review | Uniform /review/interactive/nav-XX and /review/interactive for NAV01 | Python cross-nav + private Chromium |
| W1-F03 | MEDIUM | Shared TSX parser gate stopped at NAV09 | Added NAV10 and NAV11 TSX and fixtures to source syntax inventory | Node/TypeScript parse in Docker Release |
| W1-F04 | MEDIUM | No single release-gated 11-route cross-link test | Added integrated Python audit and private four-viewport Chromium, Release-runner hook | Exact-SHA Docker Release PENDING |
| W1-F05 | TRACKED | NAV01–NAV03 have earlier layout and navigation variants; NAV04–NAV11 share later shell | No sweeping redesign: keep accepted baselines and document variation | Visual cross-section review after release |
| W1-F06 | BLOCKER FOR LIVE | NAVIGATION_CONTRACT implementation_status NOT_IMPLEMENTED; permission_policy and authoritative_routes null | Leave routes review-only. No server authorization falsely asserted | Require separate per-tenant permission/version gate |
| W1-F07 | BLOCKER FOR LIVE | Child06 / Child07 source authority, Child01 session and legal authorization, NAV10 private report and NAV11 settings mutators unresolved | No live source, payment, PDF, OTP/MFA or account commands added | Independent source/legal/security approvals |
| W1-F08 | TRACKED | Repeated sidebar ROOTS in NAV05–NAV11 and SIDE_MENU in NAV04 may drift | Cross-nav regression gate added; shared-component refactor requires future design approval | Automated regression |

## Traceability matrix
| Navigation | Screen | Primary source owner | Integrated review capability | Live gate |
| --- | --- | --- | --- | --- |
| NAV01 داشبورد | /review/interactive | Child06/07/09 projections | synthetic read states | Source owner + tenant and user authorization |
| NAV02 سهام و عضویت من | /review/interactive/nav-02 | Child06 + Child07 | separated membership/holdings mock | independent membership/ledger verification |
| NAV03 خرید و فروش سهام | /review/interactive/nav-03 | Child07 + Child05 | demo sale/buy steps | legal Rule Registry and payment direct transfer |
| NAV04 مجامع و انتخابات | /review/interactive/nav-04 | Child08/09/03 | synthetic assembly document states | statutory governance/notice source |
| NAV05 اخبار و ارتباط با شرکت | /review/interactive/nav-05 | Child09 | synthetic publisher states | audience and publication permission |
| NAV06 خدمات من | /review/interactive/nav-06 | service domain and Child06 | synthetic request catalog | eligibility and service source |
| NAV07 فروشگاه و فرصت‌ها | /review/interactive/nav-07 | Child16 and Child18 | synthetic commerce | source-backed authorized seller/order |
| NAV08 پروژه‌های شرکت | /review/interactive/nav-08 | Child12 | synthetic project | approved scope-specific disclosures |
| NAV09 شفافیت و اسناد شرکت | /review/interactive/nav-09 | Child11/03 | synthetic versioned disclosure | publication and doc/download rights |
| NAV10 گزارش‌های من | /review/interactive/nav-10 | Child03/05/06/07/14/15/16/22 | eight canonical synthetic reports | own records; no data != 0; PDF separate right |
| NAV11 تنظیمات حساب | /review/interactive/nav-11 | Child01/02/03/05/09/22 | ten canonical synthetic settings | authorization, reauth, CSRF/session/device policy |

## Release acceptance (new SHA only)
- Static 11-label/11-route and NAV04 & NAV01 broken-link regression test PASS from log
- NAV03–NAV11 prior browser tests PASS on NEW SHA, plus integrated 11-route four-viewport browser PASS
- local Docker full Release PASS on exact candidate SHA
- no external requests, no writes, no horizontal overflow in integrated browser
- screenshots reviewed, layout differences documented, no unintended regressions
- source of truth not bypassed; no merge/deploy, real permission gates remain BLOCKED

## No-go controls
No route in /review is authoritative or an operational permission grant.
Never mark legal source, payment, ledger, personal data, download, user settings, or production deployment green via synthetic-only tests.
No wallet/custody/general accounting; no test deletion to produce a false green.
