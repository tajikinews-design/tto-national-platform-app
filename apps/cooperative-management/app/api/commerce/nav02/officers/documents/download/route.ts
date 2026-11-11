import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function GET(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"LOGIN_REQUIRED");
 const slug=req.nextUrl.searchParams.get("slug"),officeId=req.nextUrl.searchParams.get("officeId"),
  id=req.nextUrl.searchParams.get("id");
 if(!slug||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)||
  !officeId||!/^[a-f0-9-]{36}$/i.test(officeId)||!id||!/^[a-f0-9-]{36}$/i.test(id))
  return fail(400,"INVALID_DOCUMENT_QUERY");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const u=new URL(base);if(u.username||u.password||u.hash)return fail(503,"BACKEND_INVALID");
  const url=new URL("/v1/commerce/demo/nav02/officers/documents/download",u);
  url.searchParams.set("slug",slug);url.searchParams.set("officeId",officeId);url.searchParams.set("id",id);
  const r=await fetch(url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)}});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OFFICER_DOCUMENT_SCOPE_DENIED");
  if(!r.ok)return fail(503,"OFFICER_DOCUMENT_UNAVAILABLE");
  const data=await r.json() as {mime?:unknown;filename?:unknown;dataBase64?:unknown};
  if(!["application/pdf","image/png","image/jpeg","application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(String(data.mime))||
   typeof data.filename!=="string"||typeof data.dataBase64!=="string"||
   data.dataBase64.length>699052||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.dataBase64))
   return fail(502,"INVALID_DOCUMENT_REPLY");
  const bytes=Buffer.from(data.dataBase64,"base64");
  if(bytes.length>524288||bytes.length<68)return fail(502,"INVALID_DOCUMENT_REPLY");
  const name=data.filename.replace(/[\\/\x00-\x1f"\r\n]/g,"_").slice(0,180);
  return new NextResponse(new Uint8Array(bytes),{headers:{...H,
   "Content-Type":"application/octet-stream","X-Content-Type-Options":"nosniff",
   "Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(name)}});
 }catch{return fail(503,"OFFICER_DOCUMENT_UNAVAILABLE")}
}