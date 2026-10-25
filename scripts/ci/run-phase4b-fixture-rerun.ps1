#Requires -Version 5.1
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$Repository,
 [Parameter(Mandatory=$true)][string]$HarnessCommit,
 [string]$RuntimeCommit="e0ba3a3a95cf0a03b2c02aa59ddf4d1255f6280f",
 [string]$ReportsDirectory="D:\TTO-Phase4B-Session-QA-Reports",
 [switch]$RunRelease
)
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"
$ProgressPreference="SilentlyContinue"
$Repository=(Resolve-Path -LiteralPath $Repository).Path
foreach($sha in @($HarnessCommit,$RuntimeCommit)){
 if($sha -cnotmatch '^[a-f0-9]{40}$'){throw "SHA_INVALID"}
}
$head=@(& git -C $Repository rev-parse HEAD)
if($LASTEXITCODE -ne 0 -or $head.Count -ne 1 -or $head[0].Trim() -cne $HarnessCommit){throw "HARNESS_SHA_MISMATCH"}
$origin=@(& git -C $Repository remote get-url origin)
if($LASTEXITCODE -ne 0 -or $origin.Count -ne 1 -or $origin[0] -notmatch '(?i)github\.com[:/]tajikinews-design/tto-national-platform-app(?:\.git)?$'){throw "UNEXPECTED_GIT_ORIGIN"}
$dirty=@(& git -C $Repository status --porcelain)
if($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0){throw "HARNESS_WORKTREE_NOT_CLEAN"}
$allowed=@(
 "scripts/ci/phase4b-session-browser.cjs",
 "scripts/ci/test_shareholder_phase4b_browser.py",
 "scripts/ci/run-phase4b-fixture-rerun.ps1",
 "docs/reports/SHAREHOLDER_SESSION_PRIVACY_PHASE4B_2026-10-25.md",
 "status/PHASE_GATES.json"
)
$changed=@(& git -C $Repository diff --name-only $RuntimeCommit $HarnessCommit)
if($LASTEXITCODE -ne 0 -or $changed.Count -eq 0){throw "SOURCE_DIFF_INVALID"}
foreach($path in $changed){if($allowed -cnotcontains $path){throw "APPLICATION_CHANGED_REBUILD_REQUIRED=$path"}}
$container="tto-phase4b-session-"+$RuntimeCommit.Substring(0,12)
$raw=@(& docker inspect --type container --format '{{json .}}' $container)
if($LASTEXITCODE -ne 0 -or $raw.Count -ne 1){throw "EXISTING_RUNTIME_NOT_FOUND"}
$c=$raw[0]|ConvertFrom-Json
$owner=$c.Config.Labels.PSObject.Properties["tto.phase4b.sha"]
if($null -eq $owner -or [string]$owner.Value -cne $RuntimeCommit){throw "EXISTING_RUNTIME_OWNER_MISMATCH"}
if(-not $c.State.Running){throw "EXISTING_RUNTIME_NOT_RUNNING"}
$ready=@(& docker exec $container bash -lc 'test -s /workspace/apps/shareholder/.next/BUILD_ID && test -f /workspace/apps/shareholder/node_modules/next/dist/bin/next && echo READY')
if($LASTEXITCODE -ne 0 -or $ready -cnotcontains "READY"){throw "EXISTING_RUNTIME_BUILD_MISSING"}
$server="http://127.0.0.1:32165/modules/nav-02"
$resp=Invoke-WebRequest -UseBasicParsing -Uri $server -TimeoutSec 10
if($resp.StatusCode -ne 200){throw "EXISTING_RUNTIME_NOT_HTTP_200"}
$dir=Join-Path $ReportsDirectory "trade401-corrected"
New-Item -ItemType Directory -Path $dir -Force|Out-Null
$script=Join-Path $Repository "scripts\ci\phase4b-session-browser.cjs"
if(-not(Test-Path -LiteralPath $script -PathType Leaf)){throw "TEST_HARNESS_MISSING"}
$testBlob=@(& git -C $Repository hash-object -- "scripts/ci/phase4b-session-browser.cjs")
if($LASTEXITCODE -ne 0 -or $testBlob.Count -ne 1){throw "TEST_HARNESS_BLOB_MISSING"}
Write-Host "APPLICATION_SHA=$RuntimeCommit" -ForegroundColor Cyan
Write-Host "CORRECTED_HARNESS_SHA=$HarnessCommit" -ForegroundColor Cyan
Write-Host "HARNESS_BLOB=$($testBlob[0])"
Write-Host "EXISTING_APPLICATION_BUILD_REUSED_NO_REINSTALL" -ForegroundColor Green
$command='set -euo pipefail; export npm_config_fetch_retries=8 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000; for attempt in 1 2 3; do npm install --prefix /tmp/tto-browser --no-audit --no-fund --silent playwright@1.56.1 && break; sleep 15; done; test -f /tmp/tto-browser/node_modules/playwright/package.json; NODE_PATH=/tmp/tto-browser/node_modules node /tmp/phase4b-session-browser.cjs'
& docker run --rm --network ("container:"+$container) --security-opt no-new-privileges --mount ("type=bind,source="+$script+",target=/tmp/phase4b-session-browser.cjs,readonly") --mount ("type=bind,source="+$dir+",target=/results") -e "TTO_PHASE4B_BASE_URL=http://127.0.0.1:32165" -e "TTO_PHASE4B_OUTPUT_DIR=/results" -e ("TTO_PHASE4B_EXPECTED_SOURCE_SHA="+$RuntimeCommit) mcr.microsoft.com/playwright:v1.56.1-noble bash -lc $command
if($LASTEXITCODE -ne 0){throw "CORRECTED_BROWSER_SUITE_FAILED"}
$report=Join-Path $dir "phase4b-session-report.json"
if(-not(Test-Path -LiteralPath $report)){throw "BROWSER_REPORT_MISSING"}
$data=Get-Content -LiteralPath $report -Raw -Encoding UTF8|ConvertFrom-Json
if(-not $data.pass -or $data.casesExecuted -ne 11 -or $data.casesPassed -ne 11 -or $data.sourceSha -cne $RuntimeCommit -or -not $data.browserOnlySyntheticBff -or $data.realAuthenticationVerified){throw "CORRECTED_BROWSER_GATE_FAILED"}
$meta=[ordered]@{
 applicationSha=$RuntimeCommit
 harnessSha=$HarnessCommit
 harnessBlob=$testBlob[0]
 simulatedCasesPassed=$data.casesPassed
 realAuthenticationVerified=$false
 releaseValidated=$false
 evidenceKind="MOCK_ONLY_BROWSER_RETEST_WITH_UNCHANGED_APPLICATION_BUILD"
}
$metaFile=Join-Path $dir "rerun-evidence.json"
[IO.File]::WriteAllText($metaFile,($meta|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
Write-Host "TTO_PHASE4B_CORRECTED_BROWSER_PASS=11_OF_11" -ForegroundColor Green
Write-Host "BROWSER_REPORT=$report"
Write-Host "ATTESTATION=$metaFile"
if($RunRelease){
 Write-Host "=== EXACT_NEW_SHA_DISPOSABLE_RELEASE ===" -ForegroundColor Cyan
 $release=Join-Path $Repository "scripts\ci\run-local-docker.ps1"
 $original=Get-Content -LiteralPath $release -Raw -Encoding UTF8
 $old='Run-Node "Install pinned dependencies (once)" "npm install -g pnpm@10.18.0; pnpm install --frozen-lockfile"'
 $new='Run-Node "Install pinned dependencies (once)" "npm config set fetch-retries 8; npm config set fetch-retry-mintimeout 20000; npm install -g pnpm@10.18.0; pnpm config set fetch-retries 8; pnpm config set network-concurrency 3; (pnpm install --frozen-lockfile --network-concurrency=3 || (sleep 15; pnpm install --frozen-lockfile --network-concurrency=3) || (sleep 15; pnpm install --frozen-lockfile --network-concurrency=3))"'
 if(-not $original.Contains($old)){throw "RELEASE_TRANSPORT_ANCHOR_NOT_FOUND"}
 $runnerDir=Join-Path $dir "transport-retry-only"
 New-Item -ItemType Directory -Path $runnerDir -Force|Out-Null
 $runner=Join-Path $runnerDir "run-local-docker.ps1"
 $replace=$original.Replace($old,$new)
 [IO.File]::WriteAllText($runner,$replace,[Text.UTF8Encoding]::new($true))
 Copy-Item -LiteralPath (Join-Path $Repository "scripts\ci\local-release-helper.ps1") -Destination (Join-Path $runnerDir "local-release-helper.ps1") -Force
 $tokens=$null;$errors=$null
 [Management.Automation.Language.Parser]::ParseFile($runner,[ref]$tokens,[ref]$errors)|Out-Null
 if($errors -and $errors.Count -gt 0){throw "RELEASE_TRANSPORT_PATCH_SYNTAX_FAILED"}
 Write-Host "ORIGINAL_RELEASE_SCRIPT_SHA256=$((Get-FileHash $release -Algorithm SHA256).Hash)"
 Write-Host "TEMP_TRANSPORT_RETRY_SHA256=$((Get-FileHash $runner -Algorithm SHA256).Hash)"
 & powershell.exe -NoProfile -NoLogo -ExecutionPolicy Bypass -File $runner -Repository $Repository -ExpectedCommit $HarnessCommit -Suite Release
 if($LASTEXITCODE -ne 0){throw "PHASE4B_EXACT_SHA_RELEASE_FAILED"}
 $meta.releaseValidated=$true
 [IO.File]::WriteAllText($metaFile,($meta|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
 Write-Host "TTO_PHASE4B_EXACT_SHA_DOCKER_RELEASE_PASS=$HarnessCommit" -ForegroundColor Green
}
