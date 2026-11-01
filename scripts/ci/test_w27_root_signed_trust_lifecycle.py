"""W2.7 signed key publication, rotation/revocation and Draft no-Docker gates.
The Python checks guard the offline boundary; executable Node tests demonstrate
actual subprocess signer behavior and root-signed trust updates.
"""
import json
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
KEYS=ROOT/"scripts/security/w27-root-signed-trust-keyring.cjs"
GATE=ROOT/"scripts/security/w26-signed-pdp-gateway.cjs"
ENF=ROOT/"scripts/security/w26-signed-pdp-enforcer.cjs"
TEST=ROOT/"scripts/ci/w27-root-signed-key-lifecycle.test.cjs"
WF=ROOT/".github/workflows/tto-adaptive-ci.yml"
CONTRACT=ROOT/"docs/contracts/shareholder-w2-7-signed-key-lifecycle-v0.1.json"
BRANCH="test/w2-7-root-signed-trust-lifecycle-no-docker-20261101"

class W27SignedKeyLifecycle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.keys=KEYS.read_text(encoding="utf8")
        cls.gate=GATE.read_text(encoding="utf8")
        cls.enf=ENF.read_text(encoding="utf8")
        cls.test=TEST.read_text(encoding="utf8")
        cls.workflow=WF.read_text(encoding="utf8")
    def test_01_root_is_independent_and_pinned_before_keyset(self):
        for x in ('pinnedRootPublicPem','crypto.sign(null,canonical(base)',
                  'crypto.verify(null,canonical(s)',
                  's.rootKeyId!==keyId(pinnedRootPem)',
                  'const SNAP_KEYS=', 'W27_ROOT_PUBLICATION_V1',
                  'const SIGNED_KEYS=', 'snapshotValid(signed,this.#rootPem)',
                  'signed.epoch!==this.#epoch+1',
                  'signed.previousHash!==this.#hash',
                  'Object.keys(x).sort()'):
            with self.subTest(x=x):self.assertIn(x,self.keys)
        self.assertNotIn('process.env.W27_ROOT_PRIVATE_KEY',self.keys)
        self.assertNotIn('fetch(',self.keys)
        self.assertNotIn('new Pool(',self.keys)
    def test_02_roles_expiry_revocation_no_resurrection(self):
        for x in ('POLICY_PUBLISHER','PDP_DECISION','REVOKED',
                  'TRUST_KEY_REVOKED','TRUST_KEY_EXPIRED',
                  'TRUST_SNAPSHOT_EXPIRED','W27_TRUST_TOMBSTONE_MISSING',
                  'W27_TRUST_REUSE_OR_RESURRECTION',
                  'W27_TRUST_GENERATION_ROLLBACK',
                  'W27_TRUST_ACTIVE_ROLE_INVALID',
                  'W27_TRUST_CLOCK_INVALID',
                  'if(activeRoles.has(e.role)',
                  'if(!upcoming.has(id))',
                  'this.#maxGeneration=maxGeneration'):
            with self.subTest(x=x):self.assertIn(x,self.keys)
        self.assertIn('process.env.TTO_W27_TRUST_LAB==="1"',self.keys)
        for v in ('!process.env.DATABASE_URL',
                  '!process.env.TTO_API_BASE_URL',
                  '!process.env.APIIR_TOKEN',
                  '!process.env.TEST_ADMIN_DATABASE_URL'):
            self.assertIn(v,self.keys)
    def test_03_signed_child_pdp_remains_fail_closed(self):
        for x in ('onSignerReady=null,checkSigner=null',
                  'onSignerReady(verifiedKey)===true',
                  'checkSigner(verifiedKey)===true',
                  'verifyDecision(signed,verifiedKey.pem,expected)',
                  'W27_SIGNER_ENROLLMENT_DENIED',
                  'W27_SIGNER_REVOKED_AFTER_PDP',
                  'child.kill("SIGKILL")'):
            self.assertIn(x,self.gate)
        for x in ('const trust=cfg.w27Trust??null',
                  'trust.checkPublisher(cfg.publisher.publicPem)!==true',
                  'onSignerReady:trust?.onSignerReady??null',
                  'checkSigner:trust?.checkSigner??null',
                  'trust.checkSigner({pem:signed.publicPem,keyId:signed.signerKeyId})!==true',
                  'const afterPdp=registry.check(lease)',
                  'const afterAudit=registry.check(lease)',
                  'cfg.source.read({requestId:id,policyRevision:lease.revision})',
                  'canGrantPermission:false',
                  'legalOperationalEffect:"NONE"'):
            self.assertIn(x,self.enf)
        self.assertLess(self.enf.index('const afterPdp=registry.check(lease)'),
                        self.enf.index('const afterAudit=registry.check(lease)'))
        self.assertLess(self.enf.index('const afterAudit=registry.check(lease)'),
                        self.enf.index('cfg.source.read('))
        self.assertNotIn('return {available:true',self.enf)
    def test_04_no_operational_route_or_appmodule_affected(self):
        for base in (ROOT/"apps/shareholder/app",ROOT/"services/api/src"):
            for f in list(base.rglob("*.ts"))+list(base.rglob("*.tsx")):
                s=f.read_text(encoding="utf8")
                self.assertNotIn('w27-root-signed-trust-keyring',s,str(f))
        self.assertNotIn('W27',(ROOT/"services/api/src/module.ts").read_text(encoding="utf8"))
        for file in (KEYS,TEST):
            text=file.read_text(encoding="utf8")
            for bad in ('docker run','postgresql://','new Pool('):
                self.assertNotIn(bad,text)
    def test_05_adversarial_signatures_roles_lifecycle_and_races(self):
        for marker in (
            "TTO_W27_ROOT_AUTHORIZED_CHILD_SIGNATURE=PASS",
            "TTO_W27_PINNED_ROOT_REJECTS_FORGED_KEYSET=PASS",
            "TTO_W27_SIGNED_KEYSET_ANTI_ROLLBACK=PASS",
            "TTO_W27_KEY_ROLE_AND_UNKNOWN_DENIED=PASS",
            "TTO_W27_UNENROLLED_PDP_KEY_DENIED=PASS",
            "TTO_W27_INFLIGHT_REVOKED_SIGNER_DENIED=PASS",
            "TTO_W27_INFLIGHT_SIGNER_ROTATION_DENIED=PASS",
            "TTO_W27_INFLIGHT_PUBLISHER_REVOCATION_DENIED=PASS",
            "TTO_W27_INFLIGHT_PUBLISHER_ROTATION_DENIED=PASS",
            "TTO_W27_INFLIGHT_SIGNER_EXPIRY_DENIED=PASS",
            "TTO_W27_REVOKED_TOMBSTONES_CANNOT_RESURRECT=PASS",
            "TTO_W27_ROLE_UNIQUENESS_AND_GENERATION_GATE=PASS",
            "TTO_W27_SNAPSHOT_EXPIRY_AND_CLOCK_ROLLBACK_DENY=PASS",
            "TTO_W27_W23_TENANT_OWNER_SCOPE_PRESERVED=PASS",
            "TTO_W27_RECHECK_TRUST_AFTER_AUDIT_BEFORE_SOURCE=PASS",
            "TTO_W27_AUDIT_OUTAGE_NO_OPERATIONAL_ALLOW=PASS",
            "TTO_W27_ABORT_REAPS_CHILD_AND_DENIES=PASS",
            "TTO_W27_NO_ORPHAN_SIGNERS_NO_REAL_SOURCES=PASS",
            "TTO_W27_DRAFT_NO_DOCKER_NO_DB_NO_OPERATIONAL_ALLOW=PASS"):
            with self.subTest(marker=marker):self.assertIn(marker,self.test)
        self.assertIn('state({denyEnrollment:true})',self.test)
        self.assertIn('s.rotateSigner(replacement)',self.test)
        self.assertIn('s.revoke("PDP_DECISION")',self.test)
    def test_06_exact_draft_no_docker_and_complete_prior_regression(self):
        s=self.workflow
        self.assertIn("github.event.pull_request.draft && github.head_ref == '"+BRANCH+"'",s)
        self.assertIn('TTO_W27_TRUST_LAB: "1"',s)
        self.assertIn("node --test scripts/ci/w27-root-signed-key-lifecycle.test.cjs",s)
        self.assertIn("TTO_W27_GITHUB_ACTIONS_NO_DOCKER=PASS",s)
        for k in ("w2-inline-lab-http","w2-2-cancellable-pdp",
                  "w23-dormant-boundary-contract","w24-offline-audit-chain",
                  "w25-policy-revision-expiry","w26-signed-pdp-policy"):
            self.assertIn("node --test scripts/ci/"+k+".test.cjs",s)
        # Ensure the no-Docker switch is only possible on a Draft PR.
        env_line=next(l for l in s.splitlines()
                      if "TTO_W2_NO_DOCKER_BRANCH:" in l)
        self.assertIn("github.event_name == 'pull_request'",env_line)
        self.assertIn("github.event.pull_request.draft && github.head_ref == '"+BRANCH+"'",env_line)
        self.assertNotIn("|| github.head_ref == '"+BRANCH+"'",env_line)
        for name in (
          "Start a single disposable local PostgreSQL 17 container",
          "Apply migrations 0001-0010 to disposable PG17 only",
          "Real Next Nest PostgreSQL identity, tenant, source and share quarantine E2E",
          "Complete historical SQL, OTP, login/logout and authority regression",
          "Build and smoke all four OCI images without registry push",
          "Stop isolated PostgreSQL even on failure"):
            part=s.split("- name: "+name,1)
            self.assertEqual(len(part),2,name)
            self.assertIn("env.TTO_W2_NO_DOCKER_BRANCH != 'true'",
                          part[1].split("- name:",1)[0],name)
    def test_07_contract_does_not_claim_production_pkis(self):
        c=json.loads(CONTRACT.read_text(encoding="utf8"))
        self.assertEqual(c["schemaVersion"],"0.1-DRAFT")
        self.assertEqual(c["acceptedBaselineSha"],
          "0c9c08a5bc0de901d110eb33891ac6a16330783c")
        self.assertEqual(c["legalOperationalEffect"],"NONE")
        for key in ("operationalRoutes","liveShareholderData","realTrades",
                    "docker","externalIdentityAttestation","productionPKI",
                    "durableTrustLog","merge","deploy"):
            self.assertFalse(c["capabilities"][key],key)
        self.assertIn("TOFU",c["limitations"][0])
if __name__=="__main__":
    unittest.main()
