import type { W1PdpContext, W1ServerLabProof } from "./w1-boundary-seam";

/**
 * W2.3 DORMANT Nest-side boundary contract. DO NOT import into AppModule,
 * register as a controller/provider or wire to real shareholder sources.
 *
 * Only the ephemeral CI Nest Fastify controller can use this laboratory seam.
 * A BFF envelope is NEVER an identity/owner/source approval. All authoritative
 * facts below must come from an independently trusted, in-memory TEST proof.
 */
export const W23_NEST_CONTRACT_VERSION = "W2_3_DORMANT_BOUNDARY_V0_1" as const;

export type W23WireCandidate = {
  contractVersion: typeof W23_NEST_CONTRACT_VERSION;
  environment: "SIMULATION";
  operation: "read";
  tenantKey: string;
  ownerKey: string;
  requestId: string;
};

export type W23NestDraftResult =
  | { kind: "DENY"; status: 403 | 503; code: string }
  | {
      kind: "SYNTHETIC_PDP_CANDIDATE";
      operation: "read";
      requestId: string;
      context: W1PdpContext;
      signal: AbortSignal;
    };

export type W23SyntheticPolicyVerdict = {
  decision: "DENY" | "SIMULATED_ALLOW";
  reasonCode: string;
  requestId: string;
  fixtureTouches: number;
  auditCount: 1;
  legalOperationalEffect: "NONE";
  canGrantPermission: false;
  hasActualRecord: false;
};

export type W23NestSafeVerdict =
  | { kind: "DENY"; status: 503; code: "W23_POLICY_RESPONSE_INVALID" }
  | { kind: "SIMULATED_ONLY"; verdict: W23SyntheticPolicyVerdict };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANDIDATE_KEYS = ["contractVersion", "environment", "operation",
  "ownerKey", "requestId", "tenantKey"].sort();
const POLICY_KEYS = ["auditCount", "canGrantPermission", "decision", "fixtureTouches",
  "hasActualRecord", "legalOperationalEffect", "reasonCode", "requestId"].sort();
const REASON = /^[A-Z][A-Z0-9_]{1,59}$/;

function labOnly(): boolean {
  return process.env.CI === "true" && process.env.NODE_ENV === "test" &&
    process.env.TTO_LOOPBACK_E2E === "1" &&
    process.env.TTO_W1_BOUNDARY_LAB === "1" &&
    process.env.TTO_W2_OFFLINE_LAB === "1" &&
    process.env.TTO_W23_CONTRACT_LAB === "1" &&
    !process.env.VERCEL && !process.env.DATABASE_URL &&
    !process.env.TTO_API_BASE_URL && !process.env.APIIR_TOKEN &&
    !process.env.TEST_ADMIN_DATABASE_URL &&
    !process.env.TTO_DB_POOLER_HOST && !process.env.TTO_DB_APP_PASSWORD;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keysAreExact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys);
}

/**
 * Only constructs a POLICY CANDIDATE in the detached lab. It neither opens a
 * database nor calls any source connector or returns an authorized principal.
 */
