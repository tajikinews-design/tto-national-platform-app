"""W0 evidence-index consistency gate. Does not grant legal/runtime authority.

Checks saved source snapshots and local QA evidence shape; NEVER queries external
systems, uploads documents, or treats GitHub CI as formal legal approval.
"""
import json
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
INDEX=ROOT/"docs/evidence/SHAREHOLDER_W0_EVIDENCE_INDEX_2026-10-27.json"
DECISIONS=ROOT/"docs/decisions/SHAREHOLDER_NEXT_PHASE_EXECUTION_GATES_2026-10-27.json"
SOURCE=ROOT/"status/PHASE_GATES.json"
DOMAINS=ROOT/"docs/contracts/shareholder-source-readiness-phase4d-v1.json"
AUTH=ROOT/"docs/contracts/shareholder-source-authority-readiness-v1.json"
SHA=re.compile(r"^[0-9a-f]{40}$")

class ShareholderW0IndexConsistency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.idx=json.loads(INDEX.read_text("utf-8"))
        cls.dec=json.loads(DECISIONS.read_text("utf-8"))
        cls.source=json.loads(SOURCE.read_text("utf-8"))
        cls.domains=json.loads(DOMAINS.read_text("utf-8"))
        cls.authority=json.loads(AUTH.read_text("utf-8"))

    def test_01_index_scope_and_immutable_baseline(self):
        self.assertEqual(self.idx["kind"],"W0_SHAREHOLDER_EVIDENCE_INDEX_NON_AUTHORIZING")
        self.assertEqual(self.idx["w0SourceParentSha"],
                         "c4f9dc5ba523b401a0ea3c9e875c945509441144")
        self.assertEqual(self.idx["runtimeEvidenceSha"],
                         "e9f588f7e37c4c2a18853a7feb70a7f27a57b500")
        self.assertEqual(self.idx["runtimeEvidenceSha"],self.dec["baseRuntimeSha"])

    def test_02_pr_stack_has_expected_exact_shas_and_no_merges(self):
        prs=self.idx["historicalPRs"]
        self.assertEqual([r["number"] for r in prs],list(range(30,38)))
        self.assertEqual([r["phase"] for r in prs],
                         ["4A","4B","4C","4D","4E","4F","4G","ARCHITECTURE_REVIEW"])
        self.assertEqual(len({p["sha"] for p in prs}),8)
        self.assertTrue(all(SHA.fullmatch(p["sha"]) and p["draft"]
                            and p["state"]=="open" and not p["merged"] for p in prs))
        self.assertEqual(prs[6]["sha"],self.idx["runtimeEvidenceSha"])
        self.assertEqual(prs[7]["sha"],self.idx["w0SourceParentSha"])
        self.assertTrue(all(p["legalApproval"] is False and
                            p["productionApproved"] is False for p in prs))

    def test_03_explicitly_bounded_local_evidence(self):
        prs={r["phase"]:r for r in self.idx["historicalPRs"]}
        self.assertEqual(prs["4C"]["acceptanceEvidence"]["checks"],156)
        self.assertEqual(prs["4E"]["acceptanceEvidence"]["checks"],65)
        self.assertEqual(prs["4F"]["acceptanceEvidence"]["checks"],71)
        self.assertIs(prs["4G"]["acceptanceEvidence"]["individualCaseOutputObserved"],False)
        self.assertIn("20_CASE_LINES",
                      prs["4G"]["acceptanceEvidence"]["details"])
        self.assertEqual(prs["4G"]["acceptanceEvidence"]["kind"],
                         "USER_REPORTED_EXACT_SHA_TERMINAL_RELEASE_PASS")

    def test_04_legal_gate_counts_match_repositories_contracts(self):
        child=self.idx["authoritativeSourceGates"]
        self.assertEqual(child["child06Membership"]["controlsPending"],9)
        self.assertEqual(child["child07Shareholding"]["controlsPending"],10)
        self.assertEqual(child["child07TradeHistory"]["controlsPending"],7)
        self.assertEqual(child["child09Notices"]["controlsPending"],8)
        self.assertEqual([len(x["evidence"]) for x in self.domains["sourceDomains"]],[9,10])
        self.assertEqual([len(x["requiredEvidence"]) for x in self.authority["domains"]],[7,8])
        self.assertTrue(all(x["operationalSource"]=="BLOCKED"
            for x in [child["child06Membership"],child["child07Shareholding"],
                      child["child07TradeHistory"],child["child09Notices"]]))
        self.assertEqual(self.domains["approvalState"],"NO_LIVE_SOURCE_APPROVAL")
        self.assertFalse(self.authority["runtimeActivationSupported"])

    def test_05_live_sources_trades_merge_and_deploy_still_denied(self):
        g=self.idx["authoritativeSourceGates"]
        self.assertEqual(g["realEvidenceUpload"],"DISABLED")
        self.assertEqual(g["realSms"],"DISABLED")
        self.assertEqual(g["realShareTrading"],"DISABLED")
        self.assertEqual(g["companyAccounting"],"OUT_OF_SCOPE")
        self.assertEqual(g["inAppWallet"],"OUT_OF_SCOPE")
        self.assertEqual(self.idx["operations"]["mainMerge"],"NOT_AUTHORIZED")
        self.assertEqual(self.idx["operations"]["production"],"NOT_AUTHORIZED")
        self.assertTrue(all(p in self.idx["localAcceptanceIsNot"] for p in
          ("MERGE_APPROVAL","SOURCE_OWNER_APPROVAL","DEPLOY_APPROVAL",
           "SHARE_TRADE_AUTHORIZATION")))

    def test_06_ci_status_scope_does_not_infer_hosted_success(self):
        ci={x["pr"]:x for x in self.idx["commitStatuses"]}
        self.assertEqual(set(ci),{35,36,37})
        for n,item in ci.items():
            self.assertEqual(item["sha"],next(x["sha"] for x in
                            self.idx["historicalPRs"] if x["number"]==n))
        self.assertEqual(list(ci[37]["statusByTarget"].values()),["failure"]*4)
        self.assertEqual(sum(v=="success" for v in ci[36]["statusByTarget"].values()),3)
        self.assertEqual(ci[36]["statusByTarget"]["tto-api-preview"],"failure")
        self.assertTrue(all(x["failureClass"].startswith("VERCEL_") for x in ci.values()))

    def test_07_w1_remains_synthetic_and_requires_project_owner(self):
        w=self.idx["uiModules"]
        self.assertEqual(w["total"],11)
        self.assertEqual(len(w["implementedProtectedSlices"])+
                         len(w["protectedInformationShells"]),11)
        self.assertEqual(w["nextSliceAuthorization"],
                         "PROPOSED_AWAITING_PROJECT_OWNER_DECISION")
        self.assertFalse(self.idx["syntheticUiAuthorization"]["realUserData"])
        self.assertFalse(self.idx["syntheticUiAuthorization"]["tradePostEndpoint"])
        self.assertFalse(self.idx["syntheticUiAuthorization"]["realProviderAccess"])
        decisions={x["id"]:x for x in self.dec["decisions"]}
        self.assertEqual(len(decisions),10)
        self.assertEqual(decisions["DEC-01"]["state"],"PENDING")

    def test_08_discrepancy_is_disclosed_not_rewritten(self):
        d={x["code"] for x in self.idx["knownEvidenceDiscrepancies"]}
        self.assertIn("PHASE4F_SOURCE_STATUS_STALE",d)
        self.assertIn("PHASE4G_SOURCE_STATUS_STALE",d)
        self.assertIn("HOSTED_BUILD_RATE_LIMIT",d)
        self.assertIn("APPROVED_BUY_SELL_SPEC_NOT_LOCATED_IN_APP_REPO",d)
        self.assertEqual(self.idx["shaAuthority"],
          "EXACT_GIT_COMMIT_PLUS_ATTESTED_LOG_ONLY_NEVER_POLICY_APPROVAL")

if __name__=="__main__":
    unittest.main()
