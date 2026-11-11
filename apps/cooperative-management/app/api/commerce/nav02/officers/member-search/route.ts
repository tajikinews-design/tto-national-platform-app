import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function GET(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"LOGIN_REQUIRED");
 const slug=req.nextUrl.searchParams.get("slug"),q=req.nextUrl.searchParams.get("q")??"";
 if(!slug||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)||
  q.length>60||/[\x00-\x1f]/.test(q))return fail(400,"INVALID_MEMBER_QUERY");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const root=new URL(base);
  if(root.username||root.password||root.hash)return fail(503,"BACKEND_CONFIG_INVALID");
  const endpoint=new URL("/v1/commerce/demo/nav02/officers/member-search",root);
  endpoint.searchParams.set("slug",slug);endpoint.searchParams.set("q",q);
  const r=await fetch(endpoint,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)}});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OFFICER_OWNER_REQUIRED");
  if(!r.ok)return fail(503,"MEMBER_SEARCH_UNAVAILABLE");
  const data=await r.json() as {items?:unknown;more?:unknown};
  if(!Array.isArray(data.items)||data.items.length>20||typeof data.more!=="boolean"||
    data.items.some(x=>!x||typeof x!=="object"||typeof x.id!=="string"||
      typeof x.name!=="string"||typeof x.identifierMask!=="string"))
    return fail(502,"INVALID_MEMBER_SEARCH");
  return NextResponse.json({items:data.items,more:data.more},{headers:H});
 }catch{return fail(503,"MEMBER_SEARCH_UNAVAILABLE")}
}
