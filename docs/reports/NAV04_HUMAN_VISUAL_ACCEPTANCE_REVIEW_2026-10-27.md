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

## Visual remediation pass — 2026-10-28 (DRAFT, no runtime acceptance)

- Replaced hand-drawn room illustration with an optimized image crop of the **user-approved reference meeting room**. Added as `apps/shareholder/public/nav04-approved-meeting-demo.webp` (Git binary blob sha `4663ca8351bbbdf47e0fa5d2d46a23d81b395f7b`). It is a demo background, NOT evidence of a conducted assembly.
- Rebuilt the assembly hero composition: same photo region, next-assembly label, assembly type, invitation status, date/time/location, attendee status band, detail shortcut and explicitly disabled attendance control.
- Matched header semantic slots: sample cooperative selector, message/notification placeholders and shareholder sample identity. Preserved 11 canonical product navigation roots; they must NOT be swapped for UI-mock-only labels.
- Added four explicitly fictional document rows and four fictional notice rows to mimic approved density. All remain visible **only after DEMO_CONTENT opt-in** and are not actual downloadable PDF links or legal publications.
- Reworked panel spacing, card sizes, badges, color hierarchy and desktop/tablet/mobile wrapping. Kept historical legal gates, source denial, fixture count (6) and disabled vote/publishing controls unchanged.
- Extended executable Chromium review to include an exact **1536×1024 full-page** screenshot alongside 1440, 768, 390 and 320 widths (5 viewports), and test loading of the approved photo, demo information density and disabled legal attendance.
- Added local Python fixture photo / screenshot-path regression checks.
- Source readback inspection: 28 visual/safety items checked (27 initial pass; one false negative from a check's title-matching regex was manually confirmed to have all 4 documents), 4/4 document and 4/4 notice titles, CSS braces balanced, unique H1.
- **This changes the SHA. Previous successful local Release `a53b487c` DOES NOT validate the new candidate. No Chromium PNG from the new candidate has been inspected.**
- Mandatory next gate: exact-SHA Docker Release on user's Windows host, SHA-tagged synthetic screenshot bundle, human screenshot comparison versus 1536×1024 reference. Keep visual status not accepted until visually reviewed.
