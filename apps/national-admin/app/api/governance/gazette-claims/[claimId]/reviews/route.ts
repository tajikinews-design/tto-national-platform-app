import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"no-store, private","Vary":"Cookie"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny=(s:number,code:string)=>NextResponse.json({code},{status:s,headers:H});
export async function POST(req:NextRequest,{params}:{params:Promise<{claimId:string}>}){
 const {claimId}=await params;
 if(!UUID.test(claimId))return deny(400,"INVALID_CLAIM");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return deny(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return deny(503,"GAZETTE_REVIEW_NOT_RELEASED");
 const origin=req.headers.get("origin");
 if(!origin)return deny(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return deny(403,"ORIGIN_DENIED");}
 catch{return deny(403,"ORIGIN_DENIED");}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return deny(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>3500)return deny(413,"BODY_TOO_LARGE");
 let v:Record<string,unknown>;
 try{const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return deny(400,"INVALID_BODY");v=parsed as Record<string,unknown>;}
 catch{return deny(400,"INVALID_JSON");}
 if(typeof v.requestKey!=="string"||!UUID.test(v.requestKey)||
   typeof v.sourceReference!=="string"||v.sourceReference.trim().length<8||v.sourceReference.length>240||
   typeof v.sourceHashHex!=="string"||!/^[a-fA-F0-9]{64}$/.test(v.sourceHashHex)||
   typeof v.outcome!=="string"||!["MATCH_REPORTED_UNVERIFIED","MISMATCH_REPORTED","INCONCLUSIVE"].includes(v.outcome)||
   typeof v.rationale!=="string"||v.rationale.trim().length<10||v.rationale.length>1500)
   return deny(400,"INVALID_REVIEW");
 const base=process.env.TTO_API_BASE_URL??"";
 const local=process.env.CI==="true"&&!process.env.VERCEL&&process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!local)return deny(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL(base);if(url.username||url.password)return deny(503,"BACKEND_UNAVAILABLE");
  const res=await fetch(new URL("/v1/national/governance/gazette-claims/"+claimId+"/reviews",url),{
   method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",
    ...trustedBackendHeaders(req)},body:JSON.stringify(v),cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(9500)});
  if([400,401,403,409].includes(res.status))return deny(res.status,"GAZETTE_REVIEW_DENIED");
  if(res.status!==201)return deny(503,"GAZETTE_REVIEW_UNAVAILABLE");
  const result:unknown=await res.json();
  if(!result||typeof result!=="object"||Array.isArray(result))return deny(502,"INVALID_UPSTREAM");
  const x=result as Record<string,unknown>;
  if(x.claimId!==claimId||typeof x.findingId!=="string"||!UUID.test(x.findingId)||
    typeof x.replayed!=="boolean"||x.officiallyVerified!==false||
    x.legalApproval!==false||x.roleGranted!==false||
    !["MATCH_REPORTED_UNVERIFIED","MISMATCH_REPORTED","INCONCLUSIVE"].includes(String(x.outcome)))
    return deny(502,"INVALID_UPSTREAM");
  return NextResponse.json(x,{status:201,headers:H});
 }catch{return deny(503,"GAZETTE_REVIEW_UNAVAILABLE");}
}
