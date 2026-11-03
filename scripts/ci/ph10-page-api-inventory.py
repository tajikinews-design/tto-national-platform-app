"""PH10-A: reproducible source-derived portal-to-API census. No runtime or data writes.

This is a discovery artifact, NOT proof that a route, policy or E2E passed.
Unknown canonical API mappings must remain UNKNOWN rather than inferred.
"""
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
PORTALS = ("shareholder", "cooperative-management", "national-admin")
OUTPUT = ROOT / "ph10-artifacts" / "ph10_page_api_inventory.json"

def route_path(path, app):
    rel = path.relative_to(app / "app")
    parts = list(rel.parts[:-1])
    parts = [p for p in parts if not (p.startswith("(") and p.endswith(")"))]
    return "/" + "/".join(parts)

def source_refs(text):
    # Static source-code signals only; do not mistake these for runtime evidence.
    return sorted(set(re.findall(r"""(?:fetch\s*\(|apiBaseUrl\s*\+|TTO_API_BASE_URL|/v1/tenants|/api/tenants|module-status)""", text)))

def classified_upstreams(portal, route_file):
    """Static BFF route mapping only. Never means the HTTP authorization passed."""
    text = route_file.read_text(encoding="utf-8")
    found = []
    for nav, downstream in re.findall(
        r'"(NAV-\d{2})"\s*:\s*\{path:\s*"([^"]+)"', text
    ):
        found.append({"moduleId": nav, "method": "GET",
                      "upstreamTemplate": "/v1/tenants/{tenantId}/" + downstream,
                      "classification": "DECLARED_STATIC_UPSTREAM_NOT_RUNTIME_VERIFIED"})
    if portal == "national-admin" and route_file.parts[-3:-1] == ("ph10", "[moduleId]"):
        found.append({"moduleId": "NAV-09", "method": "GET",
                      "upstreamTemplate": "/v1/tenants/{tenantId}/documents",
                      "classification": "DECLARED_STATIC_JIT_REVIEW_NOT_RUNTIME_VERIFIED"})
    return found

def main():
    entries = []
    for portal in PORTALS:
        app = ROOT / "apps" / portal
        if not (app / "app").is_dir():
            raise SystemExit("Missing portal app: " + portal)
        for page in sorted((app / "app").rglob("page.tsx")):
            source = page.read_text(encoding="utf-8")
            refs = source_refs(source)
            entries.append({
                "portal": portal,
                "route": route_path(page, app),
                "pageSource": str(page.relative_to(ROOT)),
                "integrationSignals": refs,
                "canonicalNestEndpoint": None,
                "tenantScopedAuthorizationVerified": False,
                "requiredRoleVerified": False,
                "syntheticAuthenticatedBrowserE2E": False,
                "sourceAcceptanceIds": [],
                "state": "INVENTORY_ONLY_NEEDS_CONTRACT_AND_RUNTIME_EVIDENCE"
            })
        for route in sorted((app / "app").rglob("route.ts")):
            source = route.read_text(encoding="utf-8")
            entries.append({
                "portal": portal,
                "route": route_path(route, app),
                "routeSource": str(route.relative_to(ROOT)),
                "kind": "BFF_API_ROUTE",
                "integrationSignals": source_refs(source),
                "declaredUpstreamMappings": classified_upstreams(portal, route),
                "canonicalNestEndpoint": None,
                "tenantScopedAuthorizationVerified": False,
                "requiredRoleVerified": False,
                "syntheticAuthenticatedBrowserE2E": False,
                "sourceAcceptanceIds": [],
                "state": "INVENTORY_ONLY_NEEDS_CONTRACT_AND_RUNTIME_EVIDENCE"
            })
    if not entries or not all(any(e["portal"] == p for e in entries) for p in PORTALS):
        raise SystemExit("All three portals must have indexed routes")
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "phase": "PH10-A", "schemaVersion": "1.0",
        "evidenceClass": "STATIC_SOURCE_DISCOVERY_ONLY",
        "headSha": os.environ.get("GITHUB_SHA"),
        "syntheticOnly": True,
        "fullIntegrationGreen": False,
        "routeCount": len(entries),
        "unknownCanonicalEndpointCount": len(entries),
        "staticDeclaredMappingCount": sum(len(e.get("declaredUpstreamMappings", [])) for e in entries),
        "pages": entries
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("PH10_A_STATIC_ROUTE_INVENTORY_PASS",
          json.dumps({p: sum(e["portal"] == p for e in entries) for p in PORTALS}),
          "unverified", len(entries))

if __name__ == "__main__":
    main()
