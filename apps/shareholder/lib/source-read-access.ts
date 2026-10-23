import type {NextRequest} from "next/server";
import {trustedBackendHeaders} from "./trusted-backend";

/** Never enable Child07/Child09 data based on these checks alone.
 * This guard authenticates a revocable cookie and checks the tenant context
 * using Nest+PostgreSQL. Returning "approved" is deliberately impossible.
 */
export type SourceReadDenial={
  status:401|403|503;
  code:"SESSION_REQUIRED"|"SOURCE_OR_PERMISSION_NOT_APPROVED"|"SOURCE_UNAVAILABLE";
};
const DENIED:SourceReadDenial={status:403,code:"SOURCE_OR_PERMISSION_NOT_APPROVED"};
const UNAVAILABLE:SourceReadDenial={status:503,code:"SOURCE_UNAVAILABLE"};
const REVOKED:SourceReadDenial={status:401,code:"SESSION_REQUIRED"};
const LOOPBACK=/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/;

/** Returns only a DENIAL; no source data/permission to trade is emitted. */
export async function verifySessionTenantForClosedRead(
  request:NextRequest,tenantId:string,token:string
):Promise<SourceReadDenial>{
  const base=process.env.TTO_API_BASE_URL;
  const local=process.env.TTO_LOOPBACK_E2E==="1"&&
    process.env.CI==="true"&&!process.env.VERCEL&&LOOPBACK.test(base??"");
  const testOnly=process.env.NODE_ENV==="test"&&LOOPBACK.test(base??"");
  let url:URL;
  try{
    if(!base||(!base.startsWith("https://")&&!local&&!testOnly))return UNAVAILABLE;
    url=new URL("/v1/tenants/"+tenantId+"/context",base);
    if(url.username||url.password||(url.protocol!=="https:"&&!local&&!testOnly))
      return UNAVAILABLE;
  }catch{return UNAVAILABLE;}

  try{
    // Browser-provided Authorization, X-Tenant-Id, X-Role and Party are never used.
    // Only HttpOnly cookie -> Bearer at BFF, and workload identity via trusted headers.
    const response=await fetch(url,{
      method:"GET",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500),
      headers:{Authorization:`Bearer ${token}`,...trustedBackendHeaders(request)}
    });
    if(response.status===401)return REVOKED;
    // Tenant nonexistence, missing role, or unapproved scope share one denial.
    if(response.status===403||response.status===404)return DENIED;
    if(response.status!==200)return UNAVAILABLE;
    const result:unknown=await response.json();
    if(!result||typeof result!=="object"||Array.isArray(result))return UNAVAILABLE;
    const scoped=result as Record<string,unknown>;
    if(scoped.tenant_id!==tenantId||scoped.status!=="ACTIVE")return DENIED;
    // EVEN WITH A VALID SCOPE, Child07 and Child09 sources remain unapproved.
    return DENIED;
  }catch{return UNAVAILABLE;}
}
