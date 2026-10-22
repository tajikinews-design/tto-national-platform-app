#Requires -Version 5.1
<#
  TTO Windows local Core E2E. Requires Git and Docker Desktop.
  Exact committed source only, private containers, no host ports, no live DB.
  This never installs a GitHub self-hosted runner or accesses external project secrets.
#>
[CmdletBinding()]
param([string]$Repository="", [string]$ExpectedCommit="")
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"
$ProgressPreference="SilentlyContinue"

function Need([string]$name) {
  if(-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "REQUIRED_TOOL_MISSING: $name" }
}
function DockerChecked([string]$label,[string[]]$arguments) {
  Write-Host "=== $label ===" -ForegroundColor Cyan
  & docker @arguments
  if($LASTEXITCODE -ne 0) { throw "FAILED_$label : docker exit code $LASTEXITCODE" }
}
function NodeRun([string]$label,[string]$cmd) {
  DockerChecked $label @("exec",$script:runner,"bash","-lc","set -euo pipefail; cd /workspace; $cmd")
}
function SqlFile([string]$relative) {
  DockerChecked "SQL $relative" @("exec",$script:pg,"psql","-U","postgres","-d","tto","-v","ON_ERROR_STOP=1","-f","/workspace/$relative")
}
Need "git"; Need "docker"
if(-not $Repository) { $Repository=(Resolve-Path (Join-Path $PSScriptRoot "../..")).Path }
$Repository=(Resolve-Path -LiteralPath $Repository).Path
if(-not (Test-Path (Join-Path $Repository ".git"))) { throw "GIT_CHECKOUT_REQUIRED" }
$sha=(& git -C $Repository rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $sha -notmatch "^[a-f0-9]{40}$") { throw "INVALID_GIT_COMMIT" }
if($ExpectedCommit -and $sha -ne $ExpectedCommit) { throw "WRONG_COMMIT: expected $ExpectedCommit; got $sha" }
& docker info --format "{{.ServerVersion}}" *> $null
if($LASTEXITCODE -ne 0) { throw "DOCKER_DESKTOP_NOT_RUNNING" }

