#!/usr/bin/env python3
"""Pure synthetic-only policy contract simulator. NOT a production authorization engine."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MATRIX = ROOT / "docs/contracts/shareholder-w1-security-test-matrix-v0.1.json"
DESIGN = ROOT / "docs/contracts/shareholder-w1-operational-gates-design-v0.1.json"
APPROVED = ROOT / "docs/analysis/NAVIGATION_CONTRACT.json"
SOURCE = ROOT / "docs/contracts/shareholder-source-readiness-phase4d-v1.json"

def decide(operation, context):
    """Simulation cannot grant operational rights. The maximum result is SIMULATED_ALLOW."""
    c = context
    if c.get("environment") != "SIMULATION":
        return "DENY", "REVIEW_ONLY"
    if c.get("session") != "ACTIVE":
        return "DENY", "SESSION_INVALID"
    if c.get("tenantMatch") is not True:
        return "DENY", "TENANT_MISMATCH"
    if c.get("partyBound") is not True:
        return "DENY", "PARTY_BINDING_INVALID"
    if c.get("membershipSourceApproved") is not True:
        return "DENY", "MEMBERSHIP_SOURCE_NOT_APPROVED"
    if c.get("featureEnabled") is not True:
        return "DENY", "FEATURE_DISABLED"
    if c.get("permission") is not True:
        return "DENY", "PERMISSION_MISSING"
    if c.get("sourceApproved") is not True or c.get("sourceStatus") != "APPROVED":
        return "DENY", "LEGAL_SOURCE_NOT_APPROVED"
    if c.get("sourceFresh") is not True:
        return "DENY", "SOURCE_FRESHNESS_INVALID"
    if not c.get("sourceVersion"):
        return "DENY", "SOURCE_VERSION_MISSING"
    if c.get("selfResource") is not True:
        return "DENY", "RESOURCE_OWNERSHIP_DENIED"
    if c.get("classificationAllowed") is not True:
        return "DENY", "CLASSIFICATION_DENIED"
    if operation == "download" and c.get("downloadPermission") is not True:
        return "DENY", "PERMISSION_MISSING"
    if operation == "export" and c.get("exportPermission") is not True:
        return "DENY", "PERMISSION_MISSING"
    if operation in ("write", "trade", "finalize"):
        if c.get("writePermission") is not True:
            return "DENY", "PERMISSION_MISSING"
        if c.get("reauth") is not True:
            return "DENY", "REAUTH_REQUIRED"
        if c.get("csrf") is not True:
            return "DENY", "CSRF_INVALID"
        if not c.get("idempotency"):
            return "DENY", "IDEMPOTENCY_MISSING"
        if c.get("versionMatched") is not True:
            return "DENY", "VERSION_CONFLICT"
    if operation in ("trade", "finalize") and not c.get("ruleSnapshot"):
        return "DENY", "RULE_REGISTRY_MISSING"
    if operation == "finalize":
        if c.get("paymentState") != "VERIFIED":
            return "DENY", "PAYMENT_NOT_VERIFIED"
        if c.get("ownershipFinalizationApproved") is not True:
            return "DENY", "OWNERSHIP_FINALIZATION_NOT_AUTHORIZED"
    if operation not in ("read", "download", "export", "write", "trade", "finalize"):
        return "DENY", "UNKNOWN_OPERATION"
    return "SIMULATED_ALLOW", "SIMULATION_ONLY"

class TestOperationalGateContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
        cls.design = json.loads(DESIGN.read_text(encoding="utf-8"))
        cls.nav = json.loads(APPROVED.read_text(encoding="utf-8"))
        cls.source = json.loads(SOURCE.read_text(encoding="utf-8"))

    def test_01_design_never_changes_live_contract(self):
        self.assertEqual(self.nav["implementation_status"], "NOT_IMPLEMENTED")
        self.assertTrue(all(r["permission_policy"] is None and r["authoritative_routes"] is None for r in self.nav["roots"]))
        self.assertFalse(self.design["canGrantPermission"])
        self.assertIsNone(self.design["permissionPolicy"])
        self.assertIsNone(self.design["authorizedRoutes"])
        self.assertFalse(self.design["runtimeActivationRequested"])
        self.assertFalse(self.design["releaseAuthorization"])
        self.assertEqual(self.matrix["liveAuthorization"], "FORBIDDEN")
        self.assertFalse(self.matrix["canGrantPermission"])

    def test_02_all_eleven_navigation_ids_covered(self):
        canonical = {r["code"] for r in self.nav["roots"]}
        proposed = {r["navId"] for r in self.design["roots"]}
        self.assertEqual(canonical, proposed)
        self.assertEqual(len(proposed), 11)
        for root in self.design["roots"]:
            self.assertEqual(root["status"], "DESIGN_ONLY")
            self.assertFalse(root["runtimeEnabled"])
            self.assertIsNone(root["permissionApprovalRef"])
            self.assertIsNone(root["routeApprovalRef"])
            self.assertIsNone(root["legalApprovalRef"])
            self.assertIsNone(root["sourceApprovalRef"])

    def test_03_sources_remain_unapproved(self):
        self.assertEqual(self.source["approvalState"], "NO_LIVE_SOURCE_APPROVAL")
        self.assertFalse(self.source["runtimeActivationRequested"])
        self.assertEqual(len(self.source["sourceDomains"]), 2)
        self.assertEqual([len(x["evidence"]) for x in self.source["sourceDomains"]], [9, 10])
        for domain in self.source["sourceDomains"]:
            self.assertFalse(domain["liveDataEnabled"])
            self.assertTrue(all(e["status"] == "PENDING" for e in domain["evidence"]))

    def test_04_matrix_has_unique_cases_and_constrained_schema(self):
        self.assertEqual(self.matrix["status"], "SYNTHETIC_ONLY")
        self.assertEqual(self.matrix["engine"], "STANDALONE_CONTRACT_SIMULATOR_NOT_RUNTIME")
        self.assertEqual(self.matrix["default"], "DENY")
        self.assertIsNone(self.matrix["approvedRoutes"])
        self.assertIsNone(self.matrix["approvedPolicy"])
        self.assertGreaterEqual(len(self.matrix["cases"]), 25)
        self.assertEqual(len({x["id"] for x in self.matrix["cases"]}), len(self.matrix["cases"]))

    def test_05_all_declared_attack_and_positive_simulation_cases(self):
        base = self.matrix["syntheticBaseline"]
        for case in self.matrix["cases"]:
            with self.subTest(case=case["id"]):
                ctx = dict(base, **case["override"])
                actual, reason = decide(case["operation"], ctx)
                self.assertEqual((actual, reason), (case["expected"], case["reason"]))
                self.assertNotEqual(actual, "ALLOW")

    def test_06_live_environment_always_denied_even_with_approvals(self):
        base = dict(self.matrix["syntheticBaseline"], sourceApproved=True, sourceStatus="APPROVED",
                    membershipSourceApproved=True, writePermission=True, reauth=True, csrf=True,
                    idempotency="synthetic", ruleSnapshot="synthetic", paymentState="VERIFIED",
                    ownershipFinalizationApproved=True)
        for operation in self.matrix["operationFamilies"]:
            for environment in ("LIVE", "STAGING", "REVIEW", None, ""):
                with self.subTest(op=operation, env=environment):
                    self.assertEqual(decide(operation, dict(base, environment=environment)),
                                     ("DENY", "REVIEW_ONLY"))

    def test_07_unknown_operations_are_denied(self):
        good = dict(self.matrix["syntheticBaseline"], sourceApproved=True, sourceStatus="APPROVED")
        self.assertEqual(decide("admin-delete", good), ("DENY", "UNKNOWN_OPERATION"))

if __name__ == "__main__":
    unittest.main()
