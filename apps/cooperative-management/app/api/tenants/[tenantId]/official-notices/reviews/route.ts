import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params,token=req.cookies.get("tto_session")?.value;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT");
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return deny(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return deny(503,"GAZETTE_HISTORY_NOT_RELEASED");
 const q=new URL(req.url).searchParams;
 const pageToken=q.get("cursor"),limit=q.get("limit")??"50";
 if(q.size>2||(pageToken!==null&&!/^[A-Za-z0-9_-]{32,512}$/.test(pageToken))||
   !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit))
  return deny(400,"INVALID_REVIEW_HISTORY_CURSOR");
 const base=process.env.TTO_API_BASE_URL??"";
 const local=process.env.CI==="true"&&!process.env.VERCEL&&
   process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!local)return deny(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(base);
  if(url.username||url.password)return deny(503,"BACKEND_UNAVAILABLE");
  const upstream=new URL("/v1/tenants/"+tenantId+"/governance/manual-official-notices/reviews",url);
  upstream.searchParams.set("limit",limit);
  if(pageToken)upstream.searchParams.set("cursor",pageToken);
  const response=await fetch(upstream,{headers:{
   Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if([400,401,403].includes(response.status))return deny(response.status,"GAZETTE_REVIEW_HISTORY_ACCESS_DENIED");
  if(response.status!==200)return deny(503,"GAZETTE_REVIEW_HISTORY_UNAVAILABLE");
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return deny(502,"INVALID_UPSTREAM");
  const data=raw as Record<string,unknown>;
  if(data.tenantId!==tenantId||!Array.isArray(data.items)||data.items.length>Number(limit)||
     typeof data.hasMore!=="boolean"||data.officiallyVerified!==false||
     data.legalApproval!==false||data.roleGranted!==false||
     data.sourceClassification!=="INDEPENDENT_REVIEWER_FINDINGS_NOT_OFFICIAL_VERIFICATION")
    return deny(502,"INVALID_UPSTREAM");
  for(const row of data.items){
   if(!row||typeof row!=="object"||Array.isArray(row))return deny(502,"INVALID_UPSTREAM");
   const item=row as Record<string,unknown>;
   if(typeof item.findingId!=="string"||!UUID.test(item.findingId)||
     typeof item.claimId!=="string"||!UUID.test(item.claimId)||
     !["INCONCLUSIVE","MISMATCH_REPORTED","MATCH_REPORTED_UNVERIFIED"].includes(String(item.outcome))||
     typeof item.sourceReference!=="string"||typeof item.rationale!=="string"||
     typeof item.createdAt!=="string")return deny(502,"INVALID_UPSTREAM");
  }
  return NextResponse.json(data,{headers:H});
 }catch{return deny(503,"GAZETTE_REVIEW_HISTORY_UNAVAILABLE");}
}
