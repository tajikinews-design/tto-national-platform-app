import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>400)return fail(413,"BODY_TOO_LARGE");
 let data:{mobile?:unknown;challengeId?:unknown;otp?:unknown};try{data=JSON.parse(raw)}catch{return fail(400,"INVALID_BODY")}
 const isVerify=data.challengeId!==undefined;
 if(isVerify){
  if(typeof data.challengeId!=="string"||!/^[0-9a-f-]{36}$/i.test(data.challengeId)||
    typeof data.otp!=="string"||!/^[0-9]{6}$/.test(data.otp))return fail(400,"INVALID_CODE");
 }else if(typeof data.mobile!=="string"||!/^09[0-9]{9}$/.test(data.mobile))return fail(400,"INVALID_MOBILE");
 const base=process.env.TTO_API_BASE_URL;if(!base?.startsWith("https://"))return fail(503,"SERVICE_UNAVAILABLE");
 try{
  const r=await fetch(new URL(isVerify?"/v1/auth/registration/verify":"/v1/auth/registration/request",base),{
   method:"POST",headers:{"Content-Type":"application/json",...trustedBackendHeaders(req)},
   body:JSON.stringify(data),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(!r.ok)return fail(r.status===401?401:503,isVerify?"INVALID_OR_EXPIRED_CODE":"REGISTRATION_UNAVAILABLE");
  const result=await r.json() as {requestId?:unknown;accessToken?:unknown};
  if(isVerify){
   if(typeof result.accessToken!=="string"||!/^[A-Za-z0-9_-]{32,256}$/.test(result.accessToken))return fail(502,"INVALID_RESPONSE");
   const out=NextResponse.json({verified:true},{headers:H});
   out.cookies.set("tto_session",result.accessToken,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:900});
   return out;
  }
  if(typeof result.requestId!=="string")return fail(502,"INVALID_RESPONSE");
  return NextResponse.json({requestId:result.requestId,status:"ACCEPTED"},{status:202,headers:H});
 }catch{return fail(503,"REGISTRATION_UNAVAILABLE")}
}
