# NAV-04 PR48 — Visual correction and revalidation handoff

Date: 2026-10-28
Status: **CHANGES COMMITTED / STATIC CONTRACT CHECKS PASS / EXACT-HEAD LOCAL RELEASE PENDING / HUMAN VISUAL APPROVAL PENDING**
Scope: Shareholder review-only synthetic assemblies page. Parent branch `feat/shareholder-nav04-approved-visual-20261027`.

## Corrections on this Draft branch

### 1. Approved meeting photograph
- Replaced `apps/shareholder/public/nav04-approved-meeting-demo.webp` with a fresh source-resolution **308 × 221 px** crop of the actual approved 1536 × 1024 design screenshot.
- Previous overcompressed image was about **2658 bytes**; new source-native WebP is **6516 bytes** (Git blob `0dd2ee1db87f7f92c74ae51d6aaf801dfe45bd33`). Do not claim this invents detail absent from the approved screenshot. A higher-resolution original source photo would be needed for more detail.
- The original approved mockup, NAV01–03 baselines, and their stored images were not altered.
- Python fixture check now rejects assets <=6000 bytes; Chromium checks nativeWidth >=300 and nativeHeight >=220.

### 2. Typography and brand/header
- Increased desktop/mobile headline, subtitle, side-nav and notice row legibility, while retaining the existing repository font stack.
- Replaced the visual stand-in glyph with an inline four-panel blue/teal/green SVG brand mark. This is a reference-like recreation, **not a claim of exact official logo parity**; review against the official project branding and replace with original brand asset if necessary.
- Tightened the 320px cooperative selector/mobile menu and preserved keyboard focus visibility.

### 3. Reviewer tools separated from approved overview
- Preserved `UNVERIFIED` default and explicit `DEMO_CONTENT` opt-in before any synthetic meeting cards appear.
- Kept the source selector as a compact review bar; moved the secondary demo hero, legal gate explanations, six synthetic record/detail filters and disabled legal action buttons inside a collapsed `ابزار بررسی توسعه‌دهنده` section.
- The dev details are **not removed**: accessible toggle opens the same existing test UI, with legal gates still read-only.
- Updated private-loopback Chromium test to assert developer panels are collapsed at screenshot time; it opens them only for keyboard/filter/source-loss interaction tests. Added 1536px full-page compact-height check (<1600px).
- Updated Python static-contract regression checks.

## Evidence already available
- Prior PR48 local Release PASS at SHA `12f39d35a2338de6a4b5756c9f37a3475b85ec8b`: NAV04 200 checks, five viewports; other portal and security tests. **That PASS is for the old version only**.
- This change set: 29/29 source guard checks PASS (as inspected from current branch after the layout changes), native photo Git blob size 6516 bytes verified via Git tree.
- Vercel preview at earlier feature commits reported READY, but Deployment Protection blocks unauthenticated visual inspection; GitHub Actions run failures do not count as acceptance.
- **No successful local Release, actual Chromium screenshot, pixel comparison or explicit visual sign-off has been produced for this new head.**

## Next exact-SHA verification
Use `scripts/ci/run-nav04-pr48-approved-visual-release.ps1` from the current PR48 branch. It fetches remote head, creates an isolated worktree, requires the exact expected SHA, invokes the existing disposable-PG17 Docker Release suite, independently checks each of five viewport PNG SHA256 values against Chromium's JSON report, and exports a ZIP in Downloads.
Do not reuse prior screenshots or log PASS. Compare the 1536×1024 full page and 1440/768/390/320 viewport outputs against the approved reference. If any mismatch remains, correct and retest the new exact head.

## Hard boundaries
Draft/unmerged only. No production app or canonical navigation registry changes. No new API, database, migrations, auth, real invitations, legally binding attendance/proxy/candidacy/voting/results or official document publication. External authorization and release gates remain blocked.
