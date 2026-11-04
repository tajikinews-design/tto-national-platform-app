import {NextRequest,NextResponse} from "next/server";
import {trustedBackendHeaders} from "../../../../lib/trusted-backend";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store, private","Vary":"Cookie"};
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");
 if(!origin)return NextResponse.json({error:"ORIGIN_REQUIRED"},{status:403,headers:noStore});
 try{if(new URL(origin).origin!==new URL(req.url).origin)
   return NextResponse.json({error:"ORIGIN_DENIED"},{status:403,headers:noStore})}
 catch{return NextResponse.json({error:"ORIGIN_DENIED"},{status:403,headers:noStore})}
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")
  return NextResponse.json({error:"JSON_REQUIRED"},{status:415,headers:noStore});
 const raw=await req.text();
 if(raw.length>350)return NextResponse.json({error:"BODY_TOO_LARGE"},{status:413,headers:noStore});
 let username:string,password:string;
 try{
  const body:unknown=JSON.parse(raw);
  if(!body||typeof body!=="object"||Array.isArray(body))throw Error("body");
  username=(body as {username?:unknown}).username as string;
  password=(body as {password?:unknown}).password as string;
 }catch{return NextResponse.json({error:"INVALID_JSON"},{status:400,headers:noStore})}
 if(typeof username!=="string"||username.length<2||username.length>64||
  typeof password!=="string"||password.length<1||password.length>128)
  return NextResponse.json({error:"INVALID_CREDENTIALS"},{status:400,headers:noStore});
 const rawBase=process.env.TTO_API_BASE_URL;
 const loopback=process.env.CI==="true"&&!process.env.VERCEL&&
  process.env.TTO_LOOPBACK_E2E==="1"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(rawBase??"");
 if(!rawBase||(!rawBase.startsWith("https://")&&!loopback))
  return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503,headers:noStore});
 try{
  const url=new URL("/v1/national/root/login",rawBase);
  if(url.username||url.password)return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503,headers:noStore});
  const up=await fetch(url,{method:"POST",
   headers:{"Content-Type":"application/json",...trustedBackendHeaders(req)},
   body:JSON.stringify({username,password}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)});
  if(up.status===401)return NextResponse.json({error:"INVALID_CREDENTIALS"},{status:401,headers:noStore});
  if(up.status===403)return NextResponse.json({error:"RATE_LIMITED"},{status:429,headers:noStore});
  if(up.status!==200)return NextResponse.json({error:"NATIONAL_LOGIN_UNAVAILABLE"},{status:503,headers:noStore});
  const data=await up.json() as {accessToken?:unknown;nationalRoot?:unknown};
  if(data.nationalRoot!==true||typeof data.accessToken!=="string"||
     !/^[A-Za-z0-9_-]{32,256}$/.test(data.accessToken))
   return NextResponse.json({error:"INVALID_RESPONSE"},{status:503,headers:noStore});
  const out=NextResponse.json({authenticated:true,nationalRoot:true},{status:200,headers:noStore});
  out.cookies.set("tto_session",data.accessToken,
    {httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:900});
  return out;
 }catch{return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503,headers:noStore})}
}
