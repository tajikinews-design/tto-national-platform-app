import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const H={"Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reject(status:number,code:string){return NextResponse.json({code},{status,headers:H});}
export async function POST(req:NextRequest,{params}:{params:Promise<{evidenceId:string}>}){
 const {evidenceId}=await params;
 if(!UUID.test(evidenceId))return reject(400,"INVALID_EVIDENCE_ID");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return reject(401,"SESSION_REQUIRED");
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return reject(503,"ISOLATED_PREVIEW_ONLY");
 const origin=req.headers.get("origin");
 if(!origin)return reject(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return reject(403,"ORIGIN_DENIED");}
 catch{return reject(403,"ORIGIN_DENIED");}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
  return reject(415,"JSON_REQUIRED");
 const raw=await req.text();
 if(raw.length>250)return reject(413,"BODY_TOO_LARGE");
 let requestKey:string;
 try{
  const v:unknown=JSON.parse(raw);
  if(!v||typeof v!=="object"||Array.isArray(v))return reject(400,"INVALID_JSON");
  const x=v as Record<string,unknown>;
  if(Object.keys(x).length!==1||typeof x.requestKey!=="string"||!UUID.test(x.requestKey))
   return reject(400,"INVALID_SCAN_REQUEST");
  requestKey=x.requestKey;
 }catch{return reject(400,"INVALID_JSON");}
 const base=process.env.TTO_API_BASE_URL??"";
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!loopback)return reject(503,"BACKEND_UNAVAILABLE");
 try{
  const u=new URL(base);
  if(u.username||u.password)return reject(503,"BACKEND_UNAVAILABLE");
  const res=await fetch(new URL("/v1/national/cooperative-onboarding-evidence/"+evidenceId+"/scan",u),{
   method:"POST",headers:{Authorization:"Bearer "+token,
    "Content-Type":"application/json",...trustedBackendHeaders(req)},
   body:JSON.stringify({requestKey}),cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(9000)});
  if([400,401,403,409].includes(res.status))return reject(res.status,
    res.status===409?"SCAN_REPLAY_CONFLICT":"SCAN_DENIED");
  if(res.status!==201)return reject(503,"SCANNER_UNAVAILABLE");
  const value:unknown=await res.json();
  if(!value||typeof value!=="object"||Array.isArray(value))
   return reject(502,"INVALID_UPSTREAM");
  const x=value as Record<string,unknown>;
  if(x.evidenceId!==evidenceId||typeof x.receiptId!=="string"||!UUID.test(x.receiptId)||
   !["CLEAN","MALWARE"].includes(String(x.verdict))||typeof x.replayed!=="boolean"||
   x.stillQuarantined!==true||x.authenticity!=="NOT_VERIFIED"||
   x.legalApproval!==false||x.tenantCreated!==false||x.managerRoleGranted!==false)
   return reject(502,"INVALID_UPSTREAM");
  return NextResponse.json(x,{status:201,headers:H});
 }catch{return reject(503,"SCANNER_UNAVAILABLE");}
}
