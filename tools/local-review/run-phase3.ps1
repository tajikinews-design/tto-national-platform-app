#Requires -Version 5.1
[CmdletBinding()]
param([ValidateSet('All','Test','Stop')][string]$Action='All')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'

$SHA='4385b468e10e0707071b131a537d1f2194e29ee5'
$Repo='C:\Users\Sadra\Downloads\TTO-Local-CI-20261023-015428'
$Work='D:\TTO-Phase3-PR28-4385b468'
$Branch='feat/shareholder-ux-review-preview-phase3'
$Container='tto-phase3-review-4385b468'
$Volume='tto-phase3-review-src-4385b468'
$Output='D:\TTO-Phase3-Review-4385b468'
$Port=32150
$Local='http://127.0.0.1:32150'

function Require([string]$Name) { if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "MISSING_COMMAND=$Name" } }
function CheckGit([string]$Step) { if ($LASTEXITCODE -ne 0) { throw "GIT_FAILED=$Step" } }
function DockerStep([string]$Step,[string[]]$Arguments) {
    Write-Host "=== $Step ===" -ForegroundColor Cyan
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "DOCKER_FAILED=$Step; code=$LASTEXITCODE" }
}
function OwnedContainer {
    $names=@(docker ps -a --format '{{.Names}}')
    if ($LASTEXITCODE -ne 0) { throw 'DOCKER_PS_FAILED' }
    if ($names -cnotcontains $Container) { return $false }
    # Avoid quoted Go-template map keys: Windows PowerShell 5.1 strips
    # native argument quotes, making Docker parse "tto" as a function.
    $raw=@(& docker inspect --type container --format '{{json .}}' $Container)
    if ($LASTEXITCODE -ne 0 -or $raw.Count -ne 1) { throw 'REVIEW_CONTAINER_INSPECT_FAILED' }
    $info=$raw[0] | ConvertFrom-Json
    $property=$info.Config.Labels.PSObject.Properties['tto.phase3.review']
    if ($null -eq $property -or [string]$property.Value -cne $SHA) { throw 'CONTAINER_OWNER_MISMATCH' }
    if (-not $info.State.Running) { throw 'REVIEW_CONTAINER_NOT_RUNNING' }
    return $true
}
function Ready {
    for($n=0;$n -lt 90;$n++) {
        try {
            $r=Invoke-WebRequest -UseBasicParsing -Uri ($Local+'/review') -TimeoutSec 4
            if($r.StatusCode -eq 200) { return }
        } catch {}
        Start-Sleep -Seconds 2
    }
    & docker logs --tail 60 $Container
    throw 'REVIEW_SERVER_NOT_READY'
}
Require 'git'
Require 'docker'
Require 'powershell.exe'
& docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'DOCKER_ENGINE_NOT_READY' }

if ($Action -eq 'Stop') {
    if (OwnedContainer) { DockerStep 'Stop only this review container' @('rm','-f',$Container) }
    $volumes=@(& docker volume ls -q --filter ('name=^'+$Volume+'$'))
    if ($volumes -ccontains $Volume) {
        $vRaw=@(& docker volume inspect --format '{{json .}}' $Volume)
        if ($LASTEXITCODE -ne 0 -or $vRaw.Count -ne 1) { throw 'REVIEW_VOLUME_INSPECT_FAILED' }
        $vInfo=$vRaw[0] | ConvertFrom-Json
        $vProperty=$vInfo.Labels.PSObject.Properties['tto.phase3.review']
        if ($null -eq $vProperty -or [string]$vProperty.Value -cne $SHA) { throw 'VOLUME_OWNER_MISMATCH' }
        DockerStep 'Delete only review source volume' @('volume','rm',$Volume)
    }
    Write-Host 'TTO_REVIEW_STOP_PASS_REPORTS_RETAINED' -ForegroundColor Green
    return
}

