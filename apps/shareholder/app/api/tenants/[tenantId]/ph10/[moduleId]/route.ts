import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const ROUTES:Record<string,{path:string;keys:readonly string[]}>={
 "NAV-06":{path:"ph08/learning/events",keys:["event_id","course_title","capacity","refund_policy_version","registration_state"]},
 "NAV-07":{path:"ph08/market/offers",keys:["offer_id","title","price_snapshot","seller_kind"]},
 "NAV-08":{path:"ph08/projects/disclosures",keys:["project_id","name"]},
 "NAV-10":{path:"ph09/impact/approved",keys:["claim_id","measurement_id","amount"]}
};
function deny(status:number,code:string){
 return NextResponse.json({available:false,items:[],code},{status,headers:HEADERS});
}
/** No market share trades or personalized ownership, only independently
 * approved/filtered domain read models. No client-provided bearer/party role.
 */
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string;moduleId:string}>}){
 const {tenantId,moduleId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT_ID");
 const route=ROUTES[moduleId];
 if(!route)return deny(404,"SOURCE_NOT_CONNECTED");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 const testOnly=process.env.NODE_ENV==="test"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 let url:URL;
 try{
  if(!base||(!base.startsWith("https://")&&!loopback&&!testOnly))return deny(503,"BACKEND_UNAVAILABLE");
  url=new URL("/v1/tenants/"+tenantId+"/"+route.path,base);
  if(url.username||url.password||(url.protocol!=="https:"&&!loopback&&!testOnly))return deny(503,"BACKEND_UNAVAILABLE");
 }catch{return deny(503,"BACKEND_UNAVAILABLE");}
 const headers={Authorization:"Bearer "+token,...trustedBackendHeaders(req)};
 try{
  // Tenant context is a prerequisite, not implied by 200 [] read responses.
  const ctx=await fetch(new URL("/v1/tenants/"+tenantId+"/context",base),{
   method:"GET",headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if(ctx.status===401)return deny(401,"SESSION_REQUIRED");
  if(ctx.status===403||ctx.status===404)return deny(403,"TENANT_ACCESS_DENIED");
  if(ctx.status!==200)return deny(503,"TENANT_GATE_UNAVAILABLE");
  const context=await ctx.json() as {tenant_id?:unknown;status?:unknown};
  if(context.tenant_id!==tenantId||context.status!=="ACTIVE")return deny(403,"TENANT_ACCESS_DENIED");
  const upstream=await fetch(url,{method:"GET",headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if(upstream.status===401)return deny(401,"SESSION_REQUIRED");
  if(upstream.status===403||upstream.status===404)return deny(403,"READ_DENIED");
  if(upstream.status!==200)return deny(503,"SOURCE_UNAVAILABLE");
  const result=await upstream.json() as {items?:unknown};
  if(!Array.isArray(result.items)||result.items.length>100)return deny(503,"SOURCE_SCHEMA_INVALID");
  const items:Record<string,string|number|null>[]=[];
  for(const row of result.items){
   if(typeof row!=="object"||row===null||Array.isArray(row))return deny(503,"SOURCE_SCHEMA_INVALID");
   const source=row as Record<string,unknown>;
   const safe:Record<string,string|number|null>={};
   for(const key of route.keys){
    const value=source[key];
    if(value!==undefined&&value!==null&&typeof value!=="string"&&typeof value!=="number")
     return deny(503,"SOURCE_SCHEMA_INVALID");
    if(typeof value==="string"&&value.length>400)return deny(503,"SOURCE_SCHEMA_INVALID");
    safe[key]=typeof value==="string"||typeof value==="number"?value:null;
   }
   items.push(safe);
  }
  return NextResponse.json({items,available:true,sourceBound:true,readOnly:true},{headers:HEADERS});
 }catch{return deny(503,"SOURCE_UNAVAILABLE");}
}
