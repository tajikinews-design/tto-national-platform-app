import { NextRequest, NextResponse } from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const api=process.env.TTO_API_BASE_URL;
 if(!api || (!api.startsWith("https://") && !(process.env.NODE_ENV==="test"&&api.startsWith("http://127.0.0.1:"))))
  return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});
 const origin=request.headers.get("origin");
 if(origin && new URL(origin).host!==request.headers.get("host"))
  return NextResponse.json({error:"ORIGIN_DENIED"},{status:403});
 const body=await request.text();
 if(body.length>512)return NextResponse.json({error:"BAD_REQUEST"},{status:400});
 try{
  const response=await fetch(new URL("/v1/auth/challenges/request",api),{
    method:"POST",headers:{"Content-Type":"application/json"},
    body,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)
  });
  if(!response.ok)return NextResponse.json({error:"REQUEST_UNAVAILABLE"},{status:response.status>=500?503:400});
  const data=await response.json() as {requestId?:unknown};
  if(typeof data.requestId!=="string")return NextResponse.json({error:"INVALID_RESPONSE"},{status:502});
  return NextResponse.json({requestId:data.requestId,status:"ACCEPTED"},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503});}
}
