import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const H={"Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const OFFICES=new Set(["BOARD_CHAIR","BOARD_VICE_CHAIR","BOARD_MEMBER","CEO","AUTHORIZED_SIGNATORY","INSPECTOR","OTHER"]);
const SIGNING=new Set(["NONE","INDIVIDUAL","JOINT","BOARD_RESOLUTION","OTHER_SPECIFIED"]);
function deny(status:number,code:string){return NextResponse.json({code},{status,headers:H});}
export async function POST(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT_ID");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 // Never expose incomplete legal rights path to hosted Preview/Production.
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return deny(503,"LEGAL_RECORDS_PREVIEW_ONLY");
 const origin=req.headers.get("origin");
 if(!origin)return deny(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return deny(403,"ORIGIN_DENIED");}
 catch{return deny(403,"ORIGIN_DENIED");}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
  return deny(415,"JSON_REQUIRED");
 const raw=await req.text();
 if(raw.length>3000)return deny(413,"BODY_TOO_LARGE");
 let v:Record<string,unknown>;
 try{const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||
    Array.isArray(parsed))return deny(400,"INVALID_FIELDS");v=parsed as Record<string,unknown>;}
 catch{return deny(400,"INVALID_JSON");}
 const date=/^\d{4}-\d{2}-\d{2}$/;
 const str=(k:string,min:number,max:number)=>typeof v[k]==="string"&&
   (v[k] as string).trim().length>=min&&(v[k] as string).length<=max;
 if(!str("requestKey",36,36)||!UUID.test(v.requestKey as string)||
    !str("personFullName",3,160)||
    !OFFICES.has(String(v.officeType))||
    !SIGNING.has(String(v.signingMode))||
    !str("authorityScope",10,1500)||
    !str("gazetteIssueNumber",1,20)||!/^[0-9]{1,20}$/.test(v.gazetteIssueNumber as string)||
    !str("gazetteAnnouncementNumber",1,40)||
    !/^[0-9A-Za-z-]{1,40}$/.test(v.gazetteAnnouncementNumber as string)||
    !str("gazettePublicationDate",10,10)||!date.test(v.gazettePublicationDate as string)||
    (v.effectiveFrom!==undefined&&v.effectiveFrom!==null&&v.effectiveFrom!==""&&
      (typeof v.effectiveFrom!=="string"||!date.test(v.effectiveFrom)))||
    (v.effectiveUntil!==undefined&&v.effectiveUntil!==null&&v.effectiveUntil!==""&&
      (typeof v.effectiveUntil!=="string"||!date.test(v.effectiveUntil)))||
    (v.officialReferenceUrl!==undefined&&v.officialReferenceUrl!==null&&v.officialReferenceUrl!==""&&
      (typeof v.officialReferenceUrl!=="string"||
       !v.officialReferenceUrl.startsWith("https://")||v.officialReferenceUrl.length>400))||
    (v.supersedesClaimId!==undefined&&v.supersedesClaimId!==null&&v.supersedesClaimId!==""&&
      (typeof v.supersedesClaimId!=="string"||!UUID.test(v.supersedesClaimId))))
   return deny(400,"INVALID_OFFICIAL_GAZETTE_CITATION");
 const base=process.env.TTO_API_BASE_URL??"";
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base);
 if(!base.startsWith("https://")&&!loopback)return deny(503,"BACKEND_UNAVAILABLE");
 try{
  const u=new URL(base);if(u.username||u.password)return deny(503,"BACKEND_UNAVAILABLE");
  const res=await fetch(new URL("/v1/tenants/"+tenantId+"/governance/manual-official-notices",u),{
   method:"POST",headers:{Authorization:"Bearer "+token,
    "Content-Type":"application/json",...trustedBackendHeaders(req)},
   body:JSON.stringify({...v,effectiveFrom:v.effectiveFrom||null,
     effectiveUntil:v.effectiveUntil||null,
     officialReferenceUrl:v.officialReferenceUrl||null,
     supersedesClaimId:v.supersedesClaimId||null}),
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if([400,401,403,409].includes(res.status))
   return deny(res.status,res.status===409?"OFFICIAL_NOTICE_REPLAY_CONFLICT":
     res.status===403?"MANAGER_LEGAL_AUTHORITY_REQUIRED":"GAZETTE_CLAIM_DENIED");
  if(res.status!==201)return deny(503,"OFFICIAL_NOTICE_UNAVAILABLE");
  const result:unknown=await res.json();
  if(!result||typeof result!=="object"||Array.isArray(result))return deny(502,"INVALID_UPSTREAM");
  const x=result as Record<string,unknown>;
  if(x.tenantId!==tenantId||typeof x.claimId!=="string"||!UUID.test(x.claimId)||
     typeof x.replayed!=="boolean"||x.status!=="SELF_REPORTED_PENDING_REVIEW"||
     x.legalApproval!==false||x.officiallyVerified!==false||x.roleGranted!==false)
   return deny(502,"INVALID_UPSTREAM");
  return NextResponse.json(x,{status:201,headers:H});
 }catch{return deny(503,"OFFICIAL_NOTICE_UNAVAILABLE");}
}
