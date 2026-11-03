import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie"};
function deny(status:number,code:string){
 return NextResponse.json({available:false,code},{status,headers:HEADERS});
}
/** Private, owner-only, same-source approved snapshot version history (not ledger/trades). Never trusts browser Authorization/role/Party. */
export async function GET(request:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT_ID");
 const token=request.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 const loopback=process.env.TTO_LOOPBACK_E2E==="1"&&process.env.CI==="true"&&!process.env.VERCEL&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 const testOnly=process.env.NODE_ENV==="test"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
 let url:URL;
 try{
  if(!base||(!base.startsWith("https://")&&!loopback&&!testOnly))return deny(503,"SOURCE_UNAVAILABLE");
  url=new URL("/v1/tenants/"+tenantId+"/me/shareholding-history",base);
  if(url.username||url.password||(url.protocol!=="https:"&&!loopback&&!testOnly))
   return deny(503,"SOURCE_UNAVAILABLE");
 }catch{return deny(503,"SOURCE_UNAVAILABLE");}
 try{
  const response=await fetch(url,{method:"GET",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500),
   headers:{Authorization:`Bearer ${token}`,...trustedBackendHeaders(request)}});
  if(response.status===401)return deny(401,"SESSION_REQUIRED");
  if(response.status===403||response.status===404)return deny(403,"SOURCE_OR_PERMISSION_NOT_APPROVED");
  if(response.status!==200)return deny(503,"SOURCE_UNAVAILABLE");
  const data=await response.json() as {record?:unknown};
  if(!data.record||typeof data.record!=="object"||Array.isArray(data.record))
    return deny(503,"SOURCE_UNAVAILABLE");
  const record=data.record as Record<string,unknown>;
  if(!Array.isArray(record.items)||record.items.length<1||record.items.length>20)
    return deny(503,"SOURCE_UNAVAILABLE");
  const clean:{shareQuantity:string;ledgerVersion:number;ledgerAsOf:string}[]=[];
  for(const item of record.items){
    if(!item||typeof item!=="object"||Array.isArray(item))
      return deny(503,"SOURCE_UNAVAILABLE");
    const v=item as Record<string,unknown>;
    if(typeof v.shareQuantity!=="string"||!/^(0|[1-9][0-9]{0,18})$/.test(v.shareQuantity)||
       !Number.isSafeInteger(v.ledgerVersion)||Number(v.ledgerVersion)<1||
       typeof v.ledgerAsOf!=="string"||!Number.isFinite(Date.parse(v.ledgerAsOf))||
       (clean.length>0&&Number(v.ledgerVersion)>=clean[clean.length-1].ledgerVersion))
      return deny(503,"SOURCE_UNAVAILABLE");
    clean.push({shareQuantity:v.shareQuantity,ledgerVersion:Number(v.ledgerVersion),ledgerAsOf:v.ledgerAsOf as string});
  }
  return NextResponse.json({available:true,record:{items:clean}},{status:200,headers:HEADERS});
 }catch{return deny(503,"SOURCE_UNAVAILABLE");}
}
