import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
function backend(){const b=process.env.TTO_API_BASE_URL;if(!b?.startsWith("https://"))return null;
 try{const u=new URL(b);return u.username||u.password?null:u}catch{return null}}
function token(req:NextRequest){const v=req.cookies.get("tto_session")?.value;return v&&TOKEN.test(v)?v:null}
export async function GET(req:NextRequest){
 const tk=token(req),slug=req.nextUrl.searchParams.get("slug");
 if(!tk)return fail(401,"LOGIN_REQUIRED");
 if(!slug||!SLUG.test(slug))return fail(400,"INVALID_SLUG");
 const base=backend();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const url=new URL("/v1/commerce/demo/nav02",base);url.searchParams.set("slug",slug);
  const r=await fetch(url,{headers:{Authorization:"Bearer "+tk,...trustedBackendHeaders(req)},
   redirect:"error",cache:"no-store",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OWNER_REQUIRED");
  if(!r.ok)return fail(503,"INTAKE_UNAVAILABLE");
  const data=await r.json() as {items?:unknown};
  if(!Array.isArray(data.items))return fail(502,"INVALID_RESULT");
  return NextResponse.json({items:data.items},{headers:H});
 }catch{return fail(503,"INTAKE_UNAVAILABLE")}
}
export async function POST(req:NextRequest){
 const tk=token(req);if(!tk)return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail(415,"JSON_REQUIRED");
 const raw=await req.text();if(raw.length>6400)return fail(413,"BODY_TOO_LARGE");
 let data:Record<string,unknown>;
 try{const v:unknown=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw Error();
  data=v as Record<string,unknown>;}catch{return fail(400,"INVALID_BODY")}
 if(Object.keys(data).some(k=>!["slug","action","draftId","data"].includes(k))||
   typeof data.slug!=="string"||!SLUG.test(data.slug)||
   !["profile","memberProfile","legalProfile","capital"].includes(String(data.action))||
   !data.data||typeof data.data!=="object"||Array.isArray(data.data))
  return fail(400,"INVALID_BODY");
 const d=data.data as Record<string,unknown>;
 if(Object.values(d).some(v=>typeof v!=="string")||
 ((data.action==="profile"||data.action==="memberProfile"||data.action==="legalProfile")&&(
  Object.keys(d).some(k=>!["title","fullName","group","nationalId","fatherName",
  "birthCertificate","birthDate","birthPlace","telephone","mobile","postalCode","address",
  "bornInCounty","residentInCounty","employedInCounty","informationConfirmed","membershipStatus",
  "personType","shareholdingStatus","collectionName","occupation","registrationNumber",
  "economicCode","representativeName","representativeNationalId","representativeMobile"].includes(k))||
  !["آقا","خانم","شرکت","سازمان","اداره"].includes(String(d.title))||
  typeof d.fullName!=="string"||d.fullName.trim().length<3||
  typeof d.group!=="string"||d.group.trim().length<2||
  typeof d.nationalId!=="string"||
  !(d.title==="آقا"||d.title==="خانم"?/^\d{10}$/:/^\d{11}$/).test(d.nationalId)||
  (data.action==="legalProfile"&&(d.personType!=="LEGAL"||d.title!=="شرکت"||
    d.membershipStatus!=="NON_MEMBER_REPORTED"||
    !/^\\d{11}$/.test(String(d.nationalId))||!/^\\d{1,30}$/.test(String(d.registrationNumber))||
    !/^\\d{12,14}$/.test(String(d.economicCode))||
    typeof d.representativeName!=="string"||d.representativeName.trim().length<3||
    !/^\\d{10}$/.test(String(d.representativeNationalId))||
    !/^09[0-9]{9}$/.test(String(d.representativeMobile))||
    d.informationConfirmed!=="yes"))||
  (data.action==="memberProfile"&&(!["آقا","خانم"].includes(String(d.title))||
    !["yes","no"].includes(String(d.bornInCounty))||
    !["yes","no"].includes(String(d.residentInCounty))||
    !["yes","no"].includes(String(d.employedInCounty))||
    (d.membershipStatus!=="NON_MEMBER_REPORTED"&&
     ![d.bornInCounty,d.residentInCounty,d.employedInCounty].includes("yes"))||
    d.informationConfirmed!=="yes"||!["APPLICANT_UNVERIFIED","ACTIVE_REPORTED","FORMER_REPORTED","NON_MEMBER_REPORTED"].includes(String(d.membershipStatus))||
    d.personType!=="NATURAL"||
    !["NONE_UNVERIFIED","HOLDER_REPORTED","TRANSFER_PENDING_REPORTED"].includes(String(d.shareholdingStatus))||
    typeof d.collectionName!=="string"||d.collectionName.length>100||
    typeof d.occupation!=="string"||d.occupation.length>120||
    typeof d.mobile!=="string"||!/^09[0-9]{9}$/.test(d.mobile)||
    (d.birthDate!==""&&!/^1[2-5][0-9]{2}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/.test(String(d.birthDate)))))))||
 (data.action==="capital"&&(
  typeof data.draftId!=="string"||!/^[a-f0-9-]{36}$/i.test(data.draftId)||
  Object.keys(d).some(k=>!["initialShares","subscribedShares","nominalRial","paidRial",
    "paymentDate","receiptRef"].includes(k))||
  !["initialShares","subscribedShares","nominalRial","paidRial"].every(k=>
   typeof d[k]==="string"&&/^\d{1,17}$/.test(d[k] as string)))))
  return fail(400,"INVALID_FIELDS");
 const base=backend();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 try{
  const r=await fetch(new URL("/v1/commerce/demo/nav02",base),{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+tk,...trustedBackendHeaders(req)},
   body:JSON.stringify(data),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OWNER_REQUIRED");
  if(r.status===409)return fail(409,"DUPLICATE_DRAFT");
  if(r.status===422&&(data.action==="memberProfile"||data.action==="legalProfile"))return fail(422,"SHAHKAR_MISMATCH");
  if(r.status===400)return fail(400,"INVALID_VALUES");
  if(!r.ok){
   // Only expose non-sensitive operational fault categories; never provider payloads.
   if(r.status===503){
    const payload=await r.json().catch(()=>null) as {message?:unknown}|null;
    const message=typeof payload?.message==="string"?payload.message:"";
    if(message==="SHAHKAR_NOT_CONFIGURED")return fail(503,"IDENTITY_PROVIDER_NOT_CONFIGURED");
    if(message==="SHAHKAR_UNAVAILABLE")return fail(503,"IDENTITY_PROVIDER_UNAVAILABLE");
    if(["PRIVATE_IDENTITY_KEY_UNAVAILABLE","PRIVATE_IDENTITY_KEY_INVALID"].includes(message))
     return fail(503,"IDENTITY_ENCRYPTION_UNAVAILABLE");
   }
   return fail(503,"INTAKE_UNAVAILABLE");
  }
  const result=await r.json() as {saved?:unknown;record?:unknown};
  if(result.saved!==true)return fail(502,"INVALID_RESULT");
  return NextResponse.json(result,{headers:H});
 }catch{return fail(503,"INTAKE_UNAVAILABLE")}
}
