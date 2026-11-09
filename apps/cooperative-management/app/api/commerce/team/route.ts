import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie"};
const send=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const PERM=/^NAV-(0[1-9]|1[01])$/;
function validPermissions(p:unknown):p is string[]{
 return Array.isArray(p)&&p.length>0&&p.length<=11&&p.every(x=>typeof x==="string"&&PERM.test(x))&&
 p.includes("NAV-01")&&new Set(p).size===p.length;
}
function baseUrl(){
 const value=process.env.TTO_API_BASE_URL;
 if(!value?.startsWith("https://"))return null;
 try{const u=new URL(value);return u.username||u.password?null:u}catch{return null}
}
function auth(req:NextRequest){const v=req.cookies.get("tto_session")?.value;return v&&TOKEN.test(v)?v:null}
export async function GET(req:NextRequest){
 const token=auth(req);if(!token)return send(401,"LOGIN_REQUIRED");
 const slug=req.nextUrl.searchParams.get("slug");if(!slug||!SLUG.test(slug))return send(400,"INVALID_SLUG");
 const base=baseUrl();if(!base)return send(503,"UNAVAILABLE");
 try{
  const url=new URL("/v1/commerce/demo/team",base);url.searchParams.set("slug",slug);
  const r=await fetch(url,{headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
    cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return send(401,"LOGIN_REQUIRED");
  if(!r.ok)return send(503,"UNAVAILABLE");
  const data=await r.json() as {items?:unknown};
  if(!Array.isArray(data.items))return send(502,"INVALID_RESULT");
  return NextResponse.json(data,{headers:H});
 }catch{return send(503,"UNAVAILABLE")}
}
export async function POST(req:NextRequest){
 const token=auth(req);if(!token)return send(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");if(!origin)return send(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return send(403,"ORIGIN_DENIED")}
 catch{return send(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return send(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>1600)return send(413,"BODY_TOO_LARGE");
 let d:Record<string,unknown>;
 try{const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error();d=parsed as Record<string,unknown>}
 catch{return send(400,"INVALID_BODY")}
 if(Object.keys(d).some(k=>!["action","slug","username","displayName","password","permissions","id","state"].includes(k))||
 typeof d.slug!=="string"||!SLUG.test(d.slug)||!validPermissions(d.permissions))return send(400,"INVALID_PERMISSIONS");
 if(d.action==="create"){
  if(typeof d.username!=="string"||!/^staff_[a-z][a-z0-9._-]{4,58}$/.test(d.username)||
   typeof d.displayName!=="string"||d.displayName.trim().length<3||d.displayName.length>120||
   typeof d.password!=="string"||d.password.length<14||d.password.length>128)return send(400,"INVALID_USER");
 }else if(d.action==="update"){
  if(typeof d.id!=="string"||!/^[0-9a-f-]{36}$/i.test(d.id)||
   (d.state!=="ACTIVE"&&d.state!=="DISABLED"))return send(400,"INVALID_UPDATE");
 }else return send(400,"INVALID_ACTION");
 const base=baseUrl();if(!base)return send(503,"UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/team",base),{method:"POST",
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...trustedBackendHeaders(req)},
   body:JSON.stringify(d),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return send(401,"LOGIN_REQUIRED");
  if(r.status===403)return send(403,"OWNER_REQUIRED");
  if(r.status===409)return send(409,"USERNAME_TAKEN");
  if(r.status===400)return send(400,"INVALID_USER");
  if(!r.ok)return send(503,"UNAVAILABLE");
  const data=await r.json() as {created?:unknown;changed?:unknown};
  if(data.created!==true&&data.changed!==true)return send(502,"INVALID_RESULT");
  return NextResponse.json(data,{headers:H});
 }catch{return send(503,"UNAVAILABLE")}
}
