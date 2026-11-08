import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{12}$/i;
const DATE=/^14[0-9]{2}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const H={"Cache-Control":"private,no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const deny=(n:number,s:string)=>NextResponse.json({code:s},{status:n,headers:H});
function auth(req:NextRequest,tenant:string){
 const token=req.cookies.get("tto_session")?.value;
 if(!UUID.test(tenant)||!token||!TOKEN.test(token))return null;
 if(process.env.TTO_CHILD06_GOVERNANCE_ARCHIVE_UI!=="true"||process.env.VERCEL)return null;
 const base=process.env.TTO_API_BASE_URL??"";
 const lab=process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&
   /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!lab)return null;
 const u=new URL(base);
 if(u.username||u.password||u.protocol!=="https:"&&!lab)return null;
 return {token,u};
}
function safeOrigin(req:NextRequest){
 const origin=req.headers.get("origin");
 if(!origin)return false;
 try{
  const requested=new URL(origin).origin;
  if(requested===new URL(req.url).origin)return true;
  const pinned=process.env.TTO_PH12_PUBLIC_ORIGIN??"";
  return process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&
   !process.env.VERCEL&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(pinned)&&
   requested===pinned;
 }catch{return false;}
}
async function requestUpstream(req:NextRequest,tenant:string,path:string,body?:string){
 const context=auth(req,tenant);
 if(!context)return deny(503,"GOVERNANCE_CONFLICT_SOURCE_UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/tenants/"+tenant+"/child06/"+path,context.u),{
   method:body?"POST":"GET",headers:{Authorization:"Bearer "+context.token,
    ...(body?{"Content-Type":"application/json"}:{}),...trustedBackendHeaders(req)},
   body,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if([400,401,403,409].includes(r.status))return deny(r.status,"GOVERNANCE_CONFLICT_UPSTREAM_DENIED");
  if(!r.ok)return deny(503,"GOVERNANCE_CONFLICT_SOURCE_UNAVAILABLE");
  const value:unknown=await r.json();
  if(!value||typeof value!=="object"||Array.isArray(value))
   return deny(502,"GOVERNANCE_CONFLICT_UNSAFE_UPSTREAM");
  const x=value as Record<string,unknown>;
  if(x.tenantId!==tenant)return deny(502,"GOVERNANCE_CONFLICT_TENANT_MISMATCH");
  if(body){
   if(typeof x.caseId!=="string"||!UUID.test(x.caseId)||
      x.legalAuthorityVerified!==false||x.tariffActivated!==false||
      x.officialEvidenceAuthenticated!==false||x.reviewed!==false||
      x.status!=="USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED")
    return deny(502,"GOVERNANCE_CONFLICT_UNSAFE_RECEIPT");
   return NextResponse.json({caseId:x.caseId,status:x.status,replayed:x.replayed,
    verified:false,legalAuthorityVerified:false,tariffActivated:false},{status:201,headers:H});
  }
  if(path==="governance-conflicts"){
   if(x.legalAuthorityVerified!==false||x.tariffActivated!==false||
    x.officialEvidenceAuthenticated!==false||!Array.isArray(x.cases)||x.cases.length>100)
    return deny(502,"GOVERNANCE_CONFLICT_UNSAFE_AUDIT");
   // Public manager/reviewer view: no raw auth subjects or individual NIDs.
   return NextResponse.json({available:true,verified:false,
    cases:x.cases.map((c:Record<string,unknown>)=>({
      caseId:c.caseId,asOf:c.asOf,conflictCode:c.conflictCode,
      sourceSha256:c.sourceSha256,openedAt:c.openedAt,
      evidence:c.evidence,review:c.review}))},{headers:H});
  }
  if(x.officialSourceAuthenticated!==false||x.legalSignerAuthorityGranted!==false||
   x.tariffActivated!==false||!Array.isArray(x.conflicts))
   return deny(502,"GOVERNANCE_CONFLICT_UNSAFE_SOURCE");
  return NextResponse.json({available:true,verified:false,
   asOf:x.asOf,conflicts:x.conflicts,certainty:x.certainty,
   consideredNoticeIds:x.consideredNoticeIds},{headers:H});
 }catch{return deny(503,"GOVERNANCE_CONFLICT_SOURCE_UNAVAILABLE");}
}
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT");
 if(!req.cookies.get("tto_session")?.value)return deny(401,"SESSION_REQUIRED");
 const date=req.nextUrl.searchParams.get("asOf");
 if(date!==null&&!DATE.test(date))return deny(400,"INVALID_DATE");
 return requestUpstream(req,tenantId,date?
   "governance-as-of?date="+encodeURIComponent(date):"governance-conflicts");
}
export async function POST(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT");
 if(!req.cookies.get("tto_session")?.value)return deny(401,"SESSION_REQUIRED");
 if(!safeOrigin(req))return deny(403,"ORIGIN_DENIED");
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
  return deny(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>12000)return deny(413,"BODY_TOO_LARGE");
 let v:unknown;try{v=JSON.parse(raw);}catch{return deny(400,"INVALID_JSON");}
 if(!v||typeof v!=="object"||Array.isArray(v))return deny(400,"INVALID_INPUT");
 const x=v as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["asOf","conflictCode","evidence","requestKey"].includes(k))||
    !DATE.test(String(x.asOf))||typeof x.conflictCode!=="string"||
    typeof x.requestKey!=="string"||!UUID.test(x.requestKey)||
    !Array.isArray(x.evidence)||x.evidence.length<1||x.evidence.length>20)
   return deny(400,"INVALID_INPUT");
 return requestUpstream(req,tenantId,"governance-conflicts",raw);
}
