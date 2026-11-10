import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
export async function GET(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"LOGIN_REQUIRED");
 const slug=req.nextUrl.searchParams.get("slug"),draftId=req.nextUrl.searchParams.get("draftId"),
  id=req.nextUrl.searchParams.get("id");
 if(!slug||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)||
  !draftId||!/^[a-f0-9-]{36}$/i.test(draftId)||!id||!/^[a-f0-9-]{36}$/i.test(id))
  return fail(400,"INVALID_ATTACHMENT_QUERY");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const root=new URL(base);if(root.username||root.password||root.hash)return fail(503,"BACKEND_CONFIG_INVALID");
  const url=new URL("/v1/commerce/demo/nav02/attachments/download",root);
  url.searchParams.set("slug",slug);url.searchParams.set("draftId",draftId);url.searchParams.set("id",id);
  const r=await fetch(url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(11000),
   headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)}});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"ATTACHMENT_OWNER_DENIED");
  if(!r.ok)return fail(503,"ATTACHMENT_UNAVAILABLE");
  const obj=await r.json() as {mime?:unknown;filename?:unknown;dataBase64?:unknown};
  if(!["image/png","image/jpeg","application/pdf"].includes(String(obj.mime))||
   typeof obj.filename!=="string"||typeof obj.dataBase64!=="string"||
   obj.dataBase64.length>699052||!/^[A-Za-z0-9+/]+={0,2}$/.test(obj.dataBase64))
    return fail(502,"INVALID_ATTACHMENT_REPLY");
  const bytes=Buffer.from(obj.dataBase64,"base64");
  if(bytes.length>524288)return fail(502,"INVALID_ATTACHMENT_REPLY");
  const name=obj.filename.replace(/[\\/\x00-\x1f"\r\n]/g,"_").slice(0,180);
  return new NextResponse(new Uint8Array(bytes),{headers:{...H,
   "Content-Type":"application/octet-stream","X-Content-Type-Options":"nosniff",
   "Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(name)}});
 }catch{return fail(503,"ATTACHMENT_UNAVAILABLE")}
}
