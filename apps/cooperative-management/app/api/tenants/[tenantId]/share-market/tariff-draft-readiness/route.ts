import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const TENANT=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SESSION=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie",
  "X-Content-Type-Options":"nosniff"};

function denied(status:number,code:string){
 return NextResponse.json({tenantContextVerified:false,code},{status,headers:HEADERS});
}

/** PH12 Share Market v3 draft-preparation gate.
 * Real cookie -> verified Nest session -> FORCE RLS tenant context; never use
 * caller-supplied actor/role/tenant claims for business authorization.
 * This endpoint cannot create or publish tariff policy, accept a board
 * resolution, confirm bank receipts or legalize share transfers.
 */
export async function GET(req:NextRequest,
 {params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!TENANT.test(tenantId))return denied(400,"INVALID_TENANT");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!SESSION.test(token))return denied(401,"SESSION_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 const isolated=process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&
   !process.env.VERCEL&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 let url:URL;
 try{
  if(!base||(!base.startsWith("https://")&&!isolated))
   return denied(503,"TENANT_CONTEXT_UNAVAILABLE");
  url=new URL("/v1/tenants/"+tenantId+"/context",base);
  if(url.username||url.password||(url.protocol!=="https:"&&!isolated))
    return denied(503,"TENANT_CONTEXT_UNAVAILABLE");
 }catch{return denied(503,"TENANT_CONTEXT_UNAVAILABLE");}
 try{
  const result=await fetch(url,{method:"GET",cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(9000),
   headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)}});
  if(result.status===401)return denied(401,"SESSION_REQUIRED");
  if(result.status===403||result.status===404)return denied(403,"TENANT_ACCESS_DENIED");
  if(result.status!==200)return denied(503,"TENANT_CONTEXT_UNAVAILABLE");
  const scoped=await result.json() as {tenant_id?:unknown;status?:unknown};
  if(scoped.tenant_id!==tenantId||scoped.status!=="ACTIVE")
   return denied(403,"TENANT_ACCESS_DENIED");
  return NextResponse.json({
    tenantContextVerified:true,tenantId,
    draftPreparationAllowed:true,
    // These flags cannot be changed by the browser or fake board document.
    serverSideTariffDraftPersistence:false,
    liveTariffWrites:false,officialTariffActivation:false,
    boardResolutionVerified:false,financeAndCeoMandatesVerified:false,
    officialFeePaid:false,appointmentEnabled:false,ownershipTransferEnabled:false,
    requiredEvidence:["COOPERATIVE_BOARD_RESOLUTION","FINANCE_OFFICER_BOARD_MANDATE",
      "CEO_OFFICIAL_MANDATE","AUTHENTICATED_COOPERATIVE_BANK_SETTLEMENT"]
  },{status:200,headers:HEADERS});
 }catch{return denied(503,"TENANT_CONTEXT_UNAVAILABLE");}
}
