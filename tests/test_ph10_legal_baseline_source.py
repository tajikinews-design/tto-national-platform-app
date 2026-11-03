"""PH10 verifies official approved project law register provenance and no implicit activation.
No current statutory-law opinion or real signed source authority is claimed.
"""
import json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(relative):
 return json.loads((ROOT/relative).read_text(encoding="utf8"))
class LegalSourceIndex(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.baseline=load("docs/analysis/PH10_APPROVED_LEGAL_BASELINE_INDEX.json")
  cls.source=load("docs/source/SOURCE_BASELINE.json")
 def test_reference_count_and_identifiers(self):
  ids=[x["legalGateId"] for x in self.baseline["entries"]]
  self.assertEqual(len(ids),42)
  self.assertEqual(len(set(ids)),42)
  self.assertIn("LG-SHR-01",ids)
  self.assertIn("LG-GOV-03",ids)
  self.assertIn("LG-PAY-01",ids)
  self.assertIn("LG-GRC-03",ids)
  self.assertEqual(self.baseline["sourceGateCount"],42)
  self.assertIn("LEGAL BASELINE APPROVED",self.baseline["sourceApproval"])
 def test_statuses_cannot_be_invented(self):
  by_id={x["legalGateId"]:x for x in self.baseline["entries"]}
  self.assertEqual(by_id["LG-SHR-01"]["projectBaselineStatus"],"RESOLVED")
  self.assertEqual(by_id["LG-SHR-08"]["projectBaselineStatus"],"DEFERRED")
  self.assertEqual(by_id["LG-GOV-03"]["projectBaselineStatus"],"RESOLVED")
  self.assertIsNone(by_id["LG-GRC-02"]["projectBaselineStatus"])
  self.assertIsNone(by_id["LG-GRC-03"]["projectBaselineStatus"])
 def test_valid_project_baseline_is_not_live_approval(self):
  self.assertEqual(self.baseline["liveSourceApproval"],"NOT_INFERRED_FROM_BASELINE")
  self.assertTrue(self.baseline["noGeneralAccountingOrCashCustody"])
  self.assertTrue(self.baseline["officialVotingOnlyViaAuthorizedExternalSystem"])
  self.assertTrue(self.baseline["lawBasedShareTransfersRequireAuthoritativeProof"])
  readiness=load("docs/contracts/shareholder-source-authority-readiness-v1.json")
  self.assertEqual(readiness["authorizationState"],"LEGAL_AND_SOURCE_NOT_APPROVED")
  self.assertFalse(readiness["runtimeActivationSupported"])
  chain=load("docs/contracts/shareholder-legal-source-chain-phase4f-v1.json")
  self.assertFalse(chain["sourceApprovalsReal"])
  self.assertFalse(chain["canActivateSource"])
 def test_legal_baseline_reference_immutable_pinned(self):
  names=[x["path"] for x in self.source["files"]]
  self.assertIn("TTO-CONSOLIDATED-LEGAL-GATE-REGISTER v1.0.docx",names)
  self.assertIn("TTO-Share-Market-Spec-v3.0.docx",names)
  self.assertIn("TTO-UNIFIED-IMPLEMENTATION-PACK-v1.0.docx",names)
  self.assertTrue(self.source["read_only"])
  self.assertEqual(len(self.source["files"]),15)
if __name__=="__main__":unittest.main()
