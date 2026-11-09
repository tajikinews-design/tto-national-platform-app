import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const SESSION=/^[A-Za-z0-9_-]{32,256}$/;
const deny=(status:number,code:string)=>NextResponse.json({code},{status,headers:HEADERS});
/** Independent cooperative login. No invented session, role, username or tenant. */
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");
 if(!origin)return deny(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return deny(403,"ORIGIN_DENIED")}
 catch{return deny(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
  return deny(415,"JSON_REQUIRED");
 const raw=await req.text();
 if(raw.length>430)return deny(413,"BODY_TOO_LARGE");
 let v:Record<string,unknown>;
 try{const x:unknown=JSON.parse(raw);if(!x||typeof x!=="object"||Array.isArray(x))return deny(400,"INVALID_BODY");v=x as Record<string,unknown>}
 catch{return deny(400,"INVALID_JSON")}
 const username=v.username,password=v.password,slug=v.workspaceSlug;
 if(typeof username!=="string"||!/^[a-z][a-z0-9._-]{4,63}$/.test(username)||
    typeof password!=="string"||password.length<1||password.length>128||
    (slug!==undefined&&(typeof slug!=="string"||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))))
  return deny(400,"INVALID_CREDENTIALS");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&
   !process.env.VERCEL&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))return deny(503,"SECURE_API_UNAVAILABLE");
 try{
  const u=new URL(base);
  if(u.username||u.password)return deny(503,"SECURE_API_UNAVAILABLE");
  const response=await fetch(new URL("/v1/portal/password/login",u),{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500),
   headers:{"Content-Type":"application/json",...trustedBackendHeaders(req)},
   body:JSON.stringify({surface:"cooperative",username,password,...(slug!==undefined?{workspaceSlug:slug}:{})})
  });
  if(response.status===401)return deny(401,"INVALID_CREDENTIALS");
  if(response.status===403)return deny(403,"RATE_LIMITED_OR_TENANT_DENIED");
  if(response.status===400)return deny(400,"INVALID_CREDENTIALS");
  if(response.status!==200)return deny(503,"PASSWORD_LOGIN_STAGING_NOT_READY");
  const data=await response.json() as {accessToken?:unknown;surface?:unknown;workspaceSlug?:unknown;tenantId?:unknown;authenticated?:unknown;legalPowerGranted?:unknown;shareTransferEnabled?:unknown};
  if(data.surface!=="cooperative"||data.authenticated!==true||
    data.legalPowerGranted!==false||data.shareTransferEnabled!==false||
    typeof data.accessToken!=="string"||!SESSION.test(data.accessToken)||
    typeof data.workspaceSlug!=="string"||
    (slug!==undefined&&data.workspaceSlug!==slug)||
    typeof data.tenantId!=="string"||
    !/^[a-f0-9-]{36}$/.test(data.tenantId))
   return deny(502,"UNSAFE_AUTH_RESPONSE");
  const out=NextResponse.json({authenticated:true,surface:"cooperative",
    workspaceSlug:data.workspaceSlug,tenantId:data.tenantId},{headers:HEADERS});
  out.cookies.set("tto_session",data.accessToken,{
   httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:900
  });
  return out;
 }catch{return deny(503,"PASSWORD_LOGIN_STAGING_NOT_READY")}
}
