import { NextRequest, NextResponse } from "next/server";
import { trustedBackendHeaders } from "../../../../lib/trusted-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Protected Preview-only: prove caller OIDC trust + restricted DB readiness.
 * No tokens, personal data or credentials are returned to the browser.
 */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store, private" };
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ready:false},{status:404,headers});
  }
  const base=process.env.TTO_API_BASE_URL;
  // Exact isolated Preview deployments only; never trust a caller-supplied host.
  // The legacy infrastructure probe is retained while the NAV02 cooperative
  // Preview uses the newer, verified READY backend revision.
  const trustedPreviewApis=new Set([
    "https://tto-api-preview-6l9c3huqs-tajikinews-6739.vercel.app",
    "https://tto-api-preview-feb8p8a9p-tajikinews-6739.vercel.app",
    "https://tto-api-preview-ct4e6hp5q-tajikinews-6739.vercel.app",
    "https://tto-api-preview-454wmjead-tajikinews-6739.vercel.app"
  ]);
  if (!base || !trustedPreviewApis.has(base)) {
    return NextResponse.json({ready:false},{status:503,headers});
  }
  try {
    const h=trustedBackendHeaders(request);
    const upstream=await fetch(base+"/ready",{
      method:"GET",headers:h,cache:"no-store",redirect:"error",
      signal:AbortSignal.timeout(8500)
    });
    if (!upstream.ok) {
      return NextResponse.json({ready:false,upstreamStatus:upstream.status},{status:503,headers});
    }
    const body=await upstream.json() as {status?:unknown;database?:unknown};
    if(body.status!=="ready" || body.database!=="reachable") {
      return NextResponse.json({ready:false},{status:503,headers});
    }
    return NextResponse.json({ready:true,oidcTrusted:true,restrictedDatabase:true},{status:200,headers});
  }catch{
    return NextResponse.json({ready:false,code:"PROTECTED_BACKEND_UNAVAILABLE"},{status:503,headers});
  }
}
