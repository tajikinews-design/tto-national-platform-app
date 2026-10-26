"""Offline guard for the synthetic-only PostgreSQL17 source-admission adversarial suite."""
import json
from pathlib import Path
import re
import unittest

from verify_shareholder_source_readiness_phase4d import PACKET, validate, summarize

ROOT=Path(__file__).resolve().parents[2]

class ShareholderPhase4E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.js=(ROOT/"scripts/e2e-phase4e-source-admission-attack-matrix.cjs").read_text(encoding="utf-8")
        cls.runner=(ROOT/"scripts/ci/run-local-docker.ps1").read_text(encoding="utf-8")

    def test_fixed_disposable_runtime(self):
        for token in ('process.env.TTO_LOOPBACK_E2E!=="1"',
                      'process.env.TEST_ADMIN_DATABASE_URL!==URL',
                      'process.env.CI!=="true"',
                      'postgresql://postgres@127.0.0.1:5432/tto',
                      'createRequire(resolve(__dirname,"../services/api/package.json"))("pg")'):
            self.assertIn(token,self.js)

    def test_exactly_22_adversarial_cases(self):
        numbers=re.findall(r'await test\("([0-9]{2})-',self.js)
        self.assertEqual(numbers,[f"{i:02d}" for i in range(1,23)])
        for token in ("foreign-tenant-evidence-denied","source-domain-swapping-denied",
                      "expired-membership-source-denied","app-cannot-write-source-approvals",
                      "unauthenticated-context-denies-shares",
                      "snapshot-mutation-protected","quarantine-claims-immutable"):
            self.assertIn(token,self.js)

    def test_all_ephemeral_changes_rolled_back(self):
        for token in ('await main.query("BEGIN");inTransaction=true;',
                      'await main.query("ROLLBACK");inTransaction=false;',
                      'if(inTransaction)await main.query("ROLLBACK")',
                      'SAVEPOINT phase4e_denied_write',
                      'ROLLBACK TO SAVEPOINT phase4e_denied_write',
                      'TTO_PHASE4E_PG17_MUTATIONS_ROLLED_BACK=true'):
            self.assertIn(token,self.js)
        self.assertNotIn('await main.query("COMMIT")',self.js)

    def test_docker_core_runs_suite_after_original_e2e(self):
        original='node scripts/e2e-cf02-identity-authority.cjs'
        new='node scripts/e2e-phase4e-source-admission-attack-matrix.cjs'
        self.assertIn(original,self.runner)
        self.assertIn(new,self.runner)
        self.assertLess(self.runner.index(original),self.runner.index(new))
        self.assertIn('TTO_LOCAL_HOST_PORTS=NONE',self.runner)

    def test_source_packet_remains_legally_blocked(self):
        packet=json.loads(PACKET.read_text(encoding="utf-8"))
        self.assertEqual(validate(packet),[])
        self.assertFalse(summarize(packet)["canActivateLiveSources"])
        self.assertEqual(sum(len(x["evidence"]) for x in packet["sourceDomains"]),19)

    def test_admission_is_inspection_only(self):
        for token in ("TTO_PHASE4E_REAL_PG17_ATTACK_MATRIX_PASS",
                      "TTO_PHASE4E_NO_REAL_SOURCE_OR_LEGAL_APPROVAL"):
            self.assertIn(token,self.js)
        self.assertNotIn("LIVE_SOURCE_APPROVED",self.js)

if __name__=="__main__":
    unittest.main()
