/** CHILD06 live official-issuer availability diagnostic.
 * An HTTP home page or user-supplied scan is NEVER issuer authentication.
 * Only actual issuer-issued, independently trust-anchored notice attestation
 * would qualify as verification; no official API/credential is supplied here.
 */
"use strict";
const {request}=require("node:https");
const targets=[
 {kind:"OFFICIAL_GAZETTE",url:"https://rrk.ir/ords/r/rrs/rrs-front/home"},
 {kind:"LEGAL_ENTITY_REGISTER",url:"https://ilenc.ssaa.ir/"}
];
function check(url){
 return new Promise(resolve=>{
  const timer=setTimeout(()=>{req.destroy();resolve({status:"TIMEOUT"});},8000);
  const req=request(url,{method:"GET",headers:{"User-Agent":"TTO-CHILD06-READONLY-ISSUER-CHECK/1.0"}},
   r=>{
    const code=r.statusCode;const redirect=r.headers.location;
    r.resume();clearTimeout(timer);
    resolve({status:"HTTP_"+code,redirected:!!redirect,
     tlsAuthorized:r.socket.authorized===true});
   });
  req.on("error",()=>{clearTimeout(timer);resolve({status:"NETWORK_UNAVAILABLE"});});
  req.end();
 });
}
(async()=>{
 const reports=[];
 for(const target of targets){
  const r=await check(target.url);
  reports.push({issuerKind:target.kind,host:new URL(target.url).hostname,...r,
    noticeLookupAuthenticated:false,officialSignatureVerified:false});
 }
 console.log("CHILD06_ISSUER_SOURCE_LIVE_DIAGNOSTIC_HOLD",
  JSON.stringify({checkedAt:new Date().toISOString(),reports}));
 console.log("CHILD06_OFFICIAL_NOTICE_AUTHENTICATION_REQUIRED_NO_MOCK_PASS");
})().catch(e=>{console.error("CHILD06_OFFICIAL_SOURCE_DIAGNOSTIC_ERROR",e.message);process.exitCode=1;});
