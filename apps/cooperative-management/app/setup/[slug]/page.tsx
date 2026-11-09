import {notFound} from "next/navigation";
import {SetupCredentials} from "./setup-client";
export const dynamic="force-dynamic";
export default async function SetupPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))notFound();
 return <SetupCredentials slug={slug}/>;
}
