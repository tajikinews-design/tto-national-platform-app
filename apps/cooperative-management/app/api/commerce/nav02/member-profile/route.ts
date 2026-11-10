import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const dynamic="force-dynamic";export const runtime="nodejs";
const CACHE={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:CACHE});
async function operationalError(r:Response,fallback:string){
 if(r.status!==503)return fail(503,fallback);
 const payload=await r.json().catch(()=>null) as {message?:unknown}|null;
 const message=typeof payload?.message==="string"?payload.message:"";
 if(message==="SHAHKAR_NOT_CONFIGURED")return fail(503,"IDENTITY_PROVIDER_NOT_CONFIGURED");
 if(message==="SHAHKAR_UNAVAILABLE")return fail(503,"IDENTITY_PROVIDER_UNAVAILABLE");
 if(["PRIVATE_IDENTITY_KEY_UNAVAILABLE","PRIVATE_IDENTITY_KEY_INVALID","PRIVATE_MEMBER_PROFILE_UNAVAILABLE"].includes(message))
  return fail(503,"IDENTITY_ENCRYPTION_UNAVAILABLE");
 return fail(503,fallback);
}
function token(req:NextRequest){const s=req.cookies.get("tto_session")?.value;return s&&TOKEN.test(s)?s:null}
function backend(){
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return null;
 try{const u=new URL(base);return u.username||u.password||u.hash?null:u}catch{return null}
}
export async function GET(req:NextRequest){
 const tk=token(req);
 if(!tk)return fail(401,"LOGIN_REQUIRED");
 const slug=req.nextUrl.searchParams.get("slug"),draftId=req.nextUrl.searchParams.get("draftId");
 if(!slug||!SLUG.test(slug)||!draftId||!UUID.test(draftId))return fail(400,"INVALID_PROFILE_QUERY");
 const base=backend();if(!base)return fail(503,"BACKEND_NOT_CONFIGURED");
 try{
  const url=new URL("/v1/commerce/demo/nav02/member-profile",base);
  url.searchParams.set("slug",slug);url.searchParams.set("draftId",draftId);
  const r=await fetch(url,{method:"GET",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000),
    headers:{Authorization:"Bearer "+tk,...trustedBackendHeaders(req)}});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"MEMBER_SCOPE_DENIED");
  if(!r.ok)return operationalError(r,"MEMBER_PROFILE_UNAVAILABLE");
  const body=await r.json() as {profile?:unknown;version?:unknown;managementState?:unknown};
  if(!body.profile||typeof body.profile!=="object"||Array.isArray(body.profile)||
     !Number.isSafeInteger(body.version)||typeof body.managementState!=="string")
    return fail(502,"INVALID_MEMBER_PROFILE_REPLY");
  return NextResponse.json(body,{headers:CACHE});
 }catch{return fail(503,"MEMBER_PROFILE_UNAVAILABLE")}
}
export async function POST(req:NextRequest){
 const tk=token(req);if(!tk)return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>6900)return fail(413,"BODY_TOO_LARGE");
 let value:Record<string,unknown>;
 try{const p:unknown=JSON.parse(raw);if(!p||typeof p!=="object"||Array.isArray(p))throw Error();
  value=p as Record<string,unknown>}catch{return fail(400,"INVALID_BODY")}
 if(Object.keys(value).some(k=>!["slug","draftId","version","data"].includes(k))||
  typeof value.slug!=="string"||!SLUG.test(value.slug)||
  typeof value.draftId!=="string"||!UUID.test(value.draftId)||
  !Number.isSafeInteger(value.version)||Number(value.version)<1||
  !value.data||typeof value.data!=="object"||Array.isArray(value.data)||
  Object.values(value.data as Record<string,unknown>).some(v=>typeof v!=="string"))
   return fail(400,"INVALID_PROFILE_EDIT");
 const base=backend();if(!base)return fail(503,"BACKEND_NOT_CONFIGURED");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/nav02/member-profile",base),{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000),
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+tk,
    ...trustedBackendHeaders(req)},body:JSON.stringify(value)});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"MEMBER_SCOPE_DENIED");
  if(r.status===409)return fail(409,"STALE_MEMBER_RECORD");
  if(r.status===422)return fail(422,"SHAHKAR_MISMATCH");
  if(r.status===400)return fail(400,"INVALID_PROFILE_EDIT");
  if(!r.ok)return operationalError(r,"MEMBER_EDIT_UNAVAILABLE");
  const body=await r.json() as {saved?:unknown;record?:unknown};
  if(body.saved!==true||!body.record)return fail(502,"INVALID_MEMBER_EDIT_REPLY");
  return NextResponse.json(body,{headers:CACHE});
 }catch{return fail(503,"MEMBER_EDIT_UNAVAILABLE")}
}
