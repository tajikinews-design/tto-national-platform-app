"""PH07 authoritative 26 test IDs, exact source text and executable SQL signals.

Passing this test proves traceability and source preservation, not runtime or
release acceptance. Runtime assertions run separately against disposable PG17.
"""
import json
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
FROZEN=ROOT/"docs/analysis/ACCEPTANCE_IDS.json"
MANIFEST=ROOT/"docs/analysis/PH07_26_SOURCE_ACCEPTANCE.json"
COUNTS={"GOV":8,"COMM":6,"SUP":6,"TRN":6}
class Phase07SourceTruth(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.frozen=json.loads(FROZEN.read_text(encoding="utf8"))
  cls.manifest=json.loads(MANIFEST.read_text(encoding="utf8"))
 def test_frozen_source_26_exact_sequence(self):
  official=[x["id"] for x in self.frozen[55:81]]
  cases=[x["id"] for x in self.manifest["cases"]]
  self.assertEqual(len(self.frozen),155)
  self.assertEqual(cases,official)
  self.assertEqual(len(cases),26)
  self.assertEqual(len(set(cases)),26)
  self.assertEqual(official,[
   *[f"GOV-AT-{n:03}" for n in range(1,9)],
   *[f"COMM-AT-{n:03}" for n in range(1,7)],
   *[f"SUP-AT-{n:03}" for n in range(1,7)],
   *[f"TRN-AT-{n:03}" for n in range(1,7)]
  ])
 def test_source_text_and_exact_signal_present(self):
  for case in self.manifest["cases"]:
   with self.subTest(id=case["id"]):
    self.assertTrue(case["sourceScenario"])
    self.assertTrue(case["sourceExpected"])
    self.assertEqual(case["source"],"TTO-UNIFIED-IMPLEMENTATION-PACK-v1.0.docx")
    path=ROOT/case["assertionSql"]
    self.assertTrue(path.is_file(),str(path))
    signal="PH07_"+case["id"].replace("-AT-","_AT").replace("-","_")+"_"
    self.assertIn(signal,path.read_text(encoding="utf8"))
 def test_no_fabricated_acceptance_or_reviewer(self):
  self.assertEqual(self.manifest["acceptanceGate"],
                   "NOT_GREEN_UNTIL_EXACT_EXECUTION_AND_INTEGRATION")
  self.assertTrue(self.manifest["noProductionWrites"])
  for case in self.manifest["cases"]:
   self.assertEqual(case["technicalStatus"],"PENDING_EXACT_HEAD_CI")
   self.assertEqual(case["formalStatus"],"NOT_YET_ACCEPTED")
   self.assertIsNone(case["exactSha"])
   self.assertIsNone(case["exactRun"])
   self.assertIsNone(case["independentQA"])
if __name__=="__main__":
 unittest.main()
