import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
function backend(){
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return null;
 try{const u=new URL(base);return u.username||u.password?null:u}catch{return null}
}
function auth(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 return token&&TOKEN.test(token)?token:null;
}
export async function GET(req:NextRequest){
 const token=auth(req),slug=req.nextUrl.searchParams.get("slug");
 if(!token)return fail(401,"LOGIN_REQUIRED");
 if(!slug||!SLUG.test(slug))return fail(400,"INVALID_SLUG");
 const base=backend();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL("/v1/commerce/demo/nav02/collections",base);url.searchParams.set("slug",slug);
  const r=await fetch(url,{method:"GET",headers:{Authorization:"Bearer "+token,
   ...trustedBackendHeaders(req)},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OWNER_REQUIRED");
  if(!r.ok)return fail(503,"COLLECTION_SERVICE_HOLD");
  const data=await r.json() as {items?:unknown};
  if(!Array.isArray(data.items))return fail(502,"INVALID_COLLECTION_DATA");
  return NextResponse.json({items:data.items},{headers:H});
 }catch{return fail(503,"COLLECTION_SERVICE_HOLD")}
}
export async function POST(req:NextRequest){
 const token=auth(req);if(!token)return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>430)return fail(413,"BODY_TOO_LARGE");
 let data:Record<string,unknown>;
 try{const v:unknown=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw Error();
  data=v as Record<string,unknown>}catch{return fail(400,"INVALID_BODY")}
 if(Object.keys(data).some(k=>!["slug","name"].includes(k))||
  typeof data.slug!=="string"||!SLUG.test(data.slug)||
  typeof data.name!=="string"||data.name.trim().length<3||data.name.length>100)
  return fail(400,"INVALID_COLLECTION");
 const base=backend();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/nav02/collections",base),{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500),
   headers:{"Content-Type":"application/json","Authorization":"Bearer "+token,
    ...trustedBackendHeaders(req)},body:JSON.stringify(data)});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OWNER_REQUIRED");
  if(r.status===400)return fail(400,"INVALID_COLLECTION");
  if(!r.ok)return fail(503,"COLLECTION_SERVICE_HOLD");
  const result=await r.json() as {saved?:unknown;record?:{id?:unknown;name?:unknown}};
  if(result.saved!==true||typeof result.record?.id!=="string"||
     typeof result.record?.name!=="string")return fail(502,"INVALID_COLLECTION_REPLY");
  return NextResponse.json({saved:true,record:result.record},{headers:H});
 }catch{return fail(503,"COLLECTION_SERVICE_HOLD")}
}
