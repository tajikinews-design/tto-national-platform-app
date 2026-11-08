import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const deny=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function POST(request:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT");
 const token=request.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 if(process.env.TTO_CHILD06_GOVERNANCE_ARCHIVE_UI!=="true"||process.env.VERCEL)
   return deny(503,"GOVERNANCE_IMPORT_DEVELOPMENT_ONLY");
 const origin=request.headers.get("origin");
 if(!origin)return deny(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(request.url).origin)return deny(403,"ORIGIN_DENIED");}
 catch{return deny(403,"ORIGIN_DENIED");}
 if(request.headers.get("content-type")?.split(";")[0]!=="application/json")
  return deny(415,"JSON_REQUIRED");
 const raw=await request.text();
 if(raw.length>24000)return deny(413,"LIMIT_EXCEEDED");
 let data:unknown;
 try{data=JSON.parse(raw);}catch{return deny(400,"JSON_INVALID");}
 if(!data||typeof data!=="object"||Array.isArray(data))return deny(400,"INPUT_INVALID");
 const r=data as Record<string,unknown>;
 if(typeof r.requestKey!=="string"||!UUID.test(r.requestKey)||
    typeof r.cooperativeLegalNationalId!=="string"||
    !/^[0-9]{11}$/.test(r.cooperativeLegalNationalId)||
    typeof r.registrationNumber!=="string"||!/^[0-9]{1,12}$/.test(r.registrationNumber)||
    typeof r.summary!=="string"||r.summary.length>6000||
    !Array.isArray(r.board)||!Array.isArray(r.signing)||
    r.board.length>30||r.signing.length>6)
  return deny(400,"GOVERNANCE_SOURCE_INPUT_INVALID");
 const base=process.env.TTO_API_BASE_URL??"";
 const local=process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&
   /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!local)return deny(503,"SOURCE_UNAVAILABLE");
 try{
  const u=new URL(base);if(u.username||u.password)return deny(503,"SOURCE_UNAVAILABLE");
  const upstream=await fetch(new URL("/v1/tenants/"+tenantId+"/child06/legal-notices",u),{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,
       ...trustedBackendHeaders(request)},body:raw,cache:"no-store",redirect:"error",
    signal:AbortSignal.timeout(9500)});
  if([400,401,403,409].includes(upstream.status))
   return deny(upstream.status,"GOVERNANCE_ARCHIVE_SUBMISSION_DENIED");
  if(upstream.status!==201)return deny(503,"ARCHIVE_SOURCE_UNAVAILABLE");
  const response:unknown=await upstream.json();
  if(!response||typeof response!=="object"||Array.isArray(response))
    return deny(502,"UNSAFE_UPSTREAM");
  const x=response as Record<string,unknown>;
  if(x.tenantId!==tenantId||typeof x.noticeId!=="string"||!UUID.test(x.noticeId)||
     x.state!=="USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED"||
     x.officialSourceAuthenticated!==false||x.legalSignerAuthorityGranted!==false||
     x.shareholderVoteEntitlementGranted!==false||x.tariffActivated!==false)
   return deny(502,"UNSAFE_UPSTREAM");
  return NextResponse.json(x,{status:201,headers:H});
 }catch{return deny(503,"SOURCE_UNAVAILABLE");}
}
