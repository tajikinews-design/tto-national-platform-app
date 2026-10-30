/**
 * W1 Nest service seam — SYNTHETIC CONTRACT ONLY.
 *
 * Co-located with the real Nest service sources so its types can be checked
 * by tsc, but NEVER registered in AppModule or imported by any live controller.
 * Trusted proof MUST be created by a server-side authoritative verifier if a
 * future separately authorized implementation is ever built. Here it is ONLY
 * an in-memory lab fixture. No DB, OTP, source connector or actual permission.
 */
export const W1_NEST_SEAM_VERSION = "W1_BFF_NEST_SEAM_V0_1" as const;
export type W1Operation = "read" | "download" | "export" | "write" | "trade" | "finalize";
export type W1ServerLabProof = {
  sessionActive: boolean;
  tenantKey: string;
  ownerKey: string;
  partyBound: boolean;
  membershipSourceApproved: boolean;
  featureEnabled: boolean;
  readPermission: boolean;
  sourceApproved: boolean;
  sourceFresh: boolean;
  sourceVersion: string;
  classificationAllowed: boolean;
  downloadPermission: boolean;
  exportPermission: boolean;
  writePermission: boolean;
};
export type W1PdpContext = {
  environment: "SIMULATION";
  session: "ACTIVE";
  tenantMatch: true;
  partyBound: true;
  membershipSourceApproved: true;
  featureEnabled: boolean;
  permission: boolean;
  sourceApproved: boolean;
  sourceStatus: "APPROVED";
  sourceFresh: boolean;
  sourceVersion: string;
  selfResource: true;
  classificationAllowed: boolean;
  downloadPermission: boolean;
  exportPermission: boolean;
  writePermission: boolean;
  reauth: false;
  csrf: false;
  idempotency: null;
  versionMatched: false;
  ruleSnapshot: null;
  paymentState: "NONE";
  ownershipFinalizationApproved: false;
};
export type W1NestSeamResult =
  { kind: "DENY"; reasonCode: string; status: 403 | 503 } |
  { kind: "PEP_CANDIDATE"; operation: W1Operation; context: W1PdpContext };

const TENANT = /^coop-test-[A-Z]$/;
const OWNER = /^fixture-owner-[A-Z]$/;
const OPERATIONS = ["read", "download", "export", "write", "trade", "finalize"];

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

/**
 * Independently re-check BFF's candidate against SERVER-side synthetic proof.
 * Even an internal bearer/header is not accepted as tenant or owner authority.
 * This function cannot grant a real source, permission or business operation.
 */
export function verifyW1SyntheticNestCandidate(
  input: unknown,
  serverProof: W1ServerLabProof
): W1NestSeamResult {
  const deny = (reasonCode: string): W1NestSeamResult =>
    ({ kind: "DENY", status: 403, reasonCode });
  if (!labOnly()) return { kind: "DENY", status: 503, reasonCode: "LAB_DISABLED" };
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      !serverProof || typeof serverProof !== "object")
    return deny("CANDIDATE_INVALID");
  const r = input as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  if (JSON.stringify(keys) !== JSON.stringify([
    "contractVersion", "environment", "operation", "ownerKey", "tenantKey"
  ]) ||
      r.contractVersion !== W1_NEST_SEAM_VERSION ||
      r.environment !== "SIMULATION" ||
      typeof r.tenantKey !== "string" || !TENANT.test(r.tenantKey) ||
      typeof r.ownerKey !== "string" || !OWNER.test(r.ownerKey) ||
      typeof r.operation !== "string" || !OPERATIONS.includes(r.operation))
    return deny("CANDIDATE_INVALID");
  if (serverProof.sessionActive !== true)
    return deny("SESSION_INVALID");
  if (r.tenantKey !== serverProof.tenantKey)
    return deny("TENANT_MISMATCH");
  if (r.ownerKey !== serverProof.ownerKey)
    return deny("RESOURCE_OWNERSHIP_DENIED");
  if (serverProof.partyBound !== true)
    return deny("PARTY_BINDING_INVALID");
  if (serverProof.membershipSourceApproved !== true ||
      serverProof.sourceApproved !== true)
    return deny("LEGAL_SOURCE_NOT_APPROVED");
  if (serverProof.sourceFresh !== true ||
      typeof serverProof.sourceVersion !== "string" ||
      !/^SYNTHETIC-V[1-9][0-9]*$/.test(serverProof.sourceVersion))
    return deny("SOURCE_VERSION_INVALID");
  if (serverProof.classificationAllowed !== true)
    return deny("CLASSIFICATION_DENIED");
  if (serverProof.featureEnabled !== true)
    return deny("FEATURE_DISABLED");

  return {
    kind: "PEP_CANDIDATE",
    operation: r.operation as W1Operation,
    context: {
      environment: "SIMULATION",
      session: "ACTIVE",
      tenantMatch: true,
      partyBound: true,
      membershipSourceApproved: true,
      featureEnabled: serverProof.featureEnabled,
      permission: serverProof.readPermission === true,
      sourceApproved: true,
      sourceStatus: "APPROVED",
      sourceFresh: true,
      sourceVersion: serverProof.sourceVersion,
      selfResource: true,
      classificationAllowed: true,
      downloadPermission: serverProof.downloadPermission === true,
      exportPermission: serverProof.exportPermission === true,
      writePermission: serverProof.writePermission === true,
      // Mutating operations have no synthetic authorization in this phase:
      reauth: false, csrf: false, idempotency: null, versionMatched: false,
      ruleSnapshot: null, paymentState: "NONE",
      ownershipFinalizationApproved: false
    }
  };
}
