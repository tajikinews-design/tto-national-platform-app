import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie"};
export async function GET(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return NextResponse.json({code:"LOGIN_REQUIRED"},{status:401,headers:H});
 const base=process.env.TTO_API_BASE_URL;if(!base?.startsWith("https://"))return NextResponse.json({code:"UNAVAILABLE"},{status:503,headers:H});
 try{
  const r=await fetch(new URL("/v1/commerce/demo/my-subscriptions",base),{headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(!r.ok)return NextResponse.json({code:r.status===401?"LOGIN_REQUIRED":"UNAVAILABLE"},{status:r.status===401?401:503,headers:H});
  const data=await r.json() as {items?:unknown;realPaymentEnabled?:unknown};
  if(!Array.isArray(data.items)||data.realPaymentEnabled!==false)return NextResponse.json({code:"INVALID_RESPONSE"},{status:502,headers:H});
  return NextResponse.json(data,{headers:H});
 }catch{return NextResponse.json({code:"UNAVAILABLE"},{status:503,headers:H})}
}
