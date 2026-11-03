import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
function fail(status:number,code:string){return NextResponse.json({created:false,code},{status,headers:HEADERS});}
export async function POST(req:NextRequest){
 const cookie=req.cookies.get("tto_session")?.value;
 if(!cookie||!TOKEN.test(cookie))return fail(401,"SESSION_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"INVALID_ORIGIN");}
 catch{return fail(403,"INVALID_ORIGIN");}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();
 if(raw.length>4096)return fail(413,"BODY_TOO_LARGE");
 let input:Record<string,unknown>;
 try{const value:unknown=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))return fail(400,"INVALID_INPUT");input=value as Record<string,unknown>;}
 catch{return fail(400,"INVALID_JSON");}
 const fields=["name","registrationNumber","nationalId","province","county","address","representative"];
 if(fields.some(field=>typeof input[field]!=="string"||(input[field] as string).length>300))return fail(400,"INVALID_FIELDS");
 const base=process.env.TTO_API_BASE_URL;
 // Fail closed unless pointing to a separately confirmed disposable demo DB.
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return fail(503,"ISOLATED_DEMO_DATABASE_REQUIRED");
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const endpoint=new URL("/v1/national/cooperative-intakes",base);
  if(endpoint.username||endpoint.password||(endpoint.protocol!=="https:"&&!loopback))return fail(503,"BACKEND_UNAVAILABLE");
  const response=await fetch(endpoint,{method:"POST",headers:{
   "Authorization":"Bearer "+cookie,"Content-Type":"application/json",...trustedBackendHeaders(req)
  },body:JSON.stringify(Object.fromEntries(fields.map(k=>[k,input[k]]))),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(response.status===401)return fail(401,"SESSION_REQUIRED");
  if(response.status===403)return fail(403,"NATIONAL_PLATFORM_OPERATOR_REQUIRED");
  if(response.status===409)return fail(409,"NATIONAL_ID_ALREADY_SUBMITTED");
  if(response.status!==201)return fail(503,"INTAKE_UNAVAILABLE");
  const body=await response.json() as {intakeId?:unknown;status?:unknown;created?:unknown;tenantCreated?:unknown};
  if(typeof body.intakeId!=="string"||body.status!=="PENDING_VERIFICATION"||body.created!==true||body.tenantCreated!==false)
   return fail(503,"INVALID_INTAKE_RESULT");
  return NextResponse.json(body,{status:201,headers:HEADERS});
 }catch{return fail(503,"INTAKE_UNAVAILABLE");}
}
