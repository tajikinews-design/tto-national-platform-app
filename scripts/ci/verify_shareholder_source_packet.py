"""Frozen fail-closed admission policy for the review packet, NOT an approval engine.

This validator deliberately cannot approve or activate a source. A future,
independently signed legal decision needs a separate reviewed change; editing
this JSON cannot enable live source reads, publication or trading.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PACKET = ROOT / "docs/contracts/shareholder-source-authority-readiness-v1.json"
EXPECTED = {
    "CHILD07": (
        "trade-requests", "TTO-SHARE-CAPITAL-MARKET-IMPLEMENTATION",
        frozenset({
            "AUTHORITATIVE_SOURCE_OWNER_APPROVAL",
            "CF02_VERIFIED_SESSION_TENANT_PARTY_BINDING",
            "CHILD06_SHAREHOLDER_ELIGIBILITY",
            "CF04_EFFECTIVE_TENANT_RULE_SNAPSHOT",
            "CHILD07_VERSIONED_REQUEST_EVENT_AND_REPLAY_CONTRACT",
            "CF03_EVIDENCE_RETENTION_AUDIT",
            "INDEPENDENT_RLS_RECIPIENT_AND_REVOCATION_E2E",
        }),
    ),
    "CHILD09": (
        "notices", "TTO-COMMUNICATIONS-NOTICE-IMPLEMENTATION",
        frozenset({
            "AUTHORITATIVE_PUBLISHER_APPROVAL",
            "CF02_VERIFIED_SESSION_TENANT_PARTY_BINDING",
            "CF04_PUBLICATION_AND_CLASSIFICATION_RULE_SNAPSHOT",
            "CHILD09_VERSIONED_PUBLISHED_ITEM",
            "CHILD09_FROZEN_RECIPIENT_SNAPSHOT_AND_ACL",
            "CHILD09_DELIVERED_READ_ACKNOWLEDGED_SEPARATION",
            "CF03_EVIDENCE_RETENTION_AUDIT",
            "INDEPENDENT_RLS_RECIPIENT_AND_REVOCATION_E2E",
        }),
    ),
}

def validate_blocked_packet(packet: Any) -> list[str]:
    """Require an exact, closed review skeleton. Never returns 'approved'."""
    problems: list[str] = []
    if not isinstance(packet, dict):
        return ["packet must be an object"]
    for key, wanted in (
        ("schemaVersion", "1.0"),
        ("packetType", "SOURCE_AUTHORITY_READINESS_NOT_ACTIVATION"),
        ("project", "TTO_NATIONAL_PLATFORM"),
        ("workstream", "SHAREHOLDER_READ_MODELS_PHASE2B"),
        ("authorizationState", "LEGAL_AND_SOURCE_NOT_APPROVED"),
        ("runtimeActivationSupported", False),
        ("tenantScopedApprovalRequired", True),
        ("decisionAuthority", "EXTERNAL_LEGAL_SOURCE_OWNER_AND_DATA_GOVERNANCE_REVIEW"),
    ):
        if packet.get(key) != wanted:
            problems.append("invalid block state or scope: " + key)
    expected_non_authority = {
        "GITHUB_MERGE", "CI_PASS", "TEST_FIXTURE", "VERIFIED_SESSION",
        "TENANT_ROLE", "DOCUMENT_PUBLICATION_ALONE", "SMS_DELIVERY",
    }
    rejected = packet.get("neverDeriveApprovalFrom")
    if not isinstance(rejected, list) or set(rejected) != expected_non_authority or len(rejected) != len(expected_non_authority):
        problems.append("approval non-authority exclusions incomplete")
    base = packet.get("baseEvidence")
    if not isinstance(base, dict) or base.get("phase2aCommit") != "707a45fc3de09e05c0e0ba2b3219d85f66a24981" or base.get("localRelease") != "PASS_NO_REAL_DATA":
        problems.append("phase2A baseline evidence changed")
    domains = packet.get("domains")
    if not isinstance(domains, list) or len(domains) != 2:
        return problems + ["expected exactly two independent source domains"]
    seen: set[str] = set()
    for d in domains:
        if not isinstance(d, dict):
            problems.append("domain must be an object")
            continue
        source = d.get("sourceDomain")
        if not isinstance(source, str) or source not in EXPECTED or source in seen:
            problems.append("unrecognized or duplicated source domain")
            continue
        seen.add(source)
        route, contract, controls_expected = EXPECTED[source]
        if d.get("route") != route or d.get("sourceContract") != contract:
            problems.append("domain route/owner mismatch: " + source)
        if d.get("decision") != "BLOCKED":
            problems.append("legal authority approval must remain blocked: " + source)
        if d.get("publicationOrTradingWritesAllowed") is not False:
            problems.append("write permission must remain false: " + source)
        conn = d.get("sourceConnection")
        if not isinstance(conn, dict) or conn != {"status": "NOT_IMPLEMENTED", "endpoint": None, "credentialRef": None}:
            problems.append("live source connection must remain absent: " + source)
        controls = d.get("requiredEvidence")
        if not isinstance(controls, list) or len(controls) != len(controls_expected):
            problems.append("incomplete evidence checklist: " + source)
            continue
        ids = [c.get("controlId") for c in controls if isinstance(c, dict)]
        if len(ids) != len(controls_expected) or set(ids) != controls_expected or len(set(ids)) != len(ids):
            problems.append("invalid evidence control identities: " + source)
        for c in controls:
            if not isinstance(c, dict) or c.get("status") != "PENDING" or any(
                c.get(k) is not None for k in ("evidenceRef", "reviewedBy", "reviewedAt")
            ):
                problems.append("premature evidence approval/claim: " + source)
    if seen != set(EXPECTED):
        problems.append("missing source domain")
    return problems

def main() -> None:
    packet = json.loads(PACKET.read_text(encoding="utf-8"))
    errors = validate_blocked_packet(packet)
    if errors:
        raise SystemExit("TTO_SOURCE_ACCEPTANCE_GATE_FAIL: " + "; ".join(errors))
    print("TTO_SOURCE_ACCEPTANCE_REVIEW_PACKET_BLOCKED_PASS")

if __name__ == "__main__":
    main()
