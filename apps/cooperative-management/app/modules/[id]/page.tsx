import { PortalModulePreview, parsePortalModuleId } from "@tto/ui";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Route IDs must come from the 11 approved navigation slots, not user input. */
export default async function ModulePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const moduleId=parsePortalModuleId(id);
  if(!moduleId)notFound();
  return <PortalModulePreview surface="cooperative" moduleId={moduleId}/>;
}
