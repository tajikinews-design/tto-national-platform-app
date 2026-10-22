#Requires -Version 5.1
<#
  Release extension for run-local-docker.ps1. INVOKED ONLY after Core PASS.
  Executes legacy security suites in the SAME disposable PG17 and Node22
  containers, then compiles and probes four isolated OCI images.
  Never connects to an external database, publishes ports, pushes images,
  deploys services, or changes an existing Docker Compose project.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$RunId,
    [Parameter(Mandatory=$true)][string]$PostgresContainer,
    [Parameter(Mandatory=$true)][string]$NodeContainer,
    [Parameter(Mandatory=$true)][string]$SourceVolume,
    [Parameter(Mandatory=$true)][string]$PrivateNetwork,
    [Parameter(Mandatory=$true)][string]$ReviewedArchive,
    [Parameter(Mandatory=$true)][string]$TempFolder
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Hard fail closed: all resources must be exclusively owned by this run.
if ($RunId -notmatch "^[a-f0-9]{12}$" -or
    $PostgresContainer -cne ("tto-local-ci-pg-" + $RunId) -or
    $NodeContainer -cne ("tto-local-ci-node-" + $RunId) -or
    $SourceVolume -cne ("tto-local-ci-src-" + $RunId) -or
    $PrivateNetwork -cne ("tto-local-ci-net-" + $RunId)) {
    throw "TTO_RELEASE_RESOURCE_SCOPE_REJECTED"
}
if (-not (Test-Path -LiteralPath $ReviewedArchive -PathType Leaf)) {
    throw "TTO_RELEASE_SOURCE_ARCHIVE_MISSING"
}
$pgImage = (& docker inspect --format "{{.Config.Image}}" $PostgresContainer).Trim()
$nodeImage = (& docker inspect --format "{{.Config.Image}}" $NodeContainer).Trim()
$pgNetwork = (& docker inspect --format "{{.HostConfig.NetworkMode}}" $PostgresContainer).Trim()
$nodeNetwork = (& docker inspect --format "{{.HostConfig.NetworkMode}}" $NodeContainer).Trim()
$pgPorts = (& docker inspect --format "{{json .HostConfig.PortBindings}}" $PostgresContainer).Trim()
if ($LASTEXITCODE -ne 0 -or $pgImage -ne "postgres:17" -or
    $nodeImage -ne "node:22-bookworm" -or
    $pgNetwork -ne $PrivateNetwork -or
    $nodeNetwork -ne ("container:" + $PostgresContainer) -or
    $pgPorts -notin @("null","{}")) {
    throw "TTO_RELEASE_DISPOSABLE_RESOURCE_ATTESTATION_FAILED"
}
$runtimeNames = New-Object 'System.Collections.Generic.List[string]'
$imageTags = New-Object 'System.Collections.Generic.List[string]'

