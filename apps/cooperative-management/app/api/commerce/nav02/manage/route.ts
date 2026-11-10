import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
function auth(req:NextRequest){const v=req.cookies.get("tto_session")?.value;return v&&TOKEN.test(v)?v:null}
function backend(){const b=process.env.TTO_API_BASE_URL;if(!b?.startsWith("https://"))return null;
 try{const u=new URL(b);return u.username||u.password?null:u}catch{return null}}
function status(r:Response){return r.status===401?401:r.status===403?403:r.status===409?409:r.status===400?400:503}
function code(s:number){return s===401?"LOGIN_REQUIRED":s===403?"OWNER_OR_DRAFT_STATUS_REQUIRED":
 s===409?"STALE_VERSION":s===400?"INVALID_VALUES":"MANAGEMENT_UNAVAILABLE"}
export async function GET(req:NextRequest){
 const tk=auth(req);if(!tk)return fail(401,"LOGIN_REQUIRED");
 const slug=req.nextUrl.searchParams.get("slug"),draft=req.nextUrl.searchParams.get("draftId");
 if(!slug||!SLUG.test(slug)||!draft||!UUID.test(draft))return fail(400,"INVALID_QUERY");
 const base=backend();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL("/v1/commerce/demo/nav02/manage",base);
  url.searchParams.set("slug",slug);url.searchParams.set("draftId",draft);
  const r=await fetch(url,{headers:{Authorization:"Bearer "+tk,...trustedBackendHeaders(req)},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(!r.ok){const st=status(r);return fail(st,code(st))}
  const json=await r.json() as {events?:unknown};
  if(!Array.isArray(json.events))return fail(502,"INVALID_AUDIT_RESPONSE");
  return NextResponse.json({events:json.events},{headers:H});
 }catch{return fail(503,"MANAGEMENT_UNAVAILABLE")}
}
export async function POST(req:NextRequest){
 const tk=auth(req);if(!tk)return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>2400)return fail(413,"BODY_TOO_LARGE");
 let d:Record<string,unknown>;
 try{const j:unknown=JSON.parse(raw);if(!j||typeof j!=="object"||Array.isArray(j))throw Error();
  d=j as Record<string,unknown>;}catch{return fail(400,"INVALID_BODY")}
 if(Object.keys(d).some(k=>!["slug","draftId","version","action","data","confirmation"].includes(k))||
  typeof d.slug!=="string"||!SLUG.test(d.slug)||typeof d.draftId!=="string"||!UUID.test(d.draftId)||
  !Number.isSafeInteger(d.version)||Number(d.version)<1||
  !["profileEdit","capitalEdit","suspend","resume","archive","restore","delete"].includes(String(d.action))||
  (d.action==="delete"&&d.confirmation!=="DELETE_SYNTHETIC_DRAFT")||
  (d.action!=="delete"&&d.confirmation!==undefined)||
  ((d.action==="profileEdit"||d.action==="capitalEdit")&&(!d.data||typeof d.data!=="object"||Array.isArray(d.data)||
    Object.values(d.data as Record<string,unknown>).some(x=>typeof x!=="string")))||
  (["suspend","resume","archive","restore","delete"].includes(String(d.action))&&d.data!==undefined))
  return fail(400,"INVALID_FIELDS");
 const base=backend();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/nav02/manage",base),{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+tk,...trustedBackendHeaders(req)},
   body:JSON.stringify(d),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(!r.ok){const st=status(r);return fail(st,code(st))}
  const response=await r.json() as {saved?:unknown;record?:unknown};
  if(response.saved!==true||!response.record)return fail(502,"INVALID_MANAGEMENT_RESPONSE");
  return NextResponse.json(response,{headers:H});
 }catch{return fail(503,"MANAGEMENT_UNAVAILABLE")}
}
