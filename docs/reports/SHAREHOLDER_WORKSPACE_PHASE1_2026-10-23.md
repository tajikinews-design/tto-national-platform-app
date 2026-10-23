# TTO Shareholder Portal — Phase 1 Implementation / Acceptance
Date: 2026-10-23
Scope: shareholder UI only, protected Next.js Preview; *not* a regulatory release, data migration or live transaction launch.

## Contract and source authority
This milestone builds on PR #22 local Windows Docker **Release PASS** (`33a802254a4aac284047d4b17e14fceb707da774`) and the read-only Child06/07 source-readiness contract in `docs/reports/CHILD06_07_SOURCE_READINESS_2026-10-23.md`. Existing domain authorities remain unchanged:
- CF01 verified, revocable, HttpOnly first-party session is necessary but not sufficient.
- CF02 Tenant context must independently authorize the chosen UUID; platform-wide admin implies no default private member data.
- Child06 owns membership status and ShareholderAccount; only an independently approved source record with timestamp and version may be displayed as verified.
- Child07 owns ShareOwnershipLedger; a versioned source-backed read quantity is not a payment, valuation, transfer, voting right or admission of legal ownership.
- **Unknown/awaiting approval/unavailable is never inferred to mean zero shares, no membership or zero active requests.**
- Trade operations are handled according to the approved share market workflow; buyer pays seller directly and platform does not provide cash Wallet or cooperative general accounting. The legal Board/superior rules approval gates are independent of this UI.

## Implemented user-facing routes
| Route | Active view | Behavior |
|---|---|---|
| `/` (shareholder) | Overview dashboard | Four source-state cards, three navigation actions, tenant selector, no invented counts |
| `/modules/nav-02` | Membership / Shareholding | Separately sourced membership and ledger read-only cards with source dates/versions |
| `/modules/nav-03` | Purchase/Sale requests | Structured approved-process explanation; creation, transfer and fabricated request history never enabled |
| `/modules/nav-05` | Notices and communications | Publication classes; no released content shown without source/publication classification |
| Other NAV routes | Existing review-only shell | Explicitly unchanged, no implicit access |

The existing central `OtpLogin` remains the access gate. Once session and tenant context checks pass, `ShareholderWorkspace` calls the **existing** shareholder BFF GET routes (`/api/me/tenant-options`, `/api/tenants/:id/context`, `/api/tenants/:id/me/member-record`, `/api/tenants/:id/me/shareholding`). No new write API or identity input is introduced.

## State model and privacy
- **Not authenticated**: protected workspace does not mount. OTP request/verify always go through existing secure BFF.
- **Tenant list unavailable**: refuse data access; do not derive membership from tenant naming or role alone.
- **No eligible tenant**: do not create a fake option or invent a company.
- **Pending evidence**: can select tenant for scope verification, but this alone proves no share rights.
- **Scope denied / expired / unavailable**: no personal data; the UI reports the access/source boundary, not whether a target tenant or Party exists.
- **Approved membership**: only from approved upstream record with `membershipStatus=ACTIVE`, `partyKind`, `sourceVersion>0`, valid `sourceAsOf`. An absent/non-approved record is not shown as a known inactive member.
- **Approved holding**: only from approved upstream record with decimal `shareQuantity` (including `0` if explicitly source-certified), `ledgerVersion>0`, valid `ledgerAsOf`. Unknown remains `—`.
- **Requests**: the approved purchase/sale workflow exists as a specification, not a live read/write requests integration in this slice; never display imaginary orders or enable transaction buttons.
- **Notices**: documents/audit records are not automatically public notices; a distinct publisher/source/recipient ACL contract is needed before listing notices. No placeholder headlines, dates or unread counts.
- **Tenant switch / unmount / logout**: request aborted and revision checked; no stale cross-tenant personal state is retained or persisted in browser storage.
- All reads are GET to same-origin BFF with `credentials=same-origin`, `cache=no-store`. Existing BFFs enforce secure upstream origin, bearer from HttpOnly cookie, tenant access, source/ledger provenance and no-store responses.

## Acceptance gates
| ID | Criterion | Evidence available |
|---|---|---|
| SW-01 | Protected UI mounts only after validated session | `OtpLogin` condition and existing Core auth E2E |
| SW-02 | Tenant context checked before both independent record reads | Component verify flow, existing Child06/07 E2E |
| SW-03 | Changing tenant invalidates old scope/data | Aborted controller / generation guard |
| SW-04 | Source version/date mandatory, including explicitly sourced zero | Typed runtime record validation |
| SW-05 | Unknown/pending/error never fabricate share quantities or orders | Dedicated UI policy tests |
| SW-06 | NAV-01, NAV-02, NAV-03, NAV-05 display operational states | Real Next routes; other NAV shell unchanged |
| SW-07 | No real SMS, wallet, payment, trade posting, ownership mutation | No new POST/financial code |
| SW-08 | RTL, responsive keyboard and status messages | Workspace stylesheet / semantic labels |
| SW-09 | Build/typecheck + Core/Release regression on actual new SHA | **NOT YET RUN** — user Windows Docker or GitHub hosted runner required |
| SW-10 | Legal source + publication + Child06/07 final gates | **NOT APPROVED** — independent future decision |

## Handoff / how to review
This change is intentionally stacked as a **new Draft PR** on PR #22; do not modify/merge `main`, hosted Supabase migrations or live shareholder/financial data. Run offline policy suite (`python3 -m unittest discover -s scripts/ci -p test_*.py -v`); then use the reviewed `run-local-docker.ps1 -Suite Release -ExpectedCommit <reviewed SHA>` on the user's isolated Windows Docker Desktop. Hosted GitHub required checks must be resolved separately when free minutes reset or approved billing/runner capacity is available.

## Next slice (requires separate scoped design)
Approved owner-source adapter for trade-request read-model, publisher-approved notices with explicit per-tenant recipient rules, lawful request submission and payment evidence capture, and source reconciliation workflows. None is implemented by this UI phase.
