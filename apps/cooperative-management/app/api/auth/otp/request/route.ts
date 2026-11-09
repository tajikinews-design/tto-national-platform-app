import { NextRequest, NextResponse } from "next/server";
import { trustedBackendHeaders } from "../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const api=process.env.TTO_API_BASE_URL;
 const loopbackE2E=process.env.TTO_LOOPBACK_E2E==="1" && process.env.CI==="true" && !process.env.VERCEL && /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(api??"");
 if(!api || (!api.startsWith("https://") && !(loopbackE2E || (process.env.NODE_ENV==="test"&&api.startsWith("http://127.0.0.1:")))))
  return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});
 const origin=request.headers.get("origin");
 if(origin && new URL(origin).host!==request.headers.get("host"))
  return NextResponse.json({error:"ORIGIN_DENIED"},{status:403});
 const body=await request.text();
 if(body.length>512)return NextResponse.json({error:"BAD_REQUEST"},{status:400});
 try{
  const response=await fetch(new URL("/v1/auth/challenges/request",api),{
    method:"POST",headers:{"Content-Type":"application/json",...trustedBackendHeaders(request)},
    body,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)
  });
  if(!response.ok)return NextResponse.json({error:"REQUEST_UNAVAILABLE"},{status:response.status>=500?503:400});
  const data=await response.json() as {requestId?:unknown;expiresInSeconds?:unknown};
  if(typeof data.requestId!=="string")return NextResponse.json({error:"INVALID_RESPONSE"},{status:502});
  const expiresInSeconds=Number.isInteger(data.expiresInSeconds)&&
   Number(data.expiresInSeconds)>=0&&Number(data.expiresInSeconds)<=60?
   Number(data.expiresInSeconds):60;
  return NextResponse.json({requestId:data.requestId,status:"ACCEPTED",expiresInSeconds},
    {headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503});}
}
