"""Private offline JSON bridge into the accepted synthetic-only PEP/PDP code.

Not an API and not a production authorization endpoint.
stdin: {"operation": str, "context": synthetic object}
stdout: allowlisted synthetic decision/touch counters only; never serializes input.
"""
import json
import sys
from scripts.security.w1_pep_simulator import enforce, SyntheticFixture, MemoryAudit

def main() -> int:
    try:
        raw = sys.stdin.read(8193)
        if len(raw) > 8192:
            raise ValueError("TOO_LARGE")
        request = json.loads(raw)
        if not isinstance(request, dict) or set(request) != {"operation", "context"}:
            raise ValueError("INVALID_REQUEST")
        operation = request["operation"]
        context = request["context"]
        if not isinstance(operation, str) or not isinstance(context, dict):
            raise ValueError("INVALID_REQUEST")
        fixture, audit = SyntheticFixture(), MemoryAudit()
        result = enforce(operation, context, fixture, audit)
        response = {
            "decision": result["decision"],
            "reasonCode": result["reasonCode"],
            "requestId": result["requestId"],
            "fixtureTouches": fixture.touches,
            "auditCount": len(audit.events),
            "legalOperationalEffect": "NONE",
            "canGrantPermission": False,
            "hasActualRecord": False
        }
    except Exception:
        response = {"decision": "DENY", "reasonCode": "BRIDGE_INVALID",
                    "requestId": None, "fixtureTouches": 0, "auditCount": 0,
                    "legalOperationalEffect": "NONE", "canGrantPermission": False,
                    "hasActualRecord": False}
    print(json.dumps(response, separators=(",", ":")))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
