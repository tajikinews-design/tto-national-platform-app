import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie"};
const denial=(status:number,code:string)=>NextResponse.json({code},{status,headers:HEADERS});
async function dispatch(req:NextRequest,params:Promise<{tenantId:string}>,method:"GET"|"POST"){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return denial(400,"INVALID_TENANT");
 const base=process.env.TTO_API_BASE_URL;
 if(process.env.CI!=="true"||process.env.TTO_PCS011_LAB!=="1"||process.env.VERCEL||
 !/^http:\/\/127\.0\.0\.1:32710$/.test(base??""))return denial(404,"LAB_DISABLED");
 const token=req.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return denial(401,"SESSION_REQUIRED");
 if(method==="POST"){
   const origin=req.headers.get("origin");
   if(origin!=="http://127.0.0.1:32711"&&origin!=="http://localhost:32711")return denial(403,"ORIGIN_DENIED");
 }
 let payload:unknown=undefined;
 if(method==="POST"){
  try{const body=await req.json() as {fixtureRef?:unknown};if(typeof body.fixtureRef!=="string"||!/^PCS010-FAKE-[A-Za-z0-9_-]{8,60}$/.test(body.fixtureRef))return denial(400,"INVALID_FIXTURE");payload={fixtureRef:body.fixtureRef}}
  catch{return denial(400,"INVALID_BODY")}
 }
 try{
  const upstream=await fetch(base+"/v1/pcs010-lab/tenants/"+tenantId+"/fixture-reviews",{
   method,headers:{Authorization:"Bearer "+token,...(method==="POST"?{"content-type":"application/json"}:{})},
   body:payload?JSON.stringify(payload):undefined,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(7000)});
  if(!upstream.ok)return denial([400,401,403,409].includes(upstream.status)?upstream.status:503,"REVIEW_DENIED_OR_UNAVAILABLE");
  const data=await upstream.json() as {kind?:string;official?:boolean;items?:number;recorded?:boolean};
  if(data.kind!=="SYNTHETIC_ONLY"||data.official!==false)return denial(503,"UNEXPECTED_SOURCE");
  if(method==="GET")return NextResponse.json({kind:"SYNTHETIC_ONLY",official:false,items:Number(data.items??0)},{headers:HEADERS});
  return NextResponse.json({recorded:data.recorded===true,kind:"SYNTHETIC_ONLY",official:false},{status:201,headers:HEADERS});
 }catch{return denial(503,"REVIEW_UNAVAILABLE")}
}
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){return dispatch(req,params,"GET")}
export async function POST(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){return dispatch(req,params,"POST")}
