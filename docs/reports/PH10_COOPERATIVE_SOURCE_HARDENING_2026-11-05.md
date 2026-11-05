# PH10 cooperative onboarding — isolated code hardening checkpoint

**Scope:** GitHub branch only, PR #160 Draft; no hosted Preview migration, no deployment, no legal activation, no real file upload, no share/payment operation.

## Latest engineering changes

1. Locked document upload against concurrent dossier submission: `pg_advisory_xact_lock(hashtextextended(p_slug,42))`, exactly matching the draft and dossier submission lock.
2. Serialized same `upload_key` requests with an advisory transaction lock to avoid duplicate storage and return a stable idempotent result.
3. Preserved exact upload replay after dossier submission, while blocking NEW attachments outside `CHANGES_REQUESTED` after a submitted dossier.
4. Expanded disposable-PG17 negative assertions for out-of-window new upload, exact retry after submission, and unauthorized actor.
5. Added `tests/test_ph10_cooperative_onboarding_source_gate.py` as a no-credential source-only regression guard. Source inspections performed against the live branch reported **20/20 checks present** (not a PostgreSQL, API or browser test).

## Independent execution result

- GitHub Actions `41987081994`, attempt 2, **FAILURE**, runner_id=0, steps=[].
- Latest source review is **SOURCE_ONLY / PARTIAL**; **PostgreSQL17 runtime NOT_RUN**, API real HTTP NOT_RUN, browser E2E NOT_RUN, legal verification NOT_DONE.
- The workspace connected to this assistant has no Docker, no PostgreSQL server/client binaries, and no network access for package installation; no local PG17 result can be claimed from here.
- The Windows owner-machine fallback is `scripts/ci/ph10-cooperative-dossier-local-pg17.ps1`; its design was inspected, but **not executed**.
- Billing/Actions budget/settings and possible GitHub service incident require direct account/runtime evidence; runner 0 alone does not prove exhausted quota.

## Blocking acceptance requirements

- Exact-head successful disposable PostgreSQL 17 application of migrations 9997–9999b.
- Source test suite, DB negative tests, Nest/Next compilation, real HTTP/Chromium and authority isolation.
- Independent scanner, legal reviewer authorization/identity, official source verification and complete document custody before any legal approval/activation.
- Separate change-impact review and explicit authorization for hosted Preview migrations.
- No merge of PR #160 before all applicable gates.

**State: `SOURCE_INSPECTION_PASS / CI_RUNNER_BLOCKED / PG17_NOT_RUN / LEGAL_ACTIVATION_BLOCKED`.**