function Docker-Step([string]$Label,[string[]]$Arguments) {
    Write-Host ("=== RELEASE: {0} ===" -f $Label) -ForegroundColor Cyan
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw ("TTO_RELEASE_DOCKER_STEP_FAILED: {0}; exit={1}" -f $Label,$LASTEXITCODE)
    }
}
function Node-Step([string]$Label,[string]$Code) {
    Docker-Step $Label @(
        "exec", $NodeContainer, "bash","-lc",
        ("set -euo pipefail; cd /workspace; " + $Code)
    )
}
function Database-SQL([string]$Path) {
    Docker-Step ("SQL: " + $Path) @(
        "exec", $PostgresContainer, "psql","-U","postgres",
        "-d","tto","-v","ON_ERROR_STOP=1","-f",("/workspace/" + $Path)
    )
}
function Database-Reset {
    # The attested unique PG17 container is the ONLY reset target.
    Docker-Step "Reset private PG17: drop synthetic tto" @(
        "exec",$PostgresContainer,"psql","-U","postgres","-d","postgres",
        "-v","ON_ERROR_STOP=1","-c","DROP DATABASE IF EXISTS tto WITH (FORCE)"
    )
    Docker-Step "Reset private PG17: create synthetic tto" @(
        "exec",$PostgresContainer,"psql","-U","postgres","-d","postgres",
        "-v","ON_ERROR_STOP=1","-c","CREATE DATABASE tto"
    )
}
function Migrations([int]$First,[int]$Last) {
    for ($n=$First; $n -le $Last; $n++) {
        $four = "{0:D4}" -f $n
        $command = "find /workspace/database/migrations -maxdepth 1 -type f -name '" + $four + "_*.sql' -print"
        $found = @(& docker exec $PostgresContainer bash -lc $command)
        if ($LASTEXITCODE -ne 0) {
            throw ("TTO_RELEASE_MIGRATION_DISCOVERY_FAILED_" + $four)
        }
        $files = @($found | Where-Object { $_ -and $_.Trim() })
        if ($files.Count -ne 1) {
            throw ("TTO_RELEASE_MIGRATION_NOT_UNIQUE_" + $four)
        }
        $target = $files[0].Trim()
        Docker-Step ("Migration " + $four) @(
            "exec",$PostgresContainer,"psql","-U","postgres","-d","tto",
            "-v","ON_ERROR_STOP=1","-f",$target
        )
    }
}
function Historical-Regression {
    Write-Host "TTO_LOCAL_RELEASE_HISTORICAL_START"
    Database-Reset
    Database-SQL "database/migrations/0001_cf01_cf03_foundation.sql"
    Database-SQL "tests/sql/tenant-isolation.sql"
    Database-SQL "database/migrations/0002_cf01_03_secure_flows.sql"
    Database-SQL "tests/sql/cf01-cf03-v2.sql"
    Database-SQL "database/migrations/0003_cf01_03_role_jit_party_document.sql"
    Database-SQL "tests/sql/cf01-cf03-v3.sql"
    Database-SQL "database/migrations/0004_cf02_privileged_lifecycle_cf03_hold_release.sql"
    Database-SQL "tests/sql/cf02-cf03-v4.sql"

    # Cryptographic, short-lived synthetic HMAC; not printed or persisted.
    $bytes = New-Object byte[] 48
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $secret = ([BitConverter]::ToString($bytes)).Replace("-","").ToLowerInvariant()
    try {
        Docker-Step "Historical actual Nest identity workflows and legal-hold E2E" @(
            "exec","-e",("AUTH_CHALLENGE_HMAC_SECRET=" + $secret),
            $NodeContainer,"bash","-lc",
            "set -euo pipefail; cd /workspace; node services/api/test/identity-workflows.integration.cjs"
        )
    } finally { $secret = $null }

    Database-Reset
    Database-SQL "database/migrations/0001_cf01_cf03_foundation.sql"
    Database-SQL "tests/sql/tenant-isolation.sql"
    Node-Step "Historical tenant RLS and real Nest HTTP authentication" "node services/api/test/tenant-auth.integration.cjs"

    Database-Reset
    Migrations 1 5
    Database-SQL "tests/sql/cf01-smsotp-issuance.sql"
    Node-Step "Historical SMSOTP throttling and fake-provider HTTP E2E" "node services/api/test/smsotp-request.integration.cjs"

    Database-Reset
    Migrations 1 7
    Node-Step "Historical 3-portal real login/logout HTTP E2E" "node scripts/e2e-cf01-three-portal-login-logout.cjs"
    Write-Host "TTO_LOCAL_RELEASE_HISTORICAL_PASS"
}
function Arvan-Static-Only {
    Docker-Step "Arvan YAML portability lint; never deploy" @(
        "run","--rm","--network",$PrivateNetwork,
        "-v",($SourceVolume + ":/workspace"),"-w","/workspace",
        "python:3.13-slim","sh","-c",
        "set -eu; python3 -m pip install --quiet 'PyYAML>=6,<7'; python3 scripts/test_arvan_k8s_templates.py"
    )
    Write-Host "TTO_LOCAL_RELEASE_ARVAN_STATIC_PASS"
}
function OCI-Build-And-Smoke {
    # Extract the SAME reviewed git archive. No local .env, ignored files or node_modules.
    if (-not (Get-Command "tar.exe" -ErrorAction SilentlyContinue)) {
        throw "TTO_RELEASE_WINDOWS_TAR_REQUIRED"
    }
    $context = Join-Path $TempFolder "release-oci-context"
    New-Item -ItemType Directory -Force -Path $context | Out-Null
    & tar.exe -xf $ReviewedArchive -C $context
    if ($LASTEXITCODE -ne 0) { throw "TTO_RELEASE_CLEAN_CONTEXT_EXTRACTION_FAILED" }

    $images = @(
        @("shareholder","apps/shareholder/Dockerfile"),
        @("cooperative-management","apps/cooperative-management/Dockerfile"),
        @("national-admin","apps/national-admin/Dockerfile"),
        @("api","services/api/Dockerfile")
    )
    foreach ($item in $images) {
        $label = $item[0]
        $dockerfile = Join-Path $context ($item[1].Replace("/",[IO.Path]::DirectorySeparatorChar))
        if (-not (Test-Path -LiteralPath $dockerfile -PathType Leaf)) {
            throw ("TTO_RELEASE_OCI_DOCKERFILE_MISSING_" + $label)
        }
        $tag = "tto-local-release-" + $RunId + "-" + $label
        $imageTags.Add($tag)
        Docker-Step ("Build OCI image " + $label + " (NO PUSH)") @(
            "build","--file",$dockerfile,"--tag",$tag,$context
        )
        Docker-Step ("Inspect OCI image " + $label) @(
            "image","inspect",$tag,"--format","{{.Id}}"
        )
        $runtime = "tto-local-release-run-" + $RunId + "-" + $label
        $runtimeNames.Add($runtime)

        if ($label -eq "api") {
            Docker-Step "Create API with no DB credentials and NO NETWORK" @(
                "create","--name",$runtime,"--network","none",$tag
            )
            Docker-Step "Start API without DB credentials (must exit closed)" @("start",$runtime)
            $stopped = $false
            for ($try=0; $try -lt 20; $try++) {
                $state = (& docker inspect --format "{{.State.Running}}" $runtime).Trim()
                if ($LASTEXITCODE -ne 0) { throw "TTO_RELEASE_API_INSPECT_FAILED" }
                if ($state -eq "false") { $stopped = $true; break }
                Start-Sleep -Seconds 1
            }
            if (-not $stopped) { throw "TTO_RELEASE_API_WITHOUT_DB_STILL_RUNNING" }
            $exitCode = (& docker inspect --format "{{.State.ExitCode}}" $runtime).Trim()
            $log = (& docker logs $runtime 2>&1 | Out-String)
            if ($exitCode -eq "0" -or $log -notmatch "TTO_API_STARTUP_FAILED|DATABASE_URL_NOT_CONFIGURED") {
                throw "TTO_RELEASE_API_FAIL_CLOSED_NOT_PROVEN"
            }
            Write-Host "TTO_LOCAL_RELEASE_OCI_API_DENY_PASS"
        }
        else {
            Docker-Step ("Start OCI " + $label + " with NO NETWORK and NO PORTS") @(
                "run","-d","--name",$runtime,"--network","none",$tag
            )
            $js = @'
const url="http://127.0.0.1:3000/";
fetch(url,{signal:AbortSignal.timeout(3500)}).then(async (res)=>{
  const body=await res.text();
  if(res.status!==200 || !body.includes('dir="rtl"') || !body.includes("داده")){
    console.error("OCI_RUNTIME_RTL_OR_NO_FAKE_DATA_GATE_FAILED");process.exitCode=1;
  }
}).catch((error)=>{console.error("OCI_RUNTIME_NOT_READY",error.message);process.exitCode=1;});
'@
            $ready = $false
            for ($try=0; $try -lt 60; $try++) {
                # node exists inside all portable Next images; request never leaves container.
                & docker exec $runtime node --input-type=module -e $js *> $null
                if ($LASTEXITCODE -eq 0) { $ready = $true; break }
                Start-Sleep -Seconds 1
            }
            if (-not $ready) {
                throw ("TTO_RELEASE_OCI_RUNTIME_FAILED_" + $label)
            }
            Write-Host ("TTO_LOCAL_RELEASE_OCI_" + $label.ToUpperInvariant().Replace("-","_") + "_PASS")
        }
        Docker-Step ("Stop and remove OCI runtime " + $label) @("rm","-f",$runtime)
        $runtimeNames.Remove($runtime) | Out-Null
    }
    Write-Host "TTO_LOCAL_RELEASE_OCI_FOUR_IMAGE_PASS"
}

try {
    Historical-Regression
    Arvan-Static-Only
    OCI-Build-And-Smoke
    Write-Host "TTO_LOCAL_RELEASE_EXTRA_PASS"
}
finally {
    # Remove ONLY unique images and runtime containers belonging to this invocation.
    $ErrorActionPreference = "Continue"
    foreach ($runtime in $runtimeNames) { & docker rm -f $runtime *> $null }
    foreach ($image in $imageTags) { & docker image rm -f $image *> $null }
    Write-Host "TTO_LOCAL_RELEASE_OCI_TEMP_RESOURCES_REMOVED=true"
}
