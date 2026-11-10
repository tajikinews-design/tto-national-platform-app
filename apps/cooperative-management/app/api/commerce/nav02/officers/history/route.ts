import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function GET(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"LOGIN_REQUIRED");
 const slug=req.nextUrl.searchParams.get("slug"),id=req.nextUrl.searchParams.get("id");
 if(!slug||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)||
 !id||!/^[0-9a-f-]{36}$/i.test(id))return fail(400,"INVALID_OFFICER_HISTORY");
 const base=process.env.TTO_API_BASE_URL;if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(base);if(url.username||url.password||url.hash)return fail(503,"BACKEND_CONFIG_INVALID");
  const endpoint=new URL("/v1/commerce/demo/nav02/officers/history",url);
  endpoint.searchParams.set("slug",slug);endpoint.searchParams.set("id",id);
  const r=await fetch(endpoint,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500),
    headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)}});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OFFICER_SCOPE_DENIED");
  if(!r.ok)return fail(503,"OFFICER_HISTORY_UNAVAILABLE");
  const data=await r.json() as {items?:unknown};
  if(!Array.isArray(data.items))return fail(502,"INVALID_HISTORY");
  return NextResponse.json({items:data.items},{headers:H});
 }catch{return fail(503,"OFFICER_HISTORY_UNAVAILABLE")}
}
