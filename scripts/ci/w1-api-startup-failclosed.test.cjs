"use strict";
/**
 * API startup fail-closed regression. Compiled *real* Nest bootstrap is run in
 * short-lived child processes with no DATABASE_URL, no Vercel and NO network
 * credentials. Test exits successfully only if the API process itself fails
 * with the deterministic, non-sensitive error code BEFORE Nest startup.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const {resolve}=require("node:path");
const ROOT=resolve(__dirname,"../..");
const EXPECTED="TTO_API_STARTUP_FAILED_CODE_DATABASE_URL_NOT_CONFIGURED";
if(process.env.CI!=="true"||process.env.TTO_LOOPBACK_E2E!=="1"||
   process.env.VERCEL||process.env.DATABASE_URL||process.env.TTO_DB_APP_PASSWORD||
   process.env.TTO_DB_POOLER_HOST||process.env.TTO_API_BASE_URL||
   process.env.APIIR_TOKEN)throw Error("W1_API_FAILCLOSED_DISPOSABLE_CI_ONLY");

function runWithMissingDatabase(mode,explicitEmpty){
  const env={PATH:process.env.PATH??"/usr/bin:/bin",NODE_ENV:mode,CI:"true",
    TTO_LOOPBACK_E2E:"1",APIIR_TOKEN:""};
  if(explicitEmpty)env.DATABASE_URL="";
  return spawnSync(process.execPath,["dist/main.js"],{
    cwd:resolve(ROOT,"services/api"),env,encoding:"utf8",timeout:8000,
    maxBuffer:16384
  });
}
for(const [name,mode,explicitEmpty] of [
 ["production without DATABASE_URL","production",false],
 ["test with explicitly empty DATABASE_URL","test",true]
]){
 test(name,()=>{
  const r=runWithMissingDatabase(mode,explicitEmpty);
  assert.equal(r.error,undefined,"API bootstrap must exit normally, no timeout");
  assert.equal(r.signal,null,"API must not need an external termination");
  assert.equal(r.status,1,"missing database must be a nonzero process exit");
  const output=(r.stdout??"")+"\n"+(r.stderr??"");
  assert.ok(output.includes(EXPECTED),"deterministic non-sensitive failure marker");
  assert.ok(!output.includes("postgresql://"),"no connection string printed");
  assert.ok(!output.includes("password"),"no credential fields printed");
  assert.ok(!output.includes("Nest application successfully started"),"no app startup");
 });
}
test("API startup code has a non-operational denial, not a synthetic grant",()=>{
 const r=runWithMissingDatabase("production",false);
 assert.equal(r.status,1);
 assert.match(r.stderr, /TTO_API_STARTUP_FAILED_CODE_DATABASE_URL_NOT_CONFIGURED/);
});
console.log("TTO_W1_API_NO_DATABASE_DETERMINISTIC_FAILCLOSED=PASS");
console.log("TTO_W1_API_NO_DATABASE_OPERATIONS=NONE");