if (-not (Test-Path -LiteralPath $Repo)) { throw 'LOCAL_REPO_NOT_FOUND' }
$remote=(& git -C $Repo remote get-url origin).Trim()
CheckGit 'origin'
if($remote -notmatch '(?i)github\.com[:/]tajikinews-design/tto-national-platform-app(?:\.git)?$') {
    throw 'UNEXPECTED_ORIGIN'
}
if (-not (Test-Path -LiteralPath $Work)) {
    & git -C $Repo fetch --no-tags origin ('refs/heads/'+$Branch)
    CheckGit 'fetch review commit'
    $fetched=(& git -C $Repo rev-parse FETCH_HEAD).Trim()
    CheckGit 'fetched SHA'
    if($fetched -cne $SHA) { throw 'REMOTE_REVIEW_SHA_CHANGED' }
    & git -C $Repo worktree add --detach $Work $SHA
    CheckGit 'worktree'
}
$actual=(& git -C $Work rev-parse HEAD).Trim()
CheckGit 'rev-parse'
if($actual -cne $SHA) { throw "REVIEW_SHA_MISMATCH=$actual" }
$dirty=@(& git -C $Work status --porcelain)
CheckGit 'status'
if($dirty.Count -gt 0) { throw 'REVIEW_WORKTREE_DIRTY' }
$sourceOrigin=(& git -C $Work remote get-url origin).Trim()
CheckGit 'worktree origin'
if($sourceOrigin -cne $remote) { throw 'WORKTREE_ORIGIN_MISMATCH' }
$tracked=@(& git -C $Work ls-files)
CheckGit 'tracked files'
$secrets=@($tracked | Where-Object {
    $base=[IO.Path]::GetFileName([string]$_).ToLowerInvariant()
    (($base -eq '.env' -or $base.StartsWith('.env.')) -and $base -ne '.env.example') -or
    $base -in @('.npmrc','.pypirc','id_rsa','id_ed25519') -or
    $base.EndsWith('.pem') -or $base.EndsWith('.pfx') -or $base.EndsWith('.p12')
})
if ($secrets.Count -gt 0) { throw 'TRACKED_SECRETS_REFUSE_TO_ARCHIVE' }
Write-Host "SOURCE_SHA_VERIFIED=$SHA" -ForegroundColor Green
New-Item -ItemType Directory -Force -Path $Output | Out-Null

if ($Action -eq 'All') {
    if (-not (OwnedContainer)) {
        $volumes=@(& docker volume ls -q --filter ('name=^'+$Volume+'$'))
        if ($volumes -ccontains $Volume) { throw 'EXISTING_VOLUME_NOT_REUSED' }
        $tar=Join-Path $env:TEMP ('tto-review-'+[guid]::NewGuid().ToString('N')+'.tar')
        $createdVolume=$false
        $createdContainer=$false
        try {
            & git -C $Work archive --format=tar ('--output='+$tar) $SHA
            CheckGit 'git archive'
            DockerStep 'Create private source volume' @('volume','create','--label',('tto.phase3.review='+$SHA),$Volume)
            $createdVolume=$true
            DockerStep 'Start shareholder preview (loopback only)' @(
                'run','-d','--rm','--name',$Container,'--label',('tto.phase3.review='+$SHA),
                '-p',('127.0.0.1:'+ $Port +':'+ $Port),
                '-v',($Volume+':/workspace'),'-w','/workspace',
                '-e','CI=true','-e','NEXT_TELEMETRY_DISABLED=1','-e','TTO_API_BASE_URL=','-e','APIIR_TOKEN=',
                'node:22-bookworm','sleep','infinity'
            )
            $createdContainer=$true
            DockerStep 'Transfer exact committed source' @('cp',$tar,($Container+':/tmp/source.tar'))
            DockerStep 'Install and build shareholder only in Docker' @(
                'exec',$Container,'bash','-lc',
                'set -euo pipefail; cd /workspace; tar -xf /tmp/source.tar; npm install -g pnpm@10.18.0; pnpm install --frozen-lockfile; pnpm --filter @tto/shareholder build'
            )
            DockerStep 'Start Next.js web server' @(
                'exec','-d',$Container,'bash','-lc',
                'cd /workspace/apps/shareholder; exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 32150 > /tmp/tto-next.log 2>&1'
            )
        } catch {
            if($createdContainer) { & docker rm -f $Container *> $null }
            if($createdVolume) { & docker volume rm $Volume *> $null }
            throw
        } finally {
            Remove-Item -LiteralPath $tar -Force -ErrorAction SilentlyContinue
        }
    }
}
if (-not (OwnedContainer)) { throw 'REVIEW_CONTAINER_NOT_STARTED' }
Ready
foreach($i in 1..11) {
    $route=if($i -eq 1) {'/review'} else {'/review/nav-'+$i.ToString('00')}
    $r=Invoke-WebRequest -UseBasicParsing -Uri ($Local+$route) -TimeoutSec 25
    if($r.StatusCode -ne 200 -or -not $r.Content.Contains('نسخه بازبینی') -or
       -not $r.Content.Contains('بدون اطلاعات یا عملیات واقعی')) { throw "HTTP_ROUTE_FAILED=$route" }
}
try {
    $null=Invoke-WebRequest -UseBasicParsing -Uri ($Local+'/review/not-a-nav') -TimeoutSec 20
    throw 'INVALID_REVIEW_SLUG_RETURNED_200'
} catch [System.Net.WebException] {
    if($null -eq $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404) {
        throw 'INVALID_REVIEW_SLUG_NOT_404'
    }
}
Write-Host 'TTO_LOCAL_HTTP_11_ROUTES_PASS' -ForegroundColor Green

