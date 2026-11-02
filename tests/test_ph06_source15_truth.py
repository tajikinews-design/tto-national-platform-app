"""PH06 original 15-case identity and runnable synthetic-boundary proof map."""
import json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
LOCK=ROOT/"docs/analysis/ACCEPTANCE_IDS.json"
P=ROOT/"docs/analysis/PH06_MEMBER07_SHARE08_SOURCE_TESTS.json"
SQL=ROOT/"tests/sql/ph06-member-share-frozen15.sql"
class Source15(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.original=json.loads(LOCK.read_text(encoding="utf8"))
  cls.data=json.loads(P.read_text(encoding="utf8"))
  cls.sql=SQL.read_text(encoding="utf8")
 def test_source15_sequence(self):
  frozen=[c["id"] for c in self.original[40:55]]
  cases=[c["sourceTestId"] for c in self.data["cases"]]
  self.assertEqual(len(self.original),155)
  self.assertEqual(cases,frozen)
  self.assertEqual(len(set(cases)),15)
  self.assertEqual(cases,
    [f"MEMBER-AT-{i:03d}" for i in range(1,8)]+
    [f"SHARE-AT-{i:03d}" for i in range(1,9)])
 def test_all_ids_have_executable_physical_signal(self):
  for c in self.data["cases"]:
   with self.subTest(c=c["sourceTestId"]):
    sig="PH06_"+c["sourceTestId"].replace("-","_")+"_"
    self.assertIn(sig,self.sql)
 def test_no_claim_of_verbatim_source_or_live_ownership(self):
  self.assertTrue(self.data["noProductionAuthorization"])
  self.assertEqual(self.data["technicalProofStatus"],"NOT_RUN")
  for c in self.data["cases"]:
   self.assertEqual(c["scenarioOrigin"],
    "DERIVED_FROM_LOCKED_INVARIANTS_NOT_VERBATIM_SOURCE_TEST_TEXT")
   self.assertEqual(c["businessAcceptance"],"NOT_FORMALLY_ACCEPTED")
   self.assertIsNone(c["independentHumanQA"])
if __name__=="__main__":unittest.main()
