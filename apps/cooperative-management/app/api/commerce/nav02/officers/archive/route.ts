import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>800)return fail(413,"BODY_TOO_LARGE");
 let d:Record<string,unknown>;
 try{const x:unknown=JSON.parse(raw);if(!x||typeof x!=="object"||Array.isArray(x))throw Error();
 d=x as Record<string,unknown>}catch{return fail(400,"INVALID_BODY")}
 if(typeof d.slug!=="string"||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(d.slug)||
  typeof d.id!=="string"||!/^[a-f0-9-]{36}$/i.test(d.id)||
  !Number.isSafeInteger(d.version)||Number(d.version)<1||
  d.acknowledgement!=="ARCHIVE_DRAFT_WITH_AUDIT_ACKNOWLEDGED")
  return fail(400,"INVALID_OFFICER_ARCHIVE");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const u=new URL(base);if(u.username||u.password||u.hash)return fail(503,"BACKEND_INVALID");
  const r=await fetch(new URL("/v1/commerce/demo/nav02/officers/archive",u),{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500),
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...trustedBackendHeaders(req)},body:raw});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OFFICER_SCOPE_DENIED");
  if(r.status===409)return fail(409,"OFFICER_STALE_VERSION");
  if(!r.ok)return fail(503,"OFFICER_ARCHIVE_UNAVAILABLE");
  const data=await r.json() as {archived?:boolean;legalPowerGranted?:boolean};
  if(data.archived!==true||data.legalPowerGranted!==false)return fail(502,"INVALID_ARCHIVE_RESULT");
  return NextResponse.json({archived:true},{headers:H});
 }catch{return fail(503,"OFFICER_ARCHIVE_UNAVAILABLE")}
}