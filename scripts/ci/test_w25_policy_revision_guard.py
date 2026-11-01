"""W2.5 CI-only policy revision and obsolete PDP decision fail-closed guards.

Static tests are NOT sufficient for acceptance: the live Node subprocess
and simulated policy-race tests must pass on exact GitHub Actions SHA too.
"""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
REG=ROOT/"scripts/security/w25-synthetic-policy-registry.cjs"
ENFORCER=ROOT/"scripts/security/w25-synthetic-policy-version-enforcer.cjs"
SUITE=ROOT/"scripts/ci/w25-policy-revision-expiry.test.cjs"
WORKFLOW=ROOT/".github/workflows/tto-adaptive-ci.yml"
CONTRACT=ROOT/"docs/contracts/shareholder-w2-5-policy-revision-fail-closed-v0.1.json"
BRANCH="test/w2-5-policy-revision-expiry-no-docker-20261101"

class W25PolicyRevisionSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reg=REG.read_text(encoding="utf8")
        cls.enf=ENFORCER.read_text(encoding="utf8")
        cls.suite=SUITE.read_text(encoding="utf8")
        cls.wf=WORKFLOW.read_text(encoding="utf8")

    def test_01_synthetic_only_inactive_operational_environment(self):
        for code in (self.reg,self.enf):
            for marker in ('process.env.CI==="true"',
                           'process.env.NODE_ENV==="test"',
                           'process.env.TTO_W25_POLICY_LAB==="1"',
                           '!process.env.VERCEL',
                           '!process.env.DATABASE_URL',
                           '!process.env.TTO_API_BASE_URL',
                           '!process.env.APIIR_TOKEN',
                           '!process.env.TEST_ADMIN_DATABASE_URL',
                           '!process.env.TTO_DB_POOLER_HOST',
                           '!process.env.TTO_DB_APP_PASSWORD'):
                if code is self.reg or marker != 'process.env.TTO_W25_POLICY_LAB==="1"':
                    self.assertIn(marker,code)
            for forbidden in ('new Pool(', 'postgresql://', 'docker run',
                              'fetch(', 'shell:true', 'process.env.DATABASE_URL??'):
                self.assertNotIn(forbidden,code)
        for root in (ROOT/"apps/shareholder/app",ROOT/"services/api/src"):
            for f in list(root.rglob("*.ts"))+list(root.rglob("*.tsx")):
                data=f.read_text(encoding="utf8")
                self.assertNotIn("w25-synthetic-policy-registry",data,str(f))
                self.assertNotIn("w25-synthetic-policy-version-enforcer",data,str(f))
        self.assertNotIn("W25",(ROOT/"services/api/src/module.ts").read_text(encoding="utf8"))

    def test_02_revisions_are_monotonic_and_leases_cannot_be_forged(self):
        code=self.reg
        for m in ('#maxRevision=0','#lastActivatedRevision=0',
                  '#issued=new WeakSet()',
                  'b.revision<=this.#maxRevision',
                  'revision<=this.#lastActivatedRevision',
                  'this.#issued.add(lease)',
                  'this.#issued.has(lease)',
                  'POLICY_LEASE_UNTRUSTED',
                  'Object.freeze({ok:true,lease})',
                  'this.#active=null;this.#epoch++',
                  'this.#active=revision;this.#epoch++',
                  'POLICY_VERSION_STALE',
                  'POLICY_REVOKED',
                  'POLICY_EXPIRED',
                  'POLICY_NOT_YET_VALID',
                  'POLICY_DIGEST_MISMATCH',
                  'REGISTRY_VERSION,b.policyId,b.revision,b.ruleset,b.notBeforeMs,b.expiresAtMs',
                  'const RULES=new Set(["SELF_READ_SYNTHETIC_V1","SELF_READ_SYNTHETIC_V2"])'):
            with self.subTest(m=m):self.assertIn(m,code)
        self.assertNotIn("allowOperational",code)

    def test_03_async_pdp_response_and_audit_are_revalidated_before_fixture(self):
        code=self.enf
        for m in ('const afterPdp=registry.check(lease)',
                  'const afterAudit=registry.check(lease)',
                  'if(!afterAudit?.ok)',
                  'raw=await',
                  'response=await Promise.race([',
                  'rootSignal.addEventListener("abort",onDisconnect,{once:true})',
                  'ctl.abort()',
                  'performance.now()>=expiresAt',
                  'response.revision!==lease.revision',
                  'response.digest!==lease.digest',
                  'response.epoch!==lease.epoch',
                  'validDecision(response.verdict)',
                  'audit.record({requestId,phase:"PDP_DECISION",decision,reasonCode})',
                  'trace.record(evidence)',
                  'cfg.source.read({requestId,policyRevision:lease.revision})',
                  'closeW25DormantBffResult(',
                  'canGrantPermission:false',
                  'legalOperationalEffect:"NONE"',
                  'hasActualRecord:false'):
            with self.subTest(m=m):self.assertIn(m,code)
        self.assertLess(code.index('const afterPdp=registry.check(lease)'),
                        code.index('const positive=await commit('))
        self.assertLess(code.index('const positive=await commit('),
                        code.index('const afterAudit=registry.check(lease)'))
        self.assertLess(code.index('const afterAudit=registry.check(lease)'),
                        code.index('cfg.source.read('))
        self.assertNotIn('return {available:true',code)
        self.assertNotIn('return {status:200',code)

    def test_04_actual_python_and_version_adversarial_suite(self):
        suite=self.suite
        for m in (
            'bindW25SyntheticPDP',
            'runW22CancellablePDP',
            'OfflineAuditLedger',
            'NextRequest',
            'verifyW23DormantNestEnvelope',
            'policy expires WHILE PDP is pending',
            'revocation WHILE PDP is pending',
            'replacement of active revision WHILE PDP pending',
            'post-audit revocation prevents source after PDP simulated allow',
            'stale replay, wrong fingerprint and wrong epoch',
            'missing active policy denied before calling any PDP',
            'corrupt fake source may report attempted access',
            'TTO_W25_POLICY_VERSION_BOUND_TO_PDP_AND_AUDIT=PASS',
            'TTO_W25_NO_VERSION_ROLLBACK_OR_REUSE=PASS',
            'TTO_W25_INFLIGHT_EXPIRY_DISCARDS_PDP_ALLOW=PASS',
            'TTO_W25_INFLIGHT_POLICY_REVOCATION_DENY=PASS',
            'TTO_W25_INFLIGHT_REVISION_SWAP_DENY=PASS',
            'TTO_W25_STALE_DIGEST_EPOCH_REPLAY_DENY=PASS',
            'TTO_W25_RECHECK_AFTER_AUDIT_BEFORE_SOURCE=PASS',
            'TTO_W25_VERSION_AUDIT_FAILURE_DENY=PASS',
            'TTO_W25_NO_PII_VERSION_PROVENANCE=PASS'):
            with self.subTest(m=m):self.assertIn(m,suite)
        self.assertNotIn('docker run',suite)
        self.assertNotIn('postgresql://',suite)

    def test_05_github_exact_draft_no_docker_and_old_security_regressions(self):
        wf=self.wf
        self.assertIn("github.event.pull_request.draft && github.head_ref == '"+BRANCH+"'",wf)
        self.assertIn('TTO_W25_POLICY_LAB: "1"',wf)
        self.assertIn('node --test scripts/ci/w25-policy-revision-expiry.test.cjs',wf)
        self.assertIn('TTO_W25_GITHUB_ACTIONS_NO_DOCKER=PASS',wf)
        for old in ('scripts/ci/w2-inline-lab-http.test.cjs',
                    'scripts/ci/w2-2-cancellable-pdp.test.cjs',
                    'scripts/ci/w23-dormant-boundary-contract.test.cjs',
                    'scripts/ci/w24-offline-audit-chain.test.cjs'):
            self.assertIn('node --test '+old,wf)
        for label in (
            "Start a single disposable local PostgreSQL 17 container",
            "Apply migrations 0001-0010 to disposable PG17 only",
            "Real Next Nest PostgreSQL identity, tenant, source and share quarantine E2E",
            "Complete historical SQL, OTP, login/logout and authority regression",
            "Build and smoke all four OCI images without registry push",
            "Stop isolated PostgreSQL even on failure"
        ):
            part=wf.split("- name: "+label,1)
            self.assertEqual(len(part),2,label)
            self.assertIn("env.TTO_W2_NO_DOCKER_BRANCH != 'true'",
                          part[1].split("- name:",1)[0],label)

    def test_06_contract_makes_no_operational_claims(self):
        c=json.loads(CONTRACT.read_text(encoding="utf8"))
        self.assertEqual(c["schemaVersion"],"0.1-DRAFT")
        self.assertEqual(c["status"],"NOT_OPERATIONALLY_APPROVED")
        self.assertEqual(c["acceptedBaselineSha"],
                         "c3ea5a92b7f0ea48bff986be66b4cac3916d96ad")
        self.assertFalse(c["environment"]["noDocker"] is False)
        for value in c["authorization"].values():self.assertFalse(value)
        self.assertIn("NO CRYPTOGRAPHIC PDP SIGNATURE; not proof actual Python executed that policy version",
                      c["decisionBinding"]["attestation"])
        self.assertIn("Policy revision trace is in-memory and NOT embedded in W2.4 persisted hash chain; production audit schema migration required",
                      c["provenance"]["limitation"])

if __name__=="__main__":
    unittest.main()
