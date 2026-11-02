"""PH00/PH01 final immutable-source and design-boundary revalidation.

An offline consistency test is NOT evidence of full domain implementation or 155
executed functional acceptances. Provider current state must be audited separately.
"""
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
ANALYSIS = ROOT / "docs" / "analysis"
ARCH = ROOT / "docs" / "architecture"

def data(p):
    return json.loads(p.read_text(encoding="utf-8"))

class PhaseZeroOneFinalEvidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = data(ANALYSIS / "PH00_SOURCE_15_BLOB_RECHECK_2026-11-02.json")
        cls.catalog = data(ANALYSIS / "CHILD_CATALOG.json")
        cls.map = data(ANALYSIS / "CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json")
        cls.nav = data(ANALYSIS / "NAVIGATION_CONTRACT.json")
        cls.original_acceptance = data(ANALYSIS / "ACCEPTANCE_IDS.json")
        cls.entity = data(ANALYSIS / "PH01_SOURCE_148_ENTITY_FIELD_INDEX.json")
        cls.fields = data(ANALYSIS / "PH01_148_ENTITY_FIELD_PHYSICAL_CANDIDATES.json")
        cls.acceptance = data(ANALYSIS / "PH01_155_ACCEPTANCE_EVIDENCE_GATE.json")
        cls.exit = data(ARCH / "TTO_PH01_PH02_OWNER_ACCEPTED_DESIGN_EXIT.json")

    def test_ph00_pinned_source_15_files_are_unique_and_recaptured(self):
        v = self.source
        self.assertEqual(v["source_file_count"], 15)
        self.assertEqual(v["pinnedCommit"], "5eb6be8edfbb61f2eca740a42c30f572b493f023")
        self.assertEqual(v["observedSourceMain"], v["pinnedCommit"])
        self.assertFalse(v["sourceTreeTruncated"])
        self.assertTrue(v["sourceIsPrivate"])
        self.assertTrue(v["appIsPrivate"])
        self.assertEqual(len(v["source_files"]), 15)
        self.assertEqual(len({i["path"] for i in v["source_files"]}), 15)
        self.assertEqual(len({i["blob_sha"] for i in v["source_files"]}), 14)
        self.assertTrue(all(len(i["blob_sha"]) == 40 and i["size"] > 0 for i in v["source_files"]))
        self.assertTrue(any(i["path"] == "TTO-UNIFIED-IMPLEMENTATION-PACK-v1.0.docx"
                            and i["blob_sha"] == "120a36134e04293225f11440e8c41c16a0dc085f"
                            for i in v["source_files"]))

    def test_ph00_original_preflight_success_and_unprotected_branch_risk_not_hidden(self):
        self.assertEqual(self.source["historicalPreflightRun"]["id"], 39756700303)
        self.assertEqual(self.source["historicalPreflightRun"]["conclusion"], "success")
        self.assertFalse(self.source["sourceMainProtected"])
        risks = {r["id"]: r for r in self.source["risk_register"]}
        self.assertEqual(risks["PH00-RISK-SOURCE-BRANCH-PROTECTION"]["state"], "OPEN_NON_GATE_RISK")

    def test_ph01_23_children_counts_and_11_nav_routes(self):
        self.assertEqual(len(self.catalog), 23)
        self.assertEqual(len({i["id"] for i in self.catalog}), 23)
        self.assertEqual(self.map["source_sha"], self.source["pinnedCommit"])
        self.assertEqual(len(self.map["children"]), 23)
        counts = self.map["table_counts"]
        for key,n in (("entities",148),("states",71),("commands",165),
                      ("queries",90),("events",89),("acceptance",155)):
            self.assertEqual(counts[key],n)
            self.assertEqual(sum(c["counts"][key] for c in self.map["children"]),n)
        self.assertEqual(len(self.nav["roots"]),11)
        self.assertEqual(self.nav["canonical_root_count"],11)

    def test_ph01_148_entities_786_field_phrases_and_155_acceptance_provenance(self):
        self.assertEqual(len(self.entity["entities"]),148)
        self.assertEqual(len(self.fields["rows"]),786)
        self.assertEqual(len(self.original_acceptance),155)
        self.assertEqual(len({t["id"] for t in self.original_acceptance}),155)
        self.assertEqual([t["id"] for t in self.original_acceptance],
                         [t["source_test_id"] for t in self.acceptance["acceptance_cases"]])
        self.assertTrue(all(t["status"] == "NOT_RUN" for t in self.original_acceptance))
        self.assertEqual(sum(self.fields["counts"].values()),786)

    def test_design_green_not_conflated_with_business_acceptance(self):
        p=self.exit
        self.assertEqual(p["phase01"]["scope"],"LOGICAL_DESIGN_BASELINE_ONLY")
        self.assertEqual(p["phase01"]["design_green"],8)
        self.assertEqual(len(p["phase01"]["gates"]),8)
        self.assertEqual(p["approvals"]["independent_signature_files"],0)
        self.assertEqual(p["deferred_release_blockers"]["production_release"],"BLOCKED")
        self.assertIn("155_BUSINESS_TESTS_PASS",p["phase01"]["not_claimed"])
        self.assertIn("148_RUNTIME_FIELDS_PARITY",p["phase01"]["not_claimed"])
        self.assertFalse(any(t.get("exact_accepted_test_run") for t in self.acceptance["acceptance_cases"]))

if __name__ == "__main__":
    unittest.main()
