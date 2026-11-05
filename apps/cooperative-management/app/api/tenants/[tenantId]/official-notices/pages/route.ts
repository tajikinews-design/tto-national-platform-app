import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"no-store, private","Vary":"Cookie"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(s:number,code:string)=>NextResponse.json({code},{status:s,headers:H});
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params,token=req.cookies.get("tto_session")?.value;
 if(!UUID.test(tenantId))return fail(400,"INVALID_TENANT");
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return fail(503,"GAZETTE_NOT_RELEASED");
 const cursor=new URL(req.url).searchParams;
 const pageToken=cursor.get("cursor"),limit=cursor.get("limit")??"50";
 if(cursor.size>2||(pageToken!==null&&!/^[A-Za-z0-9_-]{32,512}$/.test(pageToken))||
  !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit))
  return fail(400,"INVALID_CURSOR");
 const base=process.env.TTO_API_BASE_URL??"";
 const local=process.env.CI==="true"&&!process.env.VERCEL&&process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!local)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(base);if(url.username||url.password)return fail(503,"BACKEND_UNAVAILABLE");
  const target=new URL("/v1/tenants/"+tenantId+"/governance/manual-official-notices/pages",url);
  target.searchParams.set("limit",limit);
  if(pageToken)target.searchParams.set("cursor",pageToken);
  const out=await fetch(target,{headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if([400,401,403].includes(out.status))return fail(out.status,"GAZETTE_ACCESS_DENIED");
  if(out.status!==200)return fail(503,"GAZETTE_HISTORY_UNAVAILABLE");
  const response:unknown=await out.json();
  if(!response||typeof response!=="object"||Array.isArray(response))return fail(502,"INVALID_UPSTREAM");
  const v=response as Record<string,unknown>;
  if(v.tenantId!==tenantId||!Array.isArray(v.items)||v.items.length>Number(limit)||
    typeof v.hasMore!=="boolean"||v.selfReportedOnly!==true||
    v.officiallyVerified!==false||v.legalApproval!==false||v.roleGranted!==false)
    return fail(502,"INVALID_UPSTREAM");
  return NextResponse.json(v,{headers:H});
 }catch{return fail(503,"GAZETTE_HISTORY_UNAVAILABLE");}
}
