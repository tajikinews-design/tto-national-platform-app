"""Frozen PH05 original 24 acceptance IDs and no fabricated green signals."""
import json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
F=ROOT/"docs/analysis/PH05_CF03_CF04_CF05_24_ACCEPTANCE_BASELINE.json"
LOCKED=ROOT/"docs/analysis/ACCEPTANCE_IDS.json"
PARENT=ROOT/"docs/analysis/PH04_LOCKED_155_SOURCE_EXECUTION_MATRIX.json"
GROUPS=[("CF03","CORE-DOC"),("CF04","CORE-RULE"),("CF05","CORE-INT")]

class Phase05LockedSource(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.doc=json.loads(F.read_text(encoding="utf-8"))
  cls.official=json.loads(LOCKED.read_text(encoding="utf-8"))
  cls.parent=json.loads(PARENT.read_text(encoding="utf-8"))
 def test_24_unchanged_source_ids_and_order(self):
  self.assertEqual(len(self.official),155)
  source=[x["id"] for x in self.official[16:40]]
  cases=self.doc["cases"]
  self.assertEqual(len(cases),24)
  self.assertEqual([x["sourceTestId"] for x in cases],source)
  self.assertEqual(len(set(x["key"] for x in cases)),24)
  expected=[f"{code}-AT-{i:03d}" for child,code in GROUPS for i in range(1,9)]
  self.assertEqual(source,expected)
  self.assertEqual([x["sourceTestId"] for x in self.parent["cases"][16:40]],source)
 def test_source_text_and_no_fake_QA(self):
  self.assertEqual(self.doc["claims"]["testsFormallyAccepted"],0)
  self.assertTrue(self.doc["claims"]["conditionalOnPH04IndependentApproval"])
  for c in self.doc["cases"]:
   self.assertTrue(c["scenario"] and c["expected"])
   self.assertEqual(c["formalAcceptance"],"PENDING_SOURCE_EXACT_EVIDENCE")
   self.assertEqual(c["runtimeAcceptance"],"NOT_YET_EXECUTED")
   for field in ("exactAcceptedRun","exactAcceptedSha","independentQA","legalSignoff"):
    self.assertIsNone(c[field])
 def test_no_implicit_finance_custody(self):
  boundary=" ".join(self.doc["nonGoals"]).lower()
  for term in ("wallet","custody","payment"):
   self.assertIn(term,boundary)
if __name__=="__main__":unittest.main()
