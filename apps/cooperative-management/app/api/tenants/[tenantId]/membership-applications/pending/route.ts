import {NextRequest} from "next/server";
import {membershipBff,validUuid} from "../../../../../../lib/membership-workflow-bff";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 return membershipBff(req,tenantId,"/membership-applications/pending","GET",undefined,v=>{
  if(!v||typeof v!=="object")return false;
  const items=(v as Record<string,unknown>).items;
  if(!Array.isArray(items)||items.length>30)return false;
  return items.every((it:unknown)=>{
   if(!it||typeof it!=="object")return false;
   const x=it as Record<string,unknown>;
   return validUuid(x.applicationId)&&validUuid(x.partyId)&&Number.isSafeInteger(x.version)&&
    Number(x.version)>0&&typeof x.submittedAt==="string"&&Number.isFinite(Date.parse(x.submittedAt));
  });
 });
}
