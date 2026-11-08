import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const DATE=/^14[0-9]{2}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie",
 "X-Content-Type-Options":"nosniff"};
const deny=(status:number,code:string)=>NextResponse.json({code},{status,headers:HEADERS});
function context(req:NextRequest,tenant:string){
 const token=req.cookies.get("tto_session")?.value;
 if(!UUID.test(tenant)||!token||!TOKEN.test(token))return null;
 if(process.env.TTO_CHILD06_GOVERNANCE_ARCHIVE_UI!=="true"||process.env.VERCEL)
  return null;
 const base=process.env.TTO_API_BASE_URL??"";
 const local=process.env.CI==="true"&&process.env.TTO_LOOPBACK_E2E==="1"&&
    /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!local)return null;
 const url=new URL(base);
 if(url.username||url.password||url.protocol!=="https:"&&!local)return null;
 return {token,url};
}
async function upstream(req:NextRequest,tenant:string,method:"GET"|"POST",body?:string){
 const c=context(req,tenant);
 if(!c)return deny(503,"CHILD06_TRANSITION_SOURCE_UNAVAILABLE");
 const target=new URL("/v1/tenants/"+tenant+"/child06/"+
   (method==="GET"?"notice-transition-catalog":"notice-transitions"),c.url);
 try{
  const response=await fetch(target,{
   method,headers:{Authorization:"Bearer "+c.token,...trustedBackendHeaders(req),
     ...(body?{"Content-Type":"application/json"}:{})},body,cache:"no-store",
   redirect:"error",signal:AbortSignal.timeout(9500)});
  if(response.status===401)return deny(401,"CHILD06_TRANSITION_SESSION_REQUIRED");
  if(response.status===403)return deny(403,"CHILD06_TRANSITION_SCOPE_DENIED");
  if(method==="POST"&&[400,409].includes(response.status))
    return deny(response.status,"CHILD06_TRANSITION_INPUT_OR_REPLAY_DENIED");
  if(!response.ok)return deny(503,"CHILD06_TRANSITION_SOURCE_UNAVAILABLE");
  const data:unknown=await response.json();
  if(!data||typeof data!=="object"||Array.isArray(data))return deny(502,"CHILD06_TRANSITION_UNSAFE_UPSTREAM");
  const x=data as Record<string,unknown>;
  if(x.tenantId!==tenant)return deny(502,"CHILD06_TRANSITION_WRONG_TENANT");
  if(method==="GET"){
   if(x.sourceAuthenticated!==false||x.legalSigningPowerGranted!==false||
      x.tariffActivated!==false||!Array.isArray(x.notices)||!Array.isArray(x.transitions)||
      x.notices.length>200||x.transitions.length>500)
    return deny(502,"CHILD06_TRANSITION_UNSAFE_UPSTREAM");
   const notices=x.notices.map((v:Record<string,unknown>)=>({
     noticeId:v.noticeId,sourceType:v.sourceType,noticeKind:v.noticeKind,
     sourceNoticeNumber:v.sourceNoticeNumber,resolutionOn:v.resolutionOn,
     publishedOn:v.publishedOn,provenance:v.provenance}));
   const transitions=x.transitions.map((v:Record<string,unknown>)=>({
     transitionId:v.transitionId,targetNoticeId:v.targetNoticeId,
     replacementNoticeId:v.replacementNoticeId,action:v.action,
     effectiveOn:v.effectiveOn,publishedOn:v.publishedOn,
     sourceReference:v.sourceReference,sourceStatus:v.sourceStatus}));
   return NextResponse.json({available:true,verified:false,notices,transitions},{headers:HEADERS});
  }
  if(typeof x.transitionId!=="string"||!UUID.test(x.transitionId)||
    x.state!=="USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED"||
    x.officiallyVerified!==false||x.legalSignerAuthorityGranted!==false||
    x.tariffActivated!==false||typeof x.replayed!=="boolean")
   return deny(502,"CHILD06_TRANSITION_UNSAFE_UPSTREAM");
  return NextResponse.json({
   transitionId:x.transitionId,state:x.state,replayed:x.replayed,
   verified:false,legalSigningPowerGranted:false,tariffActivated:false},
    {status:201,headers:HEADERS});
 }catch{return deny(503,"CHILD06_TRANSITION_SOURCE_UNAVAILABLE");}
}
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT");
 if(!req.cookies.get("tto_session")?.value)return deny(401,"SESSION_REQUIRED");
 return upstream(req,tenantId,"GET");
}
export async function POST(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT");
 if(!req.cookies.get("tto_session")?.value)return deny(401,"SESSION_REQUIRED");
 const origin=req.headers.get("origin");
 if(!origin)return deny(403,"ORIGIN_REQUIRED");
 try{
  const submitted=new URL(origin),serverOrigin=new URL(req.url).origin;
  const boundHost=req.headers.get("host")??"";
  const sameOrigin=submitted.origin===serverOrigin;
  // Next standalone rewrites req.url to localhost during loopback E2E,
  // while the real browser Host and Origin are both 127.0.0.1:<port>.
  const trustedLabOrigin=process.env.CI==="true"&&
   process.env.TTO_LOOPBACK_E2E==="1"&&!process.env.VERCEL&&
   /^127[.]0[.]0[.]1:[0-9]{4,5}$/.test(boundHost)&&
   submitted.protocol==="http:"&&submitted.host===boundHost;
  if(!sameOrigin&&!trustedLabOrigin)return deny(403,"ORIGIN_DENIED");
 }catch{return deny(403,"ORIGIN_DENIED");}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
  return deny(415,"JSON_REQUIRED");
 const raw=await req.text();
 if(raw.length>3500)return deny(413,"PAYLOAD_TOO_LARGE");
 let data:unknown;
 try{data=JSON.parse(raw);}catch{return deny(400,"INVALID_JSON");}
 if(!data||typeof data!=="object"||Array.isArray(data))return deny(400,"INVALID_INPUT");
 const x=data as Record<string,unknown>;
 const keys=["requestKey","targetNoticeId","replacementNoticeId","action","effectiveOn",
    "publishedOn","sourceReference"];
 if(Object.keys(x).some(k=>!keys.includes(k))||!UUID.test(String(x.requestKey))||
   !UUID.test(String(x.targetNoticeId))||
   !["CORRECTED","REVOKED"].includes(String(x.action))||
   !DATE.test(String(x.effectiveOn))||
   (x.publishedOn!==null&&x.publishedOn!==undefined&&!DATE.test(String(x.publishedOn)))||
   typeof x.sourceReference!=="string"||x.sourceReference.length<10||
   x.sourceReference.length>300||
   (x.action==="CORRECTED"&&!UUID.test(String(x.replacementNoticeId)))||
   (x.action==="REVOKED"&&x.replacementNoticeId!==null&&x.replacementNoticeId!==undefined))
   return deny(400,"INVALID_INPUT");
 return upstream(req,tenantId,"POST",raw);
}