$js=@'
"use strict";
const fs=require("fs"),path=require("path"),{chromium}=require("playwright");
const BASE="http://127.0.0.1:32150",OUT="/results";
const SHA="4385b468e10e0707071b131a537d1f2194e29ee5";
const routes=["/review",...Array.from({length:10},(_,i)=>"/review/nav-"+String(i+2).padStart(2,"0"))];
const viewports=[{name:"desktop",width:1440,height:900,mobile:false},{name:"mobile",width:390,height:844,mobile:true}];
const fails=[],checks=[];let captures=0;
const ensure=(ok,desc)=>{if(!ok)throw Error(desc);checks.push(desc)};
const problems=(v,r,e)=>{fails.push({viewport:v,route:r,error:String(e?.message||e)});console.error("FAIL "+v+" "+r+" "+String(e?.message||e))};
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  for(const v of viewports)for(const route of routes){
   const context=await browser.newContext({viewport:{width:v.width,height:v.height},locale:"fa-IR",isMobile:v.mobile});
   const page=await context.newPage(),bad=[];
   try{
    await context.route("**/*",async x=>{
     const req=x.request(),url=new URL(req.url());
     if(url.origin!==BASE||!["GET","HEAD"].includes(req.method())||url.pathname.startsWith("/api/")){
      bad.push(req.method()+" "+url.href);await x.abort();
     } else await x.continue();
    });
    const response=await page.goto(BASE+route,{waitUntil:"networkidle",timeout:45000});
    ensure(response?.status()===200,v.name+" "+route+" HTTP200");
    ensure(await page.locator("html").getAttribute("lang")==="fa",v.name+" "+route+" fa lang");
    ensure(await page.locator("html").getAttribute("dir")==="rtl",v.name+" "+route+" RTL root");
    ensure(await page.locator(".rv-navigation .rv-nav-link").count()===11,v.name+" "+route+" 11 nav");
    ensure(await page.locator(".rv-navigation [aria-current=page]").count()===1,v.name+" "+route+" single active nav");
    ensure(await page.locator(".rv-navigation [aria-current=page]").getAttribute("href")===route,v.name+" "+route+" active URL");
    ensure(await page.locator(".rv-app form,.rv-app input,.rv-app select,.rv-app textarea").count()===0,v.name+" "+route+" no live forms");
    const body=await page.locator("body").innerText();
    ensure(body.includes("نسخه بازبینی")&&body.includes("بدون اطلاعات یا عملیات واقعی"),v.name+" "+route+" safety disclosures");
    const css=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,
      side:getComputedStyle(document.querySelector(".rv-sidebar")).position,
      nav:getComputedStyle(document.querySelector(".rv-navigation")).flexDirection}));
    ensure(css.width<=css.client+2,v.name+" "+route+" no horizontal page overflow "+css.width+"/"+css.client);
    ensure(v.mobile?(css.side==="relative"&&css.nav==="row"):(css.side==="sticky"&&css.nav==="column"),v.name+" "+route+" responsive nav");
    await page.screenshot({path:path.join(OUT,v.name+"-"+(route==="/review"?"nav-01":route.split("/").pop())+".png"),fullPage:true});
    captures++;
    if(route==="/review"){
      const cards=page.locator(".rv-module-card");
      ensure(await cards.count()===10,v.name+" dashboard cards");
      for(const a of await cards.all()){
       const h=await a.getAttribute("href");
       ensure(routes.includes(h)&&h!=="/review",v.name+" dashboard link "+h);
      }
    }else{
      const tabs=page.getByRole("tab");
      ensure(await tabs.count()===3,v.name+" "+route+" 3 tabs");
      ensure(await tabs.nth(0).getAttribute("aria-selected")==="true",v.name+" "+route+" initial overview");
      await tabs.nth(1).click();
      ensure(await tabs.nth(1).getAttribute("aria-selected")==="true"&&await page.locator(".rv-journey").isVisible(),v.name+" "+route+" journey click");
      await tabs.nth(2).click();
      ensure(await tabs.nth(2).getAttribute("aria-selected")==="true"&&await page.locator(".rv-access").isVisible(),v.name+" "+route+" access click");
      await tabs.nth(0).click();
      ensure(await tabs.nth(0).getAttribute("aria-selected")==="true"&&await page.locator(".rv-detail-body").isVisible(),v.name+" "+route+" overview click");
    }
    ensure(bad.length===0,v.name+" "+route+" no API/mutation/external request");
    console.log("PASS "+v.name+" "+route);
   }catch(e){problems(v.name,route,e)}finally{await context.close()}
  }
  const c=await browser.newContext();
  const r=await c.request.get(BASE+"/review/not-a-nav");
  ensure(r.status()===404,"invalid review slug 404");await c.close();
 }catch(e){problems("global","global",e)}finally{if(browser)await browser.close()}
 const report={commit:SHA,local:BASE,pages:22,screenshots:captures,assertions_passed:checks.length,failed:fails,pass:fails.length===0,
  scope:"Local Docker/browser only; not a hosted SSO or real-shareholder acceptance test"};
 fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(OUT,"report.md"),[
 "# TTO Phase-3 local browser verification", "Commit: "+SHA,"Screenshots: "+captures,
 "Assertions passed: "+checks.length,"Failed: "+fails.length,
 "This is local-only; manual visual signoff and hosted SSO are separate gates.",
 ...fails.map(x=>"- FAIL "+x.viewport+" "+x.route+": "+x.error)].join("\n")+"\n");
 console.log("TTO_PHASE3_REVIEW_SCREENSHOTS="+captures);
 console.log("TTO_PHASE3_REVIEW_FAIL_COUNT="+fails.length);
 if(fails.length===0)console.log("TTO_PHASE3_LOCAL_BROWSER_PASS_SHA="+SHA);
 else process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
'@
$browserFile=Join-Path $Output 'review-browser.cjs'
[IO.File]::WriteAllText($browserFile,$js,([System.Text.UTF8Encoding]::new($false)))
DockerStep 'Run Chromium in isolated browser container' @(
    'run','--rm','--network',('container:'+$Container),'--security-opt','no-new-privileges',
    '--mount',('type=bind,source='+$browserFile+',target=/tmp/review-browser.cjs,readonly'),
    '--mount',('type=bind,source='+$Output+',target=/results'),
    'mcr.microsoft.com/playwright:v1.56.1-noble','bash','-lc',
    'set -euo pipefail; npm install --prefix /tmp/tto-browser --no-audit --no-fund --silent playwright@1.56.1; NODE_PATH=/tmp/tto-browser/node_modules node /tmp/review-browser.cjs'
)
Write-Host "TTO_PHASE3_LOCAL_REVIEW_COMPLETE_SHA=$SHA" -ForegroundColor Green
Write-Host "BROWSER_URL=$Local/review"
Write-Host "REPORT=$Output\report.json"
Write-Host 'STOP_USE_SAME_SCRIPT_WITH_ACTION_STOP'
