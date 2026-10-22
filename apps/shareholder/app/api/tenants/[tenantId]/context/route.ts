import { NextRequest, NextResponse } from "next/server";
import { trustedBackendHeaders } from "../../../../../lib/trusted-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN = /^[A-Za-z0-9_-]{32,256}$/;
const HEADERS = { "Cache-Control": "private, no-store", "Vary": "Cookie" };

function denial(status: number, code: string) {
  return NextResponse.json({ tenantContextVerified: false, code }, { status, headers: HEADERS });
}

/**
 * Read-only tenant-context authorization probe.
 * The opaque browser session cookie is converted to Bearer only within this BFF.
 * Nest resolves the live PG-backed session; FORCE RLS checks active role or approved JIT.
 * A successful probe is NOT membership, share ownership or legal signing authority.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  if (!UUID.test(tenantId)) return denial(400, "INVALID_TENANT_ID");

  // Ignore caller-supplied Authorization, actor ID, role and tenant headers.
  const token = request.cookies.get("tto_session")?.value;
  if (!token || !TOKEN.test(token)) return denial(401, "SESSION_REQUIRED");

  const base = process.env.TTO_API_BASE_URL;
  const loopback = process.env.TTO_LOOPBACK_E2E === "1" &&
    process.env.CI === "true" && !process.env.VERCEL &&
    /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base ?? "");
  const testOnly = process.env.NODE_ENV === "test" &&
    /^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(base ?? "");
  let url: URL;
  try {
    if (!base || (!base.startsWith("https://") && !loopback && !testOnly))
      return denial(503, "TENANT_GATE_UNAVAILABLE");
    url = new URL(`/v1/tenants/${tenantId}/context`, base);
    if (url.username || url.password || (url.protocol !== "https:" && !loopback && !testOnly))
      return denial(503, "TENANT_GATE_UNAVAILABLE");
  } catch { return denial(503, "TENANT_GATE_UNAVAILABLE"); }

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, ...trustedBackendHeaders(request) },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(9500)
    });
    if (upstream.status === 401) return denial(401, "SESSION_REQUIRED");
    // Do not reveal whether a guessed tenant exists or whether its role is missing.
    if (upstream.status === 403 || upstream.status === 404)
      return denial(403, "TENANT_ACCESS_DENIED");
    if (upstream.status !== 200) return denial(503, "TENANT_GATE_UNAVAILABLE");
    const data = await upstream.json() as { tenant_id?: unknown; status?: unknown };
    if (data.tenant_id !== tenantId || data.status !== "ACTIVE")
      return denial(403, "TENANT_ACCESS_DENIED");
    // Whitelist response fields; never forward slug, membership, role or raw backend JSON.
    return NextResponse.json({ tenantContextVerified: true, tenantId }, { status: 200, headers: HEADERS });
  } catch { return denial(503, "TENANT_GATE_UNAVAILABLE"); }
}
