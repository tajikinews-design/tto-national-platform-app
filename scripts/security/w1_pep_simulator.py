"""Isolated in-memory Policy Enforcement Point (PEP) demonstration.

Non-runtime: no route registration, database, network, filesystem access or real
resources. SIMULATED_ALLOW is not operational authority. This module must never
be imported into a production BFF/Nest service or used with user data.
"""
from dataclasses import dataclass, field
from uuid import uuid4

from scripts.security.w1_pdp_simulator import decide

READ_OPS = frozenset({"read", "download", "export"})
OPERATIONS = READ_OPS | frozenset({"write", "trade", "finalize"})

@dataclass
class SyntheticFixture:
    """No real record lookup or mutation capability."""
    touches: int = 0
    def sample(self, operation: str) -> dict[str, object]:
        self.touches += 1
        return {"kind": "SYNTHETIC_DEMO", "operation": operation,
                "record": None, "persisted": False, "operationalEffect": False}

@dataclass
class MemoryAudit:
    """Allowlisted metadata only. Never stores subject, tenant, source, token or payload."""
    events: list[dict[str, object]] = field(default_factory=list)
    def record(self, correlation_id: str, operation: str, outcome: str, reason: str) -> None:
        self.events.append({"requestId": correlation_id, "operation": operation,
                            "decision": outcome, "reasonCode": reason})

def enforce(operation: str, context: dict[str, object],
            fixture: SyntheticFixture, audit: MemoryAudit) -> dict[str, object]:
    """Fail closed before source touch. No real ALLOW result under any inputs."""
    request_id = str(uuid4())
    verdict: dict[str, object] = {"decision": "DENY", "reasonCode": "PEP_FAILURE",
                                   "legalOperationalEffect": "NONE",
                                   "canGrantPermission": False}
    try:
        # Exception and malformed inputs always deny without inspecting any resource.
        if not isinstance(context, dict) or not isinstance(operation, str):
            verdict["reasonCode"] = "INVALID_REQUEST"
        elif operation not in OPERATIONS:
            verdict["reasonCode"] = "UNKNOWN_OPERATION"
        else:
            candidate = decide(operation, context)
            if (type(candidate) is dict
                    and candidate.get("decision") in ("DENY", "SIMULATED_ALLOW")
                    and candidate.get("legalOperationalEffect") == "NONE"
                    and candidate.get("canGrantPermission") is False
                    and isinstance(candidate.get("reasonCode"), str)):
                verdict = candidate
    except Exception:
        verdict = {"decision": "DENY", "reasonCode": "PEP_FAILURE",
                   "legalOperationalEffect": "NONE", "canGrantPermission": False}

    # Audit is only an in-memory synthetic demonstration, not a production audit.
    # An audit sink failure blocks the action, rather than allowing unaudited access.
    try:
        audit.record(request_id, operation if isinstance(operation, str) and operation in OPERATIONS else "unknown",
                     str(verdict["decision"]), str(verdict["reasonCode"]))
    except Exception:
        return {"requestId": request_id, "decision": "DENY",
                "reasonCode": "AUDIT_UNAVAILABLE", "legalOperationalEffect": "NONE",
                "canGrantPermission": False, "data": None}

    response: dict[str, object] = {"requestId": request_id,
               "decision": verdict["decision"], "reasonCode": verdict["reasonCode"],
               "legalOperationalEffect": "NONE", "canGrantPermission": False, "data": None}
    if verdict["decision"] == "SIMULATED_ALLOW":
        # Only a predefined in-memory demo object is reachable. Even 'write' here
        # only yields a marker and cannot change an actual account or share ledger.
        try:
            response["data"] = fixture.sample(operation)
        except Exception:
            response.update(decision="DENY", reasonCode="FIXTURE_UNAVAILABLE", data=None)
            audit.events[-1].update(decision="DENY", reasonCode="FIXTURE_UNAVAILABLE")
    return response
