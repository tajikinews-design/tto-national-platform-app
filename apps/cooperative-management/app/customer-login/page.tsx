import {redirect} from "next/navigation";
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export default async function LegacyCommercialLogin({searchParams}:{searchParams:Promise<{slug?:string}>}){
 const {slug}=await searchParams;
 // Old commercial login is an alias, not another login template.
 if(typeof slug==="string"&&SLUG.test(slug))redirect("/c/"+encodeURIComponent(slug));
 redirect("/entry");
}
