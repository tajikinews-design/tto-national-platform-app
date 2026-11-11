import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>3500)return fail(413,"BODY_TOO_LARGE");
 let body:Record<string,unknown>;
 try{const value:unknown=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))throw Error();
  body=value as Record<string,unknown>}catch{return fail(400,"INVALID_BODY")}
 if(typeof body.slug!=="string"||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(body.slug)||
  typeof body.memberDraftId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.memberDraftId)||
  body.alsoCeo!==true||body.ceoSource!=="MEMBER"||
  !["BOARD_CHAIR","BOARD_VICE_CHAIR","BOARD_MEMBER"].includes(String(body.officeCode)))
  return fail(400,"INVALID_DUAL_OFFICER_INPUT");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const root=new URL(base);if(root.username||root.password||root.hash)return fail(503,"BACKEND_INVALID");
  const r=await fetch(new URL("/v1/commerce/demo/nav02/officers/multi",root),{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000),
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,
    ...trustedBackendHeaders(req)},body:raw});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"DUAL_OFFICER_OWNER_DENIED");
  if(r.status===409)return fail(409,"DUAL_ROLE_OVERLAPS_EXISTING_APPOINTMENT");
  if(r.status===400)return fail(400,"INVALID_DUAL_OFFICER_DRAFT");
  if(!r.ok)return fail(503,"DUAL_OFFICER_UNAVAILABLE");
  const out=await r.json() as {saved?:boolean;ids?:unknown;status?:string;legalPowerGranted?:boolean};
  if(out.saved!==true||out.status!=="DRAFT_ONLY"||out.legalPowerGranted!==false||
   !Array.isArray(out.ids)||out.ids.length!==2||out.ids[0]===out.ids[1]||
   !out.ids.every(id=>typeof id==="string"&&/^[0-9a-f-]{36}$/i.test(id)))
   return fail(502,"INVALID_DUAL_ROLE_REPLY");
  return NextResponse.json({saved:true,ids:out.ids,status:"DRAFT_ONLY",legalPowerGranted:false},{headers:H});
 }catch{return fail(503,"DUAL_OFFICER_UNAVAILABLE")}
}
