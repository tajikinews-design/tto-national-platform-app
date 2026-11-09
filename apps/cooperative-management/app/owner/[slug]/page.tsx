import {notFound,redirect} from "next/navigation";
export default async function LegacyOwner({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))notFound();
 // Independent owner screen retired: role-checked shared management dashboard.
 redirect("/c/"+encodeURIComponent(slug));
}
