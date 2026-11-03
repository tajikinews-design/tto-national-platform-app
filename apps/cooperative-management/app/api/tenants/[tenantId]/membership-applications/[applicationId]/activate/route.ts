import {NextRequest} from "next/server";
import {membershipBff,readWorkflowBody,validUuid,denial} from "../../../../../../../lib/membership-workflow-bff";
export const runtime="nodejs"; export const dynamic="force-dynamic";
/** Separate authorized activator; manager request-decision authority is NOT enough. */
export async function POST(req:NextRequest,{params}:{params:Promise<{tenantId:string;applicationId:string}>}){
 const {tenantId,applicationId}=await params;
 if(!validUuid(applicationId))return denial(400,"INVALID_APPLICATION");
 const body=await readWorkflowBody(req);
 if(!body||!validUuid(body.activationEvidenceId)||
    !Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1)
  return denial(400,"INVALID_REQUEST");
 return membershipBff(req,tenantId,"/membership-applications/"+applicationId+"/activate","POST",
  {activationEvidenceId:body.activationEvidenceId,expectedVersion:body.expectedVersion},v=>{
   if(!v||typeof v!=="object"||Array.isArray(v))return false;
   const r=v as Record<string,unknown>;
   return r.recorded===true&&r.status==="ACTIVATED"&&typeof r.alreadyActivated==="boolean";
  });
}
