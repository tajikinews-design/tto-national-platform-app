"""Verify CHILD02 detailed §29 twenty-two-test contract without false green."""
import json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
P=ROOT/"docs/analysis/PH04_CF02_22_DEDICATED_ACCEPTANCE.json"
PACK=ROOT/"docs/analysis/PH04_CF01_18_CF02_8_ACCEPTANCE_TRACEABILITY.json"
class Child02DedicatedIntegrity(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.d=json.loads(P.read_text(encoding="utf-8"))
  cls.pack=json.loads(PACK.read_text(encoding="utf-8"))
 def test_source_detailed_22_ids_and_counts(self):
  cases=self.d["cases"]
  self.assertEqual(len(cases),22)
  self.assertEqual(self.d["canonicalDetailedTestCount"],22)
  self.assertEqual(len(set(c["key"] for c in cases)),22)
  self.assertEqual([c["sourceTestId"] for c in cases],[
   *[f"CORE-TENANT-AT-{i:03}" for i in range(1,7)],
   *[f"CORE-PARTY-AT-{i:03}" for i in range(1,9)],
   *[f"CORE-REL-AT-{i:03}" for i in range(1,5)],
   *[f"CORE-ISO-AT-{i:03}" for i in range(1,5)]])
 def test_disjoint_source_namespaces_not_false_aliases(self):
  summary=[x for x in self.pack["cases"] if x["key"].startswith("CF02.PACK.")]
  self.assertEqual(len(summary),8)
  detailed=self.d["cases"]
  self.assertEqual(detailed[0]["scenario"],"Create Tenant")
  self.assertNotEqual(detailed[0]["scenario"],summary[0]["scenario"])
  self.assertTrue(all(c["key"].startswith("CF02.DED.") for c in detailed))
 def test_no_fabricated_specialist_signatures_or_accepted_tests(self):
  self.assertEqual(self.d["acceptance"],"NOT_GREEN")
  for c in self.d["cases"]:
   self.assertEqual(c["acceptanceStatus"],"PENDING_INDEPENDENT_EXACT_PROOF")
   for k in ("exactCiRun","acceptedSha","independentProduct","independentArchitecture","independentLegal","independentQA"):
    self.assertIsNone(c[k])
if __name__=="__main__":unittest.main()
