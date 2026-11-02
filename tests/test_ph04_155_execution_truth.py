"""Fail closed on false certification of the 155 locked source acceptance IDs.

This is a traceability-integrity test only. It does NOT execute or certify
unimplemented Child03..23 domain operations, and never approves production.
"""
import collections
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/analysis/ACCEPTANCE_IDS.json"
MATRIX = ROOT / "docs/analysis/PH04_LOCKED_155_SOURCE_EXECUTION_MATRIX.json"
COUNTS = {"PH-04": 16, "PH-05": 24, "PH-06": 15,
          "PH-07": 26, "PH-08": 36, "PH-09": 38}

class Locked155SourceTruth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads(SOURCE.read_text(encoding="utf-8"))
        cls.m = json.loads(MATRIX.read_text(encoding="utf-8"))

    def test_complete_frozen_sequence_without_renumbering(self):
        self.assertEqual(len(self.source), 155)
        self.assertEqual(len(self.m["cases"]), 155)
        frozen = [x["id"] for x in self.source]
        mapped = [x["sourceTestId"] for x in self.m["cases"]]
        self.assertEqual(mapped, frozen, "Frozen IDs/order must never be silently replaced")
        self.assertEqual(len(set(mapped)), 155)
        self.assertEqual([x["sourceOrdinal"] for x in self.m["cases"]], list(range(1, 156)))

    def test_phase_routing_and_source_identity(self):
        cases = self.m["cases"]
        self.assertEqual(dict(collections.Counter(x["phase"] for x in cases)), COUNTS)
        self.assertEqual(self.m["counts"]["byPhase"], COUNTS)
        self.assertEqual(self.m["frozenSourceSha"],
            "5eb6be8edfbb61f2eca740a42c30f572b493f023")
        for item, source in zip(cases, self.source):
            self.assertEqual(item["sourceDocument"], source["source"])
            self.assertTrue(item["childId"].startswith("CHILD-"))
            self.assertEqual(item["sourceTestId"], source["id"])

    def test_no_fabricated_acceptance_or_independent_signature(self):
        self.assertEqual(self.m["counts"]["formallyAccepted"], 0)
        self.assertEqual(self.m["counts"]["notFormallyAccepted"], 155)
        for c in self.m["cases"]:
            self.assertEqual(c["formalAcceptance"], "PENDING_NOT_ACCEPTED")
            self.assertIsNone(c["officialRequirementId"])
            self.assertIsNone(c["exactCodeAssertion"])
            self.assertIsNone(c["exactAcceptedRun"])
            self.assertIsNone(c["reviewerSignature"])

    def test_evidence_separation_and_no_cross_namespace_alias_confusion(self):
        self.assertEqual(sum(bool(x["technicalEvidence"]) for x in self.m["cases"]), 16)
        for case in self.m["cases"]:
            e = case["technicalEvidence"]
            if case["childId"] == "CHILD-01":
                self.assertEqual(e["class"], "RELATED_DETAILED_ALIAS_ONLY_NOT_EXACT_SOURCE_ACCEPTANCE")
                self.assertTrue(e["dedicatedSemanticID"].startswith("CF01.DED.CORE-AUTH-AT-"))
            elif case["childId"] == "CHILD-02":
                self.assertIn(e["class"],
                    ("PARTIAL_SYNTHETIC_ONLY", "SOURCE_SCOPED_SYNTHETIC_POSTGRES"))
            else:
                self.assertIsNone(e, "Future-phase source case must not borrow CF01/02 run")

if __name__ == "__main__":
    unittest.main()
