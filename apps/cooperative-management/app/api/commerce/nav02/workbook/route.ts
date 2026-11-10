import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../../lib/trusted-backend";
import {workbookXlsx,parseMemberXlsx} from "../../../../../lib/nav02-xlsx";
export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","Vary":"Cookie","X-Robots-Tag":"noindex"};
const fail=(status:number,code:string)=>NextResponse.json({code},{status,headers:H});
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
// One canonical, fully populated interchange schema for all editable member
// profile fields. Legal identity is still represented in the confidential
// owner-only export; importing new legal persons remains a separate workflow.
const headings=["عنوان","نام و نام خانوادگی","گروه عضویت","کد ملی","شماره همراه",
 "نام پدر","شماره شناسنامه","تاریخ تولد (شمسی)","محل تولد","تلفن",
 "کدپستی","نشانی","شغل","متولد شهرستان","ساکن شهرستان","شاغل شهرستان",
 "مجموعه","نوع شخصیت","وضعیت سهام","شماره ثبت","کد اقتصادی",
 "نام نماینده","کد ملی نماینده","موبایل نماینده","شماره عضویت"];
function validNationalCode(v:string){
 if(!/^[0-9]{10}$/.test(v)||/^([0-9])\1{9}$/.test(v))return false;
 let total=0;for(let i=0;i<9;i++)total+=Number(v[i])*(10-i);
 const r=total%11;return Number(v[9])===(r<2?r:11-r);
}
function session(req:NextRequest){const t=req.cookies.get("tto_session")?.value;
 return t&&/^[A-Za-z0-9_-]{32,256}$/.test(t)?t:null}
function baseUrl(){const b=process.env.TTO_API_BASE_URL;if(!b?.startsWith("https://"))return null;
 try{const u=new URL(b);return u.username||u.password||u.hash?null:u}catch{return null}}
function excelFile(rows:string[][],name:string){
 const data=workbookXlsx(rows);
 return new NextResponse(new Uint8Array(data),{headers:{
  ...H,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "Content-Disposition":'attachment; filename="'+name+'.xlsx"',
  "X-Content-Type-Options":"nosniff"}});
}
const fake=["خانم","نمونه کاملاً ساختگی - ثبت نشود","گروه نمونه","1234567891","09000000000",
 "نام پدر نمونه","00001","1370/01/01","شهرستان نمونه","05100000000","0000000000",
 "نشانی کاملاً نمونه برای راهنمای تکمیل فایل","شغل نمونه","بله","خیر","خیر",
 "مجموعه نمونه","حقیقی","فاقد سهام","نامربوط","نامربوط","نامربوط","نامربوط","نامربوط","هنوز صادر نشده"];