export function verifyW23DormantNestEnvelope(
  wire: unknown, serverProof: W1ServerLabProof, signal: AbortSignal
): W23NestDraftResult {
  const deny = (code: string): W23NestDraftResult =>
    ({ kind: "DENY", status: 403, code });
  if (!labOnly()) return { kind: "DENY", status: 503, code: "W23_LAB_DISABLED" };
  if (!(signal instanceof AbortSignal) || signal.aborted)
    return deny("W23_REQUEST_ABORTED");
  if (!record(wire) || !keysAreExact(wire, CANDIDATE_KEYS) ||
      wire.contractVersion !== W23_NEST_CONTRACT_VERSION ||
      wire.environment !== "SIMULATION" || wire.operation !== "read" ||
      typeof wire.tenantKey !== "string" || !/^coop-test-[A-Z]$/.test(wire.tenantKey) ||
      typeof wire.ownerKey !== "string" || !/^fixture-owner-[A-Z]$/.test(wire.ownerKey) ||
      typeof wire.requestId !== "string" || !UUID.test(wire.requestId))
    return deny("W23_CANDIDATE_INVALID");
  if (!serverProof || typeof serverProof !== "object" || serverProof.sessionActive !== true)
    return deny("SESSION_INVALID");
  if (wire.tenantKey !== serverProof.tenantKey)
    return deny("TENANT_MISMATCH");
  if (wire.ownerKey !== serverProof.ownerKey)
    return deny("RESOURCE_OWNERSHIP_DENIED");
  if (serverProof.partyBound !== true)
    return deny("PARTY_BINDING_INVALID");
  if (serverProof.membershipSourceApproved !== true || serverProof.sourceApproved !== true)
    return deny("LEGAL_SOURCE_NOT_APPROVED");
  if (serverProof.sourceFresh !== true ||
      typeof serverProof.sourceVersion !== "string" ||
      !/^SYNTHETIC-V[1-9][0-9]*$/.test(serverProof.sourceVersion))
    return deny("SOURCE_VERSION_INVALID");
  if (serverProof.classificationAllowed !== true || serverProof.featureEnabled !== true ||
      serverProof.readPermission !== true)
    return deny("PERMISSION_DENIED");
  // Reconstruct the entire policy context from server-only synthetic proof.
  // Fields from BFF/browser cannot claim a role, Party, source or permission.
  return {
    kind: "SYNTHETIC_PDP_CANDIDATE",
    operation: "read",
    requestId: wire.requestId,
    signal,
    context: {
      environment: "SIMULATION", session: "ACTIVE",
      tenantMatch: true, partyBound: true,
      membershipSourceApproved: true,
      featureEnabled: true, permission: true, sourceApproved: true,
      sourceStatus: "APPROVED", sourceFresh: true,
      sourceVersion: serverProof.sourceVersion,
      selfResource: true, classificationAllowed: true,
      downloadPermission: false, exportPermission: false,
      writePermission: false, reauth: false, csrf: false,
      idempotency: null, versionMatched: false,
      ruleSnapshot: null, paymentState: "NONE",
      ownershipFinalizationApproved: false
    }
  };
}

/**
 * Never forward raw PDP JSON. This normalizes the accepted simulator into the
 * six-field correlation envelope's requestId, and cannot grant permissions.
 * A positive simulator decision remains SIMULATED_ONLY, not runtime ALLOW.
 */
export function normalizeW23SyntheticNestPolicyVerdict(
  raw: unknown, expectedRequestId: string, signal: AbortSignal
): W23NestSafeVerdict {
  const invalid: W23NestSafeVerdict = {
    kind: "DENY", status: 503, code: "W23_POLICY_RESPONSE_INVALID"
  };
  if (!labOnly() || !(signal instanceof AbortSignal) || signal.aborted ||
      !UUID.test(expectedRequestId) || !record(raw) || !keysAreExact(raw, POLICY_KEYS))
    return invalid;
  if (raw.decision !== "DENY" && raw.decision !== "SIMULATED_ALLOW") return invalid;
  if (typeof raw.requestId !== "string" || !UUID.test(raw.requestId) ||
      typeof raw.reasonCode !== "string" || !REASON.test(raw.reasonCode) ||
      raw.hasActualRecord !== false || raw.canGrantPermission !== false ||
      raw.legalOperationalEffect !== "NONE" || raw.auditCount !== 1 ||
      !Number.isSafeInteger(raw.fixtureTouches) ||
      (raw.decision === "DENY" &&
       (raw.fixtureTouches !== 0 || raw.reasonCode === "SIMULATION_ONLY")) ||
      (raw.decision === "SIMULATED_ALLOW" &&
       (raw.fixtureTouches !== 1 || raw.reasonCode !== "SIMULATION_ONLY")))
    return invalid;

  return {
    kind: "SIMULATED_ONLY",
    verdict: {
      decision: raw.decision,
      reasonCode: raw.reasonCode,
      requestId: expectedRequestId,
      fixtureTouches: raw.fixtureTouches as number,
      auditCount: 1,
      legalOperationalEffect: "NONE", canGrantPermission: false,
      hasActualRecord: false
    }
  };
}
