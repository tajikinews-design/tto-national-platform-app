import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
const token=(r:NextRequest)=>{const t=r.cookies.get("tto_session")?.value;
 return t&&/^[A-Za-z0-9_-]{32,256}$/.test(t)?t:null};
const slugOK=(v:string|null)=>v!==null&&/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(v);
const uuidOK=(v:string|null)=>v!==null&&/^[a-f0-9-]{36}$/i.test(v);
async function proxy(r:NextRequest,method:"POST"|"GET",payload?:string){
 const tk=token(r);if(!tk)return fail(401,"LOGIN_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(base);
  if(url.username||url.password||url.hash)return fail(503,"BACKEND_CONFIG_INVALID");
  const path=new URL("/v1/commerce/demo/nav02/attachments",url);
  if(method==="GET"){
   const slug=r.nextUrl.searchParams.get("slug"),draftId=r.nextUrl.searchParams.get("draftId");
   if(!slugOK(slug)||!uuidOK(draftId))return fail(400,"INVALID_ATTACHMENT_QUERY");
   path.searchParams.set("slug",slug!);path.searchParams.set("draftId",draftId!);
  }
  const x=await fetch(path,{method,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+tk,...trustedBackendHeaders(r),
    ...(method==="POST"?{"Content-Type":"application/json"}:{})},
   ...(method==="POST"?{body:payload}:{})});
  if(x.status===401)return fail(401,"LOGIN_REQUIRED");
  if(x.status===403)return fail(403,"ATTACHMENT_OWNER_DENIED");
  if(x.status===422)return fail(422,"ATTACHMENT_MALWARE_REJECTED");
  if(x.status===400)return fail(400,"INVALID_ATTACHMENT_INPUT");
  if(!x.ok)return fail(503,"ATTACHMENT_SCANNER_OR_STORAGE_UNAVAILABLE");
  const o=await x.json() as {items?:unknown;saved?:unknown;status?:unknown;legalEvidence?:unknown;id?:unknown};
  if(method==="GET"){
   if(!Array.isArray(o.items))return fail(502,"INVALID_ATTACHMENT_LIST");
   return NextResponse.json({items:o.items},{headers:H});
  }
  if(o.saved!==true||o.status!=="PRIVATE_READY"||o.legalEvidence!==false||typeof o.id!=="string")
   return fail(502,"INVALID_ATTACHMENT_SAVE");
  return NextResponse.json({saved:true,id:o.id,status:"PRIVATE_READY"},{headers:H});
 }catch{return fail(503,"ATTACHMENT_UNAVAILABLE")}
}
export async function GET(r:NextRequest){return proxy(r,"GET")}
export async function POST(r:NextRequest){
 if(!token(r))return fail(401,"LOGIN_REQUIRED");
 const origin=r.headers.get("origin");if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(r.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(r.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 if(Number(r.headers.get("content-length")||0)>750000)return fail(413,"ATTACHMENT_TOO_LARGE");
 const raw=await r.text();if(raw.length>750000)return fail(413,"ATTACHMENT_TOO_LARGE");
 let b:Record<string,unknown>;
 try{const v:unknown=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw Error();
 b=v as Record<string,unknown>}catch{return fail(400,"INVALID_BODY")}
 if(!slugOK(typeof b.slug==="string"?b.slug:null)||!uuidOK(typeof b.draftId==="string"?b.draftId:null))
  return fail(400,"INVALID_ATTACHMENT_SCOPE");
 return proxy(r,"POST",raw);
}