export async function GET(req:NextRequest){
 const token=session(req),slug=req.nextUrl.searchParams.get("slug");
 if(!token)return fail(401,"LOGIN_REQUIRED");
 if(!slug||!SLUG.test(slug))return fail(400,"INVALID_SLUG");
 const base=baseUrl();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 const mode=req.nextUrl.searchParams.get("mode");
 if(!["sample","export"].includes(mode??""))return fail(400,"INVALID_MODE");
 // The authorized owner check is mandatory even to fetch the template.
 try{
  const url=new URL("/v1/commerce/demo/nav02",base);url.searchParams.set("slug",slug);
  const r=await fetch(url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10500),
   headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)}});
  if(r.status===401)return fail(401,"LOGIN_REQUIRED");
  if(r.status===403)return fail(403,"OWNER_REQUIRED");
  if(!r.ok)return fail(503,"MEMBER_LIST_UNAVAILABLE");
  const obj=await r.json() as {items?:unknown};
  if(!Array.isArray(obj.items))return fail(502,"INVALID_OWNER_LIST");
  if(mode==="sample")return excelFile([headings,fake],"TTO_Members_Sample");
  if(obj.items.length>249)return fail(422,"EXPORT_BATCH_LIMIT_249");
  // Preserve type-safe narrowed authorization context in concurrent workers.
  const authorizedBase=base,authorizedSlug=slug,authorizedToken=token;
  // Every row is fetched from the existing encrypted owner-only edit endpoint,
  // NOT from the deliberately sparse/masked listing. Any failed row aborts
  // the entire export: no partially empty spreadsheet or tenant leakage.
  const owners=obj.items as Array<Record<string,unknown>>;
  // Narrow nullable GET parameters before a nested asynchronous worker closure.
  const scopedBase:URL=base,scopedSlug:string=slug,scopedToken:string=token;
  const rows:string[][]=new Array(owners.length);
  let cursor=0;
  async function worker(){
   while(cursor<owners.length){
    const i=cursor++,o=owners[i];
    if(!o||typeof o.id!=="string"||!/^[0-9a-f-]{36}$/i.test(o.id))
     throw Error("INVALID_DRAFT_ID");
    const url=new URL("/v1/commerce/demo/nav02/member-profile",authorizedBase);
    url.searchParams.set("slug",authorizedSlug);url.searchParams.set("draftId",o.id);
    const detail=await fetch(url,{cache:"no-store",redirect:"error",
     signal:AbortSignal.timeout(10000),
     headers:{Authorization:"Bearer "+authorizedToken,...trustedBackendHeaders(req)}});
    if(detail.status!==200)throw Error("MEMBER_DETAIL_NOT_AVAILABLE");
    const data=await detail.json() as {profile?:Record<string,unknown>};
    const p=data.profile;
    if(!p||typeof p!=="object"||typeof p.fullName!=="string"||
       !["NATURAL","LEGAL"].includes(String(p.personType)))
      throw Error("INVALID_MEMBER_DETAIL");
    const yes=(v:unknown)=>v==="yes"?"بله":v==="no"?"خیر":"";
    rows[i]=[p.title,p.fullName,p.group,p.nationalId,p.mobile,p.fatherName,
      p.birthCertificate,p.birthDate,p.birthPlace,p.telephone,p.postalCode,
      p.address,p.occupation,yes(p.bornInCounty),yes(p.residentInCounty),
      yes(p.employedInCounty),p.collectionName,
      p.personType==="LEGAL"?"حقوقی":"حقیقی",
      p.shareholdingStatus==="HOLDER_REPORTED"?"سهامدار (اظهاری)":
       p.shareholdingStatus==="TRANSFER_PENDING_REPORTED"?"انتقال در جریان (اظهاری)":"فاقد سهام",
      p.registrationNumber,p.economicCode,p.representativeName,
      p.representativeNationalId,p.representativeMobile,o.membershipNumber]
      .map(v=>String(v??""));
   }
  }
  await Promise.all(Array.from({length:Math.min(4,owners.length)},()=>worker()));
  // Sensitive owner-requested download only. Never cache, log, or expose it
  // through public previews, unscoped list endpoints or mock fixtures.
  return excelFile([headings,...rows],"TTO_Members_Export_Private");
 }catch{return fail(503,"WORKBOOK_EXPORT_UNAVAILABLE")}
}
export async function POST(req:NextRequest){
 const token=session(req);if(!token)return fail(401,"LOGIN_REQUIRED");
 const origin=req.headers.get("origin");if(!origin)return fail(403,"ORIGIN_REQUIRED");
 try{if(new URL(origin).origin!==new URL(req.url).origin)return fail(403,"ORIGIN_DENIED")}
 catch{return fail(403,"ORIGIN_DENIED")}
 const slug=req.nextUrl.searchParams.get("slug");
 if(!slug||!SLUG.test(slug))return fail(400,"INVALID_SLUG");
 if(req.headers.get("content-type")?.split(";")[0]!==
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  return fail(415,"XLSX_REQUIRED");
 if(Number(req.headers.get("content-length")||0)>2097152)return fail(413,"XLSX_TOO_LARGE");
 const bytes=Buffer.from(await req.arrayBuffer());
 if(bytes.length>2097152)return fail(413,"XLSX_TOO_LARGE");
 const base=baseUrl();if(!base)return fail(503,"BACKEND_UNAVAILABLE");
 // Separate read-only authorization gate before parsing any submitted data.
 try{
  const url=new URL("/v1/commerce/demo/nav02",base);url.searchParams.set("slug",slug);
  const gate=await fetch(url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10500),
   headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)}});
  if(gate.status===401)return fail(401,"LOGIN_REQUIRED");
  if(gate.status===403)return fail(403,"OWNER_REQUIRED");
  if(!gate.ok)return fail(503,"MEMBER_LIST_UNAVAILABLE");
  const known=await gate.json() as {items?:Array<{identifierMask?:string}>};
  if(!Array.isArray(known.items))return fail(502,"INVALID_OWNER_LIST");
 }catch{return fail(503,"OWNER_AUTH_UNAVAILABLE")}
 try{
  const data=parseMemberXlsx(bytes);
  if(data.length<2||data.length>201||headings.some((h,i)=>data[0][i]!==h))
   return fail(400,"XLSX_TEMPLATE_MISMATCH_OR_ROW_LIMIT");
  const seen=new Set<string>();
  const rows=data.slice(1).filter(row=>row.some(v=>v.trim())).map((r,i)=>{
    if(r.length>headings.length)throw Error("UNSUPPORTED_COLUMNS");
    const fields=headings.map((_,j)=>String(r[j]??"").trim());
    const [title,fullName,group,nationalId,mobile,fatherName,birthCertificate,
      birthDate,birthPlace,telephone,postalCode,address,occupation,born,resident,employed,
      collectionName,personType]=fields;
    const errors:string[]=[];
    if(!["آقا","خانم"].includes(title))errors.push("عنوان");
    if(fullName.length<3||fullName.length>180)errors.push("نام");
    if(group.length<2||group.length>90)errors.push("گروه");
    if(!validNationalCode(nationalId))errors.push("کد ملی");
    if(!/^09[0-9]{9}$/.test(mobile))errors.push("شماره همراه");
    if(![born,resident,employed].includes("بله"))errors.push("شرایط شهرستان");
    if(personType!=="حقیقی")errors.push("فایل ثبت گروهی فقط برای اشخاص حقیقی است؛ شخصیت حقوقی باید در فرم ثبت عضو وارد شود");
    if(![born,resident,employed].every(v=>["بله","خیر"].includes(v)))errors.push("پرچم شهرستان");
    if(birthDate&&!/^1[2-5][0-9]{2}\/(0[1-9]|1[0-2])\/\d{2}$/.test(birthDate))errors.push("تاریخ تولد");
    if(seen.has(nationalId))errors.push("کد ملی تکراری در فایل");
    seen.add(nationalId);
    return {row:i+2,valid:errors.length===0,errors,fields:{
     title,fullName,group,nationalId,mobile,fatherName,birthCertificate,birthDate,
     birthPlace,telephone,postalCode,address,occupation,
     bornInCounty:born==="بله"?"yes":"no",residentInCounty:resident==="بله"?"yes":"no",
     employedInCounty:employed==="بله"?"yes":"no",
     informationConfirmed:"yes",membershipStatus:"APPLICANT_UNVERIFIED",
     personType:"NATURAL",shareholdingStatus:"NONE_UNVERIFIED",collectionName,
     registrationNumber:"",economicCode:"",representativeName:"",
     representativeNationalId:"",representativeMobile:""
    }};
  });
  return NextResponse.json({rows,count:rows.length,hasErrors:rows.some(x=>!x.valid),
   status:"PREVIEW_ONLY_REQUIRES_EXPLICIT_CONFIRMATION"},{headers:H});
 }catch{return fail(400,"UNSAFE_OR_INVALID_XLSX")}
}
