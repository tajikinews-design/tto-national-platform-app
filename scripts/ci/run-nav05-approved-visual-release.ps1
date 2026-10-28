#Requires -Version 5.1
<#
NAV-05 exact-SHA local release and synthetic screenshot package.
Review-only; does not merge, push, deploy or connect to hosted data.
Usage from any directory:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File <script> -SourceRepo "$env:USERPROFILE\TTO\tto-national-platform-app" -ExpectedSha "<40hex>"
#>
[CmdletBinding()]
param(
  [string]$SourceRepo = "",
  [Parameter(Mandatory=$true)][string]$ExpectedSha
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$branch = "feat/shareholder-nav05-approved-architecture-synthetic-20261028"
$repository = "tajikinews-design/tto-national-platform-app"
foreach ($command in @("git","docker","powershell.exe")) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw ("COMMAND_NOT_FOUND: " + $command)
  }
}
if ($ExpectedSha -notmatch "^[a-f0-9]{40}$") { throw "INVALID_EXPECTED_SHA" }
if (-not $SourceRepo) {
  $SourceRepo = Join-Path $env:USERPROFILE "TTO\tto-national-platform-app"
}
if (-not (Test-Path -LiteralPath (Join-Path $SourceRepo ".git"))) {
  throw "TTO_GIT_REPOSITORY_NOT_FOUND"
}
$origin = (& git -C $SourceRepo remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $origin -notmatch "tajikinews-design/tto-national-platform-app(\.git)?$") {
  throw "UNEXPECTED_GIT_ORIGIN"
}
& git -C $SourceRepo fetch --no-tags origin ("refs/heads/" + $branch)
if ($LASTEXITCODE -ne 0) { throw "GIT_FETCH_NAV05_FAILED" }
$head = (& git -C $SourceRepo rev-parse FETCH_HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -ne $ExpectedSha) {
  throw ("REMOTE_PR48_HEAD_MISMATCH: " + $head)
}
$root = Join-Path $env:LOCALAPPDATA "TTO\NAV05-Exact-SHA"
New-Item -ItemType Directory -Path $root -Force | Out-Null
$tree = Join-Path $root ("review-" + $ExpectedSha.Substring(0,12))
if (-not (Test-Path -LiteralPath $tree)) {
  & git -C $SourceRepo worktree add --detach $tree $ExpectedSha
  if ($LASTEXITCODE -ne 0) { throw "ISOLATED_WORKTREE_FAILED" }
}
if (-not (Test-Path -LiteralPath (Join-Path $tree ".git"))) {
  throw "ISOLATED_WORKTREE_INVALID"
}
$actual = (& git -C $tree rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $actual -ne $ExpectedSha) { throw "EXACT_SHA_WORKTREE_MISMATCH" }
if (@(& git -C $tree status --porcelain).Count -gt 0) {
  throw "WORKTREE_IS_NOT_CLEAN"
}
$runner = Join-Path $tree "scripts\ci\run-local-docker.ps1"
$capture = Join-Path $root ("TTO-NAV05-Release-" + $ExpectedSha.Substring(0,12) + ".log")
Write-Host ("TTO_NAV05_SOURCE_SHA=" + $ExpectedSha) -ForegroundColor Cyan
# Tee captures the *actual nested PowerShell process output*; do not rely
# on the separate Start-Transcript file's timestamp or native stdout support.
$ErrorActionPreference = "Continue"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner -Repository $tree -ExpectedCommit $ExpectedSha -Suite Release 2>&1 |
  Tee-Object -FilePath $capture
$releaseExit = $LASTEXITCODE
$ErrorActionPreference = "Stop"
if ($releaseExit -ne 0) { throw ("EXACT_SHA_RELEASE_FAILED_EXIT=" + $releaseExit) }
$releaseOutput = Get-Content -LiteralPath $capture -Raw
if (-not $releaseOutput.Contains("TTO_LOCAL_RELEASE_PASS_SHA=" + $ExpectedSha) -or
    -not $releaseOutput.Contains("TTO_NAV05_CHROMIUM_PASS_SHA=" + $ExpectedSha)) {
  throw "EXACT_SHA_RELEASE_PASS_EVIDENCE_MISSING_FROM_CAPTURE"
}
$successLog = [pscustomobject]@{ Log=$capture; Text=$releaseOutput }
$pathMatches = [regex]::Matches($successLog.Text,"TTO_LOCAL_VISUAL_QA_PATH=([^\r\n]+)")
$reportMatches = [regex]::Matches($successLog.Text,"TTO_NAV05_SCREENSHOT_HASHES=(\\[[^\\r\\n]+\\])")
if ($pathMatches.Count -lt 1 -or $reportMatches.Count -ne 1) {
  throw "NAV05_VISUAL_EVIDENCE_NOT_FOUND"
}
$folder = $pathMatches[$pathMatches.Count-1].Groups[1].Value.Trim()
if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
  throw "NAV05_SCREENSHOT_FOLDER_NOT_FOUND"
}
$report = @($reportMatches[0].Groups[1].Value | ConvertFrom-Json)
if ($report.Count -ne 5) {
  throw "NAV05_VIEWPORT_MANIFEST_MISMATCH"
}
$files = @()
foreach ($v in $report) {
  $name = "nav05-" + $v.width + ".png"
  $found = @(Get-ChildItem -LiteralPath $folder -Filter $name -File -Recurse)
  if ($found.Count -ne 1) { throw ("NAV05_PNG_MISSING_OR_DUPLICATE: " + $name) }
  $hash = (Get-FileHash -LiteralPath $found[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $v.sha256) { throw ("NAV05_PNG_SHA_MISMATCH: " + $name) }
  $files += $found[0].FullName
  Write-Host ("VERIFIED_NAV05_PNG=" + $name) -ForegroundColor Green
}
$zip = Join-Path (Join-Path $env:USERPROFILE "Downloads") ("TTO-NAV05-Visual-" + $ExpectedSha.Substring(0,12) + ".zip")
Compress-Archive -LiteralPath $files -DestinationPath $zip -Force
Write-Host ("TTO_NAV05_SCREENSHOTS_VERIFIED=5/5") -ForegroundColor Green
Write-Host ("TTO_NAV05_RELEASE_PASS_SHA=" + $ExpectedSha) -ForegroundColor Green
Write-Host ("TTO_NAV05_VISUAL_ARCHIVE=" + $zip) -ForegroundColor Cyan
Write-Host ("TTO_NAV05_RELEASE_LOG=" + $successLog.Log) -ForegroundColor Cyan
Write-Host "HUMAN_VISUAL_ACCEPTANCE=PENDING; NO_MERGE_NO_DEPLOY" -ForegroundColor Yellow
