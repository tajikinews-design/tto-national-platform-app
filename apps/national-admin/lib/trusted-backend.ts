import type { NextRequest } from "next/server";

/**
 * Forward only Vercel's short-lived, signed function identity to the
 * exact trusted TTO API Preview deployment. The Vercel gateway verifies
 * issuer, source project and preview->preview Trusted Sources rules.
 *
 * In Vercel Functions the token is injected into x-vercel-oidc-token on
 * the incoming server-side Request (NOT into a runtime env variable).
 * In CI loopback tests there is no Vercel identity and no header.
 * Never send this header back to a browser, persist it or log its value.
 */
export function trustedBackendHeaders(request: NextRequest): Record<string,string> {
  if (!process.env.VERCEL) return {};
  const jwt=request.headers.get("x-vercel-oidc-token");
  if (!jwt || jwt.length>8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
    throw new Error("TTO_PREVIEW_WORKLOAD_IDENTITY_UNAVAILABLE");
  return {"x-vercel-trusted-oidc-idp-token":jwt};
}
