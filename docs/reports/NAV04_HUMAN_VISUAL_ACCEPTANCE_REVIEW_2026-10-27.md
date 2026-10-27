# NAV-04 — Human screenshot review against approved 1536×1024 reference
Date: 2026-10-27
Reviewed candidate SHA: a53b487c0fb0d54700306d5f36665fad89930fa6
Source: User-uploaded, SHA256-verified Chromium viewport images `nav04-1440.png`, `nav04-768.png`, `nav04-390.png`, `nav04-320.png`.
Approved visual reference: `a_wide_high_resolution_ui_ux_mockup_dashboard_scr.png`, 1536×1024.
Status: TECHNICAL LOCAL RELEASE PASS FOR THIS SHA; VISUAL ACCEPTANCE FAIL/PENDING; DO NOT MERGE OR DEPLOY.

## Technical evidence
- Local Release pass: `TTO_LOCAL_RELEASE_PASS_SHA=a53b487c0fb0d54700306d5f36665fad89930fa6`
- NAV04 Chromium PASS: 4/4 viewport checks, 126/126 checks; NAV03 visual 4/4, 70 checks. Hashes of uploaded PNG files verified by user against test report.
- 1440px screenshot shows no apparent horizontal overflow. On mobile (390px and 320px), content fits the width; remaining content requires vertical scroll, which is normal.
- Source disclaimer, DEMO mode and disabling legal/voting/publishing actions are intact.

## Visual deviations from approved mockup
**Blockers (P0 for pixel/design acceptance):**
1. Main meeting image: approved photograph of a real meeting room vs implemented synthetic CSS illustration. This is a material reference-asset mismatch.
2. Meeting hero: approved full metadata row (date/time/place), colored assembly-type and invitation badges, separate attendance-confirmation area with status and dedicated action buttons; candidate lacks corresponding visual structure and displays an empty/unavailable countdown. Do not fake legal attendance: reproduce visual affordance with disabled/demo-only treatment, until authorized data exists.
3. Navbar/topbar: approved logo and name lockup, selected cooperative selector, message/notification icons, user identity block. Current version shows a different logo treatment, generic search placeholder, no cooperative selector/notification parity, different sidebar labels/styles.
4. Document/notice cards: approved reference has four documents and four notices with dated rows, PDF/status badges, colored chips, navigation links, while candidate has fewer synthetic items, text-heavy rows with DEMO badges and lacks the approved row density. Do not fabricate actual legal records; use clearly labeled demo fixtures only.

**Other differences (P1):**
5. KPI cards visually differ in iconography, action links and secondary labels; candidate includes '—' instead of approved numeric demo count on action card, which is truthful but mismatches mockup.
6. Four lower action tiles in reference include labels/details and distinctly styled chevrons. Candidate screenshot at 1440×900 cuts off the final row because of viewport height; obtain a 1536×1024 and fullPage screenshot to compare it.
7. Typography weights, spacing, cards and background largely follow the direction but not pixel parity.
8. Tablet header and 320px mobile search area are crowded. Mobile layout is readable and no horizontal overflow is visible, but needs attention to text density.
9. The approved screenshot is at 1536×1024 while tested desktop PNG is 1440×900; a pixel-by-pixel comparison is not valid without same-viewport captures.

## Acceptance gates
- Keep NAV04 visual status `NOT_ACCEPTED`; local technical Release `PASSED @ a53b487c` only.
- Fix first the mismatching photo and information hierarchy on isolated review branch; do not change currently accepted NAV01–03 baselines. Keep fake records distinct from approved legal status.
- Re-run local exact-SHA Release after any change; prior success cannot carry forward to new head.
- Capture 1536×1024 AND four existing responsive viewports, fullPage where appropriate; human compare all sections and approve explicitly.
- Keep PR #47 Draft, no merge/deploy, no real source/attendance/voting/transactions.

This review records visual evidence; it is not evidence of lawful assembly/publication, share ownership or statutory election authority.
