import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store, private"};
function failed(status:number,code:string){return NextResponse.json({error:code},{status,headers:noStore});}
function validOrigin(req:NextRequest){
 const origin=req.headers.get("origin");
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(req.url).origin;}catch{return false;}
}
function getBackend(){
 const raw=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL &&
   process.env.TTO_LOOPBACK_E2E==="1" && /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(raw??"");
 if(!raw || (!raw.startsWith("https://")&&!loopback))return null;
 try{const url=new URL(raw);if(url.username||url.password)return null;return url;}catch{return null;}
}
export async function POST(req:NextRequest){
 if(!validOrigin(req))return failed(403,"ORIGIN_DENIED");
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return failed(415,"JSON_REQUIRED");
 const body=await req.text();if(body.length>128)return failed(413,"PAYLOAD_TOO_LARGE");
 let mobile:string;
 try{const input:unknown=JSON.parse(body);mobile=typeof input==="object"&&input!==null &&
  typeof (input as {mobile?:unknown}).mobile==="string"?(input as {mobile:string}).mobile:"";
 }catch{return failed(400,"INVALID_JSON")}
 if(!/^09[0-9]{9}$/.test(mobile))return failed(400,"INVALID_MOBILE");
 const base=getBackend();if(!base)return failed(503,"BACKEND_UNAVAILABLE");
 try{
  const u=new URL("/v1/auth/registration/request",base);
  const up=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json",...trustedBackendHeaders(req)},body:JSON.stringify({mobile}),
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000)});
  if(up.status!==202)return failed(up.status===400?400:503,"REGISTRATION_UNAVAILABLE");
  const result=await up.json() as {requestId?:unknown};
  if(typeof result.requestId!=="string"||!/^[a-f0-9-]{36}$/i.test(result.requestId))
   return failed(503,"INVALID_UPSTREAM");
  return NextResponse.json({requestId:result.requestId,status:"ACCEPTED"},{status:202,headers:noStore});
 }catch{return failed(503,"BACKEND_UNAVAILABLE")}
}
