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

## Follow-up build blocker remediation and protected-browser status (2026-10-27)
- Identified a **real** Next.js/Turbopack CSS parsing failure in the stacked NAV03 case-demo stylesheet `apps/shareholder/app/review/interactive/nav-03/case-demo/case.css` from Vercel build log on deployment dpl_9NnkKXGrbY6yXBEZhYzydPWuxexG: literal backslash-n characters caused `Unexpected end of input`.
- Replaced the five literal escaping sequences with actual line breaks on **this PR47 review branch only**; prior locally accepted NAV03 commit was not modified. Added a regression assertion `test_nav03_preview_css_has_no_literal_newline_escape`.
- Follow-up shareholder Vercel **Preview** for commit `1a14fe04d40ec0fcc15ced36bfbaf3eead2da11e` is reported **READY** (deployment dpl_EkAksKfkKkrvpvo5akdF4CrggYzw). This validates the Build gate at that commit, not the latest PR head and not Release.
- Read-only browser tried to navigate to that deployed preview's `/review/interactive/nav-04`, but Vercel Deployment Protection redirected to **Log in to Vercel**. No authenticated app DOM, screenshot or interaction result could be obtained. Do not disable or bypass security to fake success.
- Added in-repository exact-source local QA helper `scripts/ci/run-nav04-approved-visual-release.ps1`, fetching remote branch head, isolating Git worktree, enforcing exact-SHA Docker Release and disallowing auto-merge/deploy. A separate v2 helper with screenshot integrity requirements was also delivered alongside the conversation.
- Current status remains **BUILD FIXED ON CHECKED PREVIEW COMMIT; BROWSER VISUAL / EXACT HEAD RELEASE / HUMAN ACCEPTANCE PENDING**.

## Reference-specific layout correction and final browser-acceptance blockers — 2026-10-27

- Compared source composition against the user-approved 1536×1024 NAV04 screenshot (a_wide_high_resolution_ui_ux_mockup_dashboard_scr.png). This **NAV04-specific** reference takes precedence over general dashboard proportions for that screen.
- Fixed screenshot-inconsistent composition on the draft: right navigation track roughly 12.25% at 1536 viewport, feature-card media at left, information at center and countdown at right in desktop RTL. Responsive tablet/mobile layouts explicitly reset grid positions.
- Fixed visual quick-action order: results → candidacy → proxy → assemblies, right to left. Fixed secondary H1 duplication and put the approved summary overview before reviewer/legal diagnostic panels.
- Extended the real Playwright contract to assert rail position, meeting media/info/counter geometry and action sequence on desktop, tablet and mobile.
- Verified source readback: 16/16 focused static requirements passed. **Do not report as executed Chromium or pixel parity.**
- Remaining visible difference: the present feature tile is a CSS-rendered meeting-room illustration rather than the approved screenshot's actual photographic meeting room. Full pixel-accurate result must keep status UNAPPROVED until that asset/design discrepancy is resolved and human-reviewed.
- Current PR47 head has GitHub CI FAILURE; no successful exact-SHA Docker Release or screenshot artifacts. Preview READY at an **older** SHA is not head acceptance.
- Vercel preview login protection was confirmed read-only; do not disable protection or create public bypass links to force browser execution.
- The executable exact-SHA isolated local runner lives in scripts/ci/run-nav04-approved-visual-release.ps1; it does not automatically approve, merge or deploy. Once run in the authorized local worktree, confirm TTO_LOCAL_RELEASE_PASS_SHA equals the tested commit and inspect SHA-tagged screenshots visually.

**STATUS: REVIEW IMPLEMENTED / LOCAL RELEASE NOT ACCEPTED / PIXEL MATCH NOT VERIFIED / LIVE RIGHTS AND SOURCES BLOCKED.**
