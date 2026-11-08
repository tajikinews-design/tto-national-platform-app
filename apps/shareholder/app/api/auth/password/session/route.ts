import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie"};
const deny=(status:number,code:string)=>NextResponse.json({authenticated:false,code},{status,headers:H});
export async function GET(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return NextResponse.json({authenticated:false},{headers:H});
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&!process.env.VERCEL&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))return deny(503,"PASSWORD_SESSION_UNAVAILABLE");
 try{
  const url=new URL("/v1/portal/password/session?surface=shareholder",base);
  if(url.username||url.password)return deny(503,"PASSWORD_SESSION_UNAVAILABLE");
  const r=await fetch(url,{method:"GET",
   headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if([401,403].includes(r.status))return NextResponse.json({authenticated:false},{headers:H});
  if(r.status!==200)return deny(503,"PASSWORD_SESSION_UNAVAILABLE");
  const d=await r.json() as {authenticated?:unknown;surface?:unknown;workspaceSlug?:unknown;tenantId?:unknown;legalPowerGranted?:unknown};
  if(d.authenticated!==true||d.surface!=="shareholder"||d.legalPowerGranted!==false||
    typeof d.workspaceSlug!=="string"||typeof d.tenantId!=="string")return deny(502,"INVALID_SESSION_EVIDENCE");
  return NextResponse.json({authenticated:true,surface:"shareholder",
    tenantId:d.tenantId,workspaceSlug:d.workspaceSlug},{headers:H});
 }catch{return deny(503,"PASSWORD_SESSION_UNAVAILABLE")}
}
