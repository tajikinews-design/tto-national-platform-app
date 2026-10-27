#Requires -Version 5.1
<#
.SYNOPSIS
 Run W1 NAV03+NAV04 exact-SHA local QA: Python, full Docker Release,
 then real Chromium desktop/mobile interaction and capture reports.

.NOTES
 No deploy/merge/source connection. Stores transcript and SHA-pinned reports
 outside the Git worktree; refuses dirty/unexpected/unencrypted source origins.
#>
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$Repository,
 [Parameter(Mandatory=$true)][string]$ExpectedCommit,
 [string]$ReportsRoot="$env:USERPROFILE\Downloads\TTO-Local-CI-Reports",
 [switch]$SkipFullRelease,
 [switch]$KeepVisualContainers
)
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"
$ProgressPreference="SilentlyContinue"
function Require-Command([string]$Name) {
 if(-not(Get-Command $Name -ErrorAction SilentlyContinue)) { throw "MISSING_TOOL=$Name" }
}
function Exec-Checked([string]$Stage,[scriptblock]$Command) {
 Write-Host "=== $Stage ===" -ForegroundColor Cyan
 & $Command
 if($LASTEXITCODE -ne 0) { throw "STAGE_FAILED=$Stage EXIT=$LASTEXITCODE" }
}
function Assert-Report([string]$Path,[string]$Expected,[int]$Images,[string]$Name) {
 if(-not(Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Name REPORT_MISSING=$Path" }
 $Data=Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
 if(-not $Data.pass -or $Data.expectedSha -cne $Expected -or
    $Data.screenshots.Count -ne $Images -or $Data.issues.Count -gt 0) {
  throw "$Name REPORT_INVALID_OR_FAILED"
 }
 foreach($Screenshot in $Data.screenshots) {
  $Candidate=Join-Path (Split-Path $Path -Parent) ([string]$Screenshot)
  if(-not(Test-Path -LiteralPath $Candidate -PathType Leaf)) {
   throw "$Name SCREENSHOT_MISSING=$Screenshot"
  }
  if((Get-Item -LiteralPath $Candidate).Length -le 1000) {
   throw "$Name SCREENSHOT_EMPTY=$Screenshot"
  }
 }
 return $Data
}
function Cleanup-VisualOwnedResources([string]$Sha) {
 $Suffix=$Sha.Substring(0,12)
 $Name="tto-phase3b-review-$Suffix"
 $Volume="tto-phase3b-src-$Suffix"
 $Label="tto.phase3b.sha"
 $ContainerInspect=@(& docker inspect --type container --format '{{json .}}' $Name 2>$null)
 if($LASTEXITCODE -eq 0 -and $ContainerInspect.Count -eq 1) {
  $Obj=$ContainerInspect[0] | ConvertFrom-Json
  $Prop=$Obj.Config.Labels.PSObject.Properties[$Label]
  if($null -eq $Prop -or [string]$Prop.Value -cne $Sha) {
   throw "CLEANUP_REFUSED_CONTAINER_OWNER_MISMATCH"
  }
  & docker rm -f $Name | Out-Null
  if($LASTEXITCODE -ne 0) { throw "CLEANUP_CONTAINER_FAILED" }
 }
 $VolumeInspect=@(& docker volume inspect --format '{{json .}}' $Volume 2>$null)
 if($LASTEXITCODE -eq 0 -and $VolumeInspect.Count -eq 1) {
  $Obj=$VolumeInspect[0] | ConvertFrom-Json
  $Prop=$Obj.Labels.PSObject.Properties[$Label]
  if($null -eq $Prop -or [string]$Prop.Value -cne $Sha) {
   throw "CLEANUP_REFUSED_VOLUME_OWNER_MISMATCH"
  }
  & docker volume rm $Volume | Out-Null
  if($LASTEXITCODE -ne 0) { throw "CLEANUP_VOLUME_FAILED" }
 }
}

Require-Command "git"
Require-Command "python"
Require-Command "docker"
Require-Command "powershell.exe"
$Repository=(Resolve-Path -LiteralPath $Repository).Path
$ExpectedCommit=$ExpectedCommit.ToLowerInvariant()
if($ExpectedCommit -cnotmatch "^[0-9a-f]{40}$") { throw "INVALID_EXPECTED_SHA" }
$Head=@(& git -C $Repository rev-parse HEAD)
if($LASTEXITCODE -ne 0 -or $Head.Count -ne 1 -or
    $Head[0].Trim() -cne $ExpectedCommit) { throw "SOURCE_SHA_MISMATCH" }
$Origin=@(& git -C $Repository remote get-url origin)
if($LASTEXITCODE -ne 0 -or $Origin.Count -ne 1 -or
    $Origin[0] -notmatch '(?i)^(?:https://github\.com/|git@github\.com:)tajikinews-design/tto-national-platform-app(?:\.git)?$') {
 throw "UNEXPECTED_GITHUB_ORIGIN"
}
$Dirty=@(& git -C $Repository status --porcelain)
if($LASTEXITCODE -ne 0 -or $Dirty.Count -gt 0) { throw "SOURCE_WORKTREE_NOT_CLEAN" }
$Root=Join-Path $Repository "scripts\ci"
$DockerRelease=Join-Path $Root "run-local-docker.ps1"
$VisualRunner=Join-Path $Root "run-review-phase3b-docker.ps1"
foreach($File in @($DockerRelease,$VisualRunner,
                  (Join-Path $Root "nav03-interactive-browser.cjs"),
                  (Join-Path $Root "nav04-interactive-browser.cjs"))) {
 if(-not(Test-Path -LiteralPath $File -PathType Leaf)) {
  throw "QA_REQUIRED_FILE_MISSING=$File"
 }
}
if(-not(Test-Path -LiteralPath $ReportsRoot)){ New-Item -ItemType Directory -Force -Path $ReportsRoot | Out-Null }
$ReportsRoot=(Resolve-Path -LiteralPath $ReportsRoot).Path
$Out=Join-Path $ReportsRoot ("TTO-W1-VISUAL-"+$ExpectedCommit.Substring(0,12))
if(-not(Test-Path -LiteralPath $Out)){New-Item -ItemType Directory -Force -Path $Out | Out-Null}
$Transcript=Join-Path $Out "acceptance-transcript.log"
$ProgressFile=Join-Path $Out "acceptance-summary.json"
$TranscriptStarted=$false
$ReleasePassed=$false
$VisualPassed=$false
$Snapshot=$null
try {
 Start-Transcript -LiteralPath $Transcript -Force | Out-Null
 $TranscriptStarted=$true
 Write-Host "TTO_W1_SOURCE_PINNED_SHA=$ExpectedCommit" -ForegroundColor Green

 Exec-Checked "26+ recent contract browser/governance tests and historical shareholder suite" {
  & python -m unittest discover -s $Root -p 'test_shareholder*.py' -v
 }
 Write-Host "TTO_W1_PYTHON_DISCOVERY_PASS_SHA=$ExpectedCommit" -ForegroundColor Green

 $Engine=@(& docker info --format '{{.ServerVersion}}')
 if($LASTEXITCODE -ne 0 -or $Engine.Count -ne 1) { throw "DOCKER_ENGINE_UNAVAILABLE" }
 if(-not $SkipFullRelease) {
  Exec-Checked "Full pinned PostgreSQL17/Chromium/OCI Docker Release" {
   & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $DockerRelease -Repository $Repository -ExpectedCommit $ExpectedCommit -Suite Release
  }
  $ReleasePassed=$true
  Write-Host "TTO_W1_DOCKER_RELEASE_ACCEPTED_SHA=$ExpectedCommit" -ForegroundColor Green
 } else {
  Write-Host "TTO_W1_DOCKER_RELEASE_SKIPPED_NO_ACCEPTANCE" -ForegroundColor Yellow
 }

 Exec-Checked "Phase3B baseline + NAV03 18 + NAV04 10 actual screenshots" {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $VisualRunner -Repository $Repository -ExpectedCommit $ExpectedCommit -ReportsDirectory $Out -Nav03Interactive -Nav04Interactive
 }
 $Dossier=Assert-Report (Join-Path $Out "nav03-browser-report.json") $ExpectedCommit 18 "NAV03"
 $Governance=Assert-Report (Join-Path $Out "nav04-browser-report.json") $ExpectedCommit 10 "NAV04"
 $Phase3B=Get-Content -LiteralPath (Join-Path $Out "phase3b-report.json") -Raw -Encoding UTF8 | ConvertFrom-Json
 if(-not $Phase3B.pass -or $Phase3B.reviewedSourceSha -cne $ExpectedCommit -or
    $Phase3B.screenshotsCaptured -ne 62) {
  throw "PHASE3B_BASELINE_VISUAL_GATE_FAILED"
 }
 $VisualPassed=$true
 Write-Host "TTO_W1_NAV03_CHROMIUM_PASS_SHA=$ExpectedCommit" -ForegroundColor Green
 Write-Host "TTO_W1_NAV04_CHROMIUM_PASS_SHA=$ExpectedCommit" -ForegroundColor Green
 $Snapshot=[ordered]@{
  version="TTO-W1-NAV03-NAV04-LOCAL-QA-v1"
  exactSha=$ExpectedCommit
  pythonDiscovery="PASS"
  fullRelease= $(if($ReleasePassed){"PASS"}else{"SKIPPED_NO_ACCEPTANCE"})
  phase3B="PASS"
  nav03=[ordered]@{pass=$Dossier.pass;checks=$Dossier.checksPassed;screenshots=$Dossier.screenshots.Count}
  nav04=[ordered]@{pass=$Governance.pass;checks=$Governance.checks;screenshots=$Governance.screenshots.Count}
  realMembershipSource="BLOCKED"
  realShareTrades="DISABLED"
  officialVoting="DISABLED"
  officialDocumentPublication="BLOCKED"
  mergedOrDeployed=$false
 }
 $Snapshot | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ProgressFile -Encoding UTF8
 if($ReleasePassed) {
  Write-Host "TTO_W1_NAV03_NAV04_LOCAL_QA_PASS_SHA=$ExpectedCommit" -ForegroundColor Green
 } else {
  Write-Host "TTO_W1_VISUAL_ONLY_PASS_SHA=$ExpectedCommit" -ForegroundColor Yellow
 }
 Write-Host "TTO_W1_VISUAL_REPORTS=$Out"
}finally {
 if($TranscriptStarted){ Stop-Transcript | Out-Null }
 if(-not $KeepVisualContainers -and $VisualPassed) {
  Cleanup-VisualOwnedResources $ExpectedCommit
 }
}
