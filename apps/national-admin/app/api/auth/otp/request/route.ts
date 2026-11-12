import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
const fail=(status:number,error:string)=>NextResponse.json({error},{status,headers});
function backendBase(){
 const raw=process.env.TTO_API_BASE_URL??"";
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(raw);
 if(!raw.startsWith("https://")&&!loopback)return null;
 try{const u=new URL(raw);if(u.username||u.password)return null;return u}catch{return null}
}
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");
 try{if(!origin||new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const body=await req.text();if(body.length>120)return fail(413,"BODY_TOO_LARGE");
 let mobile:unknown;
 try{const x:unknown=JSON.parse(body);if(!x||typeof x!=="object"||Array.isArray(x))return fail(400,"INVALID_INPUT");mobile=(x as Record<string,unknown>).mobile}
 catch{return fail(400,"INVALID_INPUT")}
 if(typeof mobile!=="string"||!/^09[0-9]{9}$/.test(mobile))return fail(400,"INVALID_MOBILE");
 if(process.env.TTO_NATIONAL_ROOT_OTP_LOGIN_ENABLED!=="true"||process.env.TTO_ISOLATED_DEMO_DB!=="true"||
   (process.env.VERCEL==="1"&&process.env.VERCEL_ENV!=="preview"))return fail(503,"OTP_NOT_RELEASED");
 const base=backendBase();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const upstream=await fetch(new URL("/v1/auth/challenges/request",base),{
   method:"POST",headers:{"Content-Type":"application/json",...trustedBackendHeaders(req)},
   body:JSON.stringify({mobile}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)
  });
  if(upstream.status===403||upstream.status===429)return fail(429,"RATE_LIMITED");
  if(upstream.status!==202&&upstream.status!==200)return fail(503,"OTP_UNAVAILABLE");
  const x=await upstream.json() as {requestId?:unknown;expiresInSeconds?:unknown};
  if(typeof x.requestId!=="string"||!/^[a-f0-9-]{36}$/i.test(x.requestId))return fail(503,"OTP_UNAVAILABLE");
  const ttl=typeof x.expiresInSeconds==="number"&&Number.isInteger(x.expiresInSeconds)?
   Math.max(0,Math.min(60,x.expiresInSeconds)):60;
  return NextResponse.json({requestId:x.requestId,expiresInSeconds:ttl},{headers});
 }catch{return fail(503,"BACKEND_UNAVAILABLE")}
}
