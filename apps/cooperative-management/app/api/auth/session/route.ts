import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {"Cache-Control":"no-store, private","Vary":"Cookie"};

function noSession(clear:boolean){
  const r=NextResponse.json({authenticated:false},{status:200,headers:HEADERS});
  if(clear)r.cookies.set("tto_session","",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
  return r;
}
function unavailable(){
  return NextResponse.json({error:"SESSION_CHECK_UNAVAILABLE"},{status:503,headers:HEADERS});
}

/** Session claims are verified through Nest and PG17; never trust cookie presence alone. */
export async function GET(request:NextRequest){
  const token=request.cookies.get("tto_session")?.value;
  if(!token)return noSession(false);
  if(!/^[A-Za-z0-9_-]{32,256}$/.test(token))return noSession(true);

  const base=process.env.TTO_API_BASE_URL;
  const loopback=process.env.TTO_LOOPBACK_E2E==="1"&&
     process.env.CI==="true"&&!process.env.VERCEL&&
     /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
  const testOnly=process.env.NODE_ENV==="test"&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base??"");
  let url:URL;
  try{
    if(!base||(!base.startsWith("https://")&&!loopback&&!testOnly))
      return unavailable();
    url=new URL("/v1/auth/session",base);
    if(url.username||url.password||(url.protocol!=="https:"&&!loopback&&!testOnly))
      return unavailable();
  }catch{return unavailable();}
  try{
    const upstream=await fetch(url,{
      method:"GET",headers:{Authorization:`Bearer ${token}`},
      cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9500)
    });
    if(upstream.status===401)return noSession(true);
    if(upstream.status!==200)return unavailable();
    const data=await upstream.json() as {authenticated?:unknown};
    if(data.authenticated!==true)return unavailable();
    return NextResponse.json({authenticated:true},{status:200,headers:HEADERS});
  }catch{return unavailable();}
}
