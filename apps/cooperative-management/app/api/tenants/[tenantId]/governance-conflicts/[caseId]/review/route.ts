import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const H={"Cache-Control":"no-store,private","Vary":"Cookie"};
const deny=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function POST(req:NextRequest,{params}:{
 params:Promise<{tenantId:string;caseId:string}>}){
 const {tenantId,caseId}=await params;
 if(!UUID.test(tenantId)||!UUID.test(caseId))return deny(400,"INVALID_SCOPE");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 if(process.env.TTO_CHILD06_GOVERNANCE_ARCHIVE_UI!=="true"||process.env.VERCEL)
  return deny(503,"REVIEW_LAB_DISABLED");
 const origin=req.headers.get("origin");
 if(!origin)return deny(403,"ORIGIN_REQUIRED");
 const pinned=process.env.TTO_PH12_PUBLIC_ORIGIN??"";
 const lab=process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(pinned);
 try{
  if(new URL(origin).origin!==new URL(req.url).origin&&
     !(lab&&new URL(origin).origin===pinned))return deny(403,"ORIGIN_DENIED");
 }catch{return deny(403,"ORIGIN_DENIED");}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
  return deny(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>4500)return deny(413,"BODY_TOO_LARGE");
 let payload:unknown;try{payload=JSON.parse(raw);}catch{return deny(400,"INVALID_JSON");}
 if(!payload||typeof payload!=="object"||Array.isArray(payload))
  return deny(400,"INVALID_PAYLOAD");
 const x=payload as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["outcome","evidenceIds","reason","requestKey"].includes(k))||
   !["HOLD_OFFICIAL_SOURCE_REQUIRED","REJECT_SOURCE_CLAIM",
    "HOLD_INSUFFICIENT_EVIDENCE"].includes(String(x.outcome))||
   !Array.isArray(x.evidenceIds)||x.evidenceIds.length<1||x.evidenceIds.length>20||
   x.evidenceIds.some(v=>typeof v!=="string"||!UUID.test(v))||
   typeof x.reason!=="string"||x.reason.length<25||x.reason.length>1400||
   !UUID.test(String(x.requestKey)))return deny(400,"INVALID_PAYLOAD");
 const base=process.env.TTO_API_BASE_URL??"";
 const local=process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!local)return deny(503,"SOURCE_UNAVAILABLE");
 try{
  const u=new URL(base);
  if(u.username||u.password||u.protocol!=="https:"&&!local)
   return deny(503,"SOURCE_UNAVAILABLE");
  const r=await fetch(new URL("/v1/tenants/"+tenantId+
    "/child06/governance-conflicts/"+caseId+"/review",u),{
   method:"POST",headers:{"Content-Type":"application/json",
    Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
   body:raw,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if([400,401,403,409].includes(r.status))return deny(r.status,"REVIEW_DENIED");
  if(r.status!==201)return deny(503,"SOURCE_UNAVAILABLE");
  const obj:unknown=await r.json();
  if(!obj||typeof obj!=="object"||Array.isArray(obj))return deny(502,"UNSAFE_RESPONSE");
  const v=obj as Record<string,unknown>;
  if(v.tenantId!==tenantId||v.caseId!==caseId||typeof v.dispositionId!=="string"||
    !UUID.test(v.dispositionId)||v.legalAuthorityVerified!==false||
    v.officialEvidenceAuthenticated!==false||v.tariffActivated!==false||
    v.independentReviewRecorded!==true)return deny(502,"UNSAFE_RESPONSE");
  return NextResponse.json({caseId,dispositionId:v.dispositionId,
   outcome:v.outcome,replayed:v.replayed,verified:false,tariffActivated:false},
    {status:201,headers:H});
 }catch{return deny(503,"SOURCE_UNAVAILABLE");}
}
