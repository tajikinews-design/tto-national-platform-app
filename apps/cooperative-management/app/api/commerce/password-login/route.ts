import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED");}catch{return fail(403,"ORIGIN_DENIED")}
 const raw=await req.text();if(raw.length>550)return fail(413,"BODY_TOO_LARGE");
 let o:{username?:unknown;password?:unknown;slug?:unknown};
 try{o=JSON.parse(raw)}catch{return fail(400,"INVALID_BODY")}
 if(typeof o.username!=="string"||typeof o.password!=="string"||o.password.length>128||
  !/^[a-z][a-z0-9._-]{4,63}$/.test(o.username)||typeof o.slug!=="string"||
  !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(o.slug))return fail(400,"INVALID_CREDENTIALS");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/password-login",base),{method:"POST",headers:{"Content-Type":"application/json",...trustedBackendHeaders(req)},body:JSON.stringify(o),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return fail(401,"INVALID_CREDENTIALS");
  if(!r.ok)return fail(503,"UNAVAILABLE");
  const d=await r.json() as {authenticated?:unknown;commercialOnly?:unknown;accessToken?:unknown;slug?:unknown};
  if(d.authenticated!==true||d.commercialOnly!==true||d.slug!==o.slug||
   typeof d.accessToken!=="string"||!/^[A-Za-z0-9_-]{32,256}$/.test(d.accessToken))return fail(502,"UNSAFE_RESPONSE");
  const out=NextResponse.json({authenticated:true,commercialOnly:true,slug:d.slug},{headers:{"Cache-Control":"no-store"}});
  out.cookies.set("tto_session",d.accessToken,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:900});
  return out;
 }catch{return fail(503,"UNAVAILABLE")}
}
