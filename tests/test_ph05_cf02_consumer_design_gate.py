"""Design-only PR #158 source lock checks, not a PostgreSQL/HTTP execution result."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "docs/architecture/PH05_CF02_CHILD06_CONSUMER_GATE_V1.json"
MIGRATION = ROOT / "database/migrations/0023_cf02_child06_relationship_projector_lab.sql"
DOMAIN = ROOT / "docs/architecture/PH02_23_DOMAIN_OWNERSHIP_EVENT_CONTRACT.json"

class ConsumerGateContract(unittest.TestCase):
    def test_contract_remains_disabled_pending_approvals(self):
        x = json.loads(SPEC.read_text(encoding="utf-8"))
        self.assertEqual(x["status"], "PROPOSED_NOT_APPROVED_NOT_ENABLED")
        self.assertFalse(x["default_enabled"])
        self.assertFalse(x["runtime_ready"])
        self.assertFalse(x["principal"]["approved"])
        self.assertFalse(x["delivery"]["queue_and_lease_implementation_approved"])
        self.assertEqual(x["principal"]["allowed_runtime_grants"], [])
        self.assertEqual([t["id"] for t in x["test_cases"]], [f"CONS-{n:02d}" for n in range(1,13)])
        self.assertTrue(all(t["status"] == "NOT_RUN" for t in x["test_cases"]))
        self.assertEqual(set(x["canonical_acceptance"].values()), {"NOT_RUN"})

    def test_owner_and_event_names_match_frozen_source(self):
        x = json.loads(SPEC.read_text(encoding="utf-8"))
        y = json.loads(DOMAIN.read_text(encoding="utf-8"))
        self.assertEqual(x["source_sha"], y["source_sha"])
        c6 = next(d for d in y["domains"] if d["child"] == "CHILD-06")
        c2 = next(d for d in y["domains"] if d["child"] == "CHILD-02")
        self.assertEqual(x["owner"], {"source": c6["child"], "read_model": "CF02"})
        self.assertTrue(set(x["permitted_events"]).issubset(c6["event_contracts"]))
        self.assertIn("COOPERATIVE_RELATIONSHIP_PROJECTED", c2["event_contracts"])
        self.assertIn("MEMBERSHIP_ENDED", x["blocked_events_until_contract"])

    def test_lab_is_not_exposed_to_web_application(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        self.assertIn("REVOKE ALL ON FUNCTION tto.cf02_relationship_projector_authorized(uuid),", sql)
        self.assertIn("tto.cf02_project_child06_relationship_event(uuid,uuid) FROM PUBLIC,tto_app;", sql)
        self.assertNotIn("GRANT EXECUTE ON FUNCTION tto.cf02_project_child06_relationship_event", sql)
        for identifier in ("cf02_relationship_projection_receipts", "SOURCE_VERSION_GAP", "ALREADY_PROJECTED"):
            self.assertIn(identifier, sql)

if __name__ == "__main__":
    unittest.main()
