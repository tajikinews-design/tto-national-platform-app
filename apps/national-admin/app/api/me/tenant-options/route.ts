import { NextRequest,NextResponse } from "next/server";
import { trustedBackendHeaders } from "../../../../lib/trusted-backend";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const SURFACE="national";
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
type Candidate={
 tenantId:string;displayName:string;memberRole:boolean;managerRole:boolean;
 verifiedPartyLink:boolean;activeMembershipProjection:boolean;roleManagementAuthority:boolean;
 approvedDocumentJit:boolean;platformOperator:boolean;
};
function deny(status:number,code:string){
 return NextResponse.json({items:[],code},{status,headers:HEADERS});
}
export async function GET(request:NextRequest){
 // Only read HttpOnly first-party cookie. Ignore request Authorization and forged headers.
 const token=request.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.TTO_LOOPBACK_E2E==="1"&&process.env.CI==="true"&&!process.env.VERCEL&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 const test=process.env.NODE_ENV==="test"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 let url:URL;
 try{
  if(!base||(!base.startsWith("https://")&&!loopback&&!test))return deny(503,"DISCOVERY_UNAVAILABLE");
  url=new URL("/v1/me/tenant-options",base);
  if(url.username||url.password||(url.protocol!=="https:"&&!loopback&&!test))return deny(503,"DISCOVERY_UNAVAILABLE");
 }catch{return deny(503,"DISCOVERY_UNAVAILABLE");}
 try{
  const response=await fetch(url,{method:"GET",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500),
   headers:{Authorization:`Bearer ${token}`,...trustedBackendHeaders(request)}});
  if(response.status===401)return deny(401,"SESSION_REQUIRED");
  if(response.status!==200)return deny(503,"DISCOVERY_UNAVAILABLE");
  const body=await response.json() as {items?:unknown};
  if(!Array.isArray(body.items)||body.items.length>50)return deny(503,"DISCOVERY_UNAVAILABLE");
  const items=[];
  for(const raw of body.items){
   if(!raw||typeof raw!=="object")return deny(503,"DISCOVERY_UNAVAILABLE");
   const r=raw as Candidate;
   if(typeof r.tenantId!=="string"||!UUID.test(r.tenantId)||typeof r.displayName!=="string"||
    r.displayName.length<1||r.displayName.length>300||
    !["memberRole","managerRole","verifiedPartyLink","activeMembershipProjection","roleManagementAuthority",
      "approvedDocumentJit","platformOperator"].every(k=>typeof r[k as keyof Candidate]==="boolean"))
    return deny(503,"DISCOVERY_UNAVAILABLE");
   if(SURFACE==="shareholder"&&!r.memberRole)continue;
   if(SURFACE==="cooperative"&&!r.managerRole)continue;
   if(SURFACE==="national"&&!(r.approvedDocumentJit&&r.platformOperator))continue;
   const evidenceStatus=SURFACE==="shareholder"?
      (r.verifiedPartyLink&&r.activeMembershipProjection?"MEMBERSHIP_EVIDENCE":"EVIDENCE_PENDING"):
      SURFACE==="cooperative"?(r.roleManagementAuthority?"ROLE_AUTHORITY_EVIDENCE":"EVIDENCE_PENDING"):
      "JIT_DOCUMENT_REVIEW_ONLY";
   items.push({tenantId:r.tenantId,displayName:r.displayName,evidenceStatus});
  }
  return NextResponse.json({items},{status:200,headers:HEADERS});
 }catch{return deny(503,"DISCOVERY_UNAVAILABLE");}
}
