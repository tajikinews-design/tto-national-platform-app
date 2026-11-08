import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"no-store, private","Vary":"Cookie",
 "X-Content-Type-Options":"nosniff"};
const deny=(status:number,code:string)=>NextResponse.json(
 {available:false,code},{status,headers:HEADERS});
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT_ID");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 const base=process.env.TTO_API_BASE_URL??"";
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!loopback)return deny(503,"GOVERNANCE_SOURCE_UNAVAILABLE");
 try{
  const url=new URL(base);
  if(url.username||url.password||url.protocol!=="https:"&&!loopback)
   return deny(503,"GOVERNANCE_SOURCE_UNAVAILABLE");
  const res=await fetch(new URL("/v1/tenants/"+tenantId+"/child06/governance-history",url),{
   method:"GET",headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(res.status===401)return deny(401,"SESSION_REQUIRED");
  if(res.status===403)return deny(403,"GOVERNANCE_SCOPE_DENIED");
  if(res.status!==200)return deny(503,"GOVERNANCE_SOURCE_UNAVAILABLE");
  const data:unknown=await res.json();
  if(!data||typeof data!=="object"||Array.isArray(data))
   return deny(502,"GOVERNANCE_SOURCE_INVALID");
  const r=data as Record<string,unknown>;
  if(r.tenantId!==tenantId||r.publishedVerified!==false||
     r.confersSigningPower!==false||r.confersVotingRights!==false||
     r.displayMode!=="SOURCE_DECLARED_HISTORY_PENDING_AUTHENTICATION"||
     !Array.isArray(r.notices)||!Array.isArray(r.boardHistory)||
     !Array.isArray(r.signingHistory)||r.notices.length>100||
     r.boardHistory.length>300||r.signingHistory.length>200)
   return deny(502,"GOVERNANCE_SOURCE_INVALID");
  // Defensive outward response allowlists: never forward names/identifiers of
  // private individuals beyond display name, or unreviewed hidden metadata.
  const notices=r.notices.map((v:Record<string,unknown>)=>({
    noticeId:v.noticeId,sourceType:v.sourceType,noticeKind:v.noticeKind,
    legalNationalId:v.legalNationalId,registrationNumber:v.registrationNumber,
    sourceNoticeNumber:v.sourceNoticeNumber,gazetteIssue:v.gazetteIssue,
    publishedOn:v.publishedOn,resolutionOn:v.resolutionOn,
    authorityLetter:v.authorityLetter,authorityLetterOn:v.authorityLetterOn,
    summary:v.summary,sourceUrl:v.sourceUrl,provenance:v.provenance}));
  const boardHistory=r.boardHistory.map((v:Record<string,unknown>)=>({
    noticeId:v.noticeId,personName:v.personName,office:v.office,
    eventType:v.eventType,eventOn:v.eventOn,termEnd:v.termEnd,sourceVerified:false}));
  const signingHistory=r.signingHistory.map((v:Record<string,unknown>)=>({
    noticeId:v.noticeId,authorityKind:v.authorityKind,requiredSigner:v.requiredSigner,
    alternateSigners:v.alternateSigners,requiresSeal:v.requiresSeal,
    effectiveFrom:v.effectiveFrom,statedEnd:v.statedEnd,
    description:v.description,sourceVerified:false}));
  return NextResponse.json({available:true,verified:false,notices,boardHistory,
     signingHistory},{headers:HEADERS});
 }catch{return deny(503,"GOVERNANCE_SOURCE_UNAVAILABLE");}
}
