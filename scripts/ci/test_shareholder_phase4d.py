"""Phase4D governance admission: block forged legal approvals without touching live data."""
import copy
import json
from pathlib import Path
import unittest

from verify_shareholder_source_readiness_phase4d import (
    PACKET, PREVIOUS_PACKET, EXPECTED, validate, summarize,
)
from verify_shareholder_source_packet import validate_blocked_packet

ROOT=Path(__file__).resolve().parents[2]

class ShareholderReadSourcesPhase4D(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packet=json.loads(PACKET.read_text(encoding="utf-8"))
        cls.previous=json.loads(PREVIOUS_PACKET.read_text(encoding="utf-8"))
        cls.e2e=(ROOT/"scripts/e2e-cf02-identity-authority.cjs").read_text(encoding="utf-8")
        cls.nest=(ROOT/"services/api/src/module.ts").read_text(encoding="utf-8")
        cls.ui=(ROOT/"packages/ui/src/shareholder-workspace.tsx").read_text(encoding="utf-8")
        cls.release=(ROOT/"scripts/ci/run-local-docker.ps1").read_text(encoding="utf-8")

    def test_legal_source_authority_stays_blocked(self):
        self.assertEqual(validate(self.packet),[])
        summary=summarize(self.packet)
        self.assertEqual(summary["reviewState"],"BLOCKED_AWAITING_INDEPENDENT_EVIDENCE")
        self.assertFalse(summary["canActivateLiveSources"])
        self.assertEqual(summary["totalPendingControls"],19)
        self.assertEqual(summary["sourceDomains"][0]["controlsPending"],9)
        self.assertEqual(summary["sourceDomains"][1]["controlsPending"],10)
        self.assertEqual([x["domain"] for x in summary["sourceDomains"]],
                         ["CHILD06_MEMBERSHIP","CHILD07_HOLDINGS"])
        self.assertTrue(all(x["controlsApproved"]==0 for x in summary["sourceDomains"]))

    def test_past_child07_requests_and_child09_notices_gate_untouched(self):
        self.assertEqual(validate_blocked_packet(self.previous),[])
        self.assertEqual({x["sourceDomain"] for x in self.previous["domains"]},{"CHILD07","CHILD09"})
        self.assertFalse(self.previous["runtimeActivationSupported"])
        self.assertNotEqual("trade-requests",self.packet["sourceDomains"][1]["route"])

    def test_not_a_source_activation_mechanism(self):
        self.assertFalse(self.packet["artifactCanGrantPermission"])
        self.assertFalse(self.packet["runtimeActivationRequested"])
        self.assertIsNone(self.packet["productionConnection"])
        self.assertFalse(self.packet["realDataPresent"])
        for source in self.packet["sourceDomains"]:
            self.assertFalse(source["liveDataEnabled"])
            self.assertFalse(source["writesAllowed"])
            self.assertTrue(source["authorizedReadOnly"])
            self.assertTrue(all(source[x] is None for x in (
                "officialOwner","tenantId","sourceRef","ruleSnapshotRef",
                "authorityEvidenceId","independentApprover","approvalValidUntil"
            )))
            self.assertTrue(all(control["status"]=="PENDING" for control in source["evidence"]))

    def test_missing_duplicate_or_forged_domains_are_rejected(self):
        cases=[]
        p=copy.deepcopy(self.packet);p["sourceDomains"].pop();cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][1]=copy.deepcopy(p["sourceDomains"][0]);cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][1]["domain"]="CHILD07";cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][0]["route"]="trade-requests";cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][0]["sourceTables"][0]="private.customer_accounts";cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][1]["requiredResponseFields"]=["shareQuantity"];cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][0]["requirements"].pop();cases.append(p)
        for i,case in enumerate(cases):
            with self.subTest(case=i): self.assertTrue(validate(case))

    def test_forged_approval_and_live_credentials_are_rejected(self):
        cases=[]
        for field,value in (
            ("approvalState","APPROVED"),("tenantSpecificApprovalRequired",False),
            ("artifactCanGrantPermission",True),("runtimeActivationRequested",True),
            ("realDataPresent",True),("productionConnection",{"url":"https://fake.example"}),
            ("neverUseAsApproval",[]),
            ("priorAcceptedLocalSha","unverified"),
        ):
            p=copy.deepcopy(self.packet);p[field]=value;cases.append(p)
        for domain in (0,1):
            for field,value in (
                ("officialOwner","CI REVIEWER"),("tenantId","fake-tenant"),
                ("sourceRef","pretend-approved-source"),("ruleSnapshotRef","fixture"),
                ("authorityEvidenceId","fake-evidence"),("independentApprover","self"),
                ("approvalValidUntil","2099-01-01T00:00:00Z"),
                ("authorizedReadOnly",False),("liveDataEnabled",True),
                ("writesAllowed",True),
            ):
                p=copy.deepcopy(self.packet);p["sourceDomains"][domain][field]=value;cases.append(p)
            for field,value in (
                ("status","APPROVED"),("evidenceRef","fake"),
                ("reviewedBy","fixture"),("reviewedAt","2099-01-01T00:00:00Z"),
                ("controlId","CI_OVERRIDE"),
            ):
                p=copy.deepcopy(self.packet)
                p["sourceDomains"][domain]["evidence"][0][field]=value
                cases.append(p)
        for i,case in enumerate(cases):
            with self.subTest(case=i): self.assertTrue(validate(case))

    def test_evidence_shape_and_strict_bool_not_truthy(self):
        cases=[]
        p=copy.deepcopy(self.packet);p["sourceDomains"][1]["evidence"].pop();cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][1]["evidence"][1]["controlId"]=p["sourceDomains"][1]["evidence"][0]["controlId"];cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][0]["evidence"][0]["newApprovalBypass"]=True;cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][0]["evidence"][0]=None;cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][0]["liveDataEnabled"]=0;cases.append(p)
        p=copy.deepcopy(self.packet);p["sourceDomains"][1]["writesAllowed"]=0;cases.append(p)
        p=copy.deepcopy(self.packet);p["artifactCanGrantPermission"]=0;cases.append(p)
        p=copy.deepcopy(self.packet);p["tenantSpecificApprovalRequired"]=1;cases.append(p)
        p=copy.deepcopy(self.packet);p["surprise"]="allow";cases.append(p)
        for i,case in enumerate(cases):
            with self.subTest(case=i): self.assertTrue(validate(case))

    def test_exact_member_and_ledger_contracts_follow_db_source_routes(self):
        for domain in EXPECTED:
            self.assertIn(domain,self.e2e)
        self.assertIn('tto.my_member_profile_from_source($1)',self.nest)
        self.assertIn('tto.my_shareholding_from_source($1)',self.nest)
        self.assertIn('tto.member_source_snapshots',self.e2e)
        self.assertIn('tto.shareholding_source_snapshots',self.e2e)
        self.assertIn('tto.source_contract_approvals',self.e2e)
        self.assertIn('source_version',self.e2e)
        self.assertIn('ledger_version',self.e2e)
        self.assertIn('STALE_SOURCE_VERSION',self.e2e)
        self.assertIn('REPLAY_IDENTICAL_REFERENCE',self.e2e)
        self.assertIn('MEMBER_MASTER_PROJECTION_MISMATCH',self.e2e)

    def test_personal_data_never_inferred_from_login_or_empty_ledger(self):
        self.assertIn('await status(await get(sharePath,myToken),403,"absent ledger entry must not be zero shares")',self.e2e)
        self.assertIn('assert.equal(zeroSource.record.shareQuantity,"0")',self.e2e)
        self.assertIn('await status(await get(memberPath,tokenMap.get(MANAGER)),403',self.e2e)
        self.assertIn('cross cooperative',self.e2e)
        self.assertIn('if(response.status===401)throw Error("SESSION_EXPIRED")',self.ui)
        self.assertIn('setMember(EMPTY_MEMBER);setHolding(EMPTY_HOLDING)',self.ui)
        self.assertIn('no-store',self.e2e)
        self.assertIn('ناموجود به معنی صفر نیست',self.ui)
        self.assertIn('پرداخت مستقیم خریدار به فروشنده',self.ui)

    def test_offline_gate_participates_in_full_release_without_network(self):
        self.assertIn('test_*.py',self.release)
        self.assertIn('unittest discover',self.release)
        self.assertIn('TTO_LOCAL_HOST_PORTS=NONE',self.release)
        self.assertNotIn('password',json.dumps(self.packet).lower())
        self.assertNotIn('apiir',json.dumps(self.packet).lower())

if __name__=="__main__":
    unittest.main()
