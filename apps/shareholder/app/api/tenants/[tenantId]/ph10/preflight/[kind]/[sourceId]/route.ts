import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const ROUTES:Record<string,{build:(id:string)=>string;keys:readonly string[]}> = {
 checkout:{build:(id)=>"ph08/market/offers/"+id+"/checkout-preflight",
   keys:["sellerKind","priceSnapshot","published","sourceVerified","orderCreated","paymentEnabled","transactionAuthorized","legalApproval"]},
 refund:{build:(id)=>"ph08/market/orders/"+id+"/refund-policy-preflight",
   keys:["policyVersion","orderStatus","policySnapshotPreserved","refundExecuted","paymentEnabled","transactionAuthorized","legalApproval"]},
};
const deny=(status:number,code:string)=>NextResponse.json({available:false,preflightOnly:true,operationGate:"BLOCKED",code},{status,headers:HEADERS});
/** Read-only member preflight, NOT an order or refund command. */
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string;kind:string;sourceId:string}>}){
 const {tenantId,kind,sourceId}=await params;
 if(!UUID.test(tenantId)||!UUID.test(sourceId))return deny(400,"INVALID_IDENTIFIER");
 const route=ROUTES[kind];
 if(!route)return deny(404,"PREFLIGHT_NOT_AVAILABLE");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))return deny(503,"BACKEND_UNAVAILABLE");
 try{
  const parsed=new URL(base);
  if(parsed.username||parsed.password||(parsed.protocol!=="https:"&&!loopback))
   return deny(503,"BACKEND_UNAVAILABLE");
  const headers={Authorization:"Bearer "+token,...trustedBackendHeaders(req)};
  const options={method:"GET",headers,cache:"no-store" as RequestCache,redirect:"error" as RequestRedirect,signal:AbortSignal.timeout(9000)};
  const context=await fetch(new URL("/v1/tenants/"+tenantId+"/context",base),options);
  if(context.status===401)return deny(401,"SESSION_REQUIRED");
  if(context.status===403||context.status===404)return deny(403,"TENANT_DENIED");
  if(context.status!==200)return deny(503,"TENANT_GATE_UNAVAILABLE");
  const checked=await context.json() as {tenant_id?:unknown;status?:unknown};
  if(checked.tenant_id!==tenantId||checked.status!=="ACTIVE")return deny(403,"TENANT_DENIED");
  const upstream=await fetch(new URL("/v1/tenants/"+tenantId+"/"+route.build(sourceId),base),options);
  if(upstream.status===401)return deny(401,"SESSION_REQUIRED");
  if(upstream.status===403||upstream.status===404)return deny(403,"MEMBER_PREFLIGHT_DENIED");
  if(upstream.status!==200)return deny(503,"PREFLIGHT_UNAVAILABLE");
  const data=await upstream.json() as Record<string,unknown>;
  const safe:Record<string,string|number|boolean|null>={};
  for(const key of route.keys){
   const v=data[key];
   if(v===undefined||(v!==null&&typeof v!=="string"&&typeof v!=="number"&&typeof v!=="boolean")
    ||(typeof v==="string"&&v.length>150))return deny(503,"PREFLIGHT_SCHEMA_INVALID");
   safe[key]=(v??null) as string|number|boolean|null;
  }
  if(safe.paymentEnabled!==false||safe.transactionAuthorized!==false||safe.legalApproval!==false)
   return deny(503,"FINANCIAL_GATE_NOT_CLOSED");
  return NextResponse.json({available:true,readOnly:true,preflightOnly:true,operationGate:"BLOCKED",...safe},{status:200,headers:HEADERS});
 }catch{return deny(503,"PREFLIGHT_UNAVAILABLE");}
}
