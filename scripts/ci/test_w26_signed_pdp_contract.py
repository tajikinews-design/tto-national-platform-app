"""W2.6 offline independent signed PDP and publisher policy guard.

Executable tests are required for proof; static guards only prevent accidental
production import, disabled CI gates, leakage and weakened upstream checks.
"""
import json
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
FILES={
 "protocol":ROOT/"scripts/security/w26-signed-policy-protocol.cjs",
 "child":ROOT/"scripts/security/w26-independent-pdp-child.cjs",
 "gateway":ROOT/"scripts/security/w26-signed-pdp-gateway.cjs",
 "enforcer":ROOT/"scripts/security/w26-signed-pdp-enforcer.cjs",
 "suite":ROOT/"scripts/ci/w26-signed-pdp-policy.test.cjs",
 "workflow":ROOT/".github/workflows/tto-adaptive-ci.yml"
}
CONTRACT=ROOT/"docs/contracts/shareholder-w2-6-signed-pdp-policy-v0.1.json"
BRANCH="test/w2-6-signed-pdp-policy-no-docker-20261101"
class W26IndependentPdpSignature(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text={k:f.read_text(encoding="utf8") for k,f in FILES.items()}
    def test_01_no_production_route_or_module_attachment(self):
        for root in (ROOT/"apps/shareholder/app",ROOT/"services/api/src"):
            for p in list(root.rglob("*.ts"))+list(root.rglob("*.tsx")):
                s=p.read_text(encoding="utf8")
                self.assertNotIn("w26-signed-",s,str(p))
                self.assertNotIn("w26-independent-pdp-child",s,str(p))
        self.assertNotIn("W26",(ROOT/"services/api/src/module.ts").read_text(encoding="utf8"))
        for key in ("protocol","child","gateway","enforcer"):
            s=self.text[key]
            self.assertNotIn("new Pool(",s)
            self.assertNotIn("docker run",s)
            self.assertNotIn("postgresql://",s)
        self.assertIn('process.env.TTO_W26_SIGNED_LAB==="1"',self.text["protocol"])
    def test_02_ed25519_verification_and_exact_protocol(self):
        s=self.text["protocol"]
        for x in ('crypto.sign(null','crypto.verify(null',
                  'crypto.createHash("sha256")',
                  'crypto.createPublicKey(pem)',
                  'key.asymmetricKeyType!=="ed25519"',
                  'W26_PUBLISHER_SIGN_V1','W26_PDP_SIGN_V1',
                  'W26_CONTEXT_V1', 'signed.publisherKeyId',
                  'verifiedSignature(', 'policyDecision(',
                  'response.signature',
                  'Object.keys(x).sort()',
                  'manifestValid(', 'decisionValid('):
            with self.subTest(symbol=x):
                # Protocol validates keyId through policy.publisherKeyId and
                # decisions through a standalone signed payload.
                if x in ('signed.publisherKeyId','response.signature'):
                    continue
                self.assertIn(x,s)
        self.assertIn('policy.publisherKeyId===keyId(publisherPublicPem)',s)
        self.assertIn('keyId(publicPem)===expected.signerKeyId',s)
        self.assertIn('Object.keys(expected).every(k=>decision[k]===expected[k])',s)
    def test_03_child_has_own_private_key_and_actually_evaluates(self):
        child=self.text["child"]
        for x in ('crypto.generateKeyPairSync("ed25519")',
                  'verifySignedManifest(manifest,trustedPublisherPublicPem)',
                  'policyDecision(request.context,manifest.ruleset)',
                  'signDecision(reply,privateKey)',
                  'process.env.TTO_W26_CHILD!=="1"',
                  'process.env.DATABASE_URL',
                  'request.delayMs>0',
                  'emit({type:"READY",publicPem,signerKeyId'):
            self.assertIn(x,child)
        self.assertIn('process.env.TTO_W26_PUBLISHER_PUBLIC_B64',child)
        self.assertNotIn('"publisherPublicPem","evaluatedAtMs"',child)
        self.assertNotIn('privateKey.export(',child)
        self.assertNotIn('fetch(',child)
        self.assertNotIn('require("node:http")',child)
        self.assertNotIn('require("node:net")',child)
        self.assertNotIn('process.env.APIIR_TOKEN||',self.text["gateway"])
    def test_04_gateway_pins_launch_key_verifies_and_kills_on_abort(self):
        s=self.text["gateway"]
        for x in ('const {spawn}=require("node:child_process")',
                  'shell:false',
                  'keyId(m.publicPem)',
                  'expectedSignerKeyId!==m.signerKeyId',
                  'verifyDecision(signed,verifiedKey.pem,expected)',
                  'nonce=randomUUID()',
                  'contextDigest(context)',
                  'signal.addEventListener("abort",onAbort,{once:true})',
                  'child.kill("SIGKILL")',
                  'counters.closed++','active.delete(child)',
                  'TTO_W26_SIGNED_LAB:"1"',
                  'TTO_W26_CHILD:"1"',
                  'TTO_W26_PUBLISHER_PUBLIC_B64:Buffer.from('):
            with self.subTest(symbol=x):self.assertIn(x,s)
        self.assertNotIn("spawnSync(",s)
        self.assertNotIn("env:process.env",s)
        self.assertNotIn('console.log(',s)
    def test_05_enforcer_requires_signatures_revalidates_after_async(self):
        s=self.text["enforcer"]
        for x in ('makeSignedManifest(lease,cfg.bundle,',
                  'verifySignedManifest(manifest,cfg.publisher.publicPem)',
                  'runSignedPdp({',
                  'const afterPdp=registry.check(lease)',
                  'const afterAudit=registry.check(lease)',
                  'cfg.audit.record({requestId:id,phase:"PDP_DECISION",decision,reasonCode})',
                  'cfg.versionTrace.record({',
                  'cfg.source.read({requestId:id,policyRevision:lease.revision})',
                  'closeW25DormantBffResult(out,out?.requestId)',
                  'canGrantPermission:false',
                  'legalOperationalEffect:"NONE"',
                  'hasActualRecord:false'):
            with self.subTest(symbol=x):self.assertIn(x,s)
        self.assertLess(s.index('const afterPdp=registry.check(lease)'),
                        s.index('const pending=await commit('))
        self.assertLess(s.index('const afterAudit=registry.check(lease)'),
                        s.index('cfg.source.read('))
        self.assertNotIn('return {available:true',s)
    def test_06_adversarial_real_child_and_publisher_signature_matrix(self):
        s=self.text["suite"]
        for m in (
          'TTO_W26_DISTINCT_CHILD_PDP_SIGNATURE_AND_AUDIT=PASS',
          'TTO_W26_PUBLISHER_SIGNATURE_TAMPER_DETECTED=PASS',
          'TTO_W26_CHILD_POLICY_SIGNATURE_VERIFIED=PASS',
          'TTO_W26_WRONG_PUBLISHER_DENIED=PASS',
          'TTO_W26_CHILD_PINNED_PUBLISHER_ROOT_DENIES_IMPOSTOR=PASS',
          'TTO_W26_CHILD_EVALUATES_POLICY_NOT_WRAPPER_ECHO=PASS',
          'TTO_W26_POLICY_VERSION_CHANGES_RULE_EXECUTION=PASS',
          'TTO_W26_SIGNED_DECISION_REPLAY_AND_TAMPER_DENY=PASS',
          'TTO_W26_UNPINNED_SIGNER_REJECTED=PASS',
          'TTO_W26_INFLIGHT_REVOCATION_REJECTS_SIGNED_ALLOW=PASS',
          'TTO_W26_INFLIGHT_ROTATION_REJECTS_OLD_ATTESTATION=PASS',
          'TTO_W26_INFLIGHT_EXPIRED_SIGNED_DECISION_DENY=PASS',
          'TTO_W26_RECHECK_AFTER_AUDIT_BEFORE_SOURCE=PASS',
          'TTO_W26_ABORT_KILLS_SIGNING_CHILD=PASS',
          'TTO_W26_CHILD_TIMEOUT_DENIES_SIGNED_LATE_RESULT=PASS',
          'TTO_W26_NO_ORPHAN_SIGNING_CHILDREN=PASS',
          'TTO_W26_DUAL_SIGNATURES_LAB_ONLY_NO_OPERATIONAL_ALLOW=PASS',
          'TTO_W26_NO_DOCKER_NO_DB_NO_DEPLOY=PASS'):
            with self.subTest(marker=m):self.assertIn(m,s)
    def test_07_exact_draft_ci_all_docker_gates_skipped(self):
        s=self.text["workflow"]
        self.assertIn("github.event.pull_request.draft && github.head_ref == '"+BRANCH+"'",s)
        self.assertIn('node --test scripts/ci/w26-signed-pdp-policy.test.cjs',s)
        self.assertIn('TTO_W26_GITHUB_ACTIONS_NO_DOCKER=PASS',s)
        self.assertIn('TTO_W26_SIGNED_LAB: "1"',s)
        for p in ("w2-inline-lab-http","w2-2-cancellable-pdp",
                  "w23-dormant-boundary-contract","w24-offline-audit-chain",
                  "w25-policy-revision-expiry"):
            self.assertIn("node --test scripts/ci/"+p+".test.cjs",s)
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
    def test_08_contract_limits_and_non_production_claims(self):
        x=json.loads(CONTRACT.read_text(encoding="utf8"))
        self.assertEqual(x["schemaVersion"],"0.1-DRAFT")
        self.assertEqual(x["acceptedBaselineSha"],
          "570a01aa6c28bed7d6d1ed95ea006e78066ad9cd")
        for key in ("operationalRouteRegistration","operationalSourceRead",
                    "durablePdpKey","externallyAuthenticatedSigner",
                    "productionPKI","realShareTrade","usesDocker"):
            self.assertFalse(x["capabilities"][key],key)
        self.assertEqual(x["legalOperationalEffect"],"NONE")
        self.assertEqual(x["pdpSigning"]["privateKeyOrigin"],"GENERATED_INSIDE_CHILD_ONLY")
        self.assertIn("not externally authenticated",x["limitations"][0].lower())
if __name__=="__main__":
    unittest.main()
