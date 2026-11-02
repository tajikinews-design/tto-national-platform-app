"""PH-01 evidence integrity: passing here verifies tracking quality, NOT product acceptance."""
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
ANALYSIS = ROOT / "docs" / "analysis"


def load(name):
    return json.loads((ANALYSIS / name).read_text(encoding="utf-8"))


class Phase01EvidenceIntegrity(unittest.TestCase):
    def test_148_source_entities_are_exactly_indexed(self):
        manifest = load("PH01_SOURCE_148_ENTITY_FIELD_INDEX.json")
        self.assertEqual(manifest["entity_count"], 148)
        self.assertEqual(manifest["children_count"], 23)
        entities = manifest["entities"]
        self.assertEqual(len(entities), 148)
        self.assertTrue(all(e.get("entity") and e.get("fields") and e.get("child_id") for e in entities))
        identities = [(e["child_id"], e["entity"]) for e in entities]
        self.assertEqual(len(identities), len(set(identities)))
        self.assertEqual(len(set(e["child_id"] for e in entities)), 23)

    def test_155_acceptance_ids_are_preserved_without_silent_reinterpretation(self):
        locked = load("ACCEPTANCE_IDS.json")
        register = load("PH01_155_ACCEPTANCE_EVIDENCE_GATE.json")
        self.assertEqual(len(locked), 155)
        self.assertEqual(register["acceptance_count"], 155)
        original = [r["id"] for r in locked]
        derived = [r["source_test_id"] for r in register["acceptance_cases"]]
        self.assertEqual(original, derived)
        self.assertEqual(len(set(derived)), 155)
        self.assertTrue(register["gate_policy"]["no_auto_green"])

    def test_acceptance_status_requires_actual_evidence_and_independent_review(self):
        entries = load("PH01_155_ACCEPTANCE_EVIDENCE_GATE.json")["acceptance_cases"]
        for entry in entries:
            complete = all(entry.get(x) for x in (
                "official_requirement_id",
                "reviewed_code_assertion",
                "exact_accepted_test_run",
                "legal_product_qa_signoff",
            ))
            if entry.get("status") in ("GREEN", "PASS", "ACCEPTED"):
                self.assertTrue(complete, "Unsubstantiated acceptance: " + entry["source_test_id"])
            if not complete:
                self.assertNotIn(entry.get("status"), ("GREEN", "PASS", "ACCEPTED"))
        self.assertEqual(len([x for x in entries if x.get("exact_accepted_test_run")]), 0)

    def test_dedicated_child_01_conflicts_cannot_be_automatically_resolved(self):
        register = load("PH01_155_ACCEPTANCE_EVIDENCE_GATE.json")
        self.assertTrue(register["gate_policy"]["C08"].startswith("independent"))
        cf01 = [x for x in register["acceptance_cases"] if x["source_test_id"].startswith("CORE-AUTH-AT-")]
        self.assertEqual(len(cf01), 8)
        self.assertTrue(all(x["status"] == "RELATED_TECHNICAL_EVIDENCE_NOT_FORMAL_ACCEPTANCE" for x in cf01))


if __name__ == "__main__":
    unittest.main()
