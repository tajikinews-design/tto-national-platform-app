# TTO Windows Docker — isolated local CI handoff (2026-10-23)

## Objective
Run the highest-value **Core** security suite for Draft PR #19/#20 on the user's Windows Docker Desktop without spending GitHub-hosted runner minutes. This is a local test alternative only; it does not make GitHub branch required checks green, attest legal source data, or bypass release signoff.

## Committed entry point
`scripts/ci/run-local-docker.ps1` (Windows PowerShell 5.1+, Git CLI and Linux-engine Docker Desktop).

Recommended clean checkout from PowerShell with Git Credential Manager (private repository needs the user's own authenticated GitHub access):

```powershell
$repo = Join-Path $env:USERPROFILE ("Downloads\TTO-Local-CI-Checkout-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
git clone --single-branch --branch feat/local-docker-isolated-ci https://github.com/tajikinews-design/tto-national-platform-app.git $repo
if ($LASTEXITCODE -ne 0) { throw "GIT_CLONE_FAILED" }
& (Join-Path $repo "scripts\ci\run-local-docker.ps1") -Repository $repo -ExpectedCommit "<USE_FINAL_PR21_HEAD_SHA>"
```

Replace the exact expected commit after the PR is finalized. Run from a normal, non-administrator PowerShell session; no changes to execution policy are needed when local policy allows signed/trusted scripts. If policy blocks executing the reviewed file, use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path ...)` only for this explicitly inspected, version-pinned script.

## Safeguards
- `git archive HEAD` copies committed/tracked source into ephemeral Docker named volume. **Local uncommitted files, dot-env credentials and host documents are not in the test source**.
- Unique-name ephemeral postgres:17 and node:22-bookworm containers; Node shares only the PostgreSQL container's network namespace. **No `-p` or `--publish` host ports**, so 5432 of unrelated Docker Compose stacks remains untouched.
- Explicit `TEST_ADMIN_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/tto` exists only inside the temporary shared Docker namespace, and both APIIR_TOKEN and other cloud credentials remain absent.
- An offline Python test container with `--network none` validates source baseline, structure and fail-closed CI selector. All database migrations 0001–0010 run against synthetic isolated PostgreSQL.
- Real Next BFF → Nest HTTP → PostgreSQL Child06/Child07 source-quarantine checks, SMS/ClamAV and preview-denial unit tests execute with no real SMS, actual people or hosted Supabase connection.
- `finally` removes **only the containers and volume created by this invocation**, even if tests fail. Never runs global Docker prune, Compose down or force-removes pre-existing containers. Persistent PowerShell transcript: `%USERPROFILE%\Downloads\TTO-Local-CI-Reports\TTO-Core-<date>-<id>.log`.
- No self-hosted GitHub runner, GitHub token, webhook, startup service or machine-level Docker daemon setting is installed.
- This runs Node/pnpm and pulls pinned public container images/dependencies over the local network; the user must have working Docker Desktop Linux engine, Git credentials and enough disk/RAM.

## Output and acceptance
- Success marker: `TTO_LOCAL_CORE_PASS_SHA=<40-char-commit>`.
- Failure marker: `TTO_LOCAL_CORE_FAILED=...`, with detailed preserved transcript.
- No actual execution of this PowerShell script on the user's PC has occurred via this assistant; a GitHub PR/Preview READY is not proof the local environment passes.
- Independent GitHub Actions Release check remains blocked by exhausted 2,000 included minutes; do not merge dependent Draft PRs before approved final regression/official source review.
