import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const ROUTES:Record<string,{path:string;keys:readonly string[]}>={
 "NAV-04":{path:"ph07/communications",keys:["publication_id","title","version"]},
 "NAV-05":{path:"ph07/support/my-tickets",keys:["ticket_id","status","issue_key"]},
 "NAV-07":{path:"ph08/market/offers",keys:["offer_id","title","price_snapshot","seller_kind"]},
 "NAV-08":{path:"ph08/projects/disclosures",keys:["project_id","name"]},
 "NAV-09":{path:"ph07/disclosures",keys:["package_id","version_num","report_kind","dividend_state"]},
 "NAV-10":{path:"ph09/grc/cases",keys:["case_id","kind","status"]}
};
function deny(status:number,code:string){
 return NextResponse.json({items:[],available:false,code},{status,headers:HEADERS});
}
/**
 * Read-only cooperative portal façade.
 * A cookie is never sent to the upstream API; only a server-verified bearer
 * is passed. All business authorization remains in tenant+role+source-guarded
 * SECURITY DEFINER methods and independently verified actor sessions.
 * This route cannot grant rights to national managers or create a payment.
 */
export async function GET(request:NextRequest,
 {params}:{params:Promise<{tenantId:string;moduleId:string}>}){
 const {tenantId,moduleId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT_ID");
 const route=ROUTES[moduleId];
 if(!route)return deny(404,"SOURCE_VIEW_NOT_AVAILABLE");
 const token=request.cookies.get("tto_session")?.value;
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
  if(url.username||url.password||(url.protocol!=="https:"&&!loopback&&!testOnly))
   return deny(503,"BACKEND_UNAVAILABLE");
 }catch{return deny(503,"BACKEND_UNAVAILABLE");}
 try{
  // An empty private result is NOT proof of a valid tenant scope. The Nest
  // tenant context endpoint uses FORCE RLS and must succeed first; otherwise
  // a guessed cross-tenant URL is rejected rather than returning 200 + [].
  const safeHeaders={Authorization:"Bearer "+token,...trustedBackendHeaders(request)};
  const contextUrl=new URL("/v1/tenants/"+tenantId+"/context",base);
  const scoped=await fetch(contextUrl,{method:"GET",headers:safeHeaders,
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if(scoped.status===401)return deny(401,"SESSION_REQUIRED");
  if(scoped.status===403||scoped.status===404)return deny(403,"TENANT_ACCESS_DENIED");
  if(scoped.status!==200)return deny(503,"TENANT_GATE_UNAVAILABLE");
  const checked=await scoped.json() as {tenant_id?:unknown;status?:unknown};
  if(checked.tenant_id!==tenantId||checked.status!=="ACTIVE")
   return deny(403,"TENANT_ACCESS_DENIED");
  const res=await fetch(url,{method:"GET",headers:safeHeaders,
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if(res.status===401)return deny(401,"SESSION_REQUIRED");
  if(res.status===403||res.status===404)return deny(403,"SOURCE_AUTHORITY_DENIED");
  if(res.status!==200)return deny(503,"SOURCE_UNAVAILABLE");
  const data=await res.json() as {items?:unknown};
  if(!Array.isArray(data.items)||data.items.length>100)return deny(503,"SOURCE_SCHEMA_INVALID");
  const items:Record<string,string|number|null>[]=[];
  for(const item of data.items){
   if(typeof item!=="object"||item===null||Array.isArray(item))return deny(503,"SOURCE_SCHEMA_INVALID");
   const source=item as Record<string,unknown>;
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
  return NextResponse.json({items,available:true,sourceBound:true,readOnly:true},
   {status:200,headers:HEADERS});
 }catch{return deny(503,"SOURCE_UNAVAILABLE");}
}
