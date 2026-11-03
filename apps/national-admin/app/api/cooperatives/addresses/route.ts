import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
function fail(status:number,code:string){return NextResponse.json({code},{status,headers});}
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"SESSION_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"INVALID_ORIGIN");}
 catch{return fail(403,"INVALID_ORIGIN");}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const body=await req.text();
 if(body.length>256)return fail(413,"BODY_TOO_LARGE");
 let slug:string;
 try{const value:unknown=JSON.parse(body);slug=typeof value==="object"&&value!==null&&!Array.isArray(value)&&(value as Record<string,unknown>).slug && typeof (value as Record<string,unknown>).slug==="string"?(value as {slug:string}).slug:"";}
 catch{return fail(400,"INVALID_JSON");}
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))return fail(400,"INVALID_WORKSPACE_SLUG");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return fail(503,"ISOLATED_DEMO_DATABASE_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL("/v1/national/cooperative-workspaces",base);
  if(url.username||url.password)return fail(503,"BACKEND_UNAVAILABLE");
  const up=await fetch(url,{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json",...trustedBackendHeaders(req)},body:JSON.stringify({slug}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if(up.status===403)return fail(403,"NATIONAL_PLATFORM_OPERATOR_REQUIRED");
  if(up.status===401)return fail(401,"SESSION_REQUIRED");
  if(up.status===409)return fail(409,"WORKSPACE_ADDRESS_TAKEN");
  if(up.status!==201)return fail(503,"WORKSPACE_RESERVATION_UNAVAILABLE");
  const result=await up.json() as {workspaceId?:unknown;address?:unknown;state?:unknown};
  if(typeof result.workspaceId!=="string"||typeof result.address!=="string"||result.state!=="RESERVED")return fail(503,"INVALID_RESULT");
  return NextResponse.json({...result,address:new URL("/c/"+slug,req.url).toString()},{status:201,headers});
 }catch{return fail(503,"WORKSPACE_RESERVATION_UNAVAILABLE");}
}
