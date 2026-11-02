"""Executable assertion mapping for 24 phase-5 source IDs; no fake GREEN."""
import json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
B=ROOT/"docs/analysis/PH05_CF03_CF04_CF05_24_ACCEPTANCE_BASELINE.json"
E=ROOT/"docs/analysis/PH05_24_EXECUTABLE_SCOPED_COVERAGE.json"

class Phase05RunnableSourceMap(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.baseline=json.loads(B.read_text(encoding="utf-8"))
  cls.evidence=json.loads(E.read_text(encoding="utf-8"))
 def test_all_original_id_exact_order(self):
  got=[x["sourceTestId"] for x in self.evidence["details"]]
  expected=[x["sourceTestId"] for x in self.baseline["cases"]]
  self.assertEqual(got,expected)
  self.assertEqual(len(got),24)
  self.assertEqual(len(set(got)),24)
 def test_each_id_has_nontrivial_executable_signal(self):
  for case in self.evidence["details"]:
   with self.subTest(case=case["sourceTestId"]):
    p=ROOT/case["codeAssertionFile"]
    self.assertTrue(p.is_file(),str(p))
    code=p.read_text(encoding="utf-8")
    self.assertIn(case["signalPrefix"],code)
    self.assertGreaterEqual(len(case["signalPrefix"]),20)
 def test_no_fake_real_world_attestation(self):
  self.assertEqual(self.evidence["fullSourceE2EAccepted"],0)
  self.assertIsNone(self.evidence["exactSuccessfulRun"])
  for c in self.evidence["details"]:
   self.assertFalse(c["fullSourceE2EProved"])
   self.assertIsNone(c["independentHumanQA"])
   self.assertEqual(c["formalAcceptance"],"PENDING_ACTUAL_SOURCE_END_TO_END")
if __name__=="__main__":unittest.main()
