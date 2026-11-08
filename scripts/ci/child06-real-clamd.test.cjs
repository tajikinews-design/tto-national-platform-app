/** Runs against REAL clamd + official database, not the previous synthetic socket.
 * Require CI flag and no production tenant data. All samples are artificial.
 */
"use strict";
const assert=require("node:assert/strict");
const {resolve}=require("node:path");
if(process.env.CI!=="true"||process.env.TTO_CHILD06_REAL_CLAMD!=="1"||
   !process.env.TTO_COOP_CLAMD_SOCKET?.startsWith("/"))
 throw Error("CHILD06_REAL_CLAMD_CI_ONLY");
const {scanQuarantineBytes}=require("../../services/api/dist/clamd-evidence.js");
const eicar="X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
(async()=>{
 const clean=Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n");
 const cleanResult=await scanQuarantineBytes(clean);
 assert.equal(cleanResult.verdict,"CLEAN","clean PDF must be clean");
 assert.match(cleanResult.engine,/^ClamAV [0-9]/,"real daemon must identify engine");
 const found=await scanQuarantineBytes(Buffer.from(eicar,"ascii"));
 assert.equal(found.verdict,"MALWARE","real antivirus database must recognize actual EICAR");
 assert.notEqual(found.signature,"NONE");
 // A realistic PDF boundary with embedded EICAR marker. Record whether engine
 // finds embedded text without pretending a malformed PDF is a real notice.
 const PDF=Buffer.from("%PDF-1.7\n%CI-EICAR-ANTIVIRUS-TEST-ONLY\n"+
  "1 0 obj << /Length 68 >> stream\n"+eicar+"\nendstream\nendobj\n%%EOF\n");
 const pdfResult=await scanQuarantineBytes(PDF);
 assert.equal(pdfResult.verdict,"MALWARE","real ClamAV must catch EICAR embedded in PDF");
 console.log("CHILD06_REAL_CLAMAV_INSTREAM_CLEAN_EICAR_PDF_PASS",
   JSON.stringify({engine:cleanResult.engine,signature:found.signature}));
})().catch(e=>{console.error("CHILD06_REAL_CLAMAV_GATE_FAILED",e.message);process.exitCode=1;});
