import {NextRequest} from "next/server";
import {membershipBff,readWorkflowBody,validUuid,denial} from "../../../../../../lib/membership-workflow-bff";
export const runtime="nodejs"; export const dynamic="force-dynamic";
/** Applicant may submit an existing verified Party reference; it does not create membership. */
export async function POST(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 const data=await readWorkflowBody(req);
 if(!data||!validUuid(data.partyId)||!validUuid(data.evidenceId))
  return denial(400,"INVALID_REQUEST");
 const valid=(v:unknown):boolean=>{
  if(!v||typeof v!=="object")return false;
  const r=v as Record<string,unknown>;
  return validUuid(r.applicationId)&&r.status==="PENDING"&&r.version===1;
 };
 return membershipBff(req,tenantId,"/membership-applications","POST",
  {partyId:data.partyId,evidenceId:data.evidenceId},valid);
}
