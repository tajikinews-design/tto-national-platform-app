#Requires -Version 5.1
<#
  TTO local Core security CI for Windows PowerShell and Docker Desktop.
  Exact tracked Git source only. Disposable PG17 and Node22 share a private
  Docker network namespace, without publishing any host ports.
  Never runs Compose, modifies another container or accesses hosted DB.
#>
[CmdletBinding()]
param(
    [string]$Repository = "",
    [string]$ExpectedCommit = "",
    [ValidateSet("Core","Release")][string]$Suite = "Core"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw ("MISSING_TOOL: {0}" -f $Name)
    }
}
function Docker-Checked([string]$Label, [string[]]$Arguments) {
    Write-Host ("=== {0} ===" -f $Label) -ForegroundColor Cyan
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw ("DOCKER_STEP_FAILED: {0}; exit={1}" -f $Label, $LASTEXITCODE)
    }
}
function Run-Node([string]$Label, [string]$Command) {
    Docker-Checked $Label @(
        "exec", $script:nodeContainer, "bash", "-lc",
        ("set -euo pipefail; cd /workspace; " + $Command)
    )
}
function Run-SQL([string]$RelativePath) {
    Docker-Checked ("SQL: {0}" -f $RelativePath) @(
        "exec", $script:pgContainer, "psql", "-U", "postgres", "-d", "tto",
        "-v", "ON_ERROR_STOP=1", "-f", ("/workspace/" + $RelativePath)
    )
}

Require-Command "git"
Require-Command "docker"
if (-not $Repository) {
    $Repository = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
}
$Repository = (Resolve-Path -LiteralPath $Repository).Path
if (-not (Test-Path -LiteralPath (Join-Path $Repository ".git"))) {
    throw "GIT_CHECKOUT_REQUIRED"
}
$commit = (& git -C $Repository rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -notmatch "^[0-9a-f]{40}$") {
    throw "INVALID_GIT_HEAD"
}
if ($ExpectedCommit -and $ExpectedCommit -ne $commit) {
    throw ("COMMIT_MISMATCH: expected {0} got {1}" -f $ExpectedCommit, $commit)
}
& docker info --format "{{.ServerVersion}}" *> $null
if ($LASTEXITCODE -ne 0) { throw "DOCKER_DESKTOP_LINUX_ENGINE_UNAVAILABLE" }

$runId = [guid]::NewGuid().ToString("N").Substring(0, 12)
$pgContainer = "tto-local-ci-pg-$runId"
$nodeContainer = "tto-local-ci-node-$runId"
$networkName = "tto-local-ci-net-$runId"
$sourceVolume = "tto-local-ci-src-$runId"
$tempFolder = Join-Path $env:TEMP "tto-local-ci-$runId"
$reportsFolder = Join-Path $env:USERPROFILE "Downloads\TTO-Local-CI-Reports"
New-Item -ItemType Directory -Path $tempFolder, $reportsFolder -Force | Out-Null
$archivePath = Join-Path $tempFolder "tracked-source.tar"
$logPath = Join-Path $reportsFolder ("TTO-" + $Suite + "-" + (Get-Date -Format "yyyyMMdd-HHmmss") + "-$runId.log")
$hasVolume = $false
$hasNetwork = $false
$hasPostgres = $false
$hasNode = $false

