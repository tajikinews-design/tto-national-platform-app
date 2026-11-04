import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"private, no-store","Vary":"Cookie"};
function fail(status:number,error:string){return NextResponse.json({error},{status,headers:noStore});}
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"SESSION_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED");}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
  return fail(415,"JSON_REQUIRED");
 const body=await req.text();
 if(body.length>600)return fail(413,"BODY_TOO_LARGE");
 let newUsername:string,newPassword:string,currentPassword:string;
 try{
  const v:unknown=JSON.parse(body);
  if(!v||typeof v!=="object"||Array.isArray(v))return fail(400,"INVALID_BODY");
  const obj=v as Record<string,unknown>;
  newUsername=typeof obj.newUsername==="string"?obj.newUsername:"";
  newPassword=typeof obj.newPassword==="string"?obj.newPassword:"";
  currentPassword=typeof obj.currentPassword==="string"?obj.currentPassword:"";
 }catch{return fail(400,"INVALID_JSON")}
 if(!/^[A-Za-z0-9._-]{5,64}$/.test(newUsername)||
    newPassword.length<14||newPassword.length>128||/^\d+$/.test(newPassword)||
    currentPassword.length<1||currentPassword.length>128)
   return fail(400,"WEAK_NEW_CREDENTIALS");
 const raw=process.env.TTO_API_BASE_URL;
 const ci=process.env.CI==="true"&&!process.env.VERCEL&&
   process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(raw??"");
 if(!raw||(!raw.startsWith("https://")&&!ci))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL("/v1/national/root/change-credentials",raw);
  if(url.username||url.password)return fail(503,"BACKEND_UNAVAILABLE");
  const up=await fetch(url,{method:"POST",
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
   body:JSON.stringify({newUsername,newPassword,currentPassword}),cache:"no-store",
   redirect:"error",signal:AbortSignal.timeout(9500)});
  if(up.status===401)return fail(401,"INVALID_CREDENTIALS");
  if(up.status===400)return fail(400,"WEAK_NEW_CREDENTIALS");
  if(up.status===403)return fail(403,"NATIONAL_ROOT_REQUIRED");
  if(up.status!==200)return fail(503,"CHANGE_UNAVAILABLE");
  const result=await up.json() as {changed?:unknown;sessionsRevoked?:unknown};
  if(result.changed!==true||result.sessionsRevoked!==true)return fail(503,"INVALID_UPSTREAM");
  const response=NextResponse.json({changed:true,loginRequired:true},{status:200,headers:noStore});
  response.cookies.set("tto_session","",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
  return response;
 }catch{return fail(503,"CHANGE_UNAVAILABLE")}
}
