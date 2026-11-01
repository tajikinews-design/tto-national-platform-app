import {NextResponse} from "next/server";
export const runtime="nodejs";
export async function POST(request:Request){
 const enabled=process.env.CI==="true"&&process.env.TTO_PCS007_LAB==="1"&&!process.env.VERCEL&&!process.env.DATABASE_URL&&!process.env.TTO_API_BASE_URL&&Boolean(process.env.TTO_PCS007_TOKEN);
 if(!enabled)return NextResponse.json({code:"LAB_DISABLED"},{status:404});
 const origin=request.headers.get("origin");if(origin&&origin!=="http://127.0.0.1:32982"&&origin!=="http://localhost:32982")return NextResponse.json({code:"ORIGIN_DENIED"},{status:403});
 try{const r=await fetch("http://127.0.0.1:32990/approve",{method:"POST",headers:{"x-pcs007-lab-token":process.env.TTO_PCS009_LAB==="1"?process.env.TTO_PCS009_MANAGER_TOKEN!:process.env.TTO_PCS007_TOKEN!,...(process.env.TTO_PCS009_LAB==="1"?{"x-demo-tenant":"DEMO-TENANT-001","x-demo-party":"DEMO-PARTY-001"}:{})},signal:AbortSignal.timeout(2000)});if(!r.ok)return NextResponse.json({code:"LAB_UNAVAILABLE"},{status:503});return NextResponse.redirect(new URL("/review/pcs007",request.url),303)}catch{return NextResponse.json({code:"LAB_UNAVAILABLE"},{status:503})}
}
