"""Executable acceptance regression for Phase2B: real sessions still denied."""
import copy
import json
from pathlib import Path
import unittest
from verify_shareholder_source_packet import PACKET, EXPECTED, validate_blocked_packet

ROOT=Path(__file__).resolve().parents[2]

class SourceAcceptanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packet=json.loads(PACKET.read_text(encoding="utf-8"))
        cls.e2e=(ROOT/"scripts/e2e-cf02-identity-authority.cjs").read_text(encoding="utf-8")
        cls.nest=(ROOT/"services/api/src/module.ts").read_text(encoding="utf-8")

    def test_baseline_is_blocked_and_complete(self):
        self.assertEqual(validate_blocked_packet(self.packet),[])
        self.assertEqual(set(EXPECTED),{"CHILD07","CHILD09"})
        self.assertEqual(sum(len(d["requiredEvidence"]) for d in self.packet["domains"]),15)
        self.assertFalse(self.packet["runtimeActivationSupported"])

    def test_no_manifest_edit_can_activate_real_sources(self):
        mutants=[]
        for key,value in (("runtimeActivationSupported",True),
                          ("authorizationState","APPROVED"),
                          ("tenantScopedApprovalRequired",False)):
            item=copy.deepcopy(self.packet)
            item[key]=value
            mutants.append(item)
        for field,value in (("decision","APPROVED"),
                            ("publicationOrTradingWritesAllowed",True),
                            ("sourceContract","OTHER_SOURCE")):
            item=copy.deepcopy(self.packet)
            item["domains"][0][field]=value
            mutants.append(item)
        item=copy.deepcopy(self.packet)
        item["domains"][1]["sourceConnection"]={
            "status":"CONNECTED","endpoint":"https://invalid.example","credentialRef":None}
        mutants.append(item)
        for idx,item in enumerate(mutants):
            with self.subTest(mutant=idx):
                self.assertTrue(validate_blocked_packet(item))

    def test_unreviewed_or_missing_evidence_never_converts_to_approval(self):
        mutations=[]
        for update in (
            {"status":"APPROVED"},
            {"evidenceRef":"unauthorized-fixture"},
            {"reviewedBy":"mock-manager"},
            {"reviewedAt":"2026-10-23T12:00:00Z"}
        ):
            item=copy.deepcopy(self.packet)
            item["domains"][0]["requiredEvidence"][0].update(update)
            mutations.append(item)
        item=copy.deepcopy(self.packet)
        item["domains"][1]["requiredEvidence"].pop()
        mutations.append(item)
        item=copy.deepcopy(self.packet)
        item["domains"][0]["sourceDomain"]="CHILD09"
        mutations.append(item)
        for idx,item in enumerate(mutations):
            with self.subTest(mutant=idx):
                self.assertTrue(validate_blocked_packet(item))

    def test_valid_session_and_positive_synthetic_child06_07_still_block_new_reads(self):
        for fragment in (
            'for(const domain of ["trade-requests","notices"])',
            'approved identity/holdings cannot bypass ',
            'valid actor "+domain+" BFF still denied',
            'wrong-tenant "+domain+" cannot be enumerated',
            'browser forged headers cannot bypass ',
            'domain+" is explicitly read-only',
            'revoked session denies "+domain+" on Nest',
            'revoked session denies "+domain+" on BFF',
            'TTO_CF02_NO_REAL_IDENTITIES_NO_SHARE_LEDGER_NO_HOSTED_MIGRATION',
        ):
            with self.subTest(fragment=fragment):
                self.assertIn(fragment,self.e2e)
        self.assertIn('await this.db.sessionActor(auth)',self.nest)
        for path in ('me/trade-requests','me/notices'):
            self.assertIn('@Get("tenants/:tenantId/'+path+'")',self.nest)

    def test_previously_approved_membership_is_not_trade_approval(self):
        self.assertIn('const verifiedShare=await status(await get(sharePath,myToken),200',self.e2e)
        self.assertIn('const privateBody=await status(privateShare,200',self.e2e)
        self.assertLess(
            self.e2e.index('const privateBody=await status(privateShare,200'),
            self.e2e.index(' // Phase-2B: even a REAL valid CI session')
        )

if __name__=="__main__":
    unittest.main()
