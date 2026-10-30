"""Offline PEP/PDP integration contract tests; fixture-only, never real data."""
import json
import unittest
from pathlib import Path
from scripts.security.w1_pep_simulator import MemoryAudit, SyntheticFixture, enforce

ROOT = Path(__file__).resolve().parents[2]
MATRIX = ROOT / "docs/contracts/shareholder-w1-security-test-matrix-v0.1.json"

class FaultingAudit:
    def record(self, *_args):
        raise RuntimeError("AUDIT_UNAVAILABLE")

class TestW1IsolatedPEP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
        cls.base = cls.matrix["syntheticBaseline"]

    def evaluate(self, operation, context, audit=None, fixture=None):
        audit = audit if audit is not None else MemoryAudit()
        fixture = fixture if fixture is not None else SyntheticFixture()
        return enforce(operation, context, fixture, audit), fixture, audit

    def test_01_denied_requests_never_touch_resource(self):
        for case in self.matrix["cases"]:
            if case["expected"] != "DENY":
                continue
            with self.subTest(case=case["id"]):
                result, fixture, audit = self.evaluate(
                    case["operation"], {**self.base, **case["override"]})
                self.assertEqual(result["decision"], "DENY")
                self.assertIsNone(result["data"])
                self.assertEqual(fixture.touches, 0)
                self.assertEqual(audit.events[0]["reasonCode"], case["reason"])
                self.assertEqual(len(audit.events), 1)

    def test_02_synthetic_only_allow_is_not_operational(self):
        for case in self.matrix["cases"]:
            if case["expected"] != "SIMULATED_ALLOW":
                continue
            with self.subTest(case=case["id"]):
                result, fixture, audit = self.evaluate(
                    case["operation"], {**self.base, **case["override"]})
                self.assertEqual(result["decision"], "SIMULATED_ALLOW")
                self.assertEqual(result["legalOperationalEffect"], "NONE")
                self.assertIs(result["canGrantPermission"], False)
                self.assertEqual(result["data"]["kind"], "SYNTHETIC_DEMO")
                self.assertIsNone(result["data"]["record"])
                self.assertIs(result["data"]["persisted"], False)
                self.assertEqual(fixture.touches, 1)
                self.assertEqual(len(audit.events), 1)

    def test_03_read_is_not_download_export_or_write(self):
        good = {**self.base, "sourceApproved": True, "sourceStatus": "APPROVED"}
        self.assertEqual(self.evaluate("read", good)[0]["decision"], "SIMULATED_ALLOW")
        for operation in ("download", "export", "write", "trade", "finalize"):
            result, fixture, _ = self.evaluate(operation, good)
            with self.subTest(operation=operation):
                self.assertEqual(result["decision"], "DENY")
                self.assertEqual(fixture.touches, 0)

    def test_04_tenant_and_ownership_boundary(self):
        good = {**self.base, "sourceApproved": True, "sourceStatus": "APPROVED"}
        for name, fields in (("TENANT", {"tenantMatch": False}),
                             ("PARTY", {"partyBound": False}),
                             ("OTHER_OWNER", {"selfResource": False})):
            result, fixture, _ = self.evaluate("read", {**good, **fields})
            with self.subTest(name=name):
                self.assertEqual(result["decision"], "DENY")
                self.assertEqual(fixture.touches, 0)

    def test_05_audit_is_allowlisted_and_has_tracking_id(self):
        good = {**self.base, "sourceApproved": True, "sourceStatus": "APPROVED"}
        good.update(subjectId="PRIVATE_SUBJECT", tenantId="PRIVATE_TENANT",
                    token="PRIVATE_TOKEN", payload="PRIVATE_PAYLOAD")
        result, _, audit = self.evaluate("read", good)
        self.assertEqual(set(audit.events[0]), {"requestId","operation","decision","reasonCode"})
        self.assertEqual(result["requestId"], audit.events[0]["requestId"])
        self.assertEqual(len(result["requestId"]), 36)
        self.assertNotIn("PRIVATE_SUBJECT", str(audit.events))
        self.assertNotIn("PRIVATE_TENANT", str(audit.events))
        self.assertNotIn("PRIVATE_TOKEN", str(audit.events))
        self.assertNotIn("PRIVATE_PAYLOAD", str(audit.events))

    def test_06_audit_failure_denies_before_resource_touch(self):
        good = {**self.base, "sourceApproved": True, "sourceStatus": "APPROVED"}
        result, fixture, _ = self.evaluate("read", good, audit=FaultingAudit())
        self.assertEqual(result["decision"], "DENY")
        self.assertEqual(result["reasonCode"], "AUDIT_UNAVAILABLE")
        self.assertEqual(fixture.touches, 0)

    def test_07_live_and_stage_environments_never_touch_resource(self):
        good = {**self.base, "sourceApproved": True, "sourceStatus": "APPROVED"}
        for environment in ("LIVE","PRODUCTION","STAGING","REVIEW",None):
            result, fixture, _ = self.evaluate("read", {**good, "environment": environment})
            with self.subTest(environment=environment):
                self.assertEqual(result["decision"], "DENY")
                self.assertEqual(fixture.touches, 0)

    def test_08_malformed_inputs_fail_closed(self):
        for operation, context in ((None,{}), ([],{}), ("read",None),
                                   ("delete",{}), ("read",[])):
            result, fixture, audit = self.evaluate(operation, context)
            with self.subTest(operation=str(operation)):
                self.assertEqual(result["decision"], "DENY")
                self.assertEqual(fixture.touches, 0)
                self.assertEqual(len(audit.events), 1)

    def test_09_existing_authoritative_routes_stay_unapproved(self):
        contract=json.loads((ROOT/"docs/analysis/NAVIGATION_CONTRACT.json").read_text(encoding="utf-8"))
        self.assertEqual(len(contract["roots"]),11)
        for root in contract["roots"]:
            self.assertIsNone(root["authoritative_routes"])
            self.assertIsNone(root["permission_policy"])

if __name__=="__main__":
    unittest.main()
