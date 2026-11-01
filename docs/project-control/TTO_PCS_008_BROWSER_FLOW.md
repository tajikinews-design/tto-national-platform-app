# TTO-PCS-008 — Two-portal fictional browser workflow
Date 2026-11-01. No real cooperative, user, official share ledger, SMS, payment, or transfer.

## Inputs
- Wave-1 PCS-007 Draft code PR #93 SHA 13d75daf9425f35f8beeae0e7c7b817ae1e9538a.
- PCS-007 docs Draft PR #94 SHA 9099007591b35b0734a1170fc83a5a9cc22dc182.
- New app Draft PR #95 branch feat/tto-pcs-008-browser-vertical-slice-20261101, current candidate SHA fc93ac2fbbd6a57ead1f5b8b6ffd1f4be7a3c8df.

## Implemented
- scripts/ci/pcs008-cross-portal-browser.cjs launches a private CI-only in-memory broker and two built Next applications on isolated localhost loopback ports. Chromium visits cooperative review screen and synthetic shareholder page in independent tabs, submits fake approval via the review form, then refreshes shareholder page and asserts synthetic number 125, demo status, disabled trades, JS-error absence, same-origin network and no horizontal overflow on 390 and 1440 px viewports.
- GitHub Actions has a branch-limited Playwright/Chromium run to invoke the script after the workspace build, and retains existing core API/PG17 and security checks.
- A readiness error in the new script was corrected: the synthetic broker requires a lab token for GET /view, so the test readiness probe must send the token.

## Important scope and evidence limitations
- This is a two-portal browser test **with fictional identities and no authenticated role**, not a production manager/shareholder E2E.
- Broker data are in memory and cannot be safely used as official ownership ledger, release baseline or persistence.
- No legal Child06/Child07 source accepted, Wave-0 owner G3 still pending and no merge/deploy approved.
- Candidate exact SHA CI run 41306818429 **pending verification** at initial document creation. Do not claim PASS without checking job result.
- Still required: actual audited authenticated manager workbench, tenant/Party binding and signed official independent source approvals. These cannot be inferred from synthetic success.

## Next
Confirm latest exact SHA GitHub Actions. Fix any identified browser test failure; update CHECKPOINT. If green, move to a narrowly scoped design and implementation plan for authorization-backed cooperative admission using test fixtures, independent official Child06 and Child07 source authority gates.
