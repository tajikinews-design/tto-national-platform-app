import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function deny(code:number,error:string){return NextResponse.json({code:error},{status:code,headers:HEADERS});}
export async function GET(req:NextRequest,{params}:{params:Promise<{evidenceId:string}>}){
 const {evidenceId}=await params;
 if(!UUID.test(evidenceId))return deny(400,"INVALID_EVIDENCE_ID");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return deny(503,"ISOLATED_PREVIEW_ONLY");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&process.env.TTO_LOOPBACK_E2E==="1"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 if(!base||(!base.startsWith("https://")&&!loopback))return deny(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(base);if(url.username||url.password)return deny(503,"BACKEND_UNAVAILABLE");
  const response=await fetch(new URL("/v1/national/cooperative-onboarding-evidence/"+evidenceId+"/integrity",url),{
    method:"GET",headers:{"Authorization":"Bearer "+token,...trustedBackendHeaders(req)},
    cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if([400,401,403].includes(response.status))return deny(response.status,"INTEGRITY_CHECK_DENIED");
  if(response.status!==200)return deny(503,"INTEGRITY_CHECK_UNAVAILABLE");
  const payload:unknown=await response.json();
  if(!payload||typeof payload!=="object"||Array.isArray(payload))return deny(502,"INVALID_UPSTREAM");
  const v=payload as Record<string,unknown>;
  if(v.evidenceId!==evidenceId||v.integrity!=="MATCH"||
   v.authenticity!=="NOT_VERIFIED"||v.malwareStatus!=="QUARANTINED"||
   v.externalSourceVerified!==false||v.legalApproval!==false||
   v.tenantCreated!==false||v.managerRoleGranted!==false)
    return deny(502,"INVALID_UPSTREAM");
  return NextResponse.json(v,{headers:HEADERS});
 }catch{return deny(503,"INTEGRITY_CHECK_UNAVAILABLE");}
}
