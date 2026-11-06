import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../../../../lib/trusted-backend";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const SAFE_HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
function deny(status:number,code:string){
 return NextResponse.json({available:false,allowed:false,officialApproval:false,code},{status,headers:SAFE_HEADERS});
}
/**
 * GRC-AT-001 scoped inquiry only. Never finalizes an Article129 transaction,
 * signs a legal approval, or trusts the client's role/tenant headers.
 * The actor must first be authorized by a real session, tenant context and
 * the scoped GRC summary before the canonical Nest policy is queried.
 */
export async function GET(request:NextRequest,{params}:{
 params:Promise<{tenantId:string;caseId:string}>
}){
 const {tenantId,caseId}=await params;
 if(!UUID.test(tenantId)||!UUID.test(caseId))return deny(400,"INVALID_IDENTIFIER");
 const token=request.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 const testOnly=process.env.NODE_ENV==="test"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 try{
  if(!base||(!base.startsWith("https://")&&!loopback&&!testOnly))return deny(503,"BACKEND_UNAVAILABLE");
  const target=new URL(base);
  if(target.username||target.password||(target.protocol!=="https:"&&!loopback&&!testOnly))
   return deny(503,"BACKEND_UNAVAILABLE");
  const init={method:"GET",cache:"no-store" as RequestCache,
   redirect:"error" as RequestRedirect,signal:AbortSignal.timeout(9000),
   headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(request)}};
  const scoped=await fetch(new URL("/v1/tenants/"+tenantId+"/context",base),init);
  if(scoped.status===401)return deny(401,"SESSION_REQUIRED");
  if(scoped.status===403||scoped.status===404)return deny(403,"TENANT_DENIED");
  if(scoped.status!==200)return deny(503,"TENANT_GATE_UNAVAILABLE");
  const context=await scoped.json() as {tenant_id?:unknown;status?:unknown};
  if(context.tenant_id!==tenantId||context.status!=="ACTIVE")return deny(403,"TENANT_DENIED");
  const listed=await fetch(new URL("/v1/tenants/"+tenantId+"/ph09/grc/cases",base),init);
  if(listed.status===401)return deny(401,"SESSION_REQUIRED");
  if(listed.status===403||listed.status===404)return deny(403,"CASE_ACCESS_DENIED");
  if(listed.status!==200)return deny(503,"CASE_SOURCE_UNAVAILABLE");
  const allowedList=await listed.json() as {items?:unknown};
  if(!Array.isArray(allowedList.items)||allowedList.items.length>100)return deny(503,"CASE_SOURCE_INVALID");
  if(!allowedList.items.some(row=>row&&typeof row==="object"&&!Array.isArray(row)&&
   (row as {case_id?:unknown}).case_id===caseId))return deny(403,"CASE_ACCESS_DENIED");
  const check=await fetch(new URL("/v1/tenants/"+tenantId+"/ph09/grc/"+caseId+"/can-finalize",base),init);
  if(check.status===401)return deny(401,"SESSION_REQUIRED");
  if(check.status===403||check.status===404)return deny(403,"POLICY_DENIED");
  if(check.status!==200)return deny(503,"POLICY_SOURCE_UNAVAILABLE");
  const policy=await check.json() as {allowed?:unknown;decisionIsLegalApproval?:unknown};
  if(typeof policy.allowed!=="boolean"||policy.decisionIsLegalApproval!==false)
   return deny(503,"POLICY_CONTRACT_INVALID");
  return NextResponse.json({available:true,allowed:policy.allowed,readOnly:true,
   officialApproval:false,sourceBound:true,policyKind:"ARTICLE129_PRECHECK_ONLY"},
   {headers:SAFE_HEADERS});
 }catch{return deny(503,"POLICY_SOURCE_UNAVAILABLE");}
}
