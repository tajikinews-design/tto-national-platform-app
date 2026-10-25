# Phase 3b — Shareholder visual QA corrections (2026-10-24)

## Scope and immutable boundaries

Base snapshot: `4385b468e10e0707071b131a537d1f2194e29ee5` (PR #28).
This work lives in the independent branch `feat/shareholder-review-visual-qa-phase3b`; it does **not** merge PR #28 or modify `main`, any hosted/production database, operational trade logic, authentication, or Vercel SSO.

## Findings addressed

| Original acceptance concern | Change | New acceptance evidence |
| --- | --- | --- |
| P1 — Mobile deep-link can show an offscreen active horizontal menu item (especially NAV-11) | Client-side `useEffect` uses `scrollIntoView` on the currently selected navigation link, limited to viewports at most 760px | At 390px, browser checks the active menu item's bounding box lies fully inside the horizontal navigation for all 11 pages |
| P1 — Small low-contrast supporting text | Higher-contrast foreground `#465a70` and improved text sizing, including inactive tabs and card descriptions; explicit keyboard-focus indication | Browser computes and asserts >=4.5:1 contrast for designated normal supporting text |
| P2 — Only default tab visible in prior 22 screenshots | New `scripts/ci/review-phase3b-browser.cjs` captures default, journey, access on each 10 detail pages, plus both dashboards, at desktop and mobile | 62 screenshots and per-tab selection/visibility assertions |
| P2 — Very long single-column mobile dashboard | More compact spacing of cards without removing information or interaction | Inspect the new `mobile-nav-01-dashboard.png` manually against the previous baseline |

## Local execution, not GitHub Actions

1. Fetch the exact branch, record its SHA, and verify the repository origin and clean worktree.
2. Invoke `scripts/ci/run-review-phase3b-docker.ps1` with `-Repository` and `-ExpectedCommit` from an isolated Windows PowerShell process with `-ExecutionPolicy Bypass`.
3. The runner archives **only committed source** into a separately labeled volume and builds `@tto/shareholder` with Node 22 and pinned pnpm in Docker. A preview server listens on `127.0.0.1:32155` only. No PostgreSQL is created, read, or modified.
4. The isolated Playwright Chromium image `mcr.microsoft.com/playwright:v1.56.1-noble` loads `/review` and 10 detail URLs in desktop 1440×900 and mobile 390×844. External origins, API routes and non-GET requests are blocked and detected.
5. Review output: `D:\TTO-Phase3B-Visual-Reports\phase3b-report.json`, `phase3b-report.md` and 62 PNGs. Do not describe this gate as PASS until the user's local terminal contains `TTO_PHASE3B_LOCAL_BROWSER_PASS_SHA=<the new reviewed SHA>` and the report validates all 62 screenshots with zero errors.
6. Human visual inspection of the 62 new screenshots remains a distinct acceptance step, in particular all mobile active-menu positions, text legibility, keyboard focus and tab states. A green browser run is not equivalent to final legal/product approval.

## Security and product constraints

This is a **review-only, nonoperative** prototype. No user profile record, holdings, financial numbers, shareholder trade execution, or administrative accounting is displayed or operated. Regulatory approvals, identity/tenant isolation and real Child06/Child07/Child09 source authority remain separate implementation gates.

## Pending

- New SHA local Docker release and full 62-screen browser run.
- Screenshot-based human acceptance at the new SHA.
- Hosted CI only after GitHub account usage restriction is lifted.
- No merging until explicit approval.

## Screenshot audit — 62-image handoff

The user-provided `TTO-Phase3B-Visual-Review.zip` contains 62 PNG images plus `phase3b-report.json` and `phase3b-report.md`. Its self-reported source is `abb8a5c531f38de1c16595e8df092ddd2ed00846`. ZIP integrity: valid. JSON gate: 530 checks PASS, 62/62 screenshots, zero reported failures. The archived screenshot set was manually reviewed for desktop and mobile, including all three tabs for each of ten detail pages.

**Confirmed improvements:** page-specific headings and descriptive flows render across all modules; mobile current navigation selection is brought into the horizontal menu; contrast is improved; trade controls remain explicitly non-operative; all three tab states are present in screenshots.

**Remaining visual issues observed at the reviewed SHA:** mobile `mobile-nav-03-overview.png` and `mobile-nav-04-overview.png` clip portions of the active horizontal menu label at the left screen edge even though its clickable element passed bounding-box assertions. The 390px tab strip also cuts off an inactive tab title in screenshots such as `mobile-nav-11-overview.png`. Browser assertions on the containing element were insufficient to detect its overflowing child label.

**Corrective follow-up on the same Draft PR branch:** size mobile nav links and their labels by text content, display the three mobile tabs in equal-width wrapping columns, and enforce that the active label itself and all three tabs fit inside their respective viewports. Add static assertions for these rules.

**Gate interpretation:** Phase 3b revision `abb8a5c5` receives AUTOMATED ACCEPTANCE PASS, HUMAN VISUAL ACCEPTANCE CONDITIONAL. The corrective follow-up needs a new exact-SHA Docker/browser run and fresh screenshots before it can receive final visual approval. Do not merge based solely on previous results.

## Phase 3b follow-up — RTL mobile navigation stabilization and screenshot attestation (2026-10-25)

The exact-SHA local Docker/Chromium gate for `e1fc9ff048bb637e022f2150686da1f1afc40961` returned **540 assertions PASS, 62/62 full-page screenshots and zero automated errors**, but subsequent visual inspection of the uploaded screenshots still found cropped selected-menu text in several 390px images.

**Implementation correction:** change the mobile-only active-menu centering from `element.scrollIntoView` to scrolling the **navigation container only** by the physical-center pixel delta. Run once on animation frame and again after `document.fonts.ready` so font substitution cannot invalidate alignment. Disable competing horizontal scroll-snap in the mobile navigation. No operational flow, authentication, database access, or trade feature is introduced.

**New evidence at the NEXT SHA:** retain exactly 62 normal full-page images, plus 22 **viewport-only** mobile diagnostics saved under `diagnostics/` (before and after full-page captures for 11 routes). `phase3b-report.json` includes `mobileNavDiagnostics` per route: `navRect`, `activeRect`, `labelRect`, `scrollLeft`, widths, and visibility recorded before and after screenshots. The browser gate fails if the active link/label becomes clipped after a full-page screenshot, even if it was visible before capture.

**Acceptance:** rerun Docker at the new exact SHA, check 62 full-page + 22 diagnostic PNGs, and visually inspect the mobile NAV-03, NAV-04, NAV-07, NAV-08, NAV-09, NAV-10, NAV-11 before/after pairs. A green automated result alone still does not close the human visual audit. No merge until explicit approval; PR #28 and PR #29 remain Draft.
