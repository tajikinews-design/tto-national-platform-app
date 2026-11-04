import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const headers={"Cache-Control":"public, max-age=0, must-revalidate"};
 if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))return NextResponse.json({exists:false},{status:404,headers});
 const base=process.env.TTO_API_BASE_URL;
 if(!base||!base.startsWith("https://"))return NextResponse.json({exists:false},{status:503,headers});
 try{
  const url=new URL("/v1/national/cooperative-workspaces/"+encodeURIComponent(slug),base);
  const response=await fetch(url,{headers:trustedBackendHeaders(req),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
  if(response.status!==200)return NextResponse.json({exists:false},{status:503,headers});
  const data=await response.json() as {exists?:unknown;slug?:unknown};
  if(data.slug!==slug||typeof data.exists!=="boolean")return NextResponse.json({exists:false},{status:503,headers});
  return NextResponse.json({exists:data.exists,slug},{status:data.exists?200:404,headers});
 }catch{return NextResponse.json({exists:false},{status:503,headers});}
}
