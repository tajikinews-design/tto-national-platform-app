# TTO GitHub Free Actions consolidation — 2026-10-23

## Why this change
The user-shared GitHub Free billing overview shows `2,000 / 2,000` included GitHub Actions minutes consumed for the month. In PR #19, all 14 GitHub-hosted jobs were prevented from starting by GitHub's explicit billing/spending-cap annotation; this is not a code test failure. No new money budget, card, organization upgrade or self-hosted runner has been configured.

## Automatic PR strategy
- Exactly one new workflow: `.github/workflows/tto-adaptive-ci.yml`, a **single GitHub-hosted job** in any suite, checkout once and, in code suites, install/build/check once. No matrix fanout or automatic parallel historical suite.
- `concurrency` groups each PR and cancels superseded runs.
- `lite`: draft PRs with ONLY README.md or ordinary `docs/reports/**`, `docs/deployment/**` and `docs/guides/**`; performs source manifest structural checks, Python tests and safe static review build.
- `core`: any code, policy/contract, database, migration, workflow, security, application, infra or unclassified change in a Draft PR. Compiles Nest+3 Next apps, checks TypeScript, runs offline SMS/ClamAV/Vercel-gate tests, smoke-tests Next and executes the latest Child06/Child07 identity and source-quarantine E2E with real Nest/Next HTTP and **disposable PostgreSQL17**.
- `release`: when a PR is not Draft (including ready_for_review) or on explicit manual `workflow_dispatch` with release option. Includes core, then resets **only the runner's disposable local PG17** between legacy lifecycle/RLS cases, SMSOTP HTTP tests, original 3-portal login/logout E2E, and portable 4-image OCI runtime smoke / Arvan YAML tests.
- Unknown event, draft status, file path, empty diff, or source/analysis documentation defaults to `core` or error, never permissive `lite`. Unit tests validate the selector's fail-closed decisions.

## Existing workflows
16 historical overlapping workflows have been retained but changed to `workflow_dispatch`-only in the feature branch. Prior source tests are re-exercised as core/release scripts or retained for audit. The historical `lockfile-once.yml` keeps its **old specific branch-only push condition**; it does not run on these feature branches or PRs. No PR event or global push trigger remains outside the adaptive workflow.

NOTE: GitHub `workflow_dispatch` controls are usually discoverable only for workflows present on the default branch. While `main` remains README-only, do not assume manual runs can be launched in the UI from this stacked Draft PR. Ready-for-review triggers `release` automatically after workflow changes are integrated in the PR; this is NOT an enforced branch protection setting.

## Limitations / non-goals
- **No CI execution claim** at present: the account's 2,000 monthly included minutes were exhausted and GitHub refused to allocate runners. YAML, policy selector and regressions require a fresh successful run after allowance returns or the account billing restriction is resolved. Vercel Preview READY is not test evidence.
- No reduction of the established security invariants, source-read gates or Child06/07 legal acceptance requirements. Tests may be resource-intensive during release but billed minutes should no longer multiply across parallel matrix jobs.
- Never modify GitHub billing, move to paid plans, change `main`, hosted Supabase, protected Vercel Preview SSO, Arvan Production, secrets, live financial data or legal policy approval from this PR.
- PR #19's migration 0010 and quarantine E2E remain unverified at its last commit until execution becomes possible.
- Runtime images and disposable test records contain synthetic values only. No SMS, no actual payments, no deployment, and no registry push.

## Required follow-up
1. Verify new workflow YAML and local selector/regression scripts statically, review the one-job design.
2. After GitHub monthly included allowance renews, run one `core` check on the exact final CI branch head and then move the PR to ready-for-review for `release`; block merge on both required evidence and independent source/legal review.
3. Consider configuring branch protection/check enforcement once stable `main` is initialized. No current repository protection change has been made.
4. Measure actual consumed Actions minutes via GitHub Billing, then tune release frequency if necessary. Do not assume projected savings were measured.
