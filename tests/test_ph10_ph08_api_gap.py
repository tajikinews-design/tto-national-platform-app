"""PH08 ledger must not confuse related API smoke with 36 full source E2E cases."""
import importlib.util
from pathlib import Path
import unittest
P=Path(__file__).resolve().parents[1]/"scripts/ci/ph10-ph08-api-gap-ledger.py"
s=importlib.util.spec_from_file_location("phase08gap",P);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Truth(unittest.TestCase):
 def test_36_ids_and_modules(self):
  rows=m.source()
  self.assertEqual(len(rows),36)
  self.assertEqual({x["module"] for x in rows},set(m.PATHS))
 def test_related_http_not_36_accepted(self):
  self.assertEqual(len(m.MARKERS),32)
  self.assertEqual(len(m.ABSENT_ROUTE_MARKERS),4)
  self.assertEqual(len(set(m.MARKERS)|set(m.ABSENT_ROUTE_MARKERS)),36)
  self.assertLess(len(m.MARKERS),36)
 def test_preflight_no_mutations(self):
  cases=m.source()
  self.assertEqual(len(m.PREFLIGHT_ONLY_IDS),5)
  self.assertEqual(set(m.PREFLIGHT_ONLY_IDS),{"MKT-AT-002","MKT-AT-003","PROC-AT-001","PROC-AT-003","PROC-AT-006"})
  self.assertTrue(all(x in {c["id"] for c in cases} for x in m.PREFLIGHT_ONLY_IDS))
 def test_log_echo_not_exact_evidence(self):
  k=m.MARKERS["VOICE-AT-004"]
  self.assertTrue(m.exact(k,k))
  self.assertFalse(m.exact("echo "+k,k))
  self.assertFalse(m.exact(k+"_WRONG",k))
if __name__=="__main__":unittest.main()
