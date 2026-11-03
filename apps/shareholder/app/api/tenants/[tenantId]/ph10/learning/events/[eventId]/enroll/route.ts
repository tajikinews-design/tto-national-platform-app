import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const deny=(status:number,code:string)=>NextResponse.json({registered:false,code},{status,headers:HEADERS});
/** Genuine member training enrollment, never a share sale or payment. */
export async function POST(req:NextRequest,{params}:{params:Promise<{tenantId:string;eventId:string}>}){
 const {tenantId,eventId}=await params;
 if(!UUID.test(tenantId)||!UUID.test(eventId))return deny(400,"INVALID_IDENTIFIER");
 const cookie=req.cookies.get("tto_session")?.value;
 if(!cookie||!TOKEN.test(cookie))return deny(401,"SESSION_REQUIRED");
 const origin=req.headers.get("origin");
 if(origin){
  try{if(new URL(origin).origin!==new URL(req.url).origin)return deny(403,"INVALID_ORIGIN");}
  catch{return deny(403,"INVALID_ORIGIN");}
 }
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 try{
  if(!base||(!base.startsWith("https://")&&!loopback))return deny(503,"BACKEND_UNAVAILABLE");
  const server=new URL(base);
  if(server.username||server.password||(server.protocol!=="https:"&&!loopback))
   return deny(503,"BACKEND_UNAVAILABLE");
  const headers={Authorization:"Bearer "+cookie,...trustedBackendHeaders(req)};
  const options={headers,cache:"no-store" as RequestCache,redirect:"error" as RequestRedirect,signal:AbortSignal.timeout(9000)};
  const ctx=await fetch(new URL("/v1/tenants/"+tenantId+"/context",base),{...options,method:"GET"});
  if(ctx.status===401)return deny(401,"SESSION_REQUIRED");
  if(ctx.status===403||ctx.status===404)return deny(403,"TENANT_DENIED");
  if(ctx.status!==200)return deny(503,"TENANT_GATE_UNAVAILABLE");
  const data=await ctx.json() as {tenant_id?:unknown;status?:unknown};
  if(data.tenant_id!==tenantId||data.status!=="ACTIVE")return deny(403,"TENANT_DENIED");
  const url=new URL("/v1/tenants/"+tenantId+"/ph08/learning/events/"+eventId+"/enroll",base);
  const response=await fetch(url,{...options,method:"POST"});
  if(response.status===401)return deny(401,"SESSION_REQUIRED");
  if(response.status===403)return deny(403,"ENROLLMENT_DENIED");
  if(response.status===409)return deny(409,"ALREADY_REGISTERED");
  if(response.status!==201)return deny(503,"ENROLLMENT_UNAVAILABLE");
  const result=await response.json() as {registration?:unknown;courseCompleted?:unknown;certificateIssued?:unknown};
  if((result.registration!=="CONFIRMED"&&result.registration!=="WAITLIST")||
     result.courseCompleted!==false||result.certificateIssued!==false)
   return deny(503,"ENROLLMENT_SCHEMA_INVALID");
  return NextResponse.json({registered:true,registration:result.registration,
    courseCompleted:false,certificateIssued:false},{status:201,headers:HEADERS});
 }catch{return deny(503,"ENROLLMENT_UNAVAILABLE");}
}
