import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function GET(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"LOGIN_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/workspaces",base),{headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(!r.ok)return fail(503,"BACKEND_UNAVAILABLE");
  const j=await r.json() as {items?:unknown};
  if(!Array.isArray(j.items))return fail(502,"BAD_RESULT");
  return NextResponse.json(j,{headers:H});
 }catch{return fail(503,"BACKEND_UNAVAILABLE")}
}
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED");}catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>600)return fail(413,"BODY_TOO_LARGE");
 let o:{slug?:unknown;username?:unknown;password?:unknown};
 try{o=JSON.parse(raw)}catch{return fail(400,"INVALID_BODY")}
 if(typeof o.slug!=="string"||typeof o.username!=="string"||typeof o.password!=="string"||
  !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(o.slug)||
  !/^[a-z][a-z0-9._-]{4,63}$/.test(o.username)||o.password.length<14||o.password.length>128)
 return fail(400,"INVALID_CREDENTIALS");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/credentials",base),{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
   body:JSON.stringify(o),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"FRESH_OTP_REQUIRED");
  if(r.status===409)return fail(409,"USERNAME_TAKEN");
  if(!r.ok)return fail(503,"CREDENTIAL_SETUP_FAILED");
  const j=await r.json() as {username?:unknown;slug?:unknown;loginRequired?:unknown};
  if(j.loginRequired!==true||j.username!==o.username||j.slug!==o.slug)return fail(502,"INVALID_RESULT");
  const out=NextResponse.json({changed:true,username:j.username,slug:j.slug,loginRequired:true},{headers:H});
  out.cookies.set("tto_session","",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
  return out;
 }catch{return fail(503,"CREDENTIAL_SETUP_FAILED")}
}
