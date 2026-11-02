"""PH04 original source traceability integrity; NOT an independent QA signature."""
import json
import pathlib
import unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
PATH=ROOT/"docs/analysis/PH04_CF01_18_CF02_8_ACCEPTANCE_TRACEABILITY.json"
class Phase04SourceTraceability(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.doc=json.loads(PATH.read_text(encoding="utf-8"))
 def test_original_case_ids_preserved_without_duplicates(self):
  c=self.doc["cases"]
  self.assertEqual(len(c),26)
  self.assertEqual(len({x["key"] for x in c}),26)
  self.assertEqual([x["key"] for x in c[:18]],[
    f"CF01.DED.CORE-AUTH-AT-{i:03d}" for i in range(1,19)])
  self.assertEqual([x["key"] for x in c[18:]],[
    f"CF02.PACK.CORE-TENANT-AT-{i:03d}" for i in range(1,9)])
 def test_packed_alias_preserves_all_semantic_collisions(self):
  a=self.doc["summaryAliases"]
  self.assertEqual(len(a),8)
  expected=[1,2,3,5,7,10,12,17]
  self.assertEqual([x["semanticCorrespondence"] for x in a],
    [f"CF01.DED.CORE-AUTH-AT-{i:03d}" for i in expected])
  self.assertEqual(len({x["key"] for x in a}),8)
 def test_absent_contract_features_are_not_misrepresented(self):
  self.assertFalse(self.doc["claims"]["operationalAcceptance"])
  self.assertTrue(self.doc["claims"]["noFabricatedQA"])
  self.assertEqual(self.doc["sourceSha"],
    "5eb6be8edfbb61f2eca740a42c30f572b493f023")
  for x in self.doc["cases"]:
   self.assertIsNone(x["independentQa"])
   self.assertIsNone(x["exactCiRun"])
   self.assertIn(x["status"],("GAP_TRACKED","PENDING_EXACT_HEAD_SHA_RUN"))
   if x["status"]=="GAP_TRACKED":self.assertIn(x["key"],(
    "CF01.DED.CORE-AUTH-AT-004","CF01.DED.CORE-AUTH-AT-006"))
 def test_candidate_code_references_are_real_files(self):
  for x in self.doc["cases"]:
   p=x["codeAssertion"]
   if p=="NOT_IMPLEMENTED":continue
   self.assertTrue((ROOT/p).is_file(),f"Missing assertion source: {p}")
if __name__=="__main__":unittest.main()
