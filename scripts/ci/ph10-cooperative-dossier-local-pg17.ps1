# PH10 — EXACT-HEAD disposable PostgreSQL 17 acceptance for Windows PowerShell.
# NEVER uses hosted Preview, external databases, ports, named volumes, or user data.
# Run from the repository root, with local Docker Desktop running.
param(
 [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-fA-F]{40}$')][string]$ExpectedHead
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$OutputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$ExpectedBranch='feat/ph10-cooperative-dossier-lifecycle-20261105'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$RunId=[guid]::NewGuid().ToString('N').Substring(0,12)
$Container='tto-ph10-pg17-'+$RunId
$TempRoot=if($env:TEMP){$env:TEMP}else{[IO.Path]::GetTempPath()}
$EvidenceDir=Join-Path $TempRoot ('tto-ph10-pg17-'+$RunId)
New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null
$Transcript=Join-Path $EvidenceDir 'execution.log'
$Summary=Join-Path $EvidenceDir 'result.json'
$Created=$false
$Passed=@()
$Failure=$null
$Head=''
$DbVersion=''
function Log([string]$Message){
 $line=(Get-Date).ToUniversalTime().ToString('o')+' '+$Message
 Write-Host $line
 Add-Content -LiteralPath $Transcript -Value $line -Encoding UTF8
}
function Docker([string[]]$Argv){
 & docker @Argv
 if($LASTEXITCODE -ne 0){throw ('docker command failed: '+($Argv -join ' '))}
}
function SqlFile([string]$Path){
 $full=Join-Path $Root $Path
 if(!(Test-Path -LiteralPath $full -PathType Leaf)){throw ('missing file: '+$Path)}
 $sql=[IO.File]::ReadAllText($full,[System.Text.Encoding]::UTF8)
 # PowerShell sends UTF-8 to Docker stdin; the only database is in our container.
 $sql | & docker exec -i $Container psql -X -U postgres -d tto -v ON_ERROR_STOP=1 -f -
 if($LASTEXITCODE -ne 0){throw ('SQL failed: '+$Path)}
}
try{
 Set-Location $Root
 $Head=(& git rev-parse HEAD).Trim()
 $branch=(& git branch --show-current).Trim()
 if($LASTEXITCODE -ne 0 -or $branch -ne $ExpectedBranch -or
    $Head -ne $ExpectedHead){
  throw ('wrong branch/HEAD: '+$branch+' '+$Head)
 }
 & git diff --quiet
 if($LASTEXITCODE -ne 0){throw 'tracked working-tree changes; use clean exact commit'}
 & git diff --cached --quiet
 if($LASTEXITCODE -ne 0){throw 'staged changes; use clean exact commit'}
 if($env:DOCKER_HOST -and $env:DOCKER_HOST -notmatch '^(npipe://|unix://)'){
   throw 'remote Docker context not permitted'
 }
 $context=(& docker context inspect | ConvertFrom-Json)
 if($LASTEXITCODE -ne 0 -or !$context){throw 'Docker context not accessible'}
 $endpoint=[string]$context[0].Endpoints.docker.Host
 if($endpoint -notmatch '^(npipe://|unix://)'){
   throw ('only local Docker engine accepted, got '+$endpoint)
 }
 & docker info --format '{{.ServerVersion}}' | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Docker Desktop/daemon not running'}
 Log ('START branch='+$branch+' head='+$Head+' context='+$endpoint)
 $Image='postgres:17-alpine'
 # Pull happens on the Docker host if needed, but the DB container has no network.
 Docker @('run','-d','--rm','--network','none','--name',$Container,
   '-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=tto',$Image) | Out-Null
 $Created=$true
 $ready=$false
 for($i=0;$i -lt 90;$i++){
  & docker exec $Container psql -X -U postgres -d tto -Atqc 'SELECT 1' 2>$null | Out-Null
  if($LASTEXITCODE -eq 0){$ready=$true;break}
  Start-Sleep -Seconds 1
 }
 if(!$ready){throw 'ephemeral PostgreSQL 17 did not become ready'}
 $DbVersion=(& docker exec $Container psql -X -U postgres -d tto -Atqc 'SHOW server_version').Trim()
 if($LASTEXITCODE -ne 0 -or $DbVersion -notmatch '^17\.'){
  throw ('wrong PostgreSQL major version: '+$DbVersion)
 }
 Log ('PG_VERSION='+$DbVersion+' NO_NETWORK=TRUE NO_PORTS=TRUE')
 $Migrations=Get-ChildItem (Join-Path $Root 'database/migrations') -Filter '*.sql' |
  Where-Object {$_.Name -match '^[0-9]{4}.*\.sql$'} | Sort-Object Name
 if(!$Migrations -or !($Migrations.Name -contains '9999b_ph10_cooperative_evidence_quarantine.sql')){
  throw 'missing PH10 isolated migration set'
 }
 foreach($file in $Migrations){
  $rel='database/migrations/'+$file.Name
  Log ('MIGRATE '+$rel)
  SqlFile $rel
 }
 $Tests=@(
   'tests/sql/ph10-cooperative-dossier-review-disposable.sql',
   'tests/sql/ph10-cooperative-draft-disposable.sql',
   'tests/sql/ph10-cooperative-evidence-quarantine-disposable.sql'
 )
 foreach($test in $Tests){
  Log ('TEST '+$test)
  SqlFile $test
  $Passed+= $test
  Log ('PASS '+$test)
 }
 Log 'TTO_PH10_EXACT_HEAD_DISPOSABLE_PG17_PASS_NO_PREVIEW'
}catch{
 $Failure=$_.Exception.Message
 Log ('BLOCKED '+$Failure)
}finally{
 if($Created){
  & docker rm -f $Container *> $null
  Log ('REMOVED_ONLY_OWN_CONTAINER '+$Container)
 }
 $record=[ordered]@{
  project='TTO PH10 cooperative onboarding'
  exactHead=$Head
  expectedHead=$ExpectedHead
  postgresVersion=$DbVersion
  testsPassed=$Passed
  testCount=$Passed.Count
  result=if($Failure){'BLOCKED'}else{'ISOLATED_PG17_PASS'}
  failure=$Failure
  previewTouched=$false
  migrationToPreview=$false
  source='local-windows-docker'
  recordedUtc=(Get-Date).ToUniversalTime().ToString('o')
 }
 $record|ConvertTo-Json -Depth 4|Set-Content -LiteralPath $Summary -Encoding UTF8
 Log ('EVIDENCE '+$Summary)
 Set-Location $Root
}
if($Failure){exit 1}
exit 0
