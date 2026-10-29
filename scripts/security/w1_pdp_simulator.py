"""Standalone W1 policy decision simulator.

NOT an authorization provider. NEVER import into BFF/Nest, never use with real
sessions, users, tenants, sources or records. No IO, network, database or writes.
"""
from typing import Mapping, Any

OPERATIONS = frozenset({"read", "download", "export", "write", "trade", "finalize"})
MUTATIONS = frozenset({"write", "trade", "finalize"})

def decide(operation: str, context: Mapping[str, Any]) -> dict[str, str | bool]:
    """Only DENY or SIMULATED_ALLOW. No production ALLOW path exists."""
    def result(decision: str, reason: str) -> dict[str, str | bool]:
        return {"decision": decision, "reasonCode": reason,
                "legalOperationalEffect": "NONE", "canGrantPermission": False}

    if context.get("environment") != "SIMULATION":
        return result("DENY", "REVIEW_ONLY")
    if operation not in OPERATIONS:
        return result("DENY", "UNKNOWN_OPERATION")
    if context.get("session") != "ACTIVE":
        return result("DENY", "SESSION_INVALID")
    if context.get("tenantMatch") is not True:
        return result("DENY", "TENANT_MISMATCH")
    if context.get("partyBound") is not True:
        return result("DENY", "PARTY_BINDING_INVALID")
    if context.get("membershipSourceApproved") is not True:
        return result("DENY", "MEMBERSHIP_SOURCE_NOT_APPROVED")
    if context.get("featureEnabled") is not True:
        return result("DENY", "FEATURE_DISABLED")
    if context.get("permission") is not True:
        return result("DENY", "PERMISSION_MISSING")
    if context.get("sourceApproved") is not True or context.get("sourceStatus") != "APPROVED":
        return result("DENY", "LEGAL_SOURCE_NOT_APPROVED")
    if context.get("sourceFresh") is not True:
        return result("DENY", "SOURCE_FRESHNESS_INVALID")
    if not isinstance(context.get("sourceVersion"), str) or not context["sourceVersion"].strip():
        return result("DENY", "SOURCE_VERSION_MISSING")
    if context.get("selfResource") is not True:
        return result("DENY", "RESOURCE_OWNERSHIP_DENIED")
    if context.get("classificationAllowed") is not True:
        return result("DENY", "CLASSIFICATION_DENIED")
    if operation == "download" and context.get("downloadPermission") is not True:
        return result("DENY", "PERMISSION_MISSING")
    if operation == "export" and context.get("exportPermission") is not True:
        return result("DENY", "PERMISSION_MISSING")
    if operation in MUTATIONS:
        if context.get("writePermission") is not True:
            return result("DENY", "PERMISSION_MISSING")
        if context.get("reauth") is not True:
            return result("DENY", "REAUTH_REQUIRED")
        if context.get("csrf") is not True:
            return result("DENY", "CSRF_INVALID")
        if not isinstance(context.get("idempotency"), str) or not context["idempotency"].strip():
            return result("DENY", "IDEMPOTENCY_MISSING")
        if context.get("versionMatched") is not True:
            return result("DENY", "VERSION_CONFLICT")
    if operation in {"trade", "finalize"} and not context.get("ruleSnapshot"):
        return result("DENY", "RULE_REGISTRY_MISSING")
    if operation == "finalize":
        if context.get("paymentState") != "VERIFIED":
            return result("DENY", "PAYMENT_NOT_VERIFIED")
        if context.get("ownershipFinalizationApproved") is not True:
            return result("DENY", "OWNERSHIP_FINALIZATION_NOT_AUTHORIZED")
    return result("SIMULATED_ALLOW", "SIMULATION_ONLY")
