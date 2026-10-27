#Requires -Version 5.1
<#
  NAV04 approved visual QA. No merge, production deployment, or real data.
  Run from the approved repository checkout:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ci/run-nav04-approved-visual-release.ps1
#>
[CmdletBinding()]
param(
  [string]$Branch = 'feat/shareholder-nav04-approved-visual-20261027',
  [string]$SourceRepo = '',
  [string]$ExpectedSha = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($Branch -ne 'feat/shareholder-nav04-approved-visual-20261027') { throw 'UNKNOWN_REVIEW_BRANCH' }
foreach ($command in @('git','docker','powershell.exe')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw ("COMMAND_MISSING_" + $command) }
}
if (-not $SourceRepo) { $SourceRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path }
if (-not (Test-Path -LiteralPath (Join-Path $SourceRepo '.git'))) { throw 'NOT_A_REPOSITORY' }
$origin = (& git -C $SourceRepo remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $origin -notmatch '(^|[:/])tajikinews-design/tto-national-platform-app(\.git)?$') {
  throw 'UNEXPECTED_GIT_ORIGIN'
}
& git -C $SourceRepo fetch --no-tags origin ("refs/heads/" + $Branch)
if ($LASTEXITCODE -ne 0) { throw 'FETCH_FAILED' }
$sha = (& git -C $SourceRepo rev-parse FETCH_HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sha -notmatch '^[a-f0-9]{40}$') { throw 'INVALID_REMOTE_HEAD' }
if ($ExpectedSha -and $ExpectedSha -ne $sha) { throw ("REMOTE_SHA_CHANGED: " + $sha) }
$root = Join-Path $env:LOCALAPPDATA 'TTO\NAV04-Exact-SHA-QA'
New-Item -ItemType Directory -Path $root -Force | Out-Null
$tree = Join-Path $root ("review-" + $sha.Substring(0,12))
if (-not (Test-Path -LiteralPath $tree)) {
  & git -C $SourceRepo worktree add --detach $tree $sha
  if ($LASTEXITCODE -ne 0) { throw 'WORKTREE_CREATE_FAILED' }
}
elseif (-not (Test-Path -LiteralPath (Join-Path $tree '.git'))) { throw 'WORKTREE_COLLISION' }
$actual = (& git -C $tree rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $actual -ne $sha) { throw 'WORKTREE_SHA_MISMATCH' }
$runner = Join-Path $tree 'scripts\ci\run-local-docker.ps1'
Write-Host ("TTO_NAV04_TEST_SOURCE_SHA=" + $sha) -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner -Repository $tree -ExpectedCommit $sha -Suite Release
if ($LASTEXITCODE -ne 0) { throw ("TTO_NAV04_LOCAL_RELEASE_FAILED_" + $LASTEXITCODE) }
Write-Host ("TTO_NAV04_RELEASE_RUNNER_EXIT_OK_SHA=" + $sha) -ForegroundColor Green
Write-Host 'Human screenshot review is required; do not auto-approve, merge, or deploy.' -ForegroundColor Yellow
