# Phase 4B — Session privacy / revocation-sensitive shareholder UI

**Date:** 2026-10-25  
**Status:** `IN_PROGRESS / PENDING_LOCAL_DOCKER`. Candidate code committed in a stacked, isolated branch; no SHA-specific build or browser success may be claimed before local execution.  
**Direct parent:** Phase 4A Draft PR #30, commit `429b66076e8a0df1ca1e1629e470a2181dd5b0d5` (not merged).  
**Area:** authenticated shareholder workspace only. Do not alter cooperative/national session policy, source admission, payments, share transfer, Vercel protection or production.

## Problem

`OtpLogin` historically checked `/api/auth/session` only upon initial page entry. Once rendered, a shareholder workspace could keep previously fetched private membership/holding values on screen after a remote session revocation or expiry, until navigation or a new manual source lookup. Backend APIs independently reject invalid sessions, but a still-mounted React UI is a privacy concern. A GET returning 401 in the member/holding/tenant/read-model flows previously showed a message without always unmounting the parent private workspace.

## Candidate changes

1. The existing verified-only `OtpLogin` periodically rechecks current session validity through the existing same-origin `GET /api/auth/session`, using `credentials:"same-origin"`, `cache:"no-store"`, and the existing PostgreSQL-backed Nest authority. No token is read in JavaScript. Recheck runs after authenticated shareholder mount, every 60 seconds while visible, on window focus, and when document returns to visible.
2. Validation accepts **only** JSON with an explicit boolean `authenticated` and HTTP 200. `authenticated:false` unmounts the personal workspace and offers a new login. A 503, malformed response or network failure **closes** the private UI and shows the existing retry/connection-failure state rather than making up a logout or treating the session as valid.
3. The timer, focus/visibility listeners and pending request are removed/aborted on unmount, logout or invalidation. Sequential revalidation does not overlap within one mounted effect.
4. `ShareholderWorkspace` forwards session invalidation from the initial tenant discovery, tenant scope and independent Child06/Child07 owner reads when they respond 401. `ShareholderReadModels` passes a source-read 401 to the same parent only when the response has not been aborted. All three mark the whole personal workspace unverified, not merely a list unavailable. Existing 403/404 distinguish denied source and rights; 503 remains temporary unavailable without inventing records.
5. All other tenant/source controls remain in place: abort-on-tenant switch, previous scope invalidation, versioned member/holding data, Child07 and Child09 DENY until external approval, no personal data persistence, no trading/payment actions. The review-only eleven-page design routes remain unchanged.

## Security and limitations

- This is **client privacy enforcement**, not a replacement for server authentication, RLS, tenant-bound controls, revocation, or independent legal authority. The real backend remains authoritative on **every** request.
- Client refresh is not instantaneous; up to 60 seconds (or a visibility/focus event or failed read) may elapse before the screen unmounts after an out-of-band revocation. Stronger immediate lock semantics would need a separate approved transport/notification capability.
- If the session-check backend is temporarily unavailable, the current private UI closes but no confirmed server logout or credential deletion is claimed. The user can retry when connectivity returns.
- Unlike an explicit logout request, this local UI lock does not call the server revoke endpoint; it does not impersonate a successful logout.
- Phase 4A remains unmerged. No modifications to `main`, data stores, secrets, billing settings, Docker shared volumes, Vercel protections, production infrastructure or legal/source packet.

## Files

- `packages/ui/src/otp-login.tsx`: event + 60s revalidation for shareholder only; verified private mount is removed when session is invalid/unverifiable.
- `packages/ui/src/shareholder-workspace.tsx`: propagate owner-query/session errors to root and reset local privacy state.
- `packages/ui/src/shareholder-read-models.tsx`: 401 callback, with abort guard.
- `scripts/ci/test_shareholder_phase4b.py`: offline deterministic contracts and cleanup assertions.
- `status/PHASE_GATES.json`: separate candidate milestone checkpoint.

## Acceptance matrix

| Gate | Status |
| --- | --- |
| Source update on isolated branch | `IMPLEMENTED_CANDIDATE` |
| Offline source invariants reviewed | `STATIC_REVIEW_ONLY` |
| Phase 4B Python source tests on current checked-out SHA | `PENDING_LOCAL_DOCKER` |
| Phase 4B TSX AST, TypeScript, Next three-portal build | `PENDING_LOCAL_DOCKER` |
| Full isolated PostgreSQL17 Core/Release E2E (exact SHA) | `PENDING_LOCAL_DOCKER` |
| Browser revoke while loaded, resume, 503 retry, logout, tenant switch | `PENDING_INTERACTIVE_LOCAL_BROWSER` |
| GitHub hosted CI | `BILLING_RESTRICTED` (external independent gate) |
| Human owner/source/legal approval | `BLOCKED` for new operational domain feeds |
| Merge, production, real OTP, real money or order submission | `NOT_AUTHORIZED` |

