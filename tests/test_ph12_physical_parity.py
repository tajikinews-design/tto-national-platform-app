import copy
import importlib.util
import pathlib
import unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("ph12",ROOT/"scripts/ci/ph12-physical-parity.py")
ph12=importlib.util.module_from_spec(spec)
spec.loader.exec_module(ph12)

class ActualPgFieldTruth(unittest.TestCase):
 def setUp(self):
  self.source=ph12.load(ph12.INDEX)
  self.catalog=[
   {"table":"user_accounts","column":"status","type":"text","nullable":"NO"},
   {"table":"tenants","column":"tenant_id","type":"uuid","nullable":"NO"}
  ]
  self.catalog += [{"table":"test_table_"+str(i),"column":"id","type":"uuid","nullable":"NO"} for i in range(151)]
 def verify(self):
  return ph12.classify(self.source,self.catalog)
 def test_complete_census_is_unaccepted(self):
  z=self.verify()
  self.assertEqual(len(z["observations"]),786)
  self.assertEqual(sum(z["counts"].values()),786)
  self.assertEqual(z["sourceEntities"],148)
  self.assertEqual(z["semanticallyCertifiedFields"],0)
  self.assertEqual(z["phase12"],"HOLD")
 def test_same_named_field_is_only_candidate(self):
  z=self.verify()
  x=next(v for v in z["observations"] if v["sourceId"]=="CHILD-01-161-3")
  self.assertEqual(x["currentStatus"],"CANDIDATE_COLUMN_EXISTS_SEMANTICS_UNREVIEWED")
  self.assertFalse(x["semanticParityCertified"])
 def test_tampered_old_approval_denied(self):
  self.source["rows"][0]["source_to_code_approved"]=True
  with self.assertRaisesRegex(AssertionError,"OLD_CANDIDATE_UNJUSTIFIED_APPROVAL"):
   self.verify()
 def test_missing_current_schema_denied(self):
  with self.assertRaisesRegex(AssertionError,"MISSING_CURRENT_PG_CATALOG"):
   ph12.classify(self.source,[])
 def test_duplicate_catalog_column_denied(self):
  self.catalog.append(dict(self.catalog[0]))
  with self.assertRaisesRegex(AssertionError,"DUPLICATE_CATALOG_COLUMN"):
   self.verify()
 def test_source_id_duplicate_denied(self):
  self.source["rows"][1]["row_id"]=self.source["rows"][0]["row_id"]
  with self.assertRaisesRegex(AssertionError,"DUPLICATE_FIELD_IDS"):
   self.verify()
if __name__=="__main__":
 unittest.main()
