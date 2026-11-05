"""Offline source-contract integrity checks only. NO real membership or shares, no DB."""
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
DESIGN = ROOT / "docs/contracts/child06-07-oss-adoption-design-v1.json"
SOURCE_ENTITY = ROOT / "docs/analysis/PH01_SOURCE_148_ENTITY_FIELD_INDEX.json"
SOURCE_MAP = ROOT / "docs/analysis/CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json"
SOURCE_AT = ROOT / "docs/analysis/ACCEPTANCE_IDS.json"


class Child0607OssDesignGuard(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.design = json.loads(DESIGN.read_text(encoding="utf-8"))
        cls.entities = json.loads(SOURCE_ENTITY.read_text(encoding="utf-8"))
        cls.maps = json.loads(SOURCE_MAP.read_text(encoding="utf-8"))
        cls.acceptance = json.loads(SOURCE_AT.read_text(encoding="utf-8"))

    def test_frozen_source_and_nonproduction_contract(self):
        self.assertEqual(self.design["source"]["commit"], "5eb6be8edfbb61f2eca740a42c30f572b493f023")
        self.assertEqual(self.design["status"], "DESIGN_ONLY_NOT_IMPLEMENTED")
        self.assertIs(self.design["productionPermission"], False)
        self.assertIs(self.design["realShareTransfer"], False)
        self.assertTrue(self.design["globalGuardrails"]["forceRLS"])
        self.assertTrue(self.design["globalGuardrails"]["noRealPIIOrMoney"])
        self.assertTrue(self.design["globalGuardrails"]["retain155CanonicalAcceptanceIDs"])

    def test_exact_source_entity_fields_paragraphs_and_inventory(self):
        by_id = {x["id"]: x for x in self.design["domains"]}
        self.assertEqual(set(by_id), {"CHILD-06", "CHILD-07"})
        for child_id, expected_count in (("CHILD-06", 5), ("CHILD-07", 7)):
            rows = [r for r in self.entities["entities"] if r["child_id"] == child_id]
            self.assertEqual(len(rows), expected_count)
            source = {r["entity"]: r for r in rows}
            target = by_id[child_id]["entities"]
            self.assertEqual(len(target), expected_count)
            self.assertEqual({r["name"] for r in target}, set(source))
            for entity in target:
                original = source[entity["name"]]
                self.assertEqual(entity["sourceParagraph"], original["source_paragraph"])
                # Source index stores field phrases separated by a comma+space.
                self.assertEqual(", ".join(entity["sourceFieldPhrases"]), original["fields"])
                self.assertEqual(entity["status"], "DESIGN_SOURCE_ONLY")

    def test_commands_queries_events_match_locked_domain_map(self):
        catalog = {r["id"]: r for r in self.maps["children"]}
        for domain in self.design["domains"]:
            original = catalog[domain["id"]]
            for a, b in (("commands", "canonical_commands"), ("queries", "canonical_queries"), ("events", "canonical_events")):
                self.assertEqual(domain[a], original[b])
            self.assertEqual(original["acceptance_run_status"], "NOT_RUN")
        self.assertEqual(sum(len(d["commands"]) for d in self.design["domains"]), 15)
        self.assertEqual(sum(len(d["queries"]) for d in self.design["domains"]), 8)
        self.assertEqual(sum(len(d["events"]) for d in self.design["domains"]), 9)

    def test_original_acceptance_ids_unchanged_and_not_run(self):
        source = {row["id"]: row for row in self.acceptance}
        ids = [x for d in self.design["domains"] for x in d["officialAcceptanceIDs"]]
        self.assertEqual(len(ids), 15)
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(ids[:7], [f"MEMBER-AT-{i:03d}" for i in range(1, 8)])
        self.assertEqual(ids[7:], [f"SHARE-AT-{i:03d}" for i in range(1, 9)])
        for x in ids:
            self.assertIn(x, source)
            self.assertEqual(source[x]["status"], "NOT_RUN")
            self.assertIsNone(source[x]["execution_evidence"])

    def test_read_only_current_endpoints_and_blocked_write_design(self):
        routes = self.design["suggestedAPIContracts"]
        reads = [x for x in routes if x["route"].startswith("GET ")]
        writes = [x for x in routes if x["route"].startswith("POST ")]
        self.assertEqual(len(reads), 2)
        self.assertEqual(len(writes), 2)
        self.assertTrue(all(x["status"].startswith("EXISTING_CANDIDATE") for x in reads))
        self.assertTrue(all(x["status"] in {"BLOCKED_NO_ROUTE", "DESIGN_ONLY_NO_ROUTE"} for x in writes))
        for d in self.design["domains"]:
            self.assertIn(d["writeGate"], {"BLOCK_UNTIL_SOURCE_AND_LEGAL_AUTHORITY",
                                           "ALL_SHARE_WRITE_AND_TRANSFER_BLOCKED_NO_LEGAL_AUTHORITY"})
            self.assertTrue(all("PROPOSED only" in x["notes"] for x in d["proposedStateMachines"]))

    def test_no_unapproved_financial_owner_or_voting_power(self):
        prose = json.dumps(self.design, ensure_ascii=False)
        for guard in ("party", "rls", "wallet", "sourceversion", "shareholder"):
            self.assertIn(guard, prose.lower())
        self.assertNotIn('"status": "APPROVED_FOR_PRODUCTION"', prose)


if __name__ == "__main__":
    unittest.main()