## Repro instructions (Windows local Docker)

Use exactly the immutable Phase4B head SHA shown in Draft PR #31 after final commit. Check out clean isolated worktree, then:

```powershell
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\ci\run-local-docker.ps1 -Repository <clean_worktree_path> -ExpectedCommit <phase4b_exact_sha> -Suite Release
```

The script uses disposable isolated PostgreSQL17 and Node22 and must preserve the user’s other Docker resources. Inspect the log under `Downloads\TTO-Local-CI-Reports`. Do not call this phase GREEN without the exact-SHA success evidence and browser checks.

## Added 2026-10-25 — deterministic browser revoke regression (no real data)

A separate **mock-only** Chromium browser harness now covers eleven explicit cases: anonymous access closed, active approved *synthetic* holding unmounted on revocation, 503 fail-closed plus retry without stale values, malformed session status fail-closed, tenant-discovery 401, tenant-context 401, membership 401, source-read 401 for requests and notices, tenant 403 without false logout, and approved-session/source-403 without false logout.

- `scripts/ci/phase4b-session-browser.cjs` captures all same-origin API requests via Playwright route interception in an isolated browser; no real tenant/member records, API authorization, notification services, payment rails or server credentials are used. The fixture showing **271 shares is imaginary test data only** and must never be surfaced in the real application or a release report as business evidence.
- `scripts/ci/run-phase4b-browser-docker.ps1` creates an exact-commit, isolated Docker source volume and Node22 Next server bound to host loopback port `32165`; uses a separate Playwright image with the same network namespace; `TTO_API_BASE_URL=https://invalid.example` is only a local UI enablement flag while every browser API call is intercepted. Persistent resources are named/labelled with the exact SHA to prevent accidental ownership confusion; the script does not prune Docker or modify the production network.
- `scripts/ci/test_shareholder_phase4b_browser.py` asserts mock-only, source-locked, ten-module anonymous SSR and diagnostic report properties. Existing `scripts/smoke-next-otp.mjs` now tests the anonymous fail-closed shell of all ten operational module routes, including the previous three.
- Synthetic-browser report files are `phase4b-session-report.json` and `phase4b-session-report.md` in a user-supplied reports directory.
- **Exact-SHA Release and Chromium browser checks remain `PENDING_LOCAL_DOCKER`.** The browser suite is *not* real authentication, server revocation, Postgres RLS, legal approval or a substitute for production integration tests. Acceptance requires both the isolated full Release regression and the separate 11-case Chromium run to pass at the identical SHA. A true server-backed revoke/expired cookie scenario also remains a distinct integration gate.

New browser-suite source and launcher static syntax/contract checks passed while authoring, but **no actual Windows PowerShell/Chromium run was observed**. Do not promote the merged product or claim runtime verification without the user's local logs.

## 2026-10-25 user Docker evidence — dependency recovery and mock 401 test bug

User's full local log confirms that at source SHA `e0ba3a3a95cf0a03b2c02aa59ddf4d1255f6280f`:

- the original Release first passed 59 Python tests and stopped on external npm registry `ECONNRESET` before a Next build; this is a network interruption, not an assertion about application behavior;
- the external **test-infrastructure-only** npm retry/limited parallelism override successfully installed pinned dependencies, ran TSX parser and Next.js/TypeScript production build;
- Chromium actually ran 11 mock-only scenarios: **10 PASS, one FAIL** (`trade-401-unmounts`), 60 checks, zero release green. The Release suite was *not* reached after Chromium exited nonzero.

**Root cause found in the automated test fixture, not yet an application regression:** the BFF route `/me/trade-requests` looked up `state[domain]` where `domain="trade-requests"`, while the fixture defined `state.trade=403` and the scenario set `state.trade=401`. The missing key provided an `undefined` status to Playwright `route.fulfill`, so the test never actually sent the intended 401; the privacy callback did not run. The corresponding `notices` fixture correctly used `state.notices` and passed.

**Committed fix in same Draft PR:** map the `trade-requests` domain to `state.trade`, fail the fixture on any undefined/invalid HTTP mock status, and assert that the 401-unmount test actually delivered HTTP 401 at its source endpoint. Add a Python offline regression against the former erroneous lookup. This is **test code only**; no change to runtime authorization, account security, company data, or transaction logic.

**Required retest:** execute the corrected mock harness against the *verified unchanged* application build for a quick 11-case Chromium diagnosis; label evidence with BOTH `applicationSha=e0ba3a3...` and the corrected `harnessSha` rather than claiming a fresh build. Then independently run exact-new-SHA Docker Release before declaring phase acceptance. Report both results; do not merge PRs, change hosted CI, or touch production resources.
