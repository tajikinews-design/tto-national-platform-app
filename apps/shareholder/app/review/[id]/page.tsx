import {notFound} from "next/navigation";
import {parsePortalModuleId} from "@tto/ui";
import {ShareholderReview} from "../review-portal";

export default async function ShareholderReviewSection({
 params
}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const section=parsePortalModuleId(id);
 if(!section)notFound();
 return <ShareholderReview activeId={section}/>;
}
