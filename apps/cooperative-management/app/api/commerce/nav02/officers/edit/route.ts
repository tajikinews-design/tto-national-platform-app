import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>3500)return fail(413,"BODY_TOO_LARGE");
 let body:Record<string,unknown>;
 try{const v:unknown=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw Error();
 body=v as Record<string,unknown>}catch{return fail(400,"INVALID_BODY")}
 if(typeof body.slug!=="string"||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(body.slug)||
    typeof body.id!=="string"||!/^[0-9a-f-]{36}$/i.test(body.id)||
    !Number.isSafeInteger(body.version)||Number(body.version)<1)return fail(400,"INVALID_OFFICER_EDIT");
 const base=process.env.TTO_API_BASE_URL;if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(base);if(url.username||url.password||url.hash)return fail(503,"BACKEND_CONFIG_INVALID");
  const r=await fetch(new URL("/v1/commerce/demo/nav02/officers/edit",url),{
    method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(9500),
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,
    ...trustedBackendHeaders(req)},body:raw});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OFFICER_SCOPE_DENIED");
  if(r.status===409)return fail(409,"OFFICER_STALE_VERSION");
  if(r.status===400)return fail(400,"INVALID_OFFICER_EDIT");
  if(!r.ok)return fail(503,"OFFICER_EDIT_UNAVAILABLE");
  const result=await r.json() as {saved?:boolean;status?:string;legalPowerGranted?:boolean;version?:number};
  if(result.saved!==true||result.status!=="DRAFT_ONLY"||result.legalPowerGranted!==false||
    !Number.isSafeInteger(result.version))return fail(502,"INVALID_BACKEND_REPLY");
  return NextResponse.json(result,{headers:H});
 }catch{return fail(503,"OFFICER_EDIT_UNAVAILABLE")}
}
