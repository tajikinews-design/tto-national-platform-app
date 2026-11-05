import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const fields=["slug","legalName","nationalId","registrationNumber","province","county",
 "legalAddress","representativeName","candidateManagerName","candidateManagerMobile","evidenceReference"] as const;
function fail(status:number,code:string){
 return NextResponse.json({code},{status,headers:HEADERS});
}
function baseUrl(){
 const value=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(value??"");
 if(!value||(!value.startsWith("https://")&&!loopback))return null;
 try{const url=new URL(value);if(url.username||url.password)return null;return url;}catch{return null;}
}
function auth(request:NextRequest){
 const token=request.cookies.get("tto_session")?.value;
 return token&&TOKEN.test(token)?token:null;
}
async function relay(req:NextRequest,method:"GET"|"POST",body?:string){
 const token=auth(req);
 if(!token)return fail(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return fail(503,"ISOLATED_PREVIEW_ONLY");
 const base=baseUrl();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const response=await fetch(new URL("/v1/national/cooperative-onboarding",base),{
   method,headers:{"Authorization":"Bearer "+token,
     ...(method==="POST"?{"Content-Type":"application/json"}:{}),...trustedBackendHeaders(req)},
   ...(method==="POST"?{body}:{}),cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(9500)
  });
  if(response.status===401)return fail(401,"SESSION_REQUIRED");
  if(response.status===403)return fail(403,"NATIONAL_ROOT_REQUIRED");
  if(response.status===409)return fail(409,"DOSSIER_ALREADY_EXISTS");
  if(response.status===400)return fail(400,"INVALID_OR_UNRESERVED_DOSSIER");
  if(response.status!==(method==="GET"?200:201))return fail(503,"ONBOARDING_UNAVAILABLE");
  const data:unknown=await response.json();
  if(!data||typeof data!=="object"||Array.isArray(data))return fail(502,"INVALID_UPSTREAM");
  if(method==="GET"){
   const value=data as {items?:unknown;tenantActivated?:unknown};
   if(!Array.isArray(value.items)||value.tenantActivated!==false)return fail(502,"INVALID_UPSTREAM");
   return NextResponse.json(value,{headers:HEADERS});
  }
  const created=data as {status?:unknown;tenantCreated?:unknown;managerRoleGranted?:unknown;dossierId?:unknown};
  if(created.status!=="PENDING_LEGAL_REVIEW"||created.tenantCreated!==false||
     created.managerRoleGranted!==false||typeof created.dossierId!=="string")
   return fail(502,"INVALID_UPSTREAM");
  return NextResponse.json(created,{status:201,headers:HEADERS});
 }catch{return fail(503,"ONBOARDING_UNAVAILABLE");}
}
export async function GET(request:NextRequest){
 return relay(request,"GET");
}
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(request.url).origin)return fail(403,"ORIGIN_DENIED");}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(request.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await request.text();
 if(raw.length>4096)return fail(413,"BODY_TOO_LARGE");
 let obj:Record<string,unknown>;
 try{
  const x:unknown=JSON.parse(raw);
  if(!x||typeof x!=="object"||Array.isArray(x))return fail(400,"INVALID_JSON");
  obj=x as Record<string,unknown>;
 }catch{return fail(400,"INVALID_JSON")}
 if(fields.some(k=>k!=="evidenceReference"&&(typeof obj[k]!=="string"||(obj[k] as string).length>300))||
   (obj.evidenceReference!==undefined && typeof obj.evidenceReference!=="string"))
  return fail(400,"INVALID_FIELDS");
 if(typeof obj.slug!=="string"||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(obj.slug)||
    typeof obj.nationalId!=="string"||!/^[0-9]{11}$/.test(obj.nationalId)||
    typeof obj.registrationNumber!=="string"||!/^[0-9]{1,20}$/.test(obj.registrationNumber)||
    typeof obj.candidateManagerMobile!=="string"||!/^09[0-9]{9}$/.test(obj.candidateManagerMobile))
  return fail(400,"INVALID_IDENTIFIERS");
 return relay(request,"POST",JSON.stringify(Object.fromEntries(
  fields.filter(k=>obj[k]!==undefined).map(k=>[k,obj[k]])
 )));
}
