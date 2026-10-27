"""Phase4G adversarial tests for confidential, tenant-specific legal dossier workflow."""
import copy
from datetime import datetime,timezone
import json
from pathlib import Path
import unittest
from phase4g_confidential_review import (
  ROOT,OLD,PATH,ROLES,EDGES,NOW,Denied,contract,fixture,verify,move,view,audit,expire
)
def assigned(case,role):return case["actors"][role]["id"]
def step(case,to,role):
    return move(case,to,role,assigned(case,role))
def complete(domain):
    case=fixture(domain)
    for to,role in (
      ("SUBMITTED","SOURCE_SUBMITTER"),("QUARANTINED","TECHNICAL_OPERATOR"),
      ("METADATA_VALIDATED","TECHNICAL_OPERATOR"),
      ("AUTHENTICITY_REVIEWED","AUTHORIZED_SOURCE_CUSTODIAN"),
      ("INDEPENDENT_REVIEW_RECORDED","INDEPENDENT_LEGAL_REVIEWER"),
      ("EXTERNAL_SIGNOFF_REQUIRED","INDEPENDENT_LEGAL_REVIEWER")
    ):
        case=step(case,to,role)
    return case
class Phase4GConfidentialIntake(unittest.TestCase):
    def assertDenied(self,case):
        with self.assertRaises(Denied):verify(case)
    def test_01_no_runtime_or_actual_upload(self):
        p=contract()
        for key in ("realEvidenceIngressEnabled","realSourceConnectionEnabled",
                    "realApprovalMutationEnabled","realSharesTradingEnabled",
                    "uploadedDocumentsPresent","liveStorageProvisioned"):
            self.assertIs(p[key],False)
        self.assertIsNone(p["confidentialIntake"]["realEndpoint"])
        self.assertEqual(p["confidentialIntake"]["tempUploadAdapter"],"DISABLED")
        self.assertIn("PER_TENANT_OBJECT_KEYS",p["confidentialIntake"]["futureRequirements"]["encryptionAtRest"])
    def test_02_independent_19_controls(self):
        p=contract()
        self.assertEqual([(d["sourceDomain"],len(d["mandatoryControls"])) for d in p["domains"]],
           [("CHILD06_MEMBERSHIP",9),("CHILD07_HOLDINGS",10)])
        self.assertEqual([d["currentLegalAuthorityStatus"] for d in p["domains"]],
                         ["PENDING_INDEPENDENT_VERIFICATION"]*2)
        self.assertEqual(set(p["separationOfDuties"]),set(ROLES))
    def test_03_complete_synthetic_membership_dossier(self):
        case=complete("CHILD06_MEMBERSHIP")
        self.assertEqual(view(case)["state"],"EXTERNAL_SIGNOFF_REQUIRED")
        self.assertEqual(view(case)["events"],7)
        self.assertFalse(view(case)["realLegalApproval"])
        self.assertFalse(view(case)["sourceActivated"])
        self.assertTrue(audit(case))
    def test_04_complete_synthetic_ledger_dossier(self):
        case=complete("CHILD07_HOLDINGS")
        self.assertEqual(view(case)["state"],"EXTERNAL_SIGNOFF_REQUIRED")
        self.assertFalse(view(case)["realFileIngress"])
        self.assertEqual(len(case["controls"]),10)
    def test_05_no_direct_approval_or_transition_skips(self):
        case=fixture()
        for to in ("EXTERNAL_SIGNOFF_REQUIRED","AUTHENTICITY_REVIEWED",
                   "INDEPENDENT_REVIEW_RECORDED","APPROVED","ACTIVATE_SOURCE"):
            with self.subTest(to=to):
                with self.assertRaises(Denied):
                    move(case,to,"INDEPENDENT_LEGAL_REVIEWER",
                         assigned(case,"INDEPENDENT_LEGAL_REVIEWER"))
    def test_06_wrong_roles_and_self_review(self):
        case=fixture()
        with self.assertRaises(Denied):step(case,"SUBMITTED","TECHNICAL_OPERATOR")
        with self.assertRaises(Denied):move(case,"SUBMITTED","SOURCE_SUBMITTER","FAKE")
        invalid=copy.deepcopy(case)
        invalid["actors"]["INDEPENDENT_LEGAL_REVIEWER"]["id"]=assigned(case,"SOURCE_SUBMITTER")
        self.assertDenied(invalid)
    def test_07_cross_tenant_domain_and_mandate(self):
        for path,value in [
          (("tenantId",),"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
          (("sourceDomain",),"CHILD07_HOLDINGS"),
          (("sourceRef",),"ANOTHER-REGISTER"),
          (("mandate","custodianId"),"FAKE"),
          (("mandate","domain"),"CHILD07_HOLDINGS"),
          (("actors","INDEPENDENT_LEGAL_REVIEWER","tenantId"),"OTHER"),
          (("evidence",0,"tenantId"),"OTHER"),
          (("evidence",0,"domain"),"CHILD07_HOLDINGS")
        ]:
            case=fixture();x=case
            for key in path[:-1]:x=x[key]
            x[path[-1]]=value
            with self.subTest(path=path):self.assertDenied(case)
    def test_08_invalid_evidence_quarantine_and_integrity(self):
        attacks=[
           (("evidence",0,"scan"),"PENDING"),
           (("evidence",0,"scan"),"INFECTED"),
           (("evidence",0,"authenticity"),"SELF_ATTESTED"),
           (("evidence",0,"mime"),"application/x-msdownload"),
           (("evidence",0,"bytes"),10485761),
           (("evidence",0,"bytes"),0),
           (("evidence",0,"classification"),"PUBLIC"),
           (("evidence",0,"sha256"),"invalid"),
           (("evidence",0,"ref"),"OPAQUE-SYN-SOURCE_OWNER_MANDATE_OR_DELEGATION")
        ]
        for path,value in attacks:
            case=fixture();x=case
            for key in path[:-1]:x=x[key]
            x[path[-1]]=value
            with self.subTest(path=path,value=value):self.assertDenied(case)
        case=fixture();case["evidence"].pop()
        self.assertDenied(case)
        case=fixture();case["evidence"][0]["rawDocument"]="FORBIDDEN"
        self.assertDenied(case)
    def test_09_expiry_and_mandate_revocation(self):
        for path,value in [
          (("expiresAt",),"2026-10-27T09:00:00Z"),
          (("mandate","until"),"2026-10-27T09:00:00Z"),
          (("mandate","revoked"),True),
          (("mandate","syntheticTrust"),False),
          (("actors","AUTHORIZED_SOURCE_CUSTODIAN","active"),False)
        ]:
            case=fixture();x=case
            for key in path[:-1]:x=x[key]
            x[path[-1]]=value
            with self.subTest(path=path):self.assertDenied(case)
    def test_10_audit_chain_tampering_denied(self):
        for edit in ("hash","actor","state","remove"):
            case=step(fixture(),"SUBMITTED","SOURCE_SUBMITTER")
            if edit=="hash":case["events"][0]["hash"]="0"*64
            elif edit=="actor":case["events"][1]["event"]["actor"]="IMPERSONATOR"
            elif edit=="state":case["state"]="METADATA_VALIDATED"
            else:case["events"].pop()
            with self.subTest(edit=edit):self.assertDenied(case)
    def test_11_withdraw_reject_terminal(self):
        case=fixture()
        withdrawn=step(case,"WITHDRAWN","SOURCE_SUBMITTER")
        self.assertEqual(withdrawn["state"],"WITHDRAWN")
        self.assertEqual(case["state"],"DRAFT")
        with self.assertRaises(Denied):step(withdrawn,"SUBMITTED","SOURCE_SUBMITTER")
        case=step(case,"SUBMITTED","SOURCE_SUBMITTER")
        rejected=step(case,"REJECTED","INDEPENDENT_LEGAL_REVIEWER")
        self.assertEqual(rejected["state"],"REJECTED")
        with self.assertRaises(Denied):step(rejected,"QUARANTINED","TECHNICAL_OPERATOR")
    def test_13_audited_expiry(self):
        late=datetime(2026,12,3,10,tzinfo=timezone.utc)
        result=expire(fixture(),late)
        self.assertEqual(result["state"],"EXPIRED")
        self.assertTrue(audit(result))

    def test_12_no_live_authority_from_audit_success(self):
        case=complete("CHILD07_HOLDINGS")
        self.assertEqual(case["decision"]["externalApproval"],False)
        self.assertEqual(case["decision"]["recordedBy"],
                         assigned(case,"INDEPENDENT_LEGAL_REVIEWER"))
        p=json.loads(PATH.read_text("utf-8"))
        self.assertNotIn("LEGAL_SOURCE_APPROVED",p["decisionRecord"]["reviewDecisions"])
        self.assertIn("APPROVE_ACTUAL_SOURCE",p["prohibitedActivities"])
        self.assertFalse(p["realSourceConnectionEnabled"])
if __name__=="__main__":unittest.main()

# Offline review simulation only.
