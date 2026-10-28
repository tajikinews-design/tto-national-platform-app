#Requires -Version 5.1
<#
TTO NAV-04 PR48 automated exact-SHA local Release.
Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File <this-file> -ResultsRoot 'D:\TTO\MyResults'
Only isolated D: working paths. No merge, deployment, real SMS, or live database.
GitHub private repository access needs existing authenticated Git credentials.
#>
[CmdletBinding()]
param(
 [string]$OutputRoot='D:\TTO\NAV04-PR48-QA',
 [string]$ResultsRoot='D:\TTO\NAV04-PR48-Results',
 [string]$Repository=''
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$Sha='12f39d35a2338de6a4b5756c9f37a3475b85ec8b'
$Branch='fix/nav04-mobile-refinement-20261028'
$Short=$Sha.Substring(0,12)
$GitUrl='https://github.com/tajikinews-design/tto-national-platform-app.git'
if(-not (Test-Path -LiteralPath 'D:\' -PathType Container)){throw 'D_DRIVE_NOT_FOUND'}
$OutputRoot=[IO.Path]::GetFullPath($OutputRoot).TrimEnd('\')
$ResultsRoot=[IO.Path]::GetFullPath($ResultsRoot).TrimEnd('\')
foreach($path in @($OutputRoot,$ResultsRoot)){
 if(-not $path.StartsWith('D:\',[StringComparison]::OrdinalIgnoreCase)){throw "PATH_MUST_BE_ON_D: $path"}
}
$Worktrees=Join-Path $OutputRoot 'Worktrees'
$Temp=Join-Path $OutputRoot 'Temp'
$Reports=Join-Path $ResultsRoot 'Reports'
$Artifacts=Join-Path $ResultsRoot 'Artifacts'
foreach($dir in @($OutputRoot,$ResultsRoot,$Worktrees,$Temp,$Reports,$Artifacts)){
 New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
$env:TEMP=$Temp
$env:TMP=$Temp
$env:TTO_NAV04_OUTPUT_ROOT=$ResultsRoot
foreach($cmd in @('git','docker','powershell.exe')){
 if(-not (Get-Command $cmd -ErrorAction SilentlyContinue)){throw "REQUIRED_TOOL_NOT_FOUND: $cmd"}
}
if(-not $Repository){
 $Repository=Join-Path $OutputRoot 'SourceRepository'
 if(-not (Test-Path -LiteralPath (Join-Path $Repository '.git'))){
  if(Test-Path -LiteralPath $Repository){throw "SOURCE_PATH_EXISTS_WITHOUT_GIT: $Repository"}
  Write-Host "DOWNLOADING_PRIVATE_REPOSITORY_TO=$Repository" -ForegroundColor Cyan
  & git -c core.longpaths=true clone --no-checkout --single-branch --branch $Branch --filter=blob:none $GitUrl $Repository
  if($LASTEXITCODE -ne 0){throw 'PRIVATE_GITHUB_CLONE_FAILED: configure GitHub Credential Manager for this repository'}
 }
}
if(-not (Test-Path -LiteralPath (Join-Path $Repository '.git'))){throw "INVALID_REPOSITORY: $Repository"}
$Repository=(Resolve-Path -LiteralPath $Repository).Path
$origin=(& git -C $Repository remote get-url origin).Trim()
if($LASTEXITCODE -ne 0 -or $origin -notmatch '(^|[:/])tajikinews-design/tto-national-platform-app(\.git)?$'){
 throw "WRONG_GIT_ORIGIN: $origin"
}
Write-Host 'FETCHING_PR48_EXACT_COMMIT' -ForegroundColor Cyan
& git -C $Repository fetch --no-tags origin "refs/heads/$Branch"
if($LASTEXITCODE -ne 0){throw 'GIT_FETCH_PR48_FAILED'}
$RemoteSha=(& git -C $Repository rev-parse FETCH_HEAD).Trim()
if($RemoteSha -ne $Sha){throw "PR48_HEAD_CHANGED: expected=$Sha current=$RemoteSha; review before running"}
$Tree=Join-Path $Worktrees "PR48-$Short"
if(-not (Test-Path -LiteralPath $Tree)){
 & git -C $Repository worktree add --detach $Tree $Sha
 if($LASTEXITCODE -ne 0){throw 'ISOLATED_WORKTREE_CREATE_FAILED'}
}
$TreeSha=(& git -C $Tree rev-parse HEAD).Trim()
if($TreeSha -ne $Sha){throw "ISOLATED_WORKTREE_SHA_MISMATCH: $TreeSha"}
$TrackedStatus=@(& git -C $Tree status --porcelain --untracked-files=no)
if($LASTEXITCODE -ne 0 -or $TrackedStatus.Count -gt 0){throw 'ISOLATED_WORKTREE_TRACKED_CHANGES_FOUND'}
$Runner=Join-Path $Tree 'scripts\ci\run-local-docker.ps1'
$RunnerD=Join-Path $Tree 'scripts\ci\run-local-docker-D-output.ps1'
if(-not (Test-Path -LiteralPath $Runner -PathType Leaf)){throw 'EXACT_SHA_RELEASE_RUNNER_MISSING'}
$Original=Get-Content -LiteralPath $Runner -Raw -Encoding UTF8
$OldLine='$reportsFolder = Join-Path $env:USERPROFILE "Downloads\TTO-Local-CI-Reports"'
$NewLine='$reportsFolder = Join-Path $env:TTO_NAV04_OUTPUT_ROOT "Reports"'
if($Original.Split($OldLine).Count -ne 2){throw 'RELEASE_OUTPUT_ANCHOR_MISMATCH: STOP_WITHOUT_PATCH'}
$Patched=$Original.Replace($OldLine,$NewLine)
Set-Content -LiteralPath $RunnerD -Value $Patched -Encoding UTF8
Write-Host "EXACT_TEST_COMMIT=$Sha" -ForegroundColor Cyan
Write-Host "RESULTS_ROOT=$ResultsRoot" -ForegroundColor Cyan
& docker info --format '{{.ServerVersion}}' *> $null
if($LASTEXITCODE -ne 0){throw 'DOCKER_DESKTOP_LINUX_NOT_READY'}
$Stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$Log=Join-Path $Reports "NAV04-PR48-$Short-Release-$Stamp.log"
Write-Host "RELEASE_LOG=$Log" -ForegroundColor Cyan
Write-Host 'START_EXACT_SHA_PRIVATE_DOCKER_RELEASE' -ForegroundColor Cyan
# Stream output while retaining all evidence in D:. The tracked source archive
# is still git archive HEAD at the original exact commit.
$ErrorActionPreference='Continue'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RunnerD -Repository $Tree -ExpectedCommit $Sha -Suite Release 2>&1 | Tee-Object -FilePath $Log
$Code=$LASTEXITCODE
$ErrorActionPreference='Stop'
if($Code -ne 0){throw "LOCAL_RELEASE_FAILED_EXIT_$Code; SEE_LOG=$Log"}
$Pass=Select-String -LiteralPath $Log -SimpleMatch "TTO_LOCAL_RELEASE_PASS_SHA=$Sha"
if(-not $Pass){throw "LOCAL_RELEASE_EXACT_SHA_PASS_NOT_FOUND; SEE_LOG=$Log"}
$Lines=@(Select-String -LiteralPath $Log -SimpleMatch 'TTO_LOCAL_VISUAL_QA_PATH=')
if($Lines.Count -lt 1){throw "CHROMIUM_VISUAL_PATH_NOT_REPORTED; SEE_LOG=$Log"}
$Visual=($Lines[-1].Line -split 'TTO_LOCAL_VISUAL_QA_PATH=',2)[-1].Trim()
if(-not (Test-Path -LiteralPath $Visual -PathType Container)){throw "CHROMIUM_SCREENSHOT_FOLDER_MISSING: $Visual"}
$Visual=(Resolve-Path -LiteralPath $Visual).Path
if(-not $Visual.StartsWith($Reports+'\',[StringComparison]::OrdinalIgnoreCase)){
 throw "VISUAL_OUTPUT_OUTSIDE_D_RESULTS: $Visual"
}
$Names=@('nav04-320.png','nav04-390.png','nav04-768.png','nav04-1440.png','nav04-1536.png')
$Images=@()
foreach($name in $Names){
 $item=Join-Path $Visual $name
 if(-not (Test-Path -LiteralPath $item -PathType Leaf)){throw "MISSING_VISUAL: $name"}
 if((Get-Item -LiteralPath $item).Length -le 6000){throw "EMPTY_VISUAL: $name"}
 $Images+= $item
}
$Manifest=Join-Path $Artifacts "NAV04-$Short-$Stamp-Manifest.txt"
@(
 'repository=tajikinews-design/tto-national-platform-app',
 'pull_request=48',
 "tested_commit=$Sha",
 'release=PASS',
 'human_visual_acceptance=PENDING',
 'no_merge_no_deploy=true',
 "source_repository=$Repository",
 "visual_folder=$Visual",
 "release_log=$Log"
) | Set-Content -LiteralPath $Manifest -Encoding UTF8
foreach($img in $Images){
 "$([IO.Path]::GetFileName($img)) SHA256=$((Get-FileHash -LiteralPath $img -Algorithm SHA256).Hash)" |
  Add-Content -LiteralPath $Manifest -Encoding UTF8
}
$Zip=Join-Path $Artifacts "TTO-NAV04-PR48-$Short-$Stamp.zip"
Compress-Archive -LiteralPath ($Images+@($Manifest)) -DestinationPath $Zip -CompressionLevel Optimal
if(-not (Test-Path -LiteralPath $Zip -PathType Leaf)){throw 'ZIP_CREATION_FAILED'}
Write-Host ''
Write-Host 'TTO_NAV04_PR48_RELEASE_PASS' -ForegroundColor Green
Write-Host "TTO_LOCAL_RELEASE_PASS_SHA=$Sha" -ForegroundColor Green
Write-Host 'TTO_NAV04_SCREENSHOTS=5/5' -ForegroundColor Green
Write-Host "TTO_NAV04_VISUAL_ARCHIVE=$Zip" -ForegroundColor Green
Write-Host "TTO_NAV04_RELEASE_LOG=$Log" -ForegroundColor Green
Write-Host "TTO_NAV04_RESULTS_ROOT=$ResultsRoot" -ForegroundColor Green
Write-Host 'HUMAN_VISUAL_ACCEPTANCE=PENDING; NO_MERGE_NO_DEPLOY' -ForegroundColor Yellow
