import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie"};
function deny(status:number,code:string){
 return NextResponse.json({available:false,code},{status,headers:HEADERS});
}
/** Private, owner-only, source-approved query. Never trusts client Authorization/role/Party. */
export async function GET(request:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT_ID");
 const token=request.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.TTO_LOOPBACK_E2E==="1"&&process.env.CI==="true"&&!process.env.VERCEL&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 const testOnly=process.env.NODE_ENV==="test"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 let url:URL;
 try{
  if(!base||(!base.startsWith("https://")&&!loopback&&!testOnly))return deny(503,"SOURCE_UNAVAILABLE");
  url=new URL("/v1/tenants/"+tenantId+"/me/member-record",base);
  if(url.username||url.password||(url.protocol!=="https:"&&!loopback&&!testOnly))
   return deny(503,"SOURCE_UNAVAILABLE");
 }catch{return deny(503,"SOURCE_UNAVAILABLE");}
 try{
  const response=await fetch(url,{method:"GET",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500),
   headers:{Authorization:`Bearer ${token}`,...trustedBackendHeaders(request)}});
  if(response.status===401)return deny(401,"SESSION_REQUIRED");
  if(response.status===403||response.status===404)return deny(403,"SOURCE_OR_PERMISSION_NOT_APPROVED");
  if(response.status!==200)return deny(503,"SOURCE_UNAVAILABLE");
  const data=await response.json() as {record?:unknown};
  if(!data.record||typeof data.record!=="object"||Array.isArray(data.record))
   return deny(503,"SOURCE_UNAVAILABLE");
  const r=data.record as Record<string,unknown>;
  
  if(r.membershipStatus!=="ACTIVE"||
     (r.partyKind!=="PERSON"&&r.partyKind!=="ORGANIZATION")||
     !Number.isSafeInteger(r.sourceVersion)||Number(r.sourceVersion)<1||
     typeof r.sourceAsOf!=="string"||!Number.isFinite(Date.parse(r.sourceAsOf)))
   return deny(503,"SOURCE_UNAVAILABLE");
  return NextResponse.json({available:true,record:{
    membershipStatus:"ACTIVE",partyKind:r.partyKind,sourceVersion:r.sourceVersion,sourceAsOf:r.sourceAsOf
  }},{status:200,headers:HEADERS});
 }catch{return deny(503,"SOURCE_UNAVAILABLE");}
}
