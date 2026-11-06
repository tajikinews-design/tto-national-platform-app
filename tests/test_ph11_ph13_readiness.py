import importlib.util
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("gate",ROOT/"scripts/ci/ph11-ph13-readiness.py")
gate=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
class ReadinessIsNotRelease(unittest.TestCase):
 def setUp(self):
  self.m=gate.load("docs/analysis/PH11_PH13_READINESS_GATE.json")
  self.s=gate.load("status/PHASE_GATES.json")
  self.e=gate.load("docs/analysis/PH01_SOURCE_148_ENTITY_FIELD_INDEX.json")
  self.f=gate.load("docs/analysis/PH01_148_ENTITY_FIELD_PHYSICAL_CANDIDATES.json")
  self.a=gate.load("docs/analysis/PH01_155_ACCEPTANCE_EVIDENCE_GATE.json")
  self.p=gate.load("docs/analysis/PH10_INTEGRATION_ACCEPTANCE_GATE.json")
 def check(self):
  return gate.verify(self.m,self.s,self.e,self.f,self.a,self.p)
 def test_truthed_hold(self):
  out=self.check()
  self.assertEqual(out["sourceAcceptances"],155)
  self.assertEqual(out["formallyAccepted"],0)
  self.assertEqual(out["phase14"],"NOT_DEFINED")
  self.assertEqual(set(out["phases"]),{"PHASE-11","PHASE-12","PHASE-13"})
 def test_fabricated_phase_green_fails(self):
  self.m["phases"]["PHASE-12"]["status"]="GREEN"
  with self.assertRaisesRegex(AssertionError,"FALSE_PHASE_GREEN"):self.check()
 def test_invented_phase14_fails(self):
  self.m["phase14"]="GREEN"
  with self.assertRaisesRegex(AssertionError,"PHASE14_NOT_AUTHORIZED"):self.check()
 def test_manual_approval_without_evidence_fails(self):
  self.m["phases"]["PHASE-13"]["ownerSignedRelease"]="APPROVED"
  with self.assertRaisesRegex(AssertionError,"UNVERIFIED_GATE_PROMOTED"):self.check()
 def test_148_physical_parity_without_review_fails(self):
  self.f["rows"][0]["actual_semantic_equivalence_certified"]=True
  with self.assertRaisesRegex(AssertionError,"UNSUPPORTED_PHYSICAL_PARITY"):self.check()
 def test_original_155_acceptance_cannot_be_invented(self):
  self.a["not_accepted_per_source"]=0
  with self.assertRaisesRegex(AssertionError,"SOURCE155_FALSE_SIGNOFF"):self.check()
if __name__=="__main__":unittest.main()
