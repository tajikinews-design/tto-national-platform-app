import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
function api(){
 const v=process.env.TTO_API_BASE_URL;
 if(!v?.startsWith("https://"))return null;
 try{const u=new URL(v);return u.username||u.password?null:u;}catch{return null}
}
export async function GET(req:NextRequest){
 const base=api();if(!base)return fail(503,"SERVICE_UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/plans",base),{
   headers:{...trustedBackendHeaders(req)},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(!r.ok)return fail(503,"CATALOG_UNAVAILABLE");
  const o:unknown=await r.json();if(!o||typeof o!=="object"||!Array.isArray((o as {plans?:unknown}).plans))return fail(502,"INVALID_CATALOG");
  return NextResponse.json(o,{headers:H});
 }catch{return fail(503,"CATALOG_UNAVAILABLE")}
}
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"VERIFIED_LOGIN_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED");}catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>1100)return fail(413,"BODY_TOO_LARGE");
 let o:Record<string,unknown>;try{const v:unknown=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw Error("invalid");o=v as Record<string,unknown>;}catch{return fail(400,"INVALID_BODY")}
 if(Object.keys(o).some(key=>!["name","planCode"].includes(key))||
  typeof o.name!=="string"||o.name.trim().length<5||o.name.length>180||
  typeof o.planCode!=="string"||!/^demo-[a-z-]{2,30}$/.test(o.planCode))return fail(400,"INVALID_ORDER");
 const base=api();if(!base)return fail(503,"SERVICE_UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/confirm",base),{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
   body:JSON.stringify({name:o.name,planCode:o.planCode}),
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return fail(401,"VERIFIED_LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"MOBILE_NOT_VERIFIED");
  if(r.status===503)return fail(503,"DEMO_SERVICE_UNAVAILABLE");
  if(r.status===409)return fail(409,"WORKSPACE_ADDRESS_TAKEN");
  if(r.status===400)return fail(400,"INVALID_ORDER");
  if(r.status!==201)return fail(503,"CONFIRMATION_UNAVAILABLE");
  const data=await r.json() as Record<string,unknown>;
  if(data.realPayment!==false||data.tenantActivated!==true||data.managerRoleGranted!==false||
   data.status!=="DEMO_AMOUNT_ATTESTED")return fail(502,"INVALID_CONFIRMATION");
  if(typeof data.orderId==="string"){
   try{
    const notice=await fetch(new URL("/v1/commerce/demo/notify",base),{
      method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
      body:JSON.stringify({orderId:data.orderId}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8500)});
    if(notice.ok){const delivery=await notice.json() as {smsStatus?:unknown;smsSent?:unknown};
      data.smsStatus=delivery.smsStatus;data.smsSent=delivery.smsSent===true;}
   }catch{data.smsStatus="QUEUED";data.smsSent=false}
  }
  return NextResponse.json(data,{status:201,headers:H});
 }catch{return fail(503,"CONFIRMATION_UNAVAILABLE")}
}
