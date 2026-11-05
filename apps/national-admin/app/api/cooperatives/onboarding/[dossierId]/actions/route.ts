import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions=new Set(["START_REVIEW","REQUEST_CHANGES","REJECT","RESUBMIT","RECOMMEND_EXTERNAL_APPROVAL"]);
function fail(status:number,code:string){return NextResponse.json({code},{status,headers:HEADERS})}
export async function POST(req:NextRequest,{params}:{params:Promise<{dossierId:string}>}){
 const {dossierId}=await params;
 if(!UUID.test(dossierId))return fail(400,"INVALID_DOSSIER_ID");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return fail(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return fail(503,"ISOLATED_PREVIEW_ONLY");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED");}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();
 if(raw.length>2500)return fail(413,"BODY_TOO_LARGE");
 let input:Record<string,unknown>;
 try{
  const parsed:unknown=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return fail(400,"INVALID_JSON");
  input=parsed as Record<string,unknown>;
 }catch{return fail(400,"INVALID_JSON")}
 const {action,expectedVersion,requestKey,reason,evidenceReference}=input;
 if(typeof action!=="string"||!actions.has(action)||
    typeof expectedVersion!=="number"||!Number.isSafeInteger(expectedVersion)||expectedVersion<1||
    typeof requestKey!=="string"||!UUID.test(requestKey)||
    (reason!==undefined&&(typeof reason!=="string"||reason.length>1500))||
    (evidenceReference!==undefined&&(typeof evidenceReference!=="string"||evidenceReference.length>180)))
   return fail(400,"INVALID_REVIEW_INPUT");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&process.env.TTO_LOOPBACK_E2E==="1"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(base);
  if(url.username||url.password)return fail(503,"BACKEND_UNAVAILABLE");
  const response=await fetch(new URL("/v1/national/cooperative-onboarding/"+dossierId+"/actions",url),{
   method:"POST",headers:{"Authorization":"Bearer "+token,
     "Content-Type":"application/json",...trustedBackendHeaders(req)},
   body:JSON.stringify({action,expectedVersion,requestKey,...(reason!==undefined?{reason}:{}),
    ...(evidenceReference!==undefined?{evidenceReference}:{})}),
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)
  });
  if([400,401,403,409].includes(response.status))return fail(response.status,
   response.status===409?"REVIEW_CONFLICT":"REVIEW_DENIED");
  if(response.status!==200)return fail(503,"REVIEW_UNAVAILABLE");
  const data:unknown=await response.json();
  if(!data||typeof data!=="object"||Array.isArray(data))return fail(502,"INVALID_UPSTREAM");
  const record=data as Record<string,unknown>;
  if(record.dossierId!==dossierId||typeof record.status!=="string"||
    typeof record.version!=="number"||typeof record.replayed!=="boolean"||
    record.tenantCreated!==false||record.managerRoleGranted!==false)
    return fail(502,"INVALID_UPSTREAM");
  return NextResponse.json(record,{headers:HEADERS});
 }catch{return fail(503,"REVIEW_UNAVAILABLE")}
}
