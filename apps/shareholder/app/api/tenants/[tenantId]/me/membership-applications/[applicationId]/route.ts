import {NextRequest} from "next/server";
import {membershipBff,validUuid,denial} from "../../../../../../../lib/membership-workflow-bff";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string;applicationId:string}>}){
 const {tenantId,applicationId}=await params;
 if(!validUuid(applicationId))return denial(400,"INVALID_APPLICATION");
 return membershipBff(req,tenantId,"/me/membership-applications/"+applicationId,"GET",undefined,
 v=>{
  if(!v||typeof v!=="object")return false;
  const r=(v as Record<string,unknown>).record;
  if(!r||typeof r!=="object"||Array.isArray(r))return false;
  const x=r as Record<string,unknown>;
  return x.applicationId===applicationId&&["PENDING","APPROVED","REJECTED"].includes(String(x.status))&&
   Number.isSafeInteger(x.version)&&Number(x.version)>0&&
   typeof x.submittedAt==="string"&&Number.isFinite(Date.parse(x.submittedAt))&&
   (x.decidedAt===null||typeof x.decidedAt==="string"&&Number.isFinite(Date.parse(x.decidedAt)));
 });
}
