"""W2.4 offline audit security invariants; no production log storage or Docker."""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
LEDGER=ROOT/"scripts/security/w24-offline-audit-ledger.cjs"
TEST=ROOT/"scripts/ci/w24-offline-audit-chain.test.cjs"
WORKFLOW=ROOT/".github/workflows/tto-adaptive-ci.yml"
CONTRACT=ROOT/"docs/contracts/shareholder-w2-4-offline-audit-trace-v0.1.json"

class W24OfflineAuditContract(unittest.TestCase):
    def test_01_no_production_integration(self):
        for root in (ROOT/"apps/shareholder/app", ROOT/"services/api/src"):
            for f in root.rglob("*.ts"):
                self.assertNotIn("w24-offline-audit-ledger",f.read_text(encoding="utf8"),str(f))
            for f in root.rglob("*.tsx"):
                self.assertNotIn("w24-offline-audit-ledger",f.read_text(encoding="utf8"),str(f))
        module=(ROOT/"services/api/src/module.ts").read_text(encoding="utf8")
        self.assertNotIn("W24",module)

    def test_02_strict_allowlist_and_no_credentials(self):
        s=LEDGER.read_text(encoding="utf8")
        for marker in ('const INPUT_FIELDS=["requestId","phase","decision","reasonCode"].sort()',
                       'Object.keys(v).sort()', 'process.env.TTO_W24_AUDIT_LAB==="1"',
                       'process.env.NODE_ENV==="test"', '!process.env.DATABASE_URL',
                       '!process.env.TTO_API_BASE_URL', '!process.env.APIIR_TOKEN',
                       '!process.env.TEST_ADMIN_DATABASE_URL','fs.openSync(file,"wx",0o600)',
                       'fs.fsyncSync(fd)', 'this.failed=true','AUDIT_EVENT_INVALID',
                       'AUDIT_UNAVAILABLE','const MAX_BYTES=64*1024'):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        for forbidden in ('spawn(', 'spawnSync(', 'fetch(', 'new Pool(', 'console.log(input)',
                          'DATABASE_URL??', 'env:process.env', 'docker run'):
            self.assertNotIn(forbidden,s)

    def test_03_integrity_requires_independent_checkpoint(self):
        s=LEDGER.read_text(encoding="utf8")
        for marker in ('expected.count', 'expected.head', 'CHAIN_INVALID',
                       'CHECKPOINT_MISMATCH','PARTIAL_RECORD','PERMISSIONS_INVALID',
                       'previousHash:this.head', 'sha(canonical(event))',
                       'checkRecord(record,i+1,prev)','stat.isSymbolicLink()'):
            self.assertIn(marker,s)
        self.assertNotIn('return {ok:true,code:"VERIFIED"}',s)

    def test_04_real_synthetic_bff_nest_pdp_trace_tests(self):
        s=TEST.read_text(encoding="utf8")
        for marker in ('NextRequest', 'NestFactory.create(W24TestOnlyModule',
                       'prepareW1SyntheticBffCandidate',
                       'prepareW23DormantBffEnvelope',
                       'verifyW23DormantNestEnvelope',
                       'runW22CancellablePDP("read",checked.context',
                       'TTO_W24_STRICT_NO_PII_AUDIT_ALLOWLIST=PASS',
                       'TTO_W24_BFF_NEST_PDP_CORRELATED_TRACE=PASS',
                       'TTO_W24_DENIAL_AUDITED_BEFORE_PDP=PASS',
                       'TTO_W24_AUDIT_FAILURE_FAIL_CLOSED=PASS',
                       'TTO_W24_TIMEOUT_NO_SOURCE_AND_AUDIT_CHECKPOINT=PASS',
                       'TTO_W24_TAMPER_REORDER_TRUNCATE_DETECTED=PASS',
                       'TTO_W24_INDEPENDENT_CHECKPOINT_REQUIRED=PASS',
                       'TTO_W24_AUDIT_STORAGE_UNAVAILABLE_DENIED=PASS',
                       'TTO_W24_NO_RECOVERY_WITHOUT_RECONCILIATION=PASS'):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        self.assertNotIn('postgresql://',s)
        self.assertNotIn('docker run',s)

    def test_05_github_actions_is_exact_draft_no_docker(self):
        s=WORKFLOW.read_text(encoding="utf8")
        name="test/w2-4-tamper-evident-audit-no-docker-20261101"
        self.assertIn("github.event.pull_request.draft && github.head_ref == '"+name+"'",s)
        self.assertIn('TTO_W24_AUDIT_LAB: "1"',s)
        self.assertIn('node --test scripts/ci/w24-offline-audit-chain.test.cjs',s)
        self.assertIn('node --test scripts/ci/w2-2-cancellable-pdp.test.cjs',s)
        self.assertIn('node --test scripts/ci/w23-dormant-boundary-contract.test.cjs',s)
        self.assertIn('TTO_W24_GITHUB_ACTIONS_NO_DOCKER=PASS',s)
        for label in ("Start a single disposable local PostgreSQL 17 container",
            "Apply migrations 0001-0010 to disposable PG17 only",
            "Real Next Nest PostgreSQL identity, tenant, source and share quarantine E2E",
            "Complete historical SQL, OTP, login/logout and authority regression",
            "Build and smoke all four OCI images without registry push",
            "Stop isolated PostgreSQL even on failure"):
            part=s.split("- name: "+label,1)
            self.assertEqual(len(part),2,label)
            self.assertIn("env.TTO_W2_NO_DOCKER_BRANCH != 'true'",
                part[1].split("- name:",1)[0],label)

    def test_06_contract_rejects_real_authority(self):
        o=json.loads(CONTRACT.read_text(encoding="utf8"))
        self.assertEqual(o["schemaVersion"],"0.1-DRAFT")
        for k in ("operationalDatabase","dockerUsed","productionRoutesModified",
            "durableCentralAudit","cryptographicSignature","legalAuthorityGranted",
            "shareTradingEnabled","sourceApprovalGranted"):
            self.assertFalse(o[k],k)
        self.assertEqual(o["trace"]["legalOperationalEffect"],"NONE")
        self.assertFalse(o["acceptance"]["mergeAllowed"])
        self.assertFalse(o["acceptance"]["deployAllowed"])
        self.assertTrue(o["acceptance"]["sixDockerStepsSkipped"])

if __name__=="__main__":
    unittest.main()
