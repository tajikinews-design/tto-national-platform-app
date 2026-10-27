# NAV-04 screenshot inspection — 2026-10-27
Status: **LOCAL RELEASE PASS, VISUAL ACCEPTANCE NOT GRANTED**
Reviewed source SHA: `a53b487c0fb0d54700306d5f36665fad89930fa6`
Reference: approved screenshot 1536×1024, `a_wide_high_resolution_ui_ux_mockup_dashboard_scr.png`.

## Authentic runtime evidence
The user supplied real Chromium PNGs with verified SHA-256 hashes matching the local Release log:
- nav04-1440.png, 1440×900, SHA256 `26760e98318c43fe955ee24843e88d1f890413e8fbcfcf5e3435ca2f036182f3`
- nav04-768.png, 768×1024, SHA256 `f415d528ef5edb79420b1b85e49bab5d7f232877572a92c6eec558881ee71f70`
- nav04-390.png, 390×844, SHA256 `0bbd263039490fad15abd5770a9cbdc90279e679d53ba8b714fa8df9462b32bb`
- nav04-320.png, 320×740, SHA256 `df7b3a86294896ed41de709ea8b08e0b1ee0adac25f41a3b8afe6cf78ce94d62`

## Screenshot deviations to fix
1. **Blocker**: Approved meeting-room **photo** on left is replaced by geometric CSS artwork in runtime. Use the approved photographic asset, not a new stock picture.
2. Header/sidebar: approved brand graphic, company selector, message/bell/user affordances and line icons differ from the running shell.
3. Meeting hero: exact proportions, title/status row, countdown/CTA treatment and margins do not match the approved image. Keep all DEMO legal caveats while restoring approved visual grouping.
4. Summary and content panels: rhythm, font/icon sizes and row density are different. Do not fabricate documents or legal statuses to match sample counts.
5. The approved desktop source is 1536×1024 but actual automated screenshot is 1440×900. Need a **1536×1024**, preferably full-page Chromium capture and human side-by-side review. Bottom action row is cropped in the 1440×900 capture.
6. On 320px mobile, header + hero occupy nearly the entire initial viewport. Compact and retest 320/390 widths.

## Quality gate
All four provided screenshots show the intended RTL structure and no horizontal overflow; local Chromium test was reported PASS (126 NAV04 checks). That proves functionality and layout bounds, **not screenshot pixel fidelity**.
The test-data source remains `UNVERIFIED` until explicit `DEMO_CONTENT` mode, real voting/publication/attendance/proxy actions remain denied, and none of these legal gates may be weakened for visual parity.
Do not accept NAV04 visually, merge, deploy or authorize real processing pending photo/header/layout repair, matching-resolution captures, exact-SHA Release rerun and human signoff.
