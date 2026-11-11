import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
function backend(){
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return null;
 try{const u=new URL(base);return u.username||u.password||u.hash?null:u}catch{return null}
}
function token(r:NextRequest){const t=r.cookies.get("tto_session")?.value;return t&&TOKEN.test(t)?t:null}
async function forward(r:NextRequest,method:"GET"|"POST",data?:unknown){
 const tk=token(r);if(!tk)return fail(401,"LOGIN_REQUIRED");
 const base=backend();if(!base)return fail(503,"BACKEND_NOT_CONFIGURED");
 const url=new URL("/v1/commerce/demo/nav02/officers",base);
 if(method==="GET"){
  const slug=r.nextUrl.searchParams.get("slug");
  if(!slug||!SLUG.test(slug))return fail(400,"INVALID_SLUG");
  url.searchParams.set("slug",slug);
 }
 try{
  const response=await fetch(url,{method,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(9500),
   headers:{Authorization:"Bearer "+tk,...trustedBackendHeaders(r),
    ...(method==="POST"?{"Content-Type":"application/json"}:{})},
   ...(method==="POST"?{body:JSON.stringify(data)}:{})});
  if(response.status===401)return fail(401,"LOGIN_REQUIRED");
  if(response.status===403)return fail(403,"OFFICER_SCOPE_DENIED");
  if(response.status===400)return fail(400,"INVALID_OFFICER_DRAFT");
  if(!response.ok)return fail(503,"OFFICER_DRAFT_UNAVAILABLE");
  const result:unknown=await response.json();
  if(!result||typeof result!=="object"||Array.isArray(result))return fail(502,"INVALID_BACKEND_RESULT");
  return NextResponse.json(result,{headers:H});
 }catch{return fail(503,"OFFICER_DRAFT_UNAVAILABLE")}
}
export async function GET(r:NextRequest){return forward(r,"GET")}
export async function POST(r:NextRequest){
 if(!token(r))return fail(401,"LOGIN_REQUIRED");
 const origin=r.headers.get("origin");if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(r.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(r.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await r.text();if(raw.length>3500)return fail(413,"BODY_TOO_LARGE");
 let data:Record<string,unknown>;
 try{const value:unknown=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))throw Error();
  data=value as Record<string,unknown>}catch{return fail(400,"INVALID_BODY")}
 if(typeof data.slug!=="string"||!SLUG.test(data.slug))return fail(400,"INVALID_SLUG");
 return forward(r,"POST",data);
}
