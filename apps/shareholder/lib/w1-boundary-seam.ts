import type { NextRequest } from "next/server";

/**
 * W1 BFF seam contract — SYNTHETIC LAB ONLY, NOT ATTACHED TO ROUTES.
 *
 * This is not authentication. The trusted proof in tests comes from an in-memory
 * synthetic session fixture, never from client headers or a real user account.
 * No operational ALLOW value exists. Do not wire into live routes.
 */
export const W1_BFF_SEAM_VERSION = "W1_BFF_NEST_SEAM_V0_1" as const;
export type W1Operation = "read" | "download" | "export" | "write" | "trade" | "finalize";

export type W1LabRoute = {
  tenantKey: string;
  ownerKey: string;
  operation: string;
};
export type W1SyntheticSessionProof = {
  sessionActive: boolean;
  expectedCookie: string;
  tenantKey: string;
  ownerKey: string;
};
export type W1LabCandidate = {
  contractVersion: typeof W1_BFF_SEAM_VERSION;
  environment: "SIMULATION";
  tenantKey: string;
  ownerKey: string;
  operation: W1Operation;
};
type W1Denial = {
  kind: "DENY";
  status: 401 | 403 | 405 | 503;
  reasonCode: string;
};
type W1Candidate = { kind: "CANDIDATE"; candidate: W1LabCandidate };
export type W1BffResult = W1Denial | W1Candidate;

function labOnly(): boolean {
  return process.env.CI === "true" &&
    process.env.TTO_LOOPBACK_E2E === "1" &&
    process.env.TTO_W1_BOUNDARY_LAB === "1" &&
    !process.env.VERCEL &&
    process.env.NODE_ENV !== "production" &&
    !process.env.DATABASE_URL &&
    !process.env.TTO_API_BASE_URL &&
    !process.env.TTO_DB_POOLER_HOST &&
    !process.env.TTO_DB_APP_PASSWORD &&
    !process.env.APIIR_TOKEN;
}
const OPERATIONS: readonly string[] = ["read", "download", "export", "write", "trade", "finalize"];
const GET_OPERATIONS: readonly string[] = ["read", "download", "export"];
const TEST_TENANT = /^coop-test-[A-Z]$/;
const TEST_OWNER = /^fixture-owner-[A-Z]$/;

/** Input is a true NextRequest in the isolated integration harness. */
export function prepareW1SyntheticBffCandidate(
  request: Pick<NextRequest, "method" | "cookies">,
  route: W1LabRoute,
  trusted: W1SyntheticSessionProof
): W1BffResult {
  if (!labOnly()) return { kind: "DENY", status: 503, reasonCode: "LAB_DISABLED" };
  if (!route || !trusted || !TEST_TENANT.test(route.tenantKey) ||
      !TEST_OWNER.test(route.ownerKey) || !OPERATIONS.includes(route.operation))
    return { kind: "DENY", status: 403, reasonCode: "INVALID_LAB_SCOPE" };
  const method = GET_OPERATIONS.includes(route.operation) ? "GET" : "POST";
  if (request.method !== method)
    return { kind: "DENY", status: 405, reasonCode: "OPERATION_METHOD_DENIED" };
  // This is a synthetic cookie comparison, not proof of real authentication.
  // Client Authorization/role/Party/source headers are intentionally unread.
  const cookie = request.cookies.get("tto_lab_session")?.value;
  if (!trusted.sessionActive || !cookie || cookie !== trusted.expectedCookie)
    return { kind: "DENY", status: 401, reasonCode: "SESSION_REQUIRED" };
  if (trusted.tenantKey !== route.tenantKey)
    return { kind: "DENY", status: 403, reasonCode: "TENANT_MISMATCH" };
  if (trusted.ownerKey !== route.ownerKey)
    return { kind: "DENY", status: 403, reasonCode: "RESOURCE_OWNERSHIP_DENIED" };
  // Whitelist exactly 5 fields; never forward cookies, credentials or headers.
  return {
    kind: "CANDIDATE",
    candidate: {
      contractVersion: W1_BFF_SEAM_VERSION,
      environment: "SIMULATION",
      tenantKey: route.tenantKey,
      ownerKey: route.ownerKey,
      operation: route.operation as W1Operation
    }
  };
}

export type W1SafeDecision = {
  decision: "DENY" | "SIMULATED_ALLOW";
  reasonCode: string;
  requestId: string;
  fixtureTouches: number;
  auditCount: number;
  legalOperationalEffect: "NONE";
  canGrantPermission: false;
  hasActualRecord: false;
};
type W1Sanitized = { kind: "VALID"; response: W1SafeDecision } |
  { kind: "DENY"; status: 503; reasonCode: "UPSTREAM_CONTRACT_INVALID" };

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ALLOWLIST = ["decision", "reasonCode", "requestId", "fixtureTouches", "auditCount",
  "legalOperationalEffect", "canGrantPermission", "hasActualRecord"].sort();

/**
 * Never relay a raw backend response to a browser, even within the lab.
 * Reject extra fields, operational ALLOW, any record or a DENY after source touch.
 */
export function sanitizeW1SyntheticBffDecision(raw: unknown): W1Sanitized {
  const invalid: W1Sanitized = {
    kind: "DENY", status: 503, reasonCode: "UPSTREAM_CONTRACT_INVALID"
  };
  if (!labOnly() || !raw || typeof raw !== "object" || Array.isArray(raw))
    return invalid;
  const r = raw as Record<string, unknown>;
  if (JSON.stringify(Object.keys(r).sort()) !== JSON.stringify(ALLOWLIST) ||
      (r.decision !== "DENY" && r.decision !== "SIMULATED_ALLOW") ||
      typeof r.reasonCode !== "string" || !/^[A-Z0-9_]{2,60}$/.test(r.reasonCode) ||
      typeof r.requestId !== "string" || !UUID.test(r.requestId) ||
      r.canGrantPermission !== false ||
      r.legalOperationalEffect !== "NONE" || r.hasActualRecord !== false ||
      typeof r.fixtureTouches !== "number" || typeof r.auditCount !== "number" ||
      !Number.isSafeInteger(r.fixtureTouches) || !Number.isSafeInteger(r.auditCount) ||
      r.auditCount !== 1 ||
      (r.decision === "DENY" && r.fixtureTouches !== 0) ||
      (r.decision === "SIMULATED_ALLOW" && r.fixtureTouches !== 1))
    return invalid;
  return {
    kind: "VALID",
    response: {
      decision: r.decision as "DENY" | "SIMULATED_ALLOW",
      reasonCode: r.reasonCode,
      requestId: r.requestId,
      fixtureTouches: r.fixtureTouches as number,
      auditCount: r.auditCount as number,
      legalOperationalEffect: "NONE",
      canGrantPermission: false,
      hasActualRecord: false
    }
  };
}
