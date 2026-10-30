"""W1 real-directory BFF/Nest seam contract: static no-live-attachment guards.

These guardrails run in the existing isolated Python CI before any Next build.
Dynamic proof is provided by the Node loopback integration test and must also
pass under the exact-SHA Docker Release. No live resources or credentials.
"""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BFF = ROOT / "apps/shareholder/lib/w1-boundary-seam.ts"
NEST = ROOT / "services/api/src/w1-boundary-seam.ts"
CHAIN = ROOT / "scripts/ci/w1-bff-nest-pep-chain.test.cjs"
RUNNER = ROOT / "scripts/ci/run-local-docker.ps1"
CONTRACT = ROOT / "docs/contracts/shareholder-w1-bff-nest-boundary-seam-v0.1.json"

class W1BoundarySeamContractTests(unittest.TestCase):
    def test_01_contract_is_draft_and_non_authoritative(self):
        spec = json.loads(CONTRACT.read_text(encoding="utf-8"))
        self.assertEqual(spec["schemaVersion"], "0.1-DRAFT")
        self.assertFalse(spec["runtimeActivation"])
        self.assertFalse(spec["liveSourcesEnabled"])
        self.assertFalse(spec["canGrantPermission"])
        self.assertEqual(spec["authorizationStatus"], "NOT_APPROVED")
        self.assertEqual(spec["legalOperationalEffect"], "NONE")
        self.assertEqual(spec["transportResponseDecisions"], ["DENY", "SIMULATED_ALLOW"])
        self.assertIn("ALLOW", spec["forbiddenDecisions"])
        self.assertEqual(len(spec["testedBoundaries"]), 2)
        self.assertTrue(all(not part.get("attachToLiveRoutes", False) for part in
                            spec["testedBoundaries"][:1]))
        self.assertFalse(spec["testedBoundaries"][1]["attachToLiveAppModule"])

    def test_02_server_seams_are_collocated_but_not_imported_by_live_routes(self):
        self.assertTrue(BFF.is_file())
        self.assertTrue(NEST.is_file())
        for f in (ROOT / "apps/shareholder/app").rglob("*.ts"):
            self.assertNotIn("w1-boundary-seam", f.read_text(encoding="utf-8"),str(f))
        for f in (ROOT / "apps/shareholder/app").rglob("*.tsx"):
            self.assertNotIn("w1-boundary-seam", f.read_text(encoding="utf-8"),str(f))
        for f in (ROOT / "services/api/src").rglob("*.ts"):
            if f != NEST:
                self.assertNotIn("w1-boundary-seam", f.read_text(encoding="utf-8"),str(f))
        actual_nest = (ROOT / "services/api/src/module.ts").read_text(encoding="utf-8")
        self.assertIn("tto.resolve_session", actual_nest)
        self.assertIn("set_config('tto.tenant_id'", actual_nest)
        self.assertIn('throw new ForbiddenException("Source or permission not approved")', actual_nest)
        closed_bff = (ROOT / "apps/shareholder/lib/source-read-access.ts").read_text(encoding="utf-8")
        self.assertIn("return DENIED", closed_bff)

    def test_03_bff_lab_never_trusts_client_role_or_forwards_credentials(self):
        s = BFF.read_text(encoding="utf-8")
        for required in (
            'TTO_W1_BOUNDARY_LAB === "1"', 'prepareW1SyntheticBffCandidate',
            'sanitizeW1SyntheticBffDecision', 'request.cookies.get("tto_lab_session")',
            'trusted.tenantKey !== route.tenantKey', 'trusted.ownerKey !== route.ownerKey',
            'canGrantPermission: false', 'hasActualRecord: false',
            'UPSTREAM_CONTRACT_INVALID', 'SIMULATED_ALLOW',
        ):
            with self.subTest(required=required): self.assertIn(required, s)
        for forbidden in ('request.headers.get("authorization")', 'request.headers.get("x-role")',
                          'request.headers.get("x-source-approved")',
                          'new Pool(', 'DATABASE_URL =', 'sourcePermissionApproved = true'):
            with self.subTest(forbidden=forbidden): self.assertNotIn(forbidden, s)

    def test_04_nest_seam_is_rechecking_server_proof_not_bff_claims(self):
        s = NEST.read_text(encoding="utf-8")
        for required in (
            'TTO_W1_BOUNDARY_LAB === "1"', 'verifyW1SyntheticNestCandidate',
            'r.tenantKey !== serverProof.tenantKey',
            'r.ownerKey !== serverProof.ownerKey', 'serverProof.partyBound !== true',
            'serverProof.sourceApproved !== true',
            'serverProof.readPermission === true',
            'sourceVersion: serverProof.sourceVersion',
            'reauth: false', 'csrf: false', 'ownershipFinalizationApproved: false',
            'paymentState: "NONE"', 'kind: "PEP_CANDIDATE"',
        ):
            with self.subTest(required=required): self.assertIn(required,s)
        for forbidden in ('new Pool(', 'DATABASE_URL=', 'from "./module"',
                          '@Controller(', '@Get(', '@Post(', 'return {decision:"ALLOW"}'):
            with self.subTest(forbidden=forbidden): self.assertNotIn(forbidden, s)

    def test_05_full_transport_harness_executes_both_seams_and_adversarial_tests(self):
        s=CHAIN.read_text(encoding="utf-8")
        for required in (
            'loadSeam("apps/shareholder/lib/w1-boundary-seam.ts")',
            'loadSeam("services/api/src/w1-boundary-seam.ts")',
            'prepareW1SyntheticBffCandidate(req,',
            'verifyW1SyntheticNestCandidate(input,proof)',
            'sanitizeW1SyntheticBffDecision(raw)',
            'direct Nest rejects forged internal candidates',
            'BFF rejects fake ALLOW, source touch on DENY, leaked fields',
            'production environment bit disables both boundary seams',
            'TTO_W1_REAL_BOUNDARY_SEAM_CONTRACT=PASS',
            'TTO_W1_SANITIZED_UPSTREAM_ONLY=PASS',
            'TTO_W1_TEST_ONLY_RUNTIME_GUARD=PASS',
            'TTO_W1_DENIED_FIXTURE_TOUCHES=0',
        ):
            with self.subTest(required=required): self.assertIn(required, s)

    def test_06_ci_requires_lab_opt_in_and_exact_sha_release(self):
        s=RUNNER.read_text(encoding="utf-8")
        self.assertIn("TTO_W1_CHAIN_LAB=1 TTO_W1_BOUNDARY_LAB=1",s)
        self.assertIn("node --test scripts/ci/w1-bff-nest-pep-chain.test.cjs",s)
        self.assertIn("TTO_LOCAL_SOURCE_SHA=$commit",s)
        self.assertIn("COMMIT_MISMATCH:",s)
        self.assertIn('python3 -m unittest discover -s scripts/ci -p test_*.py -v',s)

    def test_07_navigation_and_legal_gates_still_unapproved(self):
        nav=json.loads((ROOT / "docs/analysis/NAVIGATION_CONTRACT.json").read_text(encoding="utf-8"))
        self.assertEqual(nav["implementation_status"], "NOT_IMPLEMENTED")
        self.assertEqual(nav["canonical_root_count"], 11)
        self.assertEqual(len(nav["roots"]), 11)
        for root in nav["roots"]:
            self.assertIsNone(root["authoritative_routes"])
            self.assertIsNone(root["permission_policy"])
            self.assertEqual(root["ui_implementation"], "REVIEW_SHELL_ONLY")
        gates=json.loads((ROOT/"docs/contracts/shareholder-w1-operational-gates-design-v0.1.json").read_text(encoding="utf-8"))
        self.assertFalse(gates["runtimeActivationRequested"])
        self.assertFalse(gates["releaseAuthorization"])
        self.assertEqual(gates["approvalStatus"],"NOT_APPROVED")
        self.assertEqual(gates["sourcePrerequisites"]["CHILD06_MEMBERSHIP"]["status"],"PENDING")
        self.assertEqual(gates["sourcePrerequisites"]["CHILD07_HOLDINGS"]["status"],"PENDING")
        self.assertIn("LIVE_SHARE_TRANSFER",gates["forbiddenCapabilities"])

if __name__ == "__main__":
    unittest.main()
