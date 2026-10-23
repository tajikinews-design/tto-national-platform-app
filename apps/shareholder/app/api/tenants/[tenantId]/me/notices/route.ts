import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,256}$/;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
function deny(status:number,code:string){
 return NextResponse.json({available:false,code},{status,headers:HEADERS});
}
/**
 * CHILD09 source-authority candidate. Fail closed until the authoritative
 * source adapter, CF04 approval and recipient authorization are accepted.
 * A browser-provided Authorization, Party, role or claimed source is ignored.
 * Neither a 200 empty list nor a synthetic record is allowed while disabled.
 */
export async function GET(request:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;
 if(!UUID.test(tenantId))return deny(400,"INVALID_TENANT_ID");
 const token=request.cookies.get("tto_session")?.value;
 if(!token||!TOKEN.test(token))return deny(401,"SESSION_REQUIRED");
 // Deliberately NO source/backend fetch, database query or feature flag bypass.
 return deny(403,"SOURCE_OR_PERMISSION_NOT_APPROVED");
}
