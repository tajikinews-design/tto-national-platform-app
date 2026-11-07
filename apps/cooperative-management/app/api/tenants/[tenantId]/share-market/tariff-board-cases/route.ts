import {NextRequest} from "next/server";
import {ph12BoardCaseProxy} from "../../../../../../lib/ph12-board-case-proxy";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;return ph12BoardCaseProxy(req,tenantId,"GET");
}
export async function POST(req:NextRequest,{params}:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await params;return ph12BoardCaseProxy(req,tenantId,"POST");
}