Start-Transcript -Path $logPath -Force | Out-Null
try {
    Write-Host "TTO_LOCAL_SUITE=$Suite"
    Write-Host "TTO_LOCAL_SOURCE_SHA=$commit"
    Write-Host "TTO_LOCAL_DATABASE=DISPOSABLE_POSTGRES17"
    Write-Host "TTO_LOCAL_HOST_PORTS=NONE"
    Write-Host "TTO_LOCAL_LOG=$logPath"

    # The archive contains only tracked Git files, never uncommitted host files.
    # Fail before copying if a possibly sensitive file was committed by mistake.
    $tracked = @(& git -C $Repository ls-files)
    if ($LASTEXITCODE -ne 0) { throw "GIT_TRACKED_FILE_LIST_FAILED" }
    $sensitive = @($tracked | Where-Object {
        $base = [IO.Path]::GetFileName([string]$_).ToLowerInvariant()
        ($base -eq ".env" -or $base.StartsWith(".env.")) -and $base -ne ".env.example" -or
        $base -in @(".npmrc", ".pypirc", "id_rsa", "id_ed25519") -or
        $base.EndsWith(".pem") -or $base.EndsWith(".p12") -or $base.EndsWith(".pfx")
    })
    if ($sensitive.Count -gt 0) {
        throw ("POTENTIAL_TRACKED_SECRET_FILES_REFUSE_LOCAL_CI_ARCHIVE: {0}" -f $sensitive.Count)
    }

    & git -C $Repository archive --format=tar "--output=$archivePath" HEAD
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $archivePath)) {
        throw "EXACT_GIT_SOURCE_ARCHIVE_FAILED"
    }
    $archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    Write-Host "TTO_LOCAL_SOURCE_ARCHIVE_SHA256=$archiveHash"

    Docker-Checked "Create private source volume" @("volume", "create", $sourceVolume)
    $hasVolume = $true
    Docker-Checked "Create dedicated Docker test network" @(
        "network", "create", "--driver", "bridge", $networkName
    )
    $hasNetwork = $true
    Docker-Checked "Start private PostgreSQL17 with no published ports" @(
        "run", "-d", "--rm", "--name", $pgContainer, "--network", $networkName,
        "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-e", "POSTGRES_DB=tto",
        "-v", ($sourceVolume + ":/workspace"), "postgres:17"
    )
    $hasPostgres = $true

    $postgresReady = $false
    for ($attempt = 0; $attempt -lt 90; $attempt++) {
        & docker exec $pgContainer pg_isready -U postgres -d tto *> $null
        if ($LASTEXITCODE -eq 0) { $postgresReady = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $postgresReady) { throw "PRIVATE_POSTGRES17_NOT_READY" }

    Docker-Checked "Start private Node22, sharing only PostgreSQL namespace" @(
        "run", "-d", "--rm", "--name", $nodeContainer,
        "--network", ("container:" + $pgContainer),
        "-v", ($sourceVolume + ":/workspace"), "-w", "/workspace",
        "-e", "CI=true", "-e", "TTO_LOOPBACK_E2E=1",
        "-e", "NEXT_TELEMETRY_DISABLED=1", "-e", "APIIR_TOKEN=",
        "-e", "TEST_ADMIN_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/tto",
        "node:22-bookworm", "sleep", "infinity"
    )
    $hasNode = $true
    Docker-Checked "Copy committed source tar only" @(
        "cp", $archivePath, ($nodeContainer + ":/tmp/tracked-source.tar")
    )
    Docker-Checked "Extract tracked SHA inside isolated volume" @(
        "exec", $nodeContainer, "tar", "-xf", "/tmp/tracked-source.tar",
        "-C", "/workspace"
    )

    if ($Suite -eq "Release") {
        # Run the Docker security attestation BEFORE costly Core build/tests.
        $releaseParameters = @{
            RunId = $runId
            PostgresContainer = $pgContainer
            NodeContainer = $nodeContainer
            SourceVolume = $sourceVolume
            PrivateNetwork = $networkName
            ReviewedArchive = $archivePath
            TempFolder = $tempFolder
        }
        & (Join-Path $PSScriptRoot "local-release-helper.ps1") @releaseParameters -AttestationOnly
    }

    Docker-Checked "Offline Python baseline and CI policy checks" @(
        "run", "--rm", "--network", "none",
        "-v", ($sourceVolume + ":/workspace"), "-w", "/workspace",
        "python:3.13-slim", "sh", "-c",
        "set -eu; python3 scripts/check_source_baseline.py; python3 -m unittest discover -s tests -v; python3 -m unittest discover -s scripts/ci -p test_*.py -v; python3 scripts/build_preview.py"
    )

    Run-Node "Install pinned dependencies (once)" "npm config set fetch-retries 8; npm config set fetch-retry-mintimeout 20000; npm config set fetch-retry-maxtimeout 120000; npm install -g pnpm@10.18.0; pnpm install --frozen-lockfile --network-concurrency=3 || (sleep 15; pnpm install --frozen-lockfile --network-concurrency=3) || (sleep 30; pnpm install --frozen-lockfile --network-concurrency=3)"
    Run-Node "Shareholder TSX AST and UI type preflight" "node scripts/ci/verify-shareholder-tsx.cjs; node --check scripts/e2e-phase4c-real-session-browser.cjs; node --check scripts/e2e-shareholder-nav06-review.cjs; node --check scripts/e2e-shareholder-nav07-review.cjs; node --check scripts/e2e-shareholder-nav08-review.cjs; node --check scripts/e2e-shareholder-nav09-review.cjs; node --check scripts/e2e-shareholder-nav10-review.cjs; node --check scripts/e2e-shareholder-nav11-review.cjs; node --check scripts/e2e-shareholder-w1-integrated-audit.cjs; pnpm --filter @tto/ui typecheck"
    Run-Node "W1 isolated Next BFF to Nest and PEP/PDP integration security test" "command -v python3 >/dev/null; CI=true TTO_LOOPBACK_E2E=1 TTO_W1_CHAIN_LAB=1 APIIR_TOKEN= DATABASE_URL= TTO_API_BASE_URL= node --test scripts/ci/w1-bff-nest-pep-chain.test.cjs"
    Run-Node "Build all portals and API; typecheck" "pnpm build; pnpm check"
    Run-Node "SMS mock and scanner protocol tests" "node --test services/workers/test/apiir-smsotp.test.cjs services/workers/test/clamav.test.cjs"
    Run-Node "SMS send disabled and Vercel protection classifier" "node --test services/api/test/sms-delivery-opt-in.test.cjs; node --test scripts/verify-vercel-preview-protection.test.mjs"
    Run-Node "Three Next portals no-credentials smoke tests" "node scripts/smoke-next-otp.mjs"

    # Ordered migrations, and exactly one file at each version; no wildcard sent to psql.
    for ($version = 1; $version -le 10; $version++) {
        $number = "{0:D4}" -f $version
        $findCommand = "find /workspace/database/migrations -maxdepth 1 -type f -name '" + $number + "_*.sql' -print"
        $found = @(& docker exec $pgContainer bash -lc $findCommand)
        if ($LASTEXITCODE -ne 0) { throw ("MIGRATION_DISCOVERY_FAILED_{0}" -f $number) }
        $files = @($found | Where-Object { $_ -and $_.Trim() })
        if ($files.Count -ne 1) {
            throw ("MIGRATION_COUNT_INVALID_{0}={1}" -f $number, $files.Count)
        }
        Docker-Checked ("Apply PG17 migration {0}" -f $number) @(
            "exec", $pgContainer, "psql", "-U", "postgres", "-d", "tto",
            "-v", "ON_ERROR_STOP=1", "-f", $files[0].Trim()
        )
    }

    Run-Node "Real Child06/07 identity, tenant and source quarantine E2E" "node scripts/e2e-cf02-identity-authority.cjs"
    # Attack matrix uses only disposable PG17 fixtures seeded by the preceding E2E.
    # All temporary PG superuser changes are ROLLBACK-ed; no live admission.
    Run-Node "Phase4E PG17 synthetic source-admission attack matrix" "node scripts/e2e-phase4e-source-admission-attack-matrix.cjs"
    # Phase4F is a TEMP/ROLLBACK-only PG17 legal-authority shadow model.
    # This does not populate tto.source_contract_approvals or grant real authority.
    Run-Node "Phase4F PG17 independent legal source-chain synthetic QA" "node scripts/e2e-phase4f-legal-authority-chain.cjs"
    Run-Node "Phase4G PG17 confidential review shadow" "node scripts/e2e-phase4g-confidential-review-shadow.cjs"
    if ($Suite -eq "Release") {
        # Real end-to-end Chromium through live Nest/Next and this invocation's
        # disposable PG17. No request interception or synthetic HTTP responses.
        # Playwright image shares the PG namespace; NO host port publication.
        Docker-Checked "Phase4C real Chromium Next Nest PG17 session revoke/expiry E2E" @(
            "run", "--rm", "--network", ("container:" + $pgContainer),
            "--security-opt", "no-new-privileges",
            "-v", ($sourceVolume + ":/workspace"), "-w", "/workspace",
            "-e", "TEST_ADMIN_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/tto",
            "-e", ("TTO_PHASE4C_EXPECTED_SOURCE_SHA=" + $commit),
            "-e", "CI=true", "-e", "TTO_LOOPBACK_E2E=1",
            "-e", "APIIR_TOKEN=", "-e", "NEXT_TELEMETRY_DISABLED=1",
            "mcr.microsoft.com/playwright:v1.56.1-noble", "bash", "-lc",
            "set -euo pipefail; npm config set fetch-retries 8; npm config set fetch-retry-mintimeout 20000; npm config set fetch-retry-maxtimeout 120000; (npm install --prefix /tmp/tto-phase4c --no-audit --no-fund --silent playwright@1.56.1 || (sleep 15; npm install --prefix /tmp/tto-phase4c --no-audit --no-fund --silent playwright@1.56.1)); test -f /tmp/tto-phase4c/node_modules/playwright/package.json; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-phase4c-real-session-browser.cjs; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-shareholder-nav03-visual-review.cjs; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-shareholder-nav04-review.cjs; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-shareholder-nav05-review.cjs; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-shareholder-nav06-review.cjs; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-shareholder-nav07-review.cjs; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-shareholder-nav08-review.cjs; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-shareholder-nav09-review.cjs; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-shareholder-nav10-review.cjs; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-shareholder-nav11-review.cjs; NODE_PATH=/tmp/tto-phase4c/node_modules node scripts/e2e-shareholder-w1-integrated-audit.cjs"
        )
        # Only synthetic renderings from private Chromium; no user records or secrets.
        $visualReportPath = Join-Path $reportsFolder ("TTO-Visual-QA-" + $runId)
        Docker-Checked "Export disposable synthetic Chromium viewport screenshots" @(
            "cp", ($nodeContainer + ":/workspace/.qa-artifacts/" + $commit), $visualReportPath
        )
        Write-Host "TTO_LOCAL_VISUAL_QA_PATH=$visualReportPath" -ForegroundColor Green
    }
    if ($Suite -eq "Release") {
        Write-Host "TTO_LOCAL_CORE_PHASE_PASS_SHA=$commit" -ForegroundColor Green
        # Same reviewed archive, same disposable Node+PG17 containers; no new host DB.
        & (Join-Path $PSScriptRoot "local-release-helper.ps1") @releaseParameters
        # The helper throws for every failed required test. Do not reuse
        # a stale native LASTEXITCODE from a best-effort cleanup command.
        Write-Host "TTO_LOCAL_RELEASE_PASS_SHA=$commit" -ForegroundColor Green
    }
    else {
        Write-Host "TTO_LOCAL_CORE_PASS_SHA=$commit" -ForegroundColor Green
    }
}
catch {
    Write-Host ("TTO_LOCAL_{0}_FAILED={1}" -f $Suite.ToUpperInvariant(), $_.Exception.Message) -ForegroundColor Red
    throw
}
finally {
    $ErrorActionPreference = "Continue"
    if ($hasNode) { & docker rm -f $nodeContainer *> $null }
    if ($hasPostgres) { & docker rm -f $pgContainer *> $null }
    if ($hasNetwork) { & docker network rm $networkName *> $null }
    if ($hasVolume) { & docker volume rm -f $sourceVolume *> $null }
    Remove-Item -LiteralPath $tempFolder -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "TTO_LOCAL_TEMP_CONTAINERS_AND_VOLUME_REMOVED=true"
    Write-Host "TTO_LOCAL_PERSISTENT_LOG=$logPath"
    Stop-Transcript | Out-Null
}
