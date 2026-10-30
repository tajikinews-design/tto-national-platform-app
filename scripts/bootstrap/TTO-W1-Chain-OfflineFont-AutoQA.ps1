#Requires -Version 5.1
# SHA-pinned TTO W1 isolated full Docker Release; no merge/deploy/production data.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ExpectedSha = '8b36eabbeb9cfb89972cf387276c9524d354790b'
$Branch = 'fix/w1-offline-vazirmatn-build-20261030'
$Remote = 'https://github.com/tajikinews-design/tto-national-platform-app.git'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Reports = Join-Path $HOME 'Downloads\TTO-Execution-Reports'
$Checkout = Join-Path $HOME ("Downloads\TTO-W1-OfflineFont-" + $Stamp)
$Stdout = Join-Path $Reports ("TTO-W1-OfflineFont-" + $Stamp + ".stdout.log")
$Stderr = Join-Path $Reports ("TTO-W1-OfflineFont-" + $Stamp + ".stderr.log")
New-Item -ItemType Directory -Force -Path $Reports | Out-Null

Write-Host '=== TTO W1 AUTO-DOWNLOAD AND OFFLINE-FONT RELEASE ===' -ForegroundColor Cyan
Write-Host "EXPECTED_SHA=$ExpectedSha"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'GIT_NOT_FOUND' }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'DOCKER_NOT_FOUND' }
& git clone --quiet --depth 1 --single-branch --branch $Branch $Remote $Checkout
if ($LASTEXITCODE -ne 0) { throw 'GIT_CLONE_FAILED' }
$ActualSha = (& git -C $Checkout rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $ActualSha -ne $ExpectedSha) {
    throw "EXACT_SHA_MISMATCH expected=$ExpectedSha actual=$ActualSha"
}
$Dirty = @(& git -C $Checkout status --porcelain | Where-Object { $_ })
if ($Dirty.Count -gt 0) { throw 'DIRTY_REPOSITORY_REFUSED' }
Write-Host 'EXACT_SOURCE_SHA_VERIFIED=PASS' -ForegroundColor Green

$Runner = Join-Path $Checkout 'scripts\ci\run-local-docker.ps1'
if (-not (Test-Path -LiteralPath $Runner -PathType Leaf)) { throw 'RUNNER_NOT_FOUND' }
$PsExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$Args = ('-NoProfile -ExecutionPolicy Bypass -File "{0}" -Repository "{1}" -ExpectedCommit {2} -Suite Release' -f $Runner,$Checkout,$ExpectedSha)
Write-Host 'STARTING_EXACT_SHA_DOCKER_RELEASE' -ForegroundColor Cyan
$Proc = Start-Process -FilePath $PsExe -ArgumentList $Args -Wait -PassThru -NoNewWindow -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr
$Out = if (Test-Path -LiteralPath $Stdout) { Get-Content -LiteralPath $Stdout -Raw } else { '' }
$ErrText = if (Test-Path -LiteralPath $Stderr) { Get-Content -LiteralPath $Stderr -Raw } else { '' }
$Evidence = $Out + [Environment]::NewLine + $ErrText
$Requirements = [ordered]@{
    EXACT_RELEASE_SHA = "TTO_LOCAL_RELEASE_PASS_SHA=$ExpectedSha"
    BFF_NEST_PEP_PDP = 'TTO_W1_BFF_NEST_PEP_PDP_CHAIN=PASS'
    DENY_ZERO_TOUCH = 'TTO_W1_DENIED_FIXTURE_TOUCHES=0'
    REAL_DATA_NONE = 'TTO_W1_REAL_DATA_OR_MUTATIONS=NONE'
    NO_OPERATIONAL_ALLOW = 'TTO_W1_NO_OPERATIONAL_ALLOW=PASS'
    LOCAL_FONT_PIN = 'test_01_upstream_pinned_woff2_exact_git_blob'
    ALL_THREE_LOCAL_FONTS = 'test_03_all_three_portals_use_same_local_font_and_css_variable'
}
$Missing = @()
foreach ($Key in $Requirements.Keys) {
    if ($Evidence.Contains($Requirements[$Key])) {
        Write-Host "$Key=PASS"
    } else {
        Write-Host "$Key=MISSING"
        $Missing += $Key
    }
}
Write-Host "RELEASE_EXIT_CODE=$($Proc.ExitCode)"
Write-Host "STDOUT_REPORT=$Stdout"
Write-Host "STDERR_REPORT=$Stderr"
Write-Host 'SYNTHETIC_ONLY=TRUE'
Write-Host 'REAL_SHAREHOLDER_DATA_AND_TRADES=BLOCKED'
Write-Host 'NO_MERGE_NO_DEPLOY'
if ($Proc.ExitCode -ne 0 -or $Missing.Count -ne 0) {
    Write-Host 'TTO_W1_CHAIN_OFFLINE_FONT_RELEASE=NOT_PASSED' -ForegroundColor Yellow
    if (Test-Path -LiteralPath $Stdout) { Get-Content -LiteralPath $Stdout -Tail 35 }
    if (Test-Path -LiteralPath $Stderr) { Get-Content -LiteralPath $Stderr -Tail 20 }
    throw 'EXACT_SHA_RELEASE_FAILED'
}
Write-Host 'TTO_W1_CHAIN_OFFLINE_FONT_RELEASE=PASS' -ForegroundColor Green
Write-Host "VERIFIED_SHA=$ExpectedSha"
