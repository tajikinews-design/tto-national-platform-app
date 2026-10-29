"""Offline tests for non-runtime W1 PDP simulator; no user records or services."""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "scripts/security/w1_pdp_simulator.py"
MATRIX = ROOT / "docs/contracts/shareholder-w1-security-test-matrix-v0.1.json"
NAV = ROOT / "docs/analysis/NAVIGATION_CONTRACT.json"

spec = importlib.util.spec_from_file_location("w1_pdp_simulator", MODULE)
assert spec is not None and spec.loader is not None
pdp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pdp)

class TestW1IsolatedPDP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
        cls.nav = json.loads(NAV.read_text(encoding="utf-8"))
        cls.base = cls.matrix["syntheticBaseline"]

    def test_01_all_fixture_expectations(self):
        for case in self.matrix["cases"]:
            with self.subTest(case=case["id"]):
                actual = pdp.decide(case["operation"], {**self.base, **case["override"]})
                self.assertEqual((actual["decision"], actual["reasonCode"]),
                                 (case["expected"], case["reason"]))
                self.assertEqual(actual["legalOperationalEffect"], "NONE")
                self.assertFalse(actual["canGrantPermission"])

    def test_02_all_runtime_like_environments_denied(self):
        positive = {**self.base, "sourceApproved":True, "sourceStatus":"APPROVED",
                    "downloadPermission":True, "exportPermission":True,
                    "writePermission":True, "reauth":True, "csrf":True,
                    "idempotency":"SYNTHETIC", "ruleSnapshot":"SYNTHETIC",
                    "paymentState":"VERIFIED", "ownershipFinalizationApproved":True}
        for env in ("PRODUCTION", "LIVE", "STAGING", "REVIEW", None, ""):
            for op in self.matrix["operationFamilies"]:
                with self.subTest(env=env, operation=op):
                    result = pdp.decide(op, {**positive, "environment":env})
                    self.assertEqual(result["decision"], "DENY")
                    self.assertEqual(result["reasonCode"], "REVIEW_ONLY")

    def test_03_minimum_context_denied(self):
        for operation in (*self.matrix["operationFamilies"], "admin"):
            self.assertEqual(pdp.decide(operation, {})["decision"], "DENY")

    def test_04_one_flag_removed_revokes_simulated_allow(self):
        positive = {**self.base, "sourceApproved":True, "sourceStatus":"APPROVED"}
        self.assertEqual(pdp.decide("read",positive)["decision"],"SIMULATED_ALLOW")
        for key in ("session","tenantMatch","partyBound","membershipSourceApproved",
                    "featureEnabled","permission","sourceApproved","sourceFresh",
                    "sourceVersion","selfResource","classificationAllowed"):
            altered=dict(positive)
            altered.pop(key)
            with self.subTest(missing=key):
                self.assertEqual(pdp.decide("read",altered)["decision"],"DENY")

    def test_05_no_policy_or_routes_enabled(self):
        self.assertEqual(self.nav["implementation_status"],"NOT_IMPLEMENTED")
        self.assertEqual(len(self.nav["roots"]),11)
        for root in self.nav["roots"]:
            self.assertIsNone(root["permission_policy"])
            self.assertIsNone(root["authoritative_routes"])

    def test_06_static_no_io_or_runtime_hooks(self):
        source=MODULE.read_text(encoding="utf-8")
        for forbidden in ("import requests", "import socket", "import psycopg",
                          "import subprocess", "fetch(", "allow_real", "API_KEY",
                          "DATABASE_URL", "from services", "from apps"):
            self.assertNotIn(forbidden,source)

if __name__=="__main__":
    unittest.main()
