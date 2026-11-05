# PH10 cooperative onboarding — CI runner recovery gate (2026-11-05)

**Official state: RUNNER_ALLOCATION_BLOCKED / POSTGRES17_NOT_RUN / LEGAL_ACTIVATION_BLOCKED.**

## Exact evidence (GitHub API, read-only)
- Draft PR #160 targets `audit/ph10-full-platform-integration-155-20261103`; **no merge**.
- Dedicated workflow run `41987081994`, initial attempt FAILED before job steps.
- Controlled re-run of its single failed job via authenticated GitHub action returned `success=true` for the re-run request, **not for the job**.
- Re-run attempt 2: `conclusion=failure`, job `127112205293`, `runner_id=0`, `steps=[]`, started `2026-11-05T07:30:17Z`, completed `2026-11-05T07:30:20Z`.
- Latest 100 workflow runs inspected from the repository had zero SUCCESS. An earlier SUCCESS did exist: adaptive-security workflow run `41852274145`, started `2026-11-04T14:54:33Z`.
- GitHub job logs for earlier failed attempts were unavailable (`BlobNotFound`). A pre-run failure prevents using SQL logs as diagnosis. **No PostgreSQL 17 migration/tests were executed by the failed runner job.**

## Root cause status
`PRE_RUNNER_FAILURE_CONFIRMED`. Specific reason `NOT_CONFIRMED`.
GitHub documentation identifies exhausted Actions minutes, billing-budget restrictions and account settings as possible causes. No billing read/write entitlement is available through the connected GitHub repository tools; **do not assert quota exhaustion or change payments/budgets without account-owner review**. Runner `0` and empty steps are evidence of non-allocation, not proof of a particular billing state.

Check account-level `https://github.com/settings/billing` -> `Budgets and alerts` and `Usage` / GitHub Actions. If an explicit quota/billing error appears, choose a controlled resolution; otherwise inspect `Actions` settings and contact GitHub Support with run and job IDs. Do not create more automatic runner attempts while this pre-run failure persists.

## Safe immediate fallback
On an authorized Windows machine with Docker Desktop running, from a clean checkout of this exact PR branch:

```powershell
git fetch origin feat/ph10-cooperative-dossier-lifecycle-20261105
git switch feat/ph10-cooperative-dossier-lifecycle-20261105
git pull --ff-only
$sha = (git rev-parse HEAD).Trim()
& .\scripts\ci\ph10-cooperative-dossier-local-pg17.ps1 -ExpectedHead $sha
```

Safeguards in the PowerShell launcher: exact branch+SHA and clean tracked files, local Docker engine only (no TCP/SSH remote context), unique disposable container, `postgres:17-alpine` with `--network none`, no ports or mounts, PG major-version check, repository migrations on the disposable DB only, three rollback-only SQL test files, uniquely named temporary evidence folder, cleanup of only the owned container. **Never point the script at hosted Preview**.

For Linux / WSL, the existing `bash scripts/ci/ph10-cooperative-dossier-local-pg17.sh` remains available, but does not produce the exact same evidence JSON format; use the Windows wrapper for owner-machine evidence if possible.

## Acceptance/recovery checklist
- [ ] Account owner confirms Actions quota/payment/budget/permission state from GitHub UI.
- [ ] GitHub-hosted workflow runs on an allocated runner (`runner_id != 0`) and produces actual steps/logs.
- [ ] Exact-HEAD PG17 migrations and all three rollback-only tests PASS; record run ID or local SHA, PG version and evidence JSON.
- [ ] Nest / Next typechecks PASS on same SHA and negative authorization browser E2E completed.
- [ ] Security review verifies file quarantine, encryption, session checks, role separation and legal review authority.
- [ ] Separate signoff for any Preview migration; **not granted by passing CI**.

**Do not merge PR #160, apply migration 9997–9999b to hosted Preview, create a Tenant or manager, upload real documents, activate legal rights, or perform shares/payment operations until separate gates are signed off.**
