import {redirect} from "next/navigation";
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export default async function LegacyFirstLogin({searchParams}:{searchParams:Promise<{slug?:string}>}){
 const {slug}=await searchParams;
 // First-credential setup is inside the protected cooperative dashboard.
 if(typeof slug==="string"&&SLUG.test(slug))redirect("/c/"+encodeURIComponent(slug));
 redirect("/entry");
}
