import { NextRequest, NextResponse } from "next/server";
import { trustedBackendHeaders } from "../../../../lib/trusted-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-side logout: keep bearer token out of browser JavaScript. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    let sameOrigin = false;
    try { sameOrigin = new URL(origin).host === request.headers.get("host") && new URL(origin).protocol === request.nextUrl.protocol; }
    catch { sameOrigin = false; }
    if (!sameOrigin) {
      return NextResponse.json({error:"ORIGIN_DENIED"},{status:403,headers:{"Cache-Control":"no-store"}});
    }
  }

  const token = request.cookies.get("tto_session")?.value;
  const clearCookie = () => {
    const response = new NextResponse(null, {status:204,headers:{"Cache-Control":"no-store"}});
    response.cookies.set("tto_session","",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
    return response;
  };
  // An absent local session is already logged out. No call or secret is required.
  if (!token) return clearCookie();
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    return NextResponse.json({error:"SESSION_INVALID"},{status:401,headers:{"Cache-Control":"no-store"}});
  }

  const base = process.env.TTO_API_BASE_URL;
  const loopbackE2E = process.env.TTO_LOOPBACK_E2E === "1" && process.env.CI === "true" && !process.env.VERCEL && /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base ?? "");
  const localTest = loopbackE2E || (process.env.NODE_ENV === "test" && /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base ?? ""));
  let upstreamUrl: URL;
  try {
    if (!base || (!base.startsWith("https://") && !localTest)) throw Error("Unsafe backend address");
    upstreamUrl = new URL("/v1/auth/logout",base);
    if ((upstreamUrl.protocol !== "https:" && !localTest) || upstreamUrl.username || upstreamUrl.password) throw Error("Unsafe backend address");
  } catch {
    return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});
  }

  try {
    const upstream = await fetch(upstreamUrl,{
      method:"POST",
      headers:{Authorization:`Bearer ${token}`,...trustedBackendHeaders(request)},
      cache:"no-store",
      redirect:"error",
      signal:AbortSignal.timeout(9500)
    });
    // Do not declare a logout success or delete the client's credential until
    // the real NestJS/PG17 revoke operation has succeeded.
    if (upstream.status !== 204) {
      return NextResponse.json({error:"LOGOUT_NOT_CONFIRMED"},{status:503,headers:{"Cache-Control":"no-store"}});
    }
    return clearCookie();
  } catch {
    return NextResponse.json({error:"BACKEND_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
