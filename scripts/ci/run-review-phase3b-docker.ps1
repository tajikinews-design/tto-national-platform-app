#Requires -Version 5.1
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$Repository,
 [Parameter(Mandatory=$true)][string]$ExpectedCommit,
 [string]$ReportsDirectory="D:\TTO-Phase3B-Visual-Reports",
 [switch]$TestOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"
$ProgressPreference="SilentlyContinue"

function Require([string]$Command) {
 if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) { throw "MISSING_TOOL=$Command" }
}
function DockerCheck([string]$Description,[string[]]$Args) {
 Write-Host "=== $Description ===" -ForegroundColor Cyan
 & docker @Args
 if ($LASTEXITCODE -ne 0) { throw "DOCKER_STEP_FAILED=$Description; exit=$LASTEXITCODE" }
}
function ReadDockerObject([string[]]$Args,[string]$ErrorId) {
 $lines=@(& docker @Args)
 if ($LASTEXITCODE -ne 0 -or $lines.Count -ne 1) { throw $ErrorId }
 return ($lines[0] | ConvertFrom-Json)
}
Require "git"
Require "docker"
$Repository=(Resolve-Path -LiteralPath $Repository).Path
$ExpectedCommit=$ExpectedCommit.ToLowerInvariant()
if($ExpectedCommit -cnotmatch "^[a-f0-9]{40}$") { throw "INVALID_EXPECTED_SHA" }
$Sha=@(& git -C $Repository rev-parse HEAD)
if($LASTEXITCODE -ne 0 -or $Sha.Count -ne 1 -or $Sha[0].Trim() -cne $ExpectedCommit) {
 throw "SOURCE_COMMIT_MISMATCH"
}
$Origin=@(& git -C $Repository remote get-url origin)
if($LASTEXITCODE -ne 0 -or $Origin.Count -ne 1 -or $Origin[0] -notmatch "(?i)github\.com[:/]tajikinews-design/tto-national-platform-app(?:\.git)?$") {
 throw "UNEXPECTED_SOURCE_REPOSITORY"
}
$Dirty=@(& git -C $Repository status --porcelain)
if($LASTEXITCODE -ne 0 -or $Dirty.Count -gt 0) { throw "SOURCE_WORKTREE_NOT_CLEAN" }
$tracked=@(& git -C $Repository ls-files)
if($LASTEXITCODE -ne 0) { throw "GIT_FILE_LIST_FAILED" }
$secrets=@($tracked | Where-Object {
 $leaf=[IO.Path]::GetFileName([string]$_).ToLowerInvariant()
 (($leaf -eq ".env" -or $leaf.StartsWith(".env.")) -and $leaf -ne ".env.example") -or
 $leaf -in @(".npmrc",".pypirc","id_rsa","id_ed25519") -or
 $leaf.EndsWith(".pem") -or $leaf.EndsWith(".pfx") -or $leaf.EndsWith(".p12")
})
if($secrets.Count -gt 0) { throw "TRACKED_SENSITIVE_FILES_REFUSE_ARCHIVE" }
$dockerInfo=@(& docker info --format '{{.ServerVersion}}')
if($LASTEXITCODE -ne 0 -or $dockerInfo.Count -ne 1) { throw "DOCKER_ENGINE_UNAVAILABLE" }
$names=@(& docker ps -a --format '{{.Names}}')
if($LASTEXITCODE -ne 0) { throw "DOCKER_CONTAINER_QUERY_FAILED" }
$short=$ExpectedCommit.Substring(0,12)
$container="tto-phase3b-review-$short"
$volume="tto-phase3b-src-$short"
$labelKey="tto.phase3b.sha"
$port=32155
$baseUrl="http://127.0.0.1:$port"
New-Item -ItemType Directory -Path $ReportsDirectory -Force | Out-Null
$ReportsDirectory=(Resolve-Path -LiteralPath $ReportsDirectory).Path

$existingVolumes=@(& docker volume ls -q)
if($LASTEXITCODE -ne 0) { throw "DOCKER_VOLUME_QUERY_FAILED" }
$hasVolume=$existingVolumes -ccontains $volume
if($hasVolume) {
 $v=ReadDockerObject @("volume","inspect","--format","{{json .}}",$volume) "DOCKER_VOLUME_INSPECT_FAILED"
 $owner=$v.Labels.PSObject.Properties[$labelKey]
 if($null -eq $owner -or [string]$owner.Value -cne $ExpectedCommit) { throw "VOLUME_OWNER_MISMATCH" }
} elseif (-not $TestOnly) {
 DockerCheck "Create exact-SHA source volume" @("volume","create","--label",($labelKey+"="+$ExpectedCommit),$volume)
} else { throw "TESTONLY_VOLUME_NOT_FOUND" }

