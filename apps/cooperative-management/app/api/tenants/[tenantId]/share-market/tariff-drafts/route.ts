import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const deny=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
function baseUrl(){
 const base=process.env.TTO_API_BASE_URL??"";
 const isolated=process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&
  !process.env.VERCEL&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!isolated)return null;
 try{const u=new URL(base);if(u.username||u.password||(!isolated&&u.protocol!=="https:"))
  return null;return u;}catch{return null;}
}
/** This BFF only hands authenticated immutable DRAFT data to the source-bound
 * Nest/PostgreSQL service. It cannot approve an actual board decision or fee.
 * Default disabled on deployed and preview tenants pending legal release. */
async function gate(req:NextRequest,tenantId:string){
 if(!UUID.test(tenantId))return {error:deny(400,"INVALID_TENANT")};
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return {error:deny(401,"SESSION_REQUIRED")};
 if(process.env.TTO_PH12_TARIFF_DRAFT_INTAKE_ENABLED!=="true")
  return {error:deny(503,"DRAFT_INTAKE_NOT_RELEASED")};
 const base=baseUrl();
 if(!base)return {error:deny(503,"BACKEND_UNAVAILABLE")};
 const headers={Authorization:"Bearer "+token,...trustedBackendHeaders(req)};
 try{
  const scoped=await fetch(new URL("/v1/tenants/"+tenantId+"/context",base),{
   method:"GET",headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if(scoped.status===401)return {error:deny(401,"SESSION_REQUIRED")};
  if(scoped.status===403||scoped.status===404)return {error:deny(403,"TENANT_ACCESS_DENIED")};
  if(scoped.status!==200)return {error:deny(503,"TENANT_GATE_UNAVAILABLE")};
  const context=await scoped.json() as {tenant_id?:unknown;status?:unknown};
  if(context.tenant_id!==tenantId||context.status!=="ACTIVE")
   return {error:deny(403,"TENANT_ACCESS_DENIED")};
  const options=await fetch(new URL("/v1/me/tenant-options",base),{
   method:"GET",headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if(options.status===401)return {error:deny(401,"SESSION_REQUIRED")};
  if(options.status!==200)return {error:deny(503,"MANAGER_AUTHORITY_UNAVAILABLE")};
  const candidates=await options.json() as {items?:unknown};
  if(!Array.isArray(candidates.items)||candidates.items.length>50)
   return {error:deny(503,"MANAGER_AUTHORITY_UNAVAILABLE")};
  const permitted=candidates.items.some(v=>{
   if(!v||typeof v!=="object"||Array.isArray(v))return false;
   const x=v as Record<string,unknown>;
   return x.tenantId===tenantId&&x.managerRole===true&&
     x.roleManagementAuthority===true;
  });
  if(!permitted)return {error:deny(403,"MANAGER_AUTHORITY_NOT_VERIFIED")};
  return {base,headers};
 }catch{return {error:deny(503,"SOURCE_UNAVAILABLE")};}
}
async function handler(req:NextRequest,params:Promise<{tenantId:string}>,method:"GET"|"POST"){
 const {tenantId}=await params;
 // Authentication and verified cooperative management grant are checked
 // before mutation-specific CSRF policy. Anonymous callers never learn
 // whether a guessed tenant exists merely from a POST Origin mismatch.
 const proof=await gate(req,tenantId);
 if(proof.error)return proof.error;
 if(method==="POST"){
  const origin=req.headers.get("origin");
  if(!origin)return deny(403,"ORIGIN_REQUIRED");
  try{
    const actual=new URL(req.url),incoming=new URL(origin);
    // Next's isolated CI loopback server can canonicalize localhost <-> 127.0.0.1.
    // ONLY in CI, same protocol/port and BOTH known loopback names are equivalent.
    // Hosted preview and production always require an exact same-origin match.
    const labAliases=process.env.CI==="true"&&
      process.env.TTO_LOOPBACK_E2E==="1"&&!process.env.VERCEL&&
      actual.protocol==="http:"&&incoming.protocol==="http:"&&
      actual.port===incoming.port&&
      ["localhost","127.0.0.1"].includes(actual.hostname)&&
      ["localhost","127.0.0.1"].includes(incoming.hostname);
    if(incoming.origin!==actual.origin&&!labAliases)return deny(403,"ORIGIN_DENIED");
  }catch{return deny(403,"ORIGIN_DENIED");}
  if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
   return deny(415,"JSON_REQUIRED");
 }
 const {base,headers}=proof;
 if(!base||!headers)return deny(503,"TENANT_GATE_UNAVAILABLE");
 let rawBody:string|undefined;
 if(method==="POST"){
  try{
   rawBody=await req.text();
   if(rawBody.length>4800)return deny(413,"DRAFT_TOO_LARGE");
   const payload:unknown=JSON.parse(rawBody);
   if(!payload||typeof payload!=="object"||Array.isArray(payload))
    return deny(400,"INVALID_DRAFT");
   const obj=payload as Record<string,unknown>;
   if(typeof obj.requestKey!=="string"||!UUID.test(obj.requestKey)||
      !obj.tariff||typeof obj.tariff!=="object"||Array.isArray(obj.tariff)||
      Object.keys(obj).some(k=>!["requestKey","tariff"].includes(k)))
    return deny(400,"INVALID_DRAFT");
  }catch{return deny(400,"INVALID_DRAFT");}
 }
 try{
  const upstream=await fetch(new URL("/v1/tenants/"+tenantId+"/ph12/share-market/tariff-drafts",base),{
   method,headers:{...headers,...(method==="POST"?{"Content-Type":"application/json"}:{})},
   body:rawBody,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if([400,401,403,409,413,415].includes(upstream.status))
   return deny(upstream.status,upstream.status===409?"DRAFT_VERSION_OR_REQUEST_CONFLICT":"DRAFT_ACCESS_OR_INPUT_DENIED");
  if(upstream.status!==(method==="POST"?201:200))
   return deny(503,"DRAFT_SOURCE_UNAVAILABLE");
  const data=await upstream.json() as Record<string,unknown>;
  if(data.tenantId!==tenantId||data.draftOnly!==true||
     data.boardVerified!==false||data.feeActivated!==false||
     data.realPaymentConfirmed!==false||data.legalShareTransfer!==false)
    return deny(502,"UNEXPECTED_DRAFT_SOURCE");
  if(method==="GET"){
   if(!Array.isArray(data.items)||data.items.length>50)return deny(502,"UNEXPECTED_DRAFT_SOURCE");
   for(const v of data.items){
    if(!v||typeof v!=="object"||Array.isArray(v))return deny(502,"UNEXPECTED_DRAFT_SOURCE");
    const x=v as Record<string,unknown>;
    if(typeof x.draftId!=="string"||!UUID.test(x.draftId)||
       x.status!=="DRAFT_UNVERIFIED"||
       typeof x.feeId!=="string"||!Number.isInteger(x.version)||
       !x.tariff||typeof x.tariff!=="object"||Array.isArray(x.tariff))
      return deny(502,"UNEXPECTED_DRAFT_SOURCE");
   }
  }else if(typeof data.draftId!=="string"||!UUID.test(data.draftId)||
     data.status!=="DRAFT_UNVERIFIED"||typeof data.replayed!=="boolean")
    return deny(502,"UNEXPECTED_DRAFT_SOURCE");
  return NextResponse.json(data,{status:upstream.status,headers:H});
 }catch{return deny(503,"DRAFT_SOURCE_UNAVAILABLE");}
}
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 return handler(req,params,"GET");
}
export async function POST(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 return handler(req,params,"POST");
}
