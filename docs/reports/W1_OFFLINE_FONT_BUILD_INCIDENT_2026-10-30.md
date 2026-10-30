# W1 — Offline Next.js Font Build Repair (no security scope expansion)

**Date:** 2026-10-30  
**Incident reference:** exact-SHA local Docker Release failure on `2d889ffd8c6214bedaf0ad62880ecfb0b28f33bd` (PR #63).  
**Status:** CODE REMEDIATION COMPLETE / NEW EXACT-SHA DOCKER RELEASE REQUIRED.

## Incident evidence
The user verified source SHA; Next/Nest/PEP/PDP chain markers and 278 Python tests passed. Whole Release returned code 1 at `pnpm build`. All 3 Next portals used `next/font/google` and requested a CSS resource from `fonts.googleapis.com`, which was unavailable. No `TTO_LOCAL_RELEASE_PASS_SHA` existed. Therefore original PR #63 was **NOT ACCEPTED**, irrespective of synthetic security test success.

## Minimal, persistent fix
- Self-host the **original unmodified variable font** `Vazirmatn[wght].woff2` sourced directly from upstream `rastikerdar/vazirmatn` **tag v33.003**, path `fonts/webfonts/Vazirmatn[wght].woff2`.
- Git blob SHA of font file: `a501289a85595158570b0c2badcb4608b042e748`; size **111152 bytes**, wOF2 header. This pin is asserted by new offline unittest.
- Retain the exact upstream `OFL.txt` license in `packages/ui/assets/OFL.txt`; the font is governed by SIL Open Font License 1.1, not the application's other licenses.
- Change only the three app `app/layout.tsx` font declarations from `next/font/google` to `next/font/local` pointed at one shared pinned file. Keep `--tto-font`, weights 100–900, `display:swap`, Persian RTL and className usage. This is the same family, not a fallback or replacement.
- No Next/Nest auth logic, source policy, database migration, RLS, share trades, user account or payment touched.

## New regression tests
`scripts/ci/test_vazirmatn_offline_build.py` verifies original file blob hash, font signature/length, upstream copyright and license, asset path, consistency of the three portals, and unmodified shared CSS variable.

The existing exact-SHA Docker Release will automatically discover these tests. Its full Next builds are the required functional confirmation that no Google Fonts dependency is needed. Pure static tests **alone are not acceptance**.

## Acceptance boundary
- **GO only if:** exact SHA checked out; local Docker Release exit 0 and `TTO_LOCAL_RELEASE_PASS_SHA=<exact SHA>`; W1 chain markers and source/tenant denial invariants present; all existing tests and full builds PASS.
- **NO-GO:** any acceptance based only on the former PR #63 test markers; no merge/deploy; no real identities, Child06/07 sources, accounting, share trade or account changes.
- **Visual compatibility:** the same Vazirmatn variable family is supplied locally, but exact pixel parity of previous screenshot evidence has **not** been independently reverified on this change. That remains a separate review condition if visual baselines are re-accepted.

## Original failure reports (user-local)
- `C:\Users\Sadra\Downloads\TTO-Execution-Reports\TTO-W1-Chain-20261030-101524.stdout.log`
- `C:\Users\Sadra\Downloads\TTO-Execution-Reports\TTO-W1-Chain-20261030-101524.stderr.log`

**Contract acceptance: PENDING pending exact-SHA full Release.**
