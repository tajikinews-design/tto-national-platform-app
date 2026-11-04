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
 const body=await req.text();if(body.length>192)return failed(413,"PAYLOAD_TOO_LARGE");
 let challengeId:string,otp:string;
 try{
  const input=JSON.parse(body) as {challengeId?:unknown;otp?:unknown};
  challengeId=typeof input?.challengeId==="string"?input.challengeId:"";
  otp=typeof input?.otp==="string"?input.otp:"";
 }catch{return failed(400,"INVALID_JSON")}
 if(!/^[a-f0-9-]{36}$/i.test(challengeId)||!/^[0-9]{6}$/.test(otp))
  return failed(400,"INVALID_CODE");
 const base=getBackend();if(!base)return failed(503,"BACKEND_UNAVAILABLE");
 try{
  const up=await fetch(new URL("/v1/auth/registration/verify",base),{
   method:"POST",headers:{"Content-Type":"application/json",...trustedBackendHeaders(req)},
   body:JSON.stringify({challengeId,otp}),cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(9000)
  });
  if(up.status===401)return failed(401,"INVALID_OR_EXPIRED_CODE");
  if(up.status!==200)return failed(503,"REGISTRATION_UNAVAILABLE");
  const out=await up.json() as {accessToken?:unknown;nationalOperator?:unknown};
  if(typeof out.accessToken!=="string"||!/^[A-Za-z0-9_-]{32,256}$/.test(out.accessToken)||
   out.nationalOperator!==false)return failed(503,"INVALID_UPSTREAM");
  const res=NextResponse.json({registered:true,nationalOperator:false},{headers:noStore});
  res.cookies.set("tto_session",out.accessToken,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:900});
  return res;
 }catch{return failed(503,"BACKEND_UNAVAILABLE")}
}
