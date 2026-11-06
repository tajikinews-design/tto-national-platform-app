import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const fields=new Set(["legalName","nationalId","registrationNumber","province","county",
 "legalAddress","representativeName","candidateManagerName","candidateManagerMobile","evidenceReference"]);
function fail(status:number,code:string){return NextResponse.json({code},{status,headers:HEADERS})}
function upstream(){
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&process.env.TTO_LOOPBACK_E2E==="1"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))return null;
 try{const url=new URL(base);if(url.username||url.password)return null;return url;}
 catch{return null}
}
async function relay(req:NextRequest,method:"GET"|"POST"){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return fail(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return fail(503,"ISOLATED_PREVIEW_ONLY");
 let body:string|undefined;
 if(method==="POST"){
  const origin=req.headers.get("origin");
  if(!origin)return fail(403,"ORIGIN_REQUIRED");
  try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED");}
  catch{return fail(403,"ORIGIN_DENIED")}
  if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
  const raw=await req.text();if(raw.length>4096)return fail(413,"BODY_TOO_LARGE");
  try{
   const parsed:unknown=JSON.parse(raw);
   if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return fail(400,"INVALID_INPUT");
   const data=parsed as Record<string,unknown>;
   if(typeof data.slug!=="string"||!SLUG.test(data.slug)||
      typeof data.expectedVersion!=="number"||!Number.isSafeInteger(data.expectedVersion)||
      data.expectedVersion<0||typeof data.requestKey!=="string"||!UUID.test(data.requestKey)||
      !data.payload||typeof data.payload!=="object"||Array.isArray(data.payload))
      return fail(400,"INVALID_DRAFT");
   const payload=data.payload as Record<string,unknown>;
   if(Object.keys(payload).some(k=>!fields.has(k)||typeof payload[k]!=="string"||
       (payload[k] as string).length>300))return fail(400,"INVALID_FIELDS");
   body=JSON.stringify({slug:data.slug,expectedVersion:data.expectedVersion,
     requestKey:data.requestKey,payload:Object.fromEntries(
      Object.keys(payload).map(k=>[k,payload[k]]))});
   if(body.length>4096)return fail(413,"BODY_TOO_LARGE");
  }catch{return fail(400,"INVALID_JSON")}
 }
 const base=upstream();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const res=await fetch(new URL("/v1/national/cooperative-onboarding-drafts",base),{
   method,headers:{"Authorization":"Bearer "+token,
    ...(method==="POST"?{"Content-Type":"application/json"}:{}),...trustedBackendHeaders(req)},
   ...(body?{body}:{}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)
  });
  if([400,401,403,409].includes(res.status))return fail(res.status,"DRAFT_REQUEST_DENIED");
  if(res.status!==200)return fail(503,"DRAFT_UNAVAILABLE");
  const value:unknown=await res.json();
  if(!value||typeof value!=="object"||Array.isArray(value))return fail(502,"INVALID_UPSTREAM");
  const obj=value as Record<string,unknown>;
  if(method==="GET"){
   if(!Array.isArray(obj.items)||obj.tenantCreated!==false)return fail(502,"INVALID_UPSTREAM");
  }else if(typeof obj.slug!=="string"||typeof obj.version!=="number"||
   obj.submitted!==false||obj.tenantCreated!==false)return fail(502,"INVALID_UPSTREAM");
  return NextResponse.json(obj,{headers:HEADERS});
 }catch{return fail(503,"DRAFT_UNAVAILABLE")}
}
export async function GET(req:NextRequest){return relay(req,"GET")}
export async function POST(req:NextRequest){return relay(req,"POST")}
