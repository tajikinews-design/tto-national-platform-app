import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
function fail(status:number,code:string){return NextResponse.json({code},{status,headers:HEADERS})}
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return fail(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return fail(503,"ISOLATED_PREVIEW_ONLY");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED");}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const length=Number(req.headers.get("content-length")??"0");
 if(!Number.isFinite(length)||length>750000)return fail(413,"BODY_TOO_LARGE");
 const raw=await req.text();
 if(raw.length>750000)return fail(413,"BODY_TOO_LARGE");
 let body:Record<string,unknown>;
 try{
  const parsed:unknown=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return fail(400,"INVALID_JSON");
  body=parsed as Record<string,unknown>;
 }catch{return fail(400,"INVALID_JSON")}
 const {slug,uploadKey,mimeType,contentBase64}=body;
 if(typeof slug!=="string"||!SLUG.test(slug)||typeof uploadKey!=="string"||
  !UUID.test(uploadKey)||typeof mimeType!=="string"||
  !["application/pdf","image/jpeg","image/png"].includes(mimeType)||
  typeof contentBase64!=="string"||contentBase64.length>700000||
  !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64))
   return fail(400,"INVALID_EVIDENCE_PAYLOAD");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(base);if(url.username||url.password)return fail(503,"BACKEND_UNAVAILABLE");
  const res=await fetch(new URL("/v1/national/cooperative-onboarding-evidence",url),{
   method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json",
    ...trustedBackendHeaders(req)},
   body:JSON.stringify({slug,uploadKey,mimeType,contentBase64}),
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(16000)
  });
  if([400,401,403,409].includes(res.status))return fail(res.status,"UPLOAD_DENIED");
  if(res.status!==201)return fail(503,"UPLOAD_UNAVAILABLE");
  const response:unknown=await res.json();
  if(!response||typeof response!=="object"||Array.isArray(response))return fail(502,"INVALID_UPSTREAM");
  const obj=response as Record<string,unknown>;
  if(typeof obj.evidenceId!=="string"||!UUID.test(obj.evidenceId)||
   obj.scanStatus!=="QUARANTINED"||obj.authenticity!=="NOT_VERIFIED"||
   obj.tenantCreated!==false||obj.managerRoleGranted!==false)
    return fail(502,"INVALID_UPSTREAM");
  return NextResponse.json(obj,{status:201,headers:HEADERS});
 }catch{return fail(503,"UPLOAD_UNAVAILABLE")}
}
