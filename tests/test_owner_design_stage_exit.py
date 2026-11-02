"""Owner-approved PH01/PH02 DESIGN gates, with no waiver of production acceptance."""
import json
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
ARCH=ROOT/"docs"/"architecture"
ANALYSIS=ROOT/"docs"/"analysis"

class StageExitAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p=json.loads((ARCH/"TTO_PH01_PH02_OWNER_ACCEPTED_DESIGN_EXIT.json").read_text(encoding="utf-8"))
        cls.e=json.loads((ANALYSIS/"PH01_SOURCE_148_ENTITY_FIELD_INDEX.json").read_text(encoding="utf-8"))
        cls.f=json.loads((ANALYSIS/"PH01_148_ENTITY_FIELD_PHYSICAL_CANDIDATES.json").read_text(encoding="utf-8"))
        cls.a=json.loads((ANALYSIS/"PH01_155_ACCEPTANCE_EVIDENCE_GATE.json").read_text(encoding="utf-8"))
        cls.dom=json.loads((ARCH/"PH02_23_DOMAIN_OWNERSHIP_EVENT_CONTRACT.json").read_text(encoding="utf-8"))
    def test_both_design_phases_complete_without_rewriting_source(self):
        self.assertEqual(self.p["phase01"]["design_green"],8)
        self.assertEqual(self.p["phase02"]["design_green"],4)
        self.assertEqual(len(self.p["phase01"]["gates"]),8)
        self.assertEqual(len(self.p["phase02"]["gates"]),4)
        self.assertTrue(all(v.startswith("GREEN_") for v in self.p["phase01"]["gates"].values()))
        self.assertTrue(all(v.startswith("GREEN_") for v in self.p["phase02"]["gates"].values()))
        self.assertEqual(self.p["phase01"]["scope"],"LOGICAL_DESIGN_BASELINE_ONLY")
        self.assertTrue(self.p["no_green_claim_for_runtime"])
    def test_original_148_and_155_source_requirements_still_block_production(self):
        self.assertEqual(self.e["entity_count"],148)
        self.assertEqual(len(self.f["rows"]),786)
        self.assertEqual(self.a["acceptance_count"],155)
        self.assertEqual(self.p["deferred_release_blockers"]["production_release"],"BLOCKED")
        self.assertEqual(self.p["deferred_release_blockers"]["source_155_acceptance"],
                         "MUST_BE_EXECUTED_WITH_EXACT_REQUIREMENT_ASSERTION_SHA_RUN_QA")
        self.assertEqual(self.p["deferred_release_blockers"]["source_148_physical_contracts"],
                         "MUST_BE_IMPLEMENTED_AND_TESTED_BEFORE_PRODUCTION")
    def test_preview_is_noncommercial_only_and_dedicated_server_is_exclusive_prod(self):
        v=self.p["phase02"]["vercel"]
        self.assertEqual(v["permitted_intent"],"NON_COMMERCIAL_PERSONAL_SYNTHETIC_TESTS_ONLY")
        self.assertFalse(v["real_data"])
        self.assertFalse(v["live_customer_delivery"])
        self.assertTrue(v["no_payment_or_live_shares"])
        self.assertIn("DO_NOT_USE_HOBBY",v["provider_terms"])
        self.assertEqual(self.p["phase02"]["production"]["target"],"DEDICATED_SERVER")
        self.assertFalse(self.p["phase02"]["production"]["release_permission"])
    def test_owner_attestation_does_not_forge_specialist_signatures(self):
        self.assertEqual(self.p["approvals"]["specialist"],"OWNER_ATTESTED_APPROVED_NOT_INDEPENDENTLY_VERIFIED")
        self.assertEqual(self.p["approvals"]["independent_signature_files"],0)
        self.assertEqual(len(self.dom["domains"]),23)
        self.assertTrue(self.p["no_merge_or_deploy_by_documenting"])
if __name__=="__main__":
    unittest.main()
