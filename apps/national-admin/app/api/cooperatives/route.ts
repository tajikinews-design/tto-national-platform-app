import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../lib/trusted-backend";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};

function fail(status:number,code:string){
 return NextResponse.json({code},{status,headers:HEADERS});
}

/** Administrator-only, read-only directory. The backend verifies national-root
 * identity and DB RLS. Never expose the upstream URL or bearer token to JS. */
export async function GET(request:NextRequest){
 const token=request.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))
  return fail(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
  return fail(503,"ISOLATED_DEMO_DATABASE_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))
  return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL("/v1/national/cooperative-registry",base);
  if(url.username||url.password||(url.protocol!=="https:"&&!loopback))
   return fail(503,"BACKEND_UNAVAILABLE");
  const upstream=await fetch(url,{
   method:"GET",headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(request)},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)
  });
  if(upstream.status===401)return fail(401,"SESSION_REQUIRED");
  if(upstream.status===403)return fail(403,"NATIONAL_ROOT_REQUIRED");
  if(upstream.status!==200)return fail(503,"REGISTRY_UNAVAILABLE");
  const data:unknown=await upstream.json();
  if(!data||typeof data!=="object"||Array.isArray(data))
   return fail(502,"INVALID_REGISTRY_RESPONSE");
  const value=data as Record<string,unknown>;
  if(value.source!=="RESERVED_WORKSPACES"||
     value.containsActivatedTenants!==false||
     typeof value.truncated!=="boolean"||!Array.isArray(value.items)||
     value.items.length>200)
   return fail(502,"INVALID_REGISTRY_RESPONSE");
  const items=[];
  for(const raw of value.items){
   if(!raw||typeof raw!=="object"||Array.isArray(raw))
    return fail(502,"INVALID_REGISTRY_RESPONSE");
   const item=raw as Record<string,unknown>;
   if(typeof item.workspaceId!=="string"||
      !/^[0-9a-f-]{36}$/i.test(item.workspaceId)||
      typeof item.slug!=="string"||
      !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(item.slug)||
      item.state!=="RESERVED"||typeof item.createdAt!=="string"||
      !Number.isFinite(Date.parse(item.createdAt)))
    return fail(502,"INVALID_REGISTRY_RESPONSE");
   items.push({workspaceId:item.workspaceId,slug:item.slug,
    state:"RESERVED",createdAt:item.createdAt});
  }
  return NextResponse.json({items,truncated:value.truncated,
   source:"RESERVED_WORKSPACES",containsActivatedTenants:false},{headers:HEADERS});
 }catch{return fail(503,"REGISTRY_UNAVAILABLE")}
}
