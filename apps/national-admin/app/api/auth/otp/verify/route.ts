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
 const body=await req.text();if(body.length>200)return fail(413,"BODY_TOO_LARGE");
 let challengeId:unknown,otp:unknown;
 try{
  const x:unknown=JSON.parse(body);
  if(!x||typeof x!=="object"||Array.isArray(x))return fail(400,"INVALID_INPUT");
  ({challengeId,otp}=x as Record<string,unknown>);
 }catch{return fail(400,"INVALID_INPUT")}
 if(typeof challengeId!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(challengeId)||
    typeof otp!=="string"||!/^[0-9]{6}$/.test(otp))return fail(400,"INVALID_OTP");
 if(process.env.TTO_NATIONAL_ROOT_OTP_LOGIN_ENABLED!=="true"||process.env.TTO_ISOLATED_DEMO_DB!=="true"||
  (process.env.VERCEL==="1"&&process.env.VERCEL_ENV!=="preview"))return fail(503,"OTP_NOT_RELEASED");
 const base=backendBase();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const verified=await fetch(new URL("/v1/auth/challenges/verify",base),{
   method:"POST",headers:{"Content-Type":"application/json",...trustedBackendHeaders(req)},
   body:JSON.stringify({challengeId,otp}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)
  });
  if(verified.status===401||verified.status===403)return fail(401,"INVALID_OR_EXPIRED_OTP");
  if(verified.status!==200)return fail(503,"OTP_VERIFICATION_UNAVAILABLE");
  const data=await verified.json() as {accessToken?:unknown};
  if(typeof data.accessToken!=="string"||!/^[A-Za-z0-9_-]{32,256}$/.test(data.accessToken))return fail(503,"INVALID_VERIFICATION");
  // OTP for any other user MUST NEVER become a national-root browser session.
  // Recheck the freshly issued, DB-backed session using the national-only endpoint.
  const session=await fetch(new URL("/v1/national/root/session",base),{
   method:"GET",headers:{Authorization:"Bearer "+data.accessToken,...trustedBackendHeaders(req)},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)
  });
  if(session.status===401||session.status===403)return fail(401,"NATIONAL_ROOT_NOT_VERIFIED");
  if(session.status!==200)return fail(503,"ROOT_SESSION_UNAVAILABLE");
  const principal=await session.json() as {authenticated?:unknown;nationalRoot?:unknown;mustChangeCredentials?:unknown};
  if(principal.authenticated!==true||principal.nationalRoot!==true||principal.mustChangeCredentials!==false)
   return fail(403,"NATIONAL_ROOT_NOT_READY");
  const response=NextResponse.json({authenticated:true,nationalRoot:true},{status:200,headers});
  response.cookies.set("tto_session",data.accessToken,
    {httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:900});
  return response;
 }catch{return fail(503,"OTP_VERIFICATION_UNAVAILABLE")}
}
