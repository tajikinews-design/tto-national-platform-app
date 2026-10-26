"""Phase 4D: independent, deliberately NON-ACTIVATING Child06/Child07 intake gate.

Validates a frozen, redacted readiness skeleton. It never verifies a real legal
approval, signs evidence, sets PostgreSQL authorization, or activates an adapter.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PACKET = ROOT / "docs/contracts/shareholder-source-readiness-phase4d-v1.json"
PREVIOUS_PACKET = ROOT / "docs/contracts/shareholder-source-authority-readiness-v1.json"
BASE_SHA = "d78f2d6ca1ca15f99301776501aeadf163e5a0ad"

EVIDENCE_FIELDS = frozenset({"controlId", "status", "evidenceRef", "reviewedBy", "reviewedAt"})
DOMAIN_FIELDS = frozenset({
    "domain", "route", "officialOwner", "tenantId", "sourceRef",
    "ruleSnapshotRef", "authorityEvidenceId", "independentApprover",
    "approvalValidUntil", "authorizedReadOnly", "liveDataEnabled",
    "writesAllowed", "currentReadBoundary", "sourceTables",
    "requiredResponseFields", "requirements", "evidence",
})
EXPECTED = {
    "CHILD06_MEMBERSHIP": {
        "route": "member-record",
        "boundary": "POSTGRES_TTO_MY_MEMBER_PROFILE_FROM_SOURCE",
        "tables": (
            "tto.member_source_snapshots", "tto.relationship_projections",
            "tto.source_contract_approvals",
        ),
        "fields": ("membershipStatus", "partyKind", "sourceVersion", "sourceAsOf"),
        "controls": frozenset({
            "TENANT_PARTY_NOT_USER_EQUIVALENCE",
            "ACTIVE_MEMBERSHIP_NEEDS_AUTHORITATIVE_SOURCE",
            "SOURCE_EVENT_ID_AND_VERSION_PROVENANCE",
            "NO_ROLE_AS_MEMBERSHIP_EVIDENCE",
            "SOURCE_BATCH_ATTESTATION_REPLAY_CONTROL",
            "REVOKED_SESSION_AND_TENANT_RLS",
            "INDEPENDENT_LAWFUL_BASIS_DATA_MINIMIZATION",
            "INDEPENDENT_TENANT_SCOPED_APPROVAL_WITH_EXPIRY",
            "RETENTION_AUDIT_AND_SOURCE_WITHDRAWAL",
        }),
    },
    "CHILD07_HOLDINGS": {
        "route": "shareholding",
        "boundary": "POSTGRES_TTO_MY_SHAREHOLDING_FROM_SOURCE",
        "tables": (
            "tto.shareholder_source_accounts", "tto.shareholding_source_snapshots",
            "tto.source_contract_approvals",
        ),
        "fields": ("shareQuantity", "ledgerVersion", "ledgerAsOf"),
        "controls": frozenset({
            "OFFICIAL_LEDGER_OWNER_AND_LEGAL_BASIS",
            "TENANT_PARTY_TO_SHAREHOLDER_ACCOUNT_BINDING",
            "LEDGER_VERSION_ENTRY_REF_AND_AS_OF",
            "EXACT_NONNEGATIVE_INTEGER_QUANTITY_EXPLICIT_ZERO_ONLY",
            "PAYMENT_REQUEST_NOT_TRANSFER_OR_SETTLEMENT",
            "SOURCE_BATCH_ATTESTATION_STALE_AND_REPLAY",
            "MEMBERSHIP_APPROVAL_NOT_LEDGER_APPROVAL",
            "SELF_ONLY_RLS_AND_SESSION_REVOCATION",
            "INDEPENDENT_TIMEBOUND_TENANT_LEDGER_APPROVAL",
            "AUDIT_RETENTION_AND_SOURCE_WITHDRAWAL",
        }),
    },
}
PACKET_FIELDS = frozenset({
    "schemaVersion", "packetType", "project", "phase",
    "priorAcceptedLocalSha", "approvalState", "tenantSpecificApprovalRequired",
    "artifactCanGrantPermission", "runtimeActivationRequested",
    "productionConnection", "realDataPresent", "approvalAuthority",
    "neverUseAsApproval", "sourceDomains",
})
NON_AUTHORITY = frozenset({
    "CI_PASS", "GITHUB_MERGE", "SIGNED_IN_SESSION", "TENANT_ROLE",
    "MEMBERSHIP_PROJECTION", "SYNTHETIC_SOURCE_SNAPSHOT",
    "ANOTHER_SOURCE_APPROVAL", "DOCUMENT_PUBLICATION",
})
NULL_PROVENANCE = (
    "officialOwner", "tenantId", "sourceRef", "ruleSnapshotRef",
    "authorityEvidenceId", "independentApprover", "approvalValidUntil",
)

def validate(packet: Any) -> list[str]:
    """Only accepts BLOCKED/unpopulated metadata. Never grants source access."""
    if not isinstance(packet, dict):
        return ["NOT_OBJECT"]
    errors: list[str] = []
    if set(packet) != PACKET_FIELDS:
        errors.append("TOP_LEVEL_SCHEMA_DRIFT")
    exact = {
        "schemaVersion": "1.0",
        "packetType": "SHAREHOLDER_MEMBER_AND_LEDGER_SOURCE_READINESS_REVIEW_ONLY",
        "project": "TTO_NATIONAL_PLATFORM",
        "phase": "SHAREHOLDER_PHASE4D",
        "priorAcceptedLocalSha": BASE_SHA,
        "approvalState": "NO_LIVE_SOURCE_APPROVAL",
        "approvalAuthority": "INDEPENDENT_LEGAL_SOURCE_OWNER_AND_DATA_GOVERNANCE",
    }
    for key, wanted in exact.items():
        if packet.get(key) != wanted or not isinstance(packet.get(key), str):
            errors.append("INVALID_FIXED_FIELD_" + key)
    for key, wanted in (
        ("tenantSpecificApprovalRequired", True),
        ("artifactCanGrantPermission", False),
        ("runtimeActivationRequested", False),
        ("realDataPresent", False),
    ):
        if packet.get(key) is not wanted:
            errors.append("ILLEGAL_ACTIVATION_" + key)
    if packet.get("productionConnection") is not None:
        errors.append("PRODUCTION_CONNECTION_FORBIDDEN")
    non_authority = packet.get("neverUseAsApproval")
    if not isinstance(non_authority, list) or (
        len(non_authority) != len(NON_AUTHORITY)
        or any(not isinstance(x, str) for x in non_authority)
        or set(non_authority) != NON_AUTHORITY
    ):
        errors.append("NON_AUTHORITY_EXCLUSIONS_CHANGED")

    domains = packet.get("sourceDomains")
    if not isinstance(domains, list) or len(domains) != len(EXPECTED):
        return errors + ["EXPECTED_EXACTLY_TWO_INDEPENDENT_DOMAINS"]
    seen: set[str] = set()
    for domain in domains:
        if not isinstance(domain, dict):
            errors.append("DOMAIN_NOT_OBJECT")
            continue
        if set(domain) != DOMAIN_FIELDS:
            errors.append("DOMAIN_SCHEMA_DRIFT")
        key = domain.get("domain")
        if not isinstance(key, str) or key not in EXPECTED or key in seen:
            errors.append("UNKNOWN_OR_DUPLICATE_DOMAIN")
            continue
        seen.add(key)
        spec = EXPECTED[key]
        if domain.get("route") != spec["route"] or domain.get("currentReadBoundary") != spec["boundary"]:
            errors.append("ROUTE_OR_DB_BOUNDARY_MISMATCH_" + key)
        if domain.get("sourceTables") != list(spec["tables"]):
            errors.append("SOURCE_TABLES_MISMATCH_" + key)
        if domain.get("requiredResponseFields") != list(spec["fields"]):
            errors.append("SOURCE_RESPONSE_FIELDS_MISMATCH_" + key)
        if domain.get("authorizedReadOnly") is not True:
            errors.append("READ_ONLY_REQUIRED_" + key)
        if domain.get("liveDataEnabled") is not False or domain.get("writesAllowed") is not False:
            errors.append("SOURCE_OR_WRITES_PREMATURELY_ENABLED_" + key)
        for field in NULL_PROVENANCE:
            if field not in domain or domain[field] is not None:
                errors.append("UNVERIFIED_AUTHORITY_OR_PII_" + key + "_" + field)
        required = domain.get("requirements")
        controls = spec["controls"]
        if (
            not isinstance(required, list)
            or len(required) != len(controls)
            or any(not isinstance(c, str) for c in required)
            or set(required) != controls
        ):
            errors.append("REQUIREMENT_SET_INVALID_" + key)
        evidence = domain.get("evidence")
        if not isinstance(evidence, list) or len(evidence) != len(controls):
            errors.append("EVIDENCE_COUNT_INVALID_" + key)
            continue
        ids: list[str] = []
        for row in evidence:
            if not isinstance(row, dict) or set(row) != EVIDENCE_FIELDS:
                errors.append("EVIDENCE_SCHEMA_INVALID_" + key)
                continue
            ident = row.get("controlId")
            if not isinstance(ident, str):
                errors.append("EVIDENCE_CONTROL_INVALID_" + key)
            else:
                ids.append(ident)
            if row.get("status") != "PENDING":
                errors.append("EVIDENCE_APPROVAL_NOT_AUTHORIZED_" + key)
            if any(row.get(field) is not None for field in ("evidenceRef", "reviewedBy", "reviewedAt")):
                errors.append("REAL_PROVENANCE_MUST_NOT_BE_IN_REPO_" + key)
        if len(ids) != len(controls) or set(ids) != controls or len(set(ids)) != len(ids):
            errors.append("EVIDENCE_CONTROL_SET_INVALID_" + key)
    if seen != set(EXPECTED):
        errors.append("MISSING_SOURCE_DOMAIN")
    return errors

def summarize(packet: Any) -> dict[str, Any]:
    errors = validate(packet)
    if errors:
        raise ValueError("PHASE4D_SOURCE_READINESS_DENIED: " + ", ".join(errors))
    return {
        "phase": "SHAREHOLDER_PHASE4D",
        "reviewState": "BLOCKED_AWAITING_INDEPENDENT_EVIDENCE",
        "canActivateLiveSources": False,
        "sourceDomains": [
            {"domain": x["domain"], "route": x["route"],
             "controlsPending": len(x["evidence"]), "controlsApproved": 0,
             "readOnly": True}
            for x in packet["sourceDomains"]
        ],
        "totalPendingControls": sum(len(x["evidence"]) for x in packet["sourceDomains"]),
        "separateTradeAndNoticesPacket": str(PREVIOUS_PACKET.relative_to(ROOT)),
        "realPersonalData": False,
        "productionAuthorization": False,
    }

def main() -> None:
    packet = json.loads(PACKET.read_text(encoding="utf-8"))
    print(json.dumps(summarize(packet), ensure_ascii=False, sort_keys=True, indent=2))
    print("TTO_PHASE4D_SOURCE_READINESS_BLOCKED_CONTRACT_PASS")

if __name__ == "__main__":
    main()
