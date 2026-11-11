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
 if(Number(req.headers.get("content-length")||0)>750000)return fail(413,"FILE_TOO_LARGE");
 const raw=await req.text();if(raw.length>750000)return fail(413,"FILE_TOO_LARGE");
 let d:Record<string,unknown>;
 try{const x:unknown=JSON.parse(raw);if(!x||typeof x!=="object"||Array.isArray(x))throw Error();
 d=x as Record<string,unknown>}catch{return fail(400,"INVALID_BODY")}
 if(typeof d.slug!=="string"||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(d.slug)||
  typeof d.officeId!=="string"||!/^[a-f0-9-]{36}$/i.test(d.officeId)||
  typeof d.subject!=="string"||d.subject.trim().length<3||
  typeof d.filename!=="string"||typeof d.mime!=="string"||typeof d.dataBase64!=="string")
  return fail(400,"INVALID_DOCUMENT_SCOPE");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const u=new URL(base);if(u.username||u.password||u.hash)return fail(503,"BACKEND_INVALID");
  const r=await fetch(new URL("/v1/commerce/demo/nav02/officers/documents",u),{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(16000),
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...trustedBackendHeaders(req)},body:raw});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OFFICER_DOCUMENT_SCOPE_DENIED");
  if(r.status===422)return fail(422,"OFFICER_DOCUMENT_MALWARE_REJECTED");
  if(r.status===400)return fail(400,"OFFICER_DOCUMENT_INVALID");
  if(!r.ok)return fail(503,"OFFICER_DOCUMENT_SECURITY_UNAVAILABLE");
  const data=await r.json() as {saved?:boolean;id?:string;status?:string;legalEvidence?:boolean};
  if(data.saved!==true||data.status!=="PRIVATE_READY"||data.legalEvidence!==false||
    typeof data.id!=="string")return fail(502,"OFFICER_DOCUMENT_NOT_CONFIRMED");
  return NextResponse.json({saved:true,id:data.id,status:data.status},{headers:H});
 }catch{return fail(503,"OFFICER_DOCUMENT_UNAVAILABLE")}
}