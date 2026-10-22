import { NextRequest, NextResponse } from "next/server";
import { trustedBackendHeaders } from "../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const api=process.env.TTO_API_BASE_URL;
 const loopbackE2E=process.env.TTO_LOOPBACK_E2E==="1" && process.env.CI==="true" && !process.env.VERCEL && /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(api??"");
 if(!api || (!api.startsWith("https://") && !(loopbackE2E || (process.env.NODE_ENV==="test"&&api.startsWith("http://127.0.0.1:")))))
  return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503});
 const origin=request.headers.get("origin");
 if(origin && new URL(origin).host!==request.headers.get("host"))
  return NextResponse.json({error:"ORIGIN_DENIED"},{status:403});
 const body=await request.text();
 if(body.length>512)return NextResponse.json({error:"BAD_REQUEST"},{status:400});
 try{
  const upstream=await fetch(new URL("/v1/auth/challenges/verify",api),{
    method:"POST",headers:{"Content-Type":"application/json",...trustedBackendHeaders(request)},body,cache:"no-store",redirect:"error",
    signal:AbortSignal.timeout(9500)
  });
  if(!upstream.ok)return NextResponse.json({error:"INVALID_OR_EXPIRED_CODE"},{status:401});
  const data=await upstream.json() as {accessToken?:unknown};
  if(typeof data.accessToken!=="string"||data.accessToken.length<32)
   return NextResponse.json({error:"INVALID_RESPONSE"},{status:502});
  // Do not expose session token to browser JS; do not imply authorization for a Tenant.
  const response=NextResponse.json({verified:true},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set("tto_session",data.accessToken,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:900});
  return response;
 }catch{return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503});}
}
