import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
export async function POST(req:NextRequest){
 if(process.env.VERCEL_ENV==="production")return fail(503,"PREVIEW_ONLY");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 if(Number(req.headers.get("content-length")||0)>1040000)return fail(413,"BODY_TOO_LARGE");
 const raw=await req.text();
 if(raw.length>1040000)return fail(413,"BODY_TOO_LARGE");
 let data:Record<string,unknown>;
 try{const obj:unknown=JSON.parse(raw);if(!obj||typeof obj!=="object"||Array.isArray(obj))throw Error();
  data=obj as Record<string,unknown>}catch{return fail(400,"INVALID_BODY")}
 if(Object.keys(data).some(k=>!["slug","draftId","mime","dataBase64"].includes(k))||
  typeof data.slug!=="string"||!SLUG.test(data.slug)||
  typeof data.draftId!=="string"||!UUID.test(data.draftId)||
  !["image/png","image/jpeg","image/webp"].includes(String(data.mime))||
  typeof data.dataBase64!=="string"||data.dataBase64.length<88||
  data.dataBase64.length>955736||
  !/^[A-Za-z0-9+/]+={0,2}$/.test(data.dataBase64))
  return fail(400,"INVALID_PHOTO_INPUT");
 const backend=process.env.TTO_API_BASE_URL;
 if(!backend?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(backend);
  if(url.username||url.password)return fail(503,"BACKEND_CONFIG_INVALID");
  const result=await fetch(new URL("/v1/commerce/demo/nav02/photo",url),{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
   body:raw,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});
  if(result.status===401)return fail(401,"LOGIN_REQUIRED");
  if(result.status===403)return fail(403,"OWNER_REQUIRED");
  if(result.status===409)return fail(409,"PHOTO_ALREADY_QUARANTINED");
  if(result.status===400)return fail(400,"INVALID_PHOTO");
  if(!result.ok)return fail(503,"PRIVATE_QUARANTINE_UNAVAILABLE");
  const json=await result.json() as {saved?:unknown;quarantine?:{status?:unknown;canDownload?:unknown}};
  if(json.saved!==true||json.quarantine?.status!=="QUARANTINED"||json.quarantine.canDownload!==false)
   return fail(502,"INVALID_QUARANTINE_RESULT");
  return NextResponse.json({saved:true,status:"QUARANTINED",visible:false,scanned:false},{headers:H});
 }catch{return fail(503,"PRIVATE_QUARANTINE_UNAVAILABLE")}
}