$id=[guid]::NewGuid().ToString("N").Substring(0,12)
$pg="tto-local-ci-pg-$id"
$runner="tto-local-ci-node-$id"
$sourceVolume="tto-local-ci-src-$id"
$work=Join-Path $env:TEMP "tto-local-ci-$id"
$reports=Join-Path $env:USERPROFILE "Downloads\TTO-Local-CI-Reports"
New-Item -ItemType Directory -Force -Path $work,$reports | Out-Null
$archive=Join-Path $work "reviewed-source.tar"
$log=Join-Path $reports ("TTO-Core-"+(Get-Date -Format "yyyyMMdd-HHmmss")+"-$id.log")
$volumeMade=$false; $pgMade=$false; $runnerMade=$false
Start-Transcript -Path $log -Force | Out-Null
try {
  Write-Host "TTO_LOCAL_SOURCE_SHA=$sha"
  Write-Host "TTO_LOCAL_NO_PUBLISHED_PORTS=true"
  Write-Host "TTO_LOCAL_DATABASE=DISPOSABLE_POSTGRES17"
  Write-Host "TTO_LOCAL_LOG=$log"
  $dirty=& git -C $Repository status --porcelain
  if($dirty) { Write-Host "NOTE: Uncommitted local files are EXCLUDED from test source." }
  & git -C $Repository archive --format=tar "--output=$archive" HEAD
  if($LASTEXITCODE -ne 0 -or -not (Test-Path $archive)) { throw "REVIEWED_SOURCE_ARCHIVE_FAILED" }

  DockerChecked "Create isolated source volume" @("volume","create",$sourceVolume)
  $volumeMade=$true
  DockerChecked "Start isolated PostgreSQL17 (no host port)" @(
    "run","-d","--rm","--name",$pg,
    "-e","POSTGRES_HOST_AUTH_METHOD=trust","-e","POSTGRES_DB=tto",
    "-v","$($sourceVolume):/workspace","postgres:17")
  $pgMade=$true
  $dbReady=$false
  for($i=0;$i -lt 90;$i++) {
    & docker exec $pg pg_isready -U postgres -d tto *> $null
    if($LASTEXITCODE -eq 0) { $dbReady=$true; break }
    Start-Sleep -Seconds 1
  }
  if(-not $dbReady) { throw "POSTGRES17_NOT_READY" }

  DockerChecked "Start Node 22 in same isolated Docker network" @(
    "run","-d","--rm","--name",$runner,
    "--network","container:$pg","-v","$($sourceVolume):/workspace",
    "-w","/workspace","-e","CI=true","-e","TTO_LOOPBACK_E2E=1",
    "-e","NEXT_TELEMETRY_DISABLED=1","-e","APIIR_TOKEN=",
    "-e","TEST_ADMIN_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/tto",
    "node:22-bookworm","sleep","infinity")
  $runnerMade=$true
  DockerChecked "Copy tracked Git source only" @("cp",$archive,"$($runner):/tmp/reviewed.tar")
  DockerChecked "Extract exact Git SHA inside temporary Docker volume" @(
    "exec",$runner,"tar","-xf","/tmp/reviewed.tar","-C","/workspace")
  DockerChecked "Offline baseline, Python tests and CI policy tests" @(
    "run","--rm","--network","none","-v","$($sourceVolume):/workspace",
    "-w","/workspace","python:3.13-slim","sh","-c",
    "set -eu; python3 scripts/check_source_baseline.py; python3 -m unittest discover -s tests -v; python3 -m unittest discover -s scripts/ci -p 'test_*.py' -v; python3 scripts/build_preview.py")
  NodeRun "Install pinned pnpm and lockfile dependencies" "npm install -g pnpm@10.18.0; pnpm install --frozen-lockfile"
  NodeRun "Build 3 Next portals and Nest; typecheck" "pnpm build; pnpm check"
  NodeRun "Offline SMS, ClamAV and Vercel-protection unit tests" "node --test services/workers/test/apiir-smsotp.test.cjs services/workers/test/clamav.test.cjs; node --test services/api/test/sms-delivery-opt-in.test.cjs; node --test scripts/verify-vercel-preview-protection.test.mjs"
  NodeRun "Three Next portal runtime security smoke checks" "node scripts/smoke-next-otp.mjs"

  foreach($i in 1..10) {
    $n=("{0:D4}" -f $i)
    $files=@(& docker exec $pg bash -lc "find /workspace/database/migrations -maxdepth 1 -type f -name '$($n)_*.sql' -print")
    if($LASTEXITCODE -ne 0) { throw "MIGRATION_LOOKUP_ERROR_$n" }
    $matched=@($files | Where-Object { $_ })
    if($matched.Count -ne 1) { throw "MIGRATION_COUNT_NOT_ONE_$n" }
    DockerChecked "Apply isolated migration $n" @(
      "exec",$pg,"psql","-U","postgres","-d","tto","-v","ON_ERROR_STOP=1","-f",$matched[0].Trim())
  }
  NodeRun "Real CF02 identity, management, national and Child06/07 source quarantine E2E" "node scripts/e2e-cf02-identity-authority.cjs"
  Write-Host "TTO_LOCAL_CORE_PASS_SHA=$sha" -ForegroundColor Green
} catch {
  Write-Host "TTO_LOCAL_CORE_FAILED=$($_.Exception.Message)" -ForegroundColor Red
  throw
} finally {
  $ErrorActionPreference="Continue"
  if($runnerMade) { & docker rm -f $runner *> $null }
  if($pgMade) { & docker rm -f $pg *> $null }
  if($volumeMade) { & docker volume rm -f $sourceVolume *> $null }
  Remove-Item -LiteralPath $work -Force -Recurse -ErrorAction SilentlyContinue
  Write-Host "TTO_LOCAL_TEMP_CONTAINERS_AND_VOLUME_REMOVED=true"
  Write-Host "TTO_LOCAL_PERSISTENT_LOG=$log"
  Stop-Transcript | Out-Null
}
