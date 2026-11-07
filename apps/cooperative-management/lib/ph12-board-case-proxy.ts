import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "./trusted-backend";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const tokenShape=/^[A-Za-z0-9_-]{32,256}$/;
const H={"Cache-Control":"private, no-store","Vary":"Cookie",
 "X-Content-Type-Options":"nosniff"};
const denied=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function ph12BoardCaseProxy(req:NextRequest,tenantId:string,
 method:"GET"|"POST",caseId?:string):Promise<NextResponse>{
 if(!uuid.test(tenantId)||(caseId!==undefined&&!uuid.test(caseId)))
  return denied(400,"INVALID_SCOPE");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!tokenShape.test(token))return denied(401,"SESSION_REQUIRED");
 if(process.env.TTO_PH12_TARIFF_DRAFT_INTAKE_ENABLED!=="true")
  return denied(503,"BOARD_DOCUMENT_REVIEW_NOT_RELEASED");
 if(method==="POST"){
  const origin=req.headers.get("origin");
  if(!origin)return denied(403,"ORIGIN_REQUIRED");
  try{
   const actual=new URL(req.url).origin,submitted=new URL(origin).origin;
   if(submitted!==actual){
    if(process.env.CI==="true")
     console.error("PH12_CSRF_TEST_DIAGNOSTIC",submitted,actual,req.headers.get("host"));
    return denied(403,"CROSS_ORIGIN_DENIED");
   }
  }catch{
   if(process.env.CI==="true")
    console.error("PH12_CSRF_PARSE_DIAGNOSTIC",String(origin).slice(0,120),
      String(req.url).slice(0,120),req.headers.get("host"));
   return denied(403,"CROSS_ORIGIN_DENIED");
  }
  if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
    return denied(415,"JSON_REQUIRED");
 }
 const base=process.env.TTO_API_BASE_URL??"";
 const isolated=process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&
  !process.env.VERCEL&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!isolated)return denied(503,"BACKEND_UNAVAILABLE");
 let api:URL;
 try{api=new URL(base);if(api.username||api.password||(!isolated&&api.protocol!=="https:"))
   return denied(503,"BACKEND_UNAVAILABLE");}catch{return denied(503,"BACKEND_UNAVAILABLE");}
 const headers={Authorization:"Bearer "+token,...trustedBackendHeaders(req)};
 let body:string|undefined;
 if(method==="POST"){
  try{
   body=await req.text();if(body.length>4600)return denied(413,"BODY_TOO_LARGE");
   const obj:unknown=JSON.parse(body);
   if(!obj||typeof obj!=="object"||Array.isArray(obj))
    return denied(400,"INVALID_REVIEW_REQUEST");
  }catch{return denied(400,"INVALID_REVIEW_REQUEST");}
 }
 try{
  const scoped=await fetch(new URL("/v1/tenants/"+tenantId+"/context",api),{
   method:"GET",headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if(scoped.status===401)return denied(401,"SESSION_REQUIRED");
  if([403,404].includes(scoped.status))return denied(403,"TENANT_ACCESS_DENIED");
  if(scoped.status!==200)return denied(503,"TENANT_CONTEXT_UNAVAILABLE");
  const ctx=await scoped.json() as {tenant_id?:unknown;status?:unknown};
  if(ctx.tenant_id!==tenantId||ctx.status!=="ACTIVE")
   return denied(403,"TENANT_CONTEXT_DENIED");
  // Only Nest/PostgreSQL decides whether the caller is an authorized manager
  // or an independent DOCUMENT_REVIEWER; client-side role claims are ignored.
  const suffix=caseId?"/"+caseId+"/review":"";
  const path="/v1/tenants/"+tenantId+"/ph12/share-market/tariff-board-cases"+suffix;
  const res=await fetch(new URL(path,api),{
   method,headers:{...headers,...(body?{"Content-Type":"application/json"}:{})},
   body,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if([400,401,403,409].includes(res.status))
   return denied(res.status,res.status===409?"REVIEW_CONFLICT":"BOARD_SOURCE_OR_ROLE_DENIED");
  if(res.status!==(method==="GET"?200:201))return denied(503,"BOARD_BACKEND_UNAVAILABLE");
  const data=await res.json() as Record<string,unknown>;
  if(data.tenantId!==tenantId||data.boardLegallyApproved!==false||
     data.tariffActivated!==false||data.officialFeePaid!==false||
     data.legalShareTransfer!==false||data.signerAuthorityAuthenticated!==false||
     data.signerIdentityAuthenticated!==false)
    return denied(502,"UNEXPECTED_BOARD_SOURCE_RESPONSE");
  if(method==="GET"){
   if(!Array.isArray(data.items)||data.items.length>50)
    return denied(502,"UNEXPECTED_BOARD_SOURCE_RESPONSE");
  }else if(caseId){
   if(data.caseId!==caseId||typeof data.reviewId!=="string"||
      !uuid.test(data.reviewId))return denied(502,"UNEXPECTED_BOARD_SOURCE_RESPONSE");
  }else if(typeof data.caseId!=="string"||!uuid.test(data.caseId)||
      data.status!=="DOCUMENT_INTAKE_AUTHORITY_UNVERIFIED")
   return denied(502,"UNEXPECTED_BOARD_SOURCE_RESPONSE");
  return NextResponse.json(data,{status:res.status,headers:H});
 }catch{return denied(503,"BOARD_BACKEND_UNAVAILABLE");}
}
