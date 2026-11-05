"use strict";
// Disposable CI only: a real ClamAV scanner using a local synthetic EICAR signature.
// This DOES NOT verify the freshness/completeness of production malware signatures.
const assert=require("node:assert/strict");
const {createRequire}=require("node:module");
const {resolve}=require("node:path");
const {scanQuarantineBytes}=createRequire(resolve(__dirname,"../../services/api/package.json"))("./dist/clamd-evidence.js");
if(process.env.CI!=="true"||process.env.TTO_ISOLATED_DEMO_DB!=="true"||
  !process.env.TTO_COOP_CLAMD_SOCKET)
 throw Error("CLAMD_DISPOSABLE_CI_REQUIRED");
const eicar="X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
(async()=>{
 const clean=await scanQuarantineBytes(Buffer.from("%PDF-1.4\nSynthetic unclassified PDF\n"));
 assert.equal(clean.verdict,"CLEAN");
 const bad=await scanQuarantineBytes(Buffer.from(eicar,"ascii"));
 assert.equal(bad.verdict,"MALWARE");
 assert.match(bad.signature,/Eicar|Test/i);
 const old=process.env.TTO_COOP_CLAMD_SOCKET;
 process.env.TTO_COOP_CLAMD_SOCKET="/tmp/tto-no-such-clamd-socket";
 await assert.rejects(()=>scanQuarantineBytes(Buffer.from("synthetic")));
 process.env.TTO_COOP_CLAMD_SOCKET=old;
 console.log("PH10_REAL_CLAMAV_ENGINE_EICAR_DETECTED_CLEAN_PDF_AND_OFFLINE_FAIL_CLOSED");
})().catch(e=>{console.error("PH10_REAL_CLAMAV_SMOKE_FAILED",e.message);process.exitCode=1});
