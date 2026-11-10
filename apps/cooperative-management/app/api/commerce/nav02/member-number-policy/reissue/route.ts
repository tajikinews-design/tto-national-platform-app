import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED");}
 catch{return fail(403,"ORIGIN_DENIED");}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>1600)return fail(413,"BODY_TOO_LARGE");
 let d:Record<string,unknown>;
 try{const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error();
  d=parsed as Record<string,unknown>}catch{return fail(400,"INVALID_BODY");}
 if(typeof d.slug!=="string"||!SLUG.test(d.slug))return fail(400,"INVALID_SLUG");
 if(Object.keys(d).some(k=>!["slug","nextSerial","prefix","suffix","expectedCount","acknowledgement"].includes(k))||
  typeof d.nextSerial!=="string"||!/^[1-9][0-9]{0,11}$/.test(d.nextSerial)||
  typeof d.prefix!=="string"||!/^[A-Z0-9-]{0,12}$/.test(d.prefix)||
  typeof d.suffix!=="string"||!/^[A-Z0-9-]{0,12}$/.test(d.suffix)||
  !Number.isSafeInteger(d.expectedCount)||Number(d.expectedCount)<1||
  d.acknowledgement!=="REISSUE_ALL_MEMBERS_ACKNOWLEDGED")return fail(400,"REISSUE_ACK_REQUIRED");
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/nav02/member-number-policy/reissue",base),{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,
     ...trustedBackendHeaders(req)},cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(10000),body:JSON.stringify(d)});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OWNER_SCOPE_DENIED");
  if(r.status===409)return fail(409,"STALE_OR_DUPLICATE_REQUEST");
  if(r.status===400)return fail(400,"INVALID_REQUEST");
  if(!r.ok)return fail(503,"GOVERNANCE_SERVICE_UNAVAILABLE");
  const body=await r.json() as {saved?:unknown;record?:unknown};
  if(body.saved!==true||!body.record)return fail(502,"INVALID_RESULT");
  return NextResponse.json(body,{headers:H});
 }catch{return fail(503,"GOVERNANCE_SERVICE_UNAVAILABLE");}
}
