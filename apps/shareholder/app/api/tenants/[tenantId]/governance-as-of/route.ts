import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie",
 "X-Content-Type-Options":"nosniff"};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const J=/^14[0-9]{2}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/;
const deny=(status:number,code:string)=>NextResponse.json({available:false,code},{status,headers:H});
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 const asOf=req.nextUrl.searchParams.get("date");
 const knownAt=req.nextUrl.searchParams.get("knownAt");
 if(!asOf||!J.test(asOf)||(knownAt&&(knownAt.length>40||
      !Number.isFinite(Date.parse(knownAt)))))
  return deny(400,"INVALID_ASOF");
 const base=process.env.TTO_API_BASE_URL??"";
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!loopback)return deny(503,"TEMPORAL_SOURCE_UNAVAILABLE");
 try{
  const url=new URL(base);
  if(url.username||url.password||url.protocol!=="https:"&&!loopback)
   return deny(503,"TEMPORAL_SOURCE_UNAVAILABLE");
  const upstream=new URL("/v1/tenants/"+tenantId+"/child06/governance-as-of",url);
  upstream.searchParams.set("date",asOf);
  if(knownAt)upstream.searchParams.set("knownAt",knownAt);
  const r=await fetch(upstream,{headers:{Authorization:"Bearer "+token,
    ...trustedBackendHeaders(req)},method:"GET",cache:"no-store",
    redirect:"error",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return deny(401,"SESSION_REQUIRED");
  if(r.status===403)return deny(403,"TEMPORAL_SCOPE_DENIED");
  if(r.status===400)return deny(400,"INVALID_ASOF");
  if(r.status!==200)return deny(503,"TEMPORAL_SOURCE_UNAVAILABLE");
  const data:unknown=await r.json();
  if(!data||typeof data!=="object"||Array.isArray(data))
   return deny(502,"TEMPORAL_UPSTREAM_INVALID");
  const x=data as Record<string,unknown>;
  if(x.tenantId!==tenantId||x.asOf!==asOf||
      x.officialSourceAuthenticated!==false||
      x.legalSignerAuthorityGranted!==false||x.boardLegallyApproved!==false||
      x.tariffActivated!==false||
      !["CONFLICT_HOLD","INCOMPLETE_SOURCE_HOLD","SOURCE_DECLARED_ONLY"].includes(String(x.certainty))||
      !Array.isArray(x.candidateOffices)||!Array.isArray(x.endedOffices)||
      !Array.isArray(x.signingCandidates)||!Array.isArray(x.issues)||
      !Array.isArray(x.conflicts)||!Array.isArray(x.consideredNoticeIds))
    return deny(502,"TEMPORAL_UPSTREAM_INVALID");
  return NextResponse.json({available:true,verified:false,
    asOf:x.asOf,knownAt:x.knownAt,certainty:x.certainty,
    candidateOffices:x.candidateOffices,endedOffices:x.endedOffices,
    signingCandidates:x.signingCandidates,issues:x.issues,
    conflicts:x.conflicts,consideredNoticeIds:x.consideredNoticeIds},
     {status:200,headers:H});
 }catch{return deny(503,"TEMPORAL_SOURCE_UNAVAILABLE");}
}