if($names -ccontains $container) {
 $object=ReadDockerObject @("inspect","--type","container","--format","{{json .}}",$container) "DOCKER_CONTAINER_INSPECT_FAILED"
 $owner=$object.Config.Labels.PSObject.Properties[$labelKey]
 if($null -eq $owner -or [string]$owner.Value -cne $ExpectedCommit) { throw "CONTAINER_OWNER_MISMATCH" }
 if(-not $object.State.Running) {
  DockerCheck "Start owned paused container" @("start",$container)
 }
} elseif (-not $TestOnly) {
 DockerCheck "Start isolated Next container on localhost only" @(
  "run","-d","--rm","--name",$container,"--label",($labelKey+"="+$ExpectedCommit),
  "-p",("127.0.0.1:"+$port+":"+$port),
  "-v",($volume+":/workspace"),"-w","/workspace",
  "-e","NEXT_TELEMETRY_DISABLED=1","-e","TTO_API_BASE_URL=","-e","APIIR_TOKEN=",
  "node:22-bookworm","sleep","infinity"
 )
} else { throw "TESTONLY_CONTAINER_NOT_FOUND" }

$built=@(& docker exec $container bash -lc 'test -s /workspace/apps/shareholder/.next/BUILD_ID && test -f /workspace/apps/shareholder/node_modules/next/dist/bin/next && test -f /workspace/scripts/ci/review-phase3b-browser.cjs && echo READY')
if($LASTEXITCODE -ne 0 -or $built -cnotcontains "READY") {
 if($TestOnly) { throw "TESTONLY_BUILD_NOT_READY" }
 $tmpTar=Join-Path $env:TEMP ("tto-phase3b-"+[guid]::NewGuid().ToString("N")+".tar")
 try {
  & git -C $Repository archive "--output=$tmpTar" --format=tar $ExpectedCommit
  if($LASTEXITCODE -ne 0) { throw "SOURCE_ARCHIVE_FAILED" }
  DockerCheck "Copy source archive" @("cp",$tmpTar,($container+":/tmp/source.tar"))
  DockerCheck "Build shareholder review from pinned source" @(
   "exec",$container,"bash","-lc",
   "set -euo pipefail; cd /workspace; tar -xf /tmp/source.tar; npm install -g pnpm@10.18.0; pnpm install --frozen-lockfile; pnpm --filter @tto/shareholder build"
  )
 } finally { Remove-Item -LiteralPath $tmpTar -Force -ErrorAction SilentlyContinue }
} else {
 Write-Host "TTO_PHASE3B_REUSE_PREVIOUS_BUILD" -ForegroundColor Green
}

$healthy=$false
try { $check=Invoke-WebRequest -UseBasicParsing -Uri ($baseUrl+"/review") -TimeoutSec 5; $healthy=$check.StatusCode -eq 200 }catch{}
if(-not $healthy){
 DockerCheck "Start localhost shareholder Next server" @(
  "exec","-d",$container,"bash","-lc",
  ("cd /workspace/apps/shareholder; exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "+$port+" >/tmp/phase3b-next.log 2>&1")
 )
}
$ready=$false
for($i=0;$i -lt 90;$i++){
 try {
  $r=Invoke-WebRequest -UseBasicParsing -Uri ($baseUrl+"/review") -TimeoutSec 5
  if($r.StatusCode -eq 200){$ready=$true;break}
 }catch{}
 Start-Sleep -Seconds 2
}
if(-not $ready){
 & docker exec $container bash -lc 'tail -n 60 /tmp/phase3b-next.log'
 throw "NEXT_PREVIEW_NOT_READY"
}
Write-Host "TTO_PHASE3B_LOCAL_PREVIEW=$baseUrl/review" -ForegroundColor Green

DockerCheck "Chromium 62-screen regression and screenshot capture" @(
 "run","--rm","--network",("container:"+$container),
 "--security-opt","no-new-privileges",
 "--mount",("type=volume,source="+$volume+",target=/workspace,readonly"),
 "--mount",("type=bind,source="+$ReportsDirectory+",target=/results"),
 "-e",("TTO_REVIEW_BASE_URL="+$baseUrl),
 "-e","TTO_REVIEW_OUTPUT_DIR=/results",
 "-e",("TTO_REVIEW_EXPECTED_SOURCE_SHA="+$ExpectedCommit),
 "mcr.microsoft.com/playwright:v1.56.1-noble","bash","-lc",
 "set -euo pipefail; npm install --prefix /tmp/tto-browser --no-audit --no-fund --silent playwright@1.56.1; NODE_PATH=/tmp/tto-browser/node_modules node /workspace/scripts/ci/review-phase3b-browser.cjs"
)
$report=Join-Path $ReportsDirectory "phase3b-report.json"
if(-not(Test-Path -LiteralPath $report)) { throw "PHASE3B_REPORT_MISSING" }
$result=Get-Content -LiteralPath $report -Raw -Encoding UTF8 | ConvertFrom-Json
if(-not $result.pass -or $result.screenshotsCaptured -ne 62 -or $result.reviewedSourceSha -cne $ExpectedCommit) {
 throw "PHASE3B_BROWSER_ACCEPTANCE_INCOMPLETE"
}
Write-Host "TTO_PHASE3B_LOCAL_BROWSER_PASS_SHA=$ExpectedCommit" -ForegroundColor Green
Write-Host "TTO_PHASE3B_REPORT=$report"
