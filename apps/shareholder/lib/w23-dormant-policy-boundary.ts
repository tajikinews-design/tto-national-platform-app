import type { NextRequest } from "next/server";
import type { W1BffResult } from "./w1-boundary-seam";
import { randomUUID } from "node:crypto";

/**
 * W2.3 DORMANT BFF integration contract — NOT imported by any application Route.
 *
 * Starts AFTER W1 synthetic BFF preflight; does not authenticate a real cookie.
 * It describes what could cross an internal BFF->Nest boundary and NEVER
 * authorizes a real source read, even if Nest/PDP says SIMULATED_ALLOW.
 * No Authorization, role, Party, cookie, source approval or browser headers
 * can be serialized to the draft envelope. No network requests here.
 */
export const W23_CONTRACT_VERSION = "W2_3_DORMANT_BOUNDARY_V0_1" as const;

export type W23BffWireCandidate = {
  contractVersion: typeof W23_CONTRACT_VERSION;
  environment: "SIMULATION";
  operation: "read";
  tenantKey: string;
  ownerKey: string;
  requestId: string;
};

type W23Deny = {
  kind: "DENY";
  status: 401 | 403 | 405 | 503;
  code: string;
};
export type W23BffPreflight =
  | W23Deny
  | { kind: "DRAFT_CANDIDATE"; envelope: W23BffWireCandidate; signal: AbortSignal };
export type W23BffClosedResponse = {
  available: false;
  status: 403 | 503;
  code: "W23_OPERATIONAL_NOT_APPROVED" | "W23_UPSTREAM_CONTRACT_INVALID";
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_REASON = /^[A-Z][A-Z0-9_]{1,59}$/;
const RESPONSE_KEYS = ["auditCount", "canGrantPermission", "decision",
  "fixtureTouches", "hasActualRecord", "legalOperationalEffect",
  "reasonCode", "requestId"].sort();

function labOnly(): boolean {
  return process.env.CI === "true" &&
    process.env.NODE_ENV === "test" &&
    process.env.TTO_LOOPBACK_E2E === "1" &&
    process.env.TTO_W1_BOUNDARY_LAB === "1" &&
    process.env.TTO_W2_OFFLINE_LAB === "1" &&
    process.env.TTO_W23_CONTRACT_LAB === "1" &&
    !process.env.VERCEL && !process.env.DATABASE_URL &&
    !process.env.TTO_API_BASE_URL && !process.env.APIIR_TOKEN &&
    !process.env.TEST_ADMIN_DATABASE_URL &&
    !process.env.TTO_DB_POOLER_HOST && !process.env.TTO_DB_APP_PASSWORD;
}
function objectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(raw: Record<string, unknown>, keys: readonly string[]): boolean {
  return JSON.stringify(Object.keys(raw).sort()) === JSON.stringify(keys);
}

/** Creates only a TEST-ONLY candidate after the existing W1 BFF gate. */
export function prepareW23DormantBffEnvelope(
  w1Preflight: W1BffResult, request: Pick<NextRequest, "signal">
): W23BffPreflight {
  if (!labOnly())
    return { kind: "DENY", status: 503, code: "W23_LAB_DISABLED" };
  if (!request || !(request.signal instanceof AbortSignal) || request.signal.aborted)
    return { kind: "DENY", status: 503, code: "W23_REQUEST_ABORTED" };
  if (!w1Preflight || w1Preflight.kind === "DENY") {
    if (w1Preflight?.kind === "DENY")
      return { kind: "DENY", status: w1Preflight.status, code: w1Preflight.reasonCode };
    return { kind: "DENY", status: 503, code: "W23_W1_PREFLIGHT_MISSING" };
  }
  const c = w1Preflight.candidate;
  if (c.contractVersion !== "W1_BFF_NEST_SEAM_V0_1" ||
      c.environment !== "SIMULATION" || c.operation !== "read" ||
      !/^coop-test-[A-Z]$/.test(c.tenantKey) ||
      !/^fixture-owner-[A-Z]$/.test(c.ownerKey))
    return { kind: "DENY", status: 405, code: "W23_OPERATION_NOT_SUPPORTED" };
  return {
    kind: "DRAFT_CANDIDATE",
    envelope: {
      contractVersion: W23_CONTRACT_VERSION,
      environment: "SIMULATION",
      operation: "read",
      tenantKey: c.tenantKey,
      ownerKey: c.ownerKey,
      requestId: randomUUID()
    },
    // AbortSignal stays in the server process, NEVER part of serialized JSON.
    signal: request.signal
  };
}

/**
 * Validate Nest's untrusted synthetic PDP verdict and ALWAYS return a closed
 * response. SIMULATED_ALLOW must never become {available:true}, HTTP 200
 * authorization, an actual record or a legal/operational permission.
 */
export function closeW23DormantBffVerdict(
  raw: unknown, expectedRequestId: string
): W23BffClosedResponse {
  const invalid: W23BffClosedResponse = {
    available: false, status: 503, code: "W23_UPSTREAM_CONTRACT_INVALID"
  };
  if (!labOnly() || !UUID.test(expectedRequestId) ||
      !objectRecord(raw) || !exactKeys(raw, RESPONSE_KEYS))
    return invalid;
  if (!UUID.test(String(raw.requestId)) || raw.requestId !== expectedRequestId ||
      (raw.decision !== "DENY" && raw.decision !== "SIMULATED_ALLOW") ||
      typeof raw.reasonCode !== "string" || !SAFE_REASON.test(raw.reasonCode) ||
      raw.canGrantPermission !== false || raw.hasActualRecord !== false ||
      raw.legalOperationalEffect !== "NONE" ||
      raw.auditCount !== 1 ||
      !Number.isSafeInteger(raw.fixtureTouches) ||
      (raw.decision === "DENY" && (raw.fixtureTouches !== 0 ||
       raw.reasonCode === "SIMULATION_ONLY")) ||
      (raw.decision === "SIMULATED_ALLOW" &&
       (raw.fixtureTouches !== 1 || raw.reasonCode !== "SIMULATION_ONLY")))
    return invalid;

  // Valid policy candidate and a positive test decision still cannot grant.
  return { available: false, status: 403, code: "W23_OPERATIONAL_NOT_APPROVED" };
}
