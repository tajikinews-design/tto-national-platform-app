# NAV-04 — Approved visual page implementation handoff
Date: 2026-10-27
Status: AUTHOR-WRITTEN / STATIC-REVIEWED / EXECUTION-PENDING / DRAFT / NOT MERGED

## Scope and parent
The user approved the proposed shareholder "مجامع و انتخابات" screen with three dashboard reference screenshots. Approved dashboard originals have not been edited.
Parent: Draft PR #46 at cc5b4f8c9c359c2463b47da053df893b821e69e7 (which is stacked on pending NAV03 Chromium QA PR #45).
Changed the synthetic NAV04 component and CSS, added one Python unittest contract and this report. No API, database, statutory authority integration, auth/session, canonical registry, or production page changed.

## Implemented
- Right-to-left approved visual structure: branded right sidebar with 11 canonical labels, header, assembly feature panel, four KPI-like demo cards, four information panels, four navigation/action tiles.
- Known existing preview paths for first four sections only; others are displayed but non-clickable, so no unimplemented routes or powers are suggested.
- UNVERIFIED is default; SOURCE_UNAVAILABLE remains fail-closed; only explicit DEMO_CONTENT reveals six fictional fixtures.
- Demo card counts are computed from synthetic categories. Missing official date shows no real countdown.
- Existing independent list/filter/detail and disabled vote, attendance, result publication and document controls are preserved.
- No actual invitation, voting, proxies, candidates, polling, signed minutes, PDF, legal quorum or official results.

## Evidence observed
Static source/readback: 13 of 13 cross-file sanity checks PASS (gating, source-state, disabled actions, navigation labels, overview sections, responsive CSS and absence of outbound request APIs).
A new Python test file includes 5 tests, automatically discovered by existing test_*.py runner.
Not executed: Python tests, TypeScript AST, Next build, real Chromium 1440/768/390/320 screenshot tests, pixel fidelity comparison, Docker Release PG17, operational source integration.
Mockup visual approval is NOT a Release acceptance.

## Next required local QA gate
Run isolated exact-SHA local Docker Release suite and Chromium NAV04 review using repository scripts; inspect screenshot PNGs manually versus the approved references. Verify no horizontal overflow, no external calls, keyboard interactions and no source leakage. Keep draft/unmerged and no production deployment until local acceptance and separate operational/legal authorization.

Source of authority remains NAV Architecture, Child08 Governance & Assemblies and the consolidated Legal Gate Register. This report does not alter them.
