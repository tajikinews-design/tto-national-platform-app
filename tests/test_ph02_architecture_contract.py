"""PH-02 review-only contract checks. Does NOT certify production or 23-domain runtime."""
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
ARCH = ROOT / "docs" / "architecture"


class Phase02ArchitectureContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = json.loads((ARCH / "PH02_23_DOMAIN_OWNERSHIP_EVENT_CONTRACT.json").read_text(encoding="utf-8"))
        cls.adr = (ARCH / "PH02_ADR_AND_SECURITY_DECISION_2026-11-02.md").read_text(encoding="utf-8")
        cls.sql = (ARCH / "sql" / "PH02_OUTBOX_REVIEW_ONLY.sql").read_text(encoding="utf-8")

    def test_all_23_owners_and_canonical_source_contracts_are_preserved(self):
        d = self.registry["domains"]
        self.assertEqual(len(d), 23)
        self.assertEqual([x["child"] for x in d], ["CHILD-%02d" % i for i in range(1, 24)])
        self.assertEqual(sum(len(x["command_contracts"]) for x in d), 165)
        self.assertEqual(sum(len(x["query_contracts"]) for x in d), 90)
        self.assertEqual(sum(len(x["event_contracts"]) for x in d), 89)
        self.assertTrue(all(x["owner"] and x["completion_gate"] == "PH04-09_DOMAIN_IMPLEMENTATION_AND_EXACT_TEST_EVIDENCE" for x in d))

    def test_selected_stack_is_source_aligned_and_no_fake_deployment(self):
        adr1 = (ARCH / "ADR-001-FINAL-STACK.md").read_text(encoding="utf-8")
        for word in ("Next.js 16", "NestJS 11", "PostgreSQL 17", "ArvanCloud"):
            self.assertIn(word, adr1)
        self.assertIn("No Merge", self.adr)
        self.assertIn("No real shareholder data", self.adr) if "No real shareholder data" in self.adr else self.assertIn("real shareholder data",self.adr)
        self.assertEqual(self.registry["status"], "ARCHITECTURE_DESIGN_CANDIDATE_NOT_DEPLOYED")

    def test_trust_and_row_security_foundation_are_explicit(self):
        m1 = (ROOT / "database/migrations/0001_cf01_cf03_foundation.sql").read_text(encoding="utf-8")
        service = (ROOT / "services/api/src/module.ts").read_text(encoding="utf-8")
        self.assertIn("NOBYPASSRLS",m1)
        self.assertIn("FORCE ROW LEVEL SECURITY",m1)
        self.assertIn("REVOKE ALL ON ALL TABLES IN SCHEMA tto FROM PUBLIC",m1)
        self.assertIn("set_config('tto.actor_id',$1,true)",service)
        self.assertIn("set_config('tto.tenant_id',$2,true)",service)
        self.assertIn("TTO_PH02_TRANSACTION_LOCAL_POOL_CROSS_TENANT_ISOLATION_PASS",
                      (ROOT / "services/api/test/tenant-auth.integration.cjs").read_text(encoding="utf-8"))

    def test_outbox_has_version_idempotency_and_default_denial(self):
        for part in ("PRIMARY KEY","aggregate_version","event_schema_version","tenant_id",
                     "payload_ref","correlation_id","causation_id","classification",
                     "ENABLE ROW LEVEL SECURITY","FORCE ROW LEVEL SECURITY",
                     "REVOKE ALL","UNIQUE (aggregate_type, aggregate_id, aggregate_version, event_type)",
                     "PRIMARY KEY (consumer_id,event_id)"):
            self.assertIn(part,self.sql)
        self.assertIn("DESIGN ONLY",self.sql)
        self.assertNotIn("GRANT ALL",self.sql)

    def test_provider_env_and_external_decisions_not_claimed_green(self):
        for term in ("Vercel","Arvan","secrets","S3-compatible","Hobby","NOT RECORDED"):
            self.assertIn(term.lower(),self.adr.lower())
        self.assertIn("ENVIRONMENT_GATED",self.registry["gates"]["C04"]["state"])
        self.assertNotEqual(self.registry["gates"]["C03"]["state"],"RUNTIME_VERIFIED")


if __name__ == "__main__":
    unittest.main()
