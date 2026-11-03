import {NextRequest} from "next/server";
import {membershipBff,readWorkflowBody,validUuid,denial} from "../../../../../../../lib/membership-workflow-bff";
export const runtime="nodejs"; export const dynamic="force-dynamic";
/** No manager decision without independently validated authority and optimistic version in PG17. */
export async function POST(req:NextRequest,
 {params}:{params:Promise<{tenantId:string;applicationId:string}>}){
 const {tenantId,applicationId}=await params;
 if(!validUuid(applicationId))return denial(400,"INVALID_APPLICATION");
 const body=await readWorkflowBody(req);
 if(!body||!validUuid(body.decisionEvidenceId)||typeof body.approve!=="boolean"||
    !Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1)
  return denial(400,"INVALID_REQUEST");
 const valid=(v:unknown):boolean=>{
  if(!v||typeof v!=="object")return false;
  const r=v as Record<string,unknown>;
  return r.recorded===true&&["APPROVED","REJECTED"].includes(String(r.status))&&
   typeof r.alreadyApplied==="boolean";
 };
 return membershipBff(req,tenantId,"/membership-applications/"+applicationId+"/decision",
  "POST",{approve:body.approve,expectedVersion:body.expectedVersion,
          decisionEvidenceId:body.decisionEvidenceId},valid);
}
