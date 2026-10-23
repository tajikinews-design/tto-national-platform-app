# TTO local Release regression runbook — 2026-10-23

## Baseline / dependency chain
Child06/07 quarantine PR #19 → GitHub Free adaptive CI PR #20 → local Windows Core runner PR #21 → **this staged local Release PR**. The user's Windows PowerShell logs demonstrated **two Core PASS runs** on PR #21 SHA `0fbb7bfbe5acbf32dcc1e035945937bb40a10101`, 145 CF02/Child06–07 assertions, PG17 migrations 0001–0010, Next/Nest builds and synthetic no-SMS checks.

## Release implementation
One opt-in `-Suite Release` mode added to `scripts/ci/run-local-docker.ps1`. Default remains `-Suite Core`, preserving the previously tested daily developer workflow. `Release` runs **all Core stages first** and then calls `scripts/ci/local-release-helper.ps1`, which:
1. Attests that all passed-in container/volume/network names are unique for the run, that the DB container is exactly postgres:17 on a dedicated bridge without published ports, and that Node22 shares only that Postgres network namespace.
2. Resets the **disposable local PG17 database only** between historical cases. Applies the tested migration/test order for tenancy/RLS, CF01–03 security v2/v3/v4, legal hold and privileged actor lifecycle, actual Nest HTTP authentication, fake-provider SMSOTP, rate-limit and replay denial, and original three Next BFF→Nest→PG17 login/logout E2E. Each failure stops Release.
3. Runs the Arvan K8s manifest parser as a static-only lint. No registry credentials and no Arvan deployment.
4. Extracts the exact previously SHA256-reported `git archive HEAD` into a disposable **clean local Docker build context**; builds each of shareholder, cooperative management, national admin, and API Dockerfiles under per-invocation tags. No existing image tag or source folder is overwritten, no Docker-wide prune, no image push.
5. Runs each Next image under `--network none` with **no host port exposure** and probes `127.0.0.1:3000` **from inside the image itself** using Node22. Verifies successful HTML, RTL layout and explicit no-fake-data marker. The API image is started with no DB and no network and must exit nonzero with an explicit fail-closed startup message.
6. Removes only unique release runtime containers and image tags in its own `finally`, while the parent runner always removes unique PG17, Node22, network, source volume and local temp context. Preserves only a PowerShell transcript in `%USERPROFILE%\Downloads\TTO-Local-CI-Reports`.

## Required execution and evidence
- User has a valid private GitHub clone at `C:\Users\Sadra\Downloads\TTO-Local-CI-20261023-015428`; can update this clone rather than cloning again. Their Docker Desktop Linux engine has already passed Core twice.
- Fetch and detach-checkout the EXACT approved PR22 Release commit (given in the handoff); ensure clean working tree, then run AST parser on BOTH `.ps1` files before invoking `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ... -Suite Release -ExpectedCommit <pinned-sha>`.
- The run must end with `TTO_LOCAL_CORE_PHASE_PASS_SHA=<sha>`, `TTO_LOCAL_RELEASE_HISTORICAL_PASS`, `TTO_LOCAL_RELEASE_ARVAN_STATIC_PASS`, `TTO_LOCAL_RELEASE_OCI_FOUR_IMAGE_PASS`, `TTO_LOCAL_RELEASE_EXTRA_PASS`, `TTO_LOCAL_RELEASE_PASS_SHA=<sha>` and `TTO_LOCAL_TEMP_CONTAINERS_AND_VOLUME_REMOVED=true` **plus caller exit code 0**.
- If any assertion fails, mark `RELEASE=FAIL` and inspect the transcript. Do not ignore a red E2E, Docker or build step. Code currently has **static inspection only**; no claim of a real Release PASS until the user provides actual Windows output.
- GitHub hosted Actions at current quota remain blocked; a real local Release pass is strong technical evidence but does **not** mark any GitHub required status as green or constitute approval to merge Draft PRs.

## Hard legal/data gates
- No actual cooperative membership, national ID verification, real person record, share ownership, live ShareOwnershipLedger import, payment or share transfer. All financial/business authority requires separate documented source approvals, RuleSnapshot and the legally independent Child04/06/07 review before any data activation.
- No edits to `main`, hosted Supabase, Vercel SSO/production, ArvanCloud, GitHub billing, Docker Compose projects, local database volumes, or real credentials.
- Once Release is verified, resume designing and implementing the **shareholder panel** in a new Draft PR rooted on this stack. Keep owner-sourced read-only identity/member/holdings contract and fail-closed unknown vs zero semantics; no live data until legal source gates pass.
