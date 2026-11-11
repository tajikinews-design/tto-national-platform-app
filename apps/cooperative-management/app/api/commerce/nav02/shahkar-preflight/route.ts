import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
  return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>300)return fail(413,"BODY_TOO_LARGE");
 let input:Record<string,unknown>;
 try{const value:unknown=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))throw Error();
  input=value as Record<string,unknown>;}catch{return fail(400,"INVALID_BODY")}
 if(Object.keys(input).some(k=>!["slug","nationalCode","mobile"].includes(k))||
  typeof input.slug!=="string"||!SLUG.test(input.slug)||
  typeof input.nationalCode!=="string"||!/^[0-9]{10}$/.test(input.nationalCode)||
  typeof input.mobile!=="string"||!/^09[0-9]{9}$/.test(input.mobile))
  return fail(400,"INVALID_SHAHKAR_PREFLIGHT");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_NOT_CONFIGURED");
 let url:URL;
 try{url=new URL(base);if(url.username||url.password||url.hash)throw Error();
  url=new URL("/v1/commerce/demo/nav02/shahkar-preflight",url);}
 catch{return fail(503,"BACKEND_NOT_CONFIGURED")}
 try{
  const response=await fetch(url,{method:"POST",cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(11000),
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,
    ...trustedBackendHeaders(req)},body:JSON.stringify(input)});
  if(response.status===401)return fail(401,"LOGIN_REQUIRED");
  if(response.status===403)return fail(403,"MEMBER_SCOPE_DENIED");
  if(response.status===422)return fail(422,"SHAHKAR_MISMATCH");
  if(response.status===400)return fail(400,"INVALID_SHAHKAR_PREFLIGHT");
  if(!response.ok){
   if(response.status===503){
    const err=await response.json().catch(()=>null) as {message?:unknown}|null;
    if(err?.message==="SHAHKAR_NOT_CONFIGURED")return fail(503,"SHAHKAR_NOT_CONFIGURED");
   }
   return fail(503,"SHAHKAR_UNAVAILABLE");
  }
  const result=await response.json() as {verified?:unknown};
  if(result.verified!==true)return fail(502,"INVALID_PROVIDER_REPLY");
  return NextResponse.json({verified:true},{headers:H});
 }catch{return fail(503,"SHAHKAR_UNAVAILABLE")}
}
