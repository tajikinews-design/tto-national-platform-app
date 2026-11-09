import {notFound,redirect} from "next/navigation";
export default async function LegacySetup({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))notFound();
 // All first-login credentials now belong inside the one scoped dashboard.
 redirect("/c/"+encodeURIComponent(slug));
}
