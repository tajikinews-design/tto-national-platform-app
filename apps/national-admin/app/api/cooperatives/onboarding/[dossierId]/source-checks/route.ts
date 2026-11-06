import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS=new Set(["NATIONAL_REGISTRY","OFFICIAL_GAZETTE","COOPERATIVE_AUTHORITY"]);
const FINDINGS=new Set(["MATCH_REPORTED_UNVERIFIED","MISMATCH_REPORTED","INCONCLUSIVE"]);
function deny(code:number,error:string){return NextResponse.json({code:error},{status:code,headers:HEADERS});}
export async function POST(req:NextRequest,{params}:{params:Promise<{dossierId:string}>}){
 const {dossierId}=await params;
 if(!UUID.test(dossierId))return deny(400,"INVALID_DOSSIER_ID");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return deny(503,"ISOLATED_PREVIEW_ONLY");
 const origin=req.headers.get("origin");
 if(!origin)return deny(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return deny(403,"ORIGIN_DENIED");}
 catch{return deny(403,"ORIGIN_DENIED");}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return deny(415,"JSON_REQUIRED");
 const raw=await req.text();
 if(raw.length>3500)return deny(413,"BODY_TOO_LARGE");
 let input:Record<string,unknown>;
 try{const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=="object"||Array.isArray(value))return deny(400,"INVALID_INPUT");
  input=value as Record<string,unknown>;
 }catch{return deny(400,"INVALID_JSON");}
 const {evidenceId,requestKey,sourceKind,sourceReference,sourceHashHex,finding,rationale}=input;
 if(typeof evidenceId!=="string"||!UUID.test(evidenceId)||
    typeof requestKey!=="string"||!UUID.test(requestKey)||
    typeof sourceKind!=="string"||!KINDS.has(sourceKind)||
    typeof sourceReference!=="string"||sourceReference.trim().length<8||sourceReference.length>240||
    typeof sourceHashHex!=="string"||!/^[a-fA-F0-9]{64}$/.test(sourceHashHex)||
    typeof finding!=="string"||!FINDINGS.has(finding)||
    typeof rationale!=="string"||rationale.trim().length<10||rationale.length>1500)
  return deny(400,"INVALID_SOURCE_CHECK");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&process.env.TTO_LOOPBACK_E2E==="1"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))return deny(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(base);
  if(url.username||url.password)return deny(503,"BACKEND_UNAVAILABLE");
  const response=await fetch(new URL("/v1/national/cooperative-onboarding/"+dossierId+"/source-checks",url),{
   method:"POST",headers:{"Authorization":"Bearer "+token,
    "Content-Type":"application/json",...trustedBackendHeaders(req)},
   body:JSON.stringify({evidenceId,requestKey,sourceKind,sourceReference,sourceHashHex,finding,rationale}),
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if([400,401,403,409].includes(response.status))
   return deny(response.status,response.status===409?"SOURCE_CHECK_CONFLICT":"SOURCE_CHECK_DENIED");
  if(response.status!==201)return deny(503,"SOURCE_CHECK_UNAVAILABLE");
  const data:unknown=await response.json();
  if(!data||typeof data!=="object"||Array.isArray(data))return deny(502,"INVALID_UPSTREAM");
  const v=data as Record<string,unknown>;
  if(v.dossierId!==dossierId||v.evidenceId!==evidenceId||typeof v.checkId!=="string"||
     !UUID.test(v.checkId)||v.recorded!==true||typeof v.replayed!=="boolean"||
     v.authenticity!=="NOT_VERIFIED"||v.legalApproval!==false||
     v.tenantCreated!==false||v.managerRoleGranted!==false)
   return deny(502,"INVALID_UPSTREAM");
  return NextResponse.json(v,{status:201,headers:HEADERS});
 }catch{return deny(503,"SOURCE_CHECK_UNAVAILABLE");}
}
