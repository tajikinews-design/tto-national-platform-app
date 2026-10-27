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


## QA follow-up, 2026-10-27
- Verified current branch source through the GitHub connector: 37/37 structural/source-policy checks PASS. These are **not browser execution results**.
- Hardened the existing real Chromium runner at `scripts/e2e-shareholder-nav04-review.cjs` with assertions for the approved overview, four status cards, four information panels, four actions, eleven menu entries and global RTL in each of 1440x900, 768x1024, 390x844 and 320x740.
- Existing test continues to check default denied state, opt-in demo, keyboard interaction, disabled legal actions, external requests and horizontal overflow.
- GitHub Actions attempt on branch was reported as FAILED, with no successful exact-SHA test evidence or retrievable logs from that run. Vercel shareholder preview was blocked by a build-rate-limit status. Neither should be counted as a browser pass.
- The assistant runtime has Chromium installed but cannot reach or clone this private GitHub repository from its container. Therefore an **exact-source Next.js build and screenshot comparison has not been conducted**. No pixel-match or local acceptance claim is made.
- Run the existing isolated repository `-Suite Release` script at the final exact branch SHA from a trusted local worktree. The script emits `TTO_LOCAL_VISUAL_QA_PATH` containing screenshots and `TTO_LOCAL_RELEASE_PASS_SHA` only after all required checks succeed. Review saved screenshots visually against the three approved master dashboard images and the approved NAV04 mockup.

## Final static source readback
- After the 17.4vw sidebar adjustment, 37/37 current-branch static contract checks passed on the then-current source. This does not verify running Next or Chromium. Three approved reference images have pixel size 1672x941; approved NAV04 mockup 1536x1024. See local QA status report for acceptance caveats.
