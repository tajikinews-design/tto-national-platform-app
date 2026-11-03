import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "./trusted-backend";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie"};
export const validUuid=(v:unknown):v is string=>typeof v==="string"&&UUID.test(v);
export const denial=(status:number,code:string)=>NextResponse.json({code},{status,headers:HEADERS});
/** Browser role/Party/Authorization headers are ignored; only server session + Nest PG17 rule gates authorize. */
export async function membershipBff(req:NextRequest,tenantId:string,suffix:string,
 method:"GET"|"POST",payload?:Record<string,unknown>,validate?:(value:unknown)=>boolean){
 if(!validUuid(tenantId))return denial(400,"INVALID_TENANT");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return denial(401,"SESSION_REQUIRED");
 if(method==="POST"){
  const origin=req.headers.get("origin");
  if(!origin||origin!==new URL(req.url).origin)return denial(403,"ORIGIN_DENIED");
 }
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.TTO_LOOPBACK_E2E==="1"&&process.env.CI==="true"&&
  !process.env.VERCEL&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 const test=process.env.NODE_ENV==="test"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 let url:URL;
 try{
  if(!base||(!base.startsWith("https://")&&!loopback&&!test))return denial(503,"SOURCE_UNAVAILABLE");
  url=new URL("/v1/tenants/"+tenantId+suffix,base);
  if(url.username||url.password||(url.protocol!=="https:"&&!loopback&&!test))
    return denial(503,"SOURCE_UNAVAILABLE");
 }catch{return denial(503,"SOURCE_UNAVAILABLE");}
 try{
  const upstream=await fetch(url,{method,cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(9500),body:method==="POST"?JSON.stringify(payload):undefined,
   headers:{Authorization:`Bearer ${token}`,...trustedBackendHeaders(req),
    ...(method==="POST"?{"Content-Type":"application/json"}:{})}});
  if(upstream.status===401)return denial(401,"SESSION_REQUIRED");
  if([403,404].includes(upstream.status))return denial(403,"SOURCE_OR_PERMISSION_NOT_APPROVED");
  if(upstream.status===409)return denial(409,"VERSION_CONFLICT");
  if(upstream.status===400)return denial(400,"INVALID_REQUEST");
  if(![200,201].includes(upstream.status))return denial(503,"SOURCE_UNAVAILABLE");
  const result:unknown=await upstream.json();
  if(!validate?.(result))return denial(503,"SOURCE_UNAVAILABLE");
  return NextResponse.json(result,{status:upstream.status,headers:HEADERS});
 }catch{return denial(503,"SOURCE_UNAVAILABLE");}
}
export async function readWorkflowBody(req:NextRequest):Promise<Record<string,unknown>|null>{
 try{
  if(!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return null;
  const raw=await req.text();
  if(raw.length>1024)return null;
  const v:unknown=JSON.parse(raw);
  if(!v||typeof v!=="object"||Array.isArray(v))return null;
  return v as Record<string,unknown>;
 }catch{return null;}
}
