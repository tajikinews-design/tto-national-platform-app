import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff",
 "X-Robots-Tag":"noindex","Content-Security-Policy":"default-src 'none'"};
const fail=(s:number,code:string)=>NextResponse.json({code},{status:s,headers:H});
export async function GET(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"LOGIN_REQUIRED");
 const slug=req.nextUrl.searchParams.get("slug"),draftId=req.nextUrl.searchParams.get("draftId");
 if(!slug||!SLUG.test(slug)||!draftId||!UUID.test(draftId))return fail(400,"INVALID_QUERY");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const u=new URL("/v1/commerce/demo/nav02/photo/view",base);
  u.searchParams.set("slug",slug);u.searchParams.set("draftId",draftId);
  const response=await fetch(u,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500),
   headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)}});
  if(response.status===401)return fail(401,"LOGIN_REQUIRED");
  if(response.status===403)return fail(403,"PRIVATE_PHOTO_OWNER_DENIED");
  if(!response.ok)return fail(503,"PRIVATE_PHOTO_UNAVAILABLE");
  const result=await response.json() as {mime?:unknown;base64?:unknown};
  if(!["image/png","image/jpeg","image/webp"].includes(String(result.mime))||
   typeof result.base64!=="string"||result.base64.length>955736)return fail(502,"INVALID_PRIVATE_IMAGE");
  const bytes=Buffer.from(result.base64,"base64");
  if(bytes.length<68||bytes.length>716800)return fail(502,"INVALID_PRIVATE_IMAGE");
  return new NextResponse(new Uint8Array(bytes),{status:200,headers:{...H,"Content-Type":result.mime as string}});
 }catch{return fail(503,"PRIVATE_PHOTO_UNAVAILABLE")}
}
