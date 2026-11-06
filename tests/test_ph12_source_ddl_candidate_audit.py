import importlib.util
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
module_spec=importlib.util.spec_from_file_location("ph12_audit",ROOT/"scripts/ci/ph12-source-ddl-candidate-audit.py")
tool=importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(tool)
class SourceDDLTruth(unittest.TestCase):
 def setUp(self):
  self.fields=tool.read(tool.FIELDS)
  self.source=tool.read(tool.SOURCE)
  self.accepted=tool.read(tool.ACCEPTED)
  self.tables,self.revisions=tool.ddl_map()
 def run_audit(self):
  return tool.audit(self.fields,self.source,self.accepted,self.tables,self.revisions)
 def test_current_ddl_count_is_executed_not_guessed(self):
  result=self.run_audit()
  self.assertEqual(sum(result["statusCounts"].values()),786)
  self.assertEqual(result["formalSourceAccepted"],0)
  self.assertGreater(result["migrationsScanned"],10)
  self.assertEqual(result["physicalSemanticParityAccepted"],0)
 def test_source_786_rows_cannot_be_shortened(self):
  self.fields["rows"].pop()
  with self.assertRaisesRegex(AssertionError,"SOURCE_FIELD_COUNT_DRIFT"):self.run_audit()
 def test_duplicate_field_ledger_fails(self):
  self.fields["rows"][1]["row_id"]=self.fields["rows"][0]["row_id"]
  with self.assertRaisesRegex(AssertionError,"DUPLICATE_FIELD_ROW_ID"):self.run_audit()
 def test_false_formal_acceptance_fails(self):
  self.accepted["not_accepted_per_source"]=0
  with self.assertRaisesRegex(AssertionError,"FORMAL_ACCEPTANCE_NOT_EVIDENCED"):self.run_audit()
 def test_false_semantic_match_fails(self):
  self.fields["rows"][0]["actual_semantic_equivalence_certified"]=True
  with self.assertRaisesRegex(AssertionError,"SOURCE_SEMANTIC_SIGNOFF"):self.run_audit()
if __name__=="__main__":unittest.main()
