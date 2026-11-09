import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
function fail(code:string,status:number){return NextResponse.json({code},{status,headers});}
export async function GET(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail("SESSION_REQUIRED",401);
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return fail("ISOLATED_PREVIEW_ONLY",503);
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail("BACKEND_UNAVAILABLE",503);
 try{
  const url=new URL("/v1/national/geo/provinces-counties",base);
  if(url.username||url.password)return fail("BACKEND_UNAVAILABLE",503);
  const r=await fetch(url,{headers:{Authorization:"Bearer "+token,...trustedBackendHeaders(req)},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return fail("SESSION_REQUIRED",401);
  if(r.status===403)return fail("NATIONAL_ROOT_REQUIRED",403);
  if(!r.ok)return fail("GEO_UNAVAILABLE",503);
  const data=await r.json() as {sourceYear?:unknown;provinces?:unknown;counties?:unknown};
  if(data.sourceYear!=="1404"||!Array.isArray(data.provinces)||!Array.isArray(data.counties)||
   data.provinces.length!==31||data.counties.length<484||data.counties.length>4000)
   return fail("INVALID_GEO_RESPONSE",502);
  return NextResponse.json(data,{headers});
 }catch{return fail("GEO_UNAVAILABLE",503)}
}
export async function POST(req:NextRequest){
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))return fail("SESSION_REQUIRED",401);
 const origin=req.headers.get("origin");
 if(!origin||new URL(origin).origin!==new URL(req.url).origin)return fail("ORIGIN_DENIED",403);
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return fail("JSON_REQUIRED",415);
 if(process.env.TTO_ISOLATED_DEMO_DB!=="true")return fail("ISOLATED_PREVIEW_ONLY",503);
 const raw=await req.text();if(raw.length>300)return fail("BODY_TOO_LARGE",413);
 let body:{provinceCode?:unknown;name?:unknown};
 try{body=JSON.parse(raw)}catch{return fail("INVALID_JSON",400)}
 if(!body||typeof body.provinceCode!=="string"||!/^[0-9]{2}$/.test(body.provinceCode)||
  typeof body.name!=="string"||body.name.length<2||body.name.length>100)return fail("INVALID_COUNTY",400);
 const base=process.env.TTO_API_BASE_URL;
 if(!base?.startsWith("https://"))return fail("BACKEND_UNAVAILABLE",503);
 try{
  const url=new URL("/v1/national/geo/counties",base);
  const r=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",...trustedBackendHeaders(req)},body:JSON.stringify({provinceCode:body.provinceCode,name:body.name}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(r.status===401)return fail("SESSION_REQUIRED",401);
  if(r.status===403)return fail("NATIONAL_ROOT_REQUIRED",403);
  if(r.status===409)return fail("COUNTY_EXISTS",409);
  if(r.status===400)return fail("INVALID_COUNTY",400);
  if(r.status!==201)return fail("COUNTY_SAVE_FAILED",503);
  const data=await r.json() as {id?:unknown;provinceCode?:unknown;name?:unknown;provenance?:unknown};
  if(typeof data.id!=="string"||data.provenance!=="NATIONAL_ADMIN_UNVERIFIED"||typeof data.name!=="string"||data.provinceCode!==body.provinceCode)return fail("INVALID_UPSTREAM",502);
  return NextResponse.json(data,{status:201,headers});
 }catch{return fail("COUNTY_SAVE_FAILED",503)}
}
