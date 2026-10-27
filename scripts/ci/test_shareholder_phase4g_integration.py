"""Phase4G Docker contract checks. Real PostgreSQL cases still require local Docker."""
import json
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
class Phase4GIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c=json.loads((ROOT/"docs/contracts/shareholder-confidential-intake-phase4g-v1.json").read_text("utf-8"))
        cls.js=(ROOT/"scripts/e2e-phase4g-confidential-review-shadow.cjs").read_text("utf-8")
        cls.runner=(ROOT/"scripts/ci/run-local-docker.ps1").read_text("utf-8")
    def test_01_synthetic_only_db(self):
        for line in ("process.env.CI!==\"true\"","process.env.TTO_LOOPBACK_E2E!==\"1\"",
                     "process.env.TEST_ADMIN_DATABASE_URL!==DB","postgresql://postgres@127.0.0.1:5432/tto"):
            self.assertIn(line,self.js)
        self.assertIn("CREATE TEMP TABLE phase4g_case",self.js)
        self.assertIn("CREATE TEMP TABLE phase4g_evidence",self.js)
        self.assertNotIn("DATABASE_URL",self.js)
        self.assertNotIn("https://",self.js)
    def test_02_no_operational_table_writes(self):
        self.assertNotRegex(self.js,r"(?:INSERT INTO|UPDATE|DELETE FROM)\s+tto\.")
        self.assertIn('await q("BEGIN");txn=true;',self.js)
        self.assertIn('await q("ROLLBACK");txn=false;',self.js)
        self.assertIn("ROLLBACK TO SAVEPOINT phase4g_probe",self.js)
        self.assertIn("TTO_PHASE4G_CONFIDENTIAL_SHADOW_ROLLBACK_PASS",self.js)
    def test_03_twenty_cases(self):
        initial=re.findall(r'await one\("0[1-6]-',self.js)
        attacks=re.findall(r'\["(?:0[7-9]|1[0-9]|20)-',self.js)
        self.assertEqual(len(initial),6)
        self.assertEqual(len(attacks),14)
        self.assertIn("TTO_PHASE4G_REAL_PG17_INTAKE_CASES=20/20",self.js)
        self.assertIn("TTO_PHASE4G_REAL_SOURCE_APPROVAL=BLOCKED",self.js)
        self.assertIn("TTO_PHASE4G_REAL_DOCUMENT_UPLOAD=DISABLED",self.js)
    def test_04_release_gate_after_phase4f(self):
        first="node scripts/e2e-phase4f-legal-authority-chain.cjs"
        second="node scripts/e2e-phase4g-confidential-review-shadow.cjs"
        self.assertIn(first,self.runner)
        self.assertIn(second,self.runner)
        self.assertLess(self.runner.index(first),self.runner.index(second))
        self.assertIn("TTO_LOCAL_HOST_PORTS=NONE",self.runner)
        self.assertIn("python3 -m unittest discover -s scripts/ci -p test_*.py -v",self.runner)
    def test_05_exact_blocked_per_cooperative_domain(self):
        self.assertEqual([x["sourceDomain"] for x in self.c["domains"]],
                         ["CHILD06_MEMBERSHIP","CHILD07_HOLDINGS"])
        self.assertEqual([len(x["mandatoryControls"]) for x in self.c["domains"]],[9,10])
        self.assertEqual(self.c["operationalAuthorityApproval"],
                         "BLOCKED_UNTIL_SEPARATE_EXTERNAL_LEGAL_DECISION")
        self.assertFalse(self.c["realEvidenceIngressEnabled"])
        self.assertIsNone(self.c["confidentialIntake"]["realEndpoint"])
        self.assertFalse(self.c["realSourceConnectionEnabled"])
if __name__=="__main__":unittest.main()
