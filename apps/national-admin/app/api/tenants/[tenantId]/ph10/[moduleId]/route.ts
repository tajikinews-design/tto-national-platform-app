import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
function deny(status:number,code:string){
 return NextResponse.json({items:[],available:false,code},{status,headers:HEADERS});
}
/**
 * National-admin has NO blanket tenant access. Only a verified, unexpired
 * independent JIT DOCUMENT_REVIEW grant plus an independently authorized
 * platform-operator permit may unlock published nonsecret metadata.
 * No legal decision, access to document bytes, or bulk tenant enumeration.
 */
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string;moduleId:string}>}){
 const {tenantId,moduleId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT");
 if(moduleId!=="NAV-09")return deny(404,"JIT_REVIEW_ONLY");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 const test=process.env.NODE_ENV==="test"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 try{
  if(!base||(!base.startsWith("https://")&&!loopback&&!test))return deny(503,"BACKEND_UNAVAILABLE");
  const baseUrl=new URL(base);
  if(baseUrl.username||baseUrl.password||(baseUrl.protocol!=="https:"&&!loopback&&!test))
   return deny(503,"BACKEND_UNAVAILABLE");
  const headers={Authorization:"Bearer "+token,...trustedBackendHeaders(req)};
  const init={method:"GET",headers,cache:"no-store" as RequestCache,redirect:"error" as RequestRedirect,
   signal:AbortSignal.timeout(9000)};
  const response=await fetch(new URL("/v1/me/tenant-options",base),init);
  if(response.status===401)return deny(401,"SESSION_REQUIRED");
  if(response.status!==200)return deny(503,"JIT_GATE_UNAVAILABLE");
  const options=await response.json() as {items?:unknown};
  if(!Array.isArray(options.items)||options.items.length>50)return deny(503,"JIT_GATE_UNAVAILABLE");
  const allowed=options.items.some(row=>{
   if(!row||typeof row!=="object"||Array.isArray(row))return false;
   const x=row as Record<string,unknown>;
   return x.tenantId===tenantId && x.approvedDocumentJit===true && x.platformOperator===true;
  });
  if(!allowed)return deny(403,"INDEPENDENT_JIT_AND_OPERATOR_REQUIRED");
  const context=await fetch(new URL("/v1/tenants/"+tenantId+"/context",base),init);
  if(context.status===401)return deny(401,"SESSION_REQUIRED");
  if(context.status===403||context.status===404)return deny(403,"TENANT_DENIED");
  if(context.status!==200)return deny(503,"TENANT_UNAVAILABLE");
  const ctx=await context.json() as {tenant_id?:unknown;status?:unknown};
  if(ctx.tenant_id!==tenantId||ctx.status!=="ACTIVE")return deny(403,"TENANT_DENIED");
  const docs=await fetch(new URL("/v1/tenants/"+tenantId+"/documents",base),init);
  if(docs.status===401)return deny(401,"SESSION_REQUIRED");
  if(docs.status===403||docs.status===404)return deny(403,"DOCUMENT_REVIEW_DENIED");
  if(docs.status!==200)return deny(503,"DOCUMENT_SOURCE_UNAVAILABLE");
  const data=await docs.json() as {items?:unknown};
  if(!Array.isArray(data.items)||data.items.length>50)return deny(503,"DOCUMENT_BAD_CONTRACT");
  const items:{document_id:string;title:string;classification:string;status:string}[]=[];
  for(const raw of data.items){
   if(!raw||typeof raw!=="object"||Array.isArray(raw))return deny(503,"DOCUMENT_BAD_CONTRACT");
   const x=raw as Record<string,unknown>;
   if(x.status!=="PUBLISHED"||!["MEMBER","RESTRICTED"].includes(String(x.classification)))continue;
   if(typeof x.document_id!=="string"||!UUID.test(x.document_id)||typeof x.title!=="string"||
    x.title.length<1||x.title.length>200)return deny(503,"DOCUMENT_BAD_CONTRACT");
   items.push({document_id:x.document_id,title:x.title,classification:String(x.classification),status:"PUBLISHED"});
  }
  return NextResponse.json({available:true,scope:"JIT_DOCUMENT_REVIEW_ONLY",
   officialApproval:false,readOnly:true,items},{status:200,headers:HEADERS});
 }catch{return deny(503,"JIT_SOURCE_UNAVAILABLE");}
}
