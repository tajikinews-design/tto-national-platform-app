"""W2.1 fail-closed policy hardening invariants. No DB/Docker/no live routes.

Static guards only: dynamic acceptance is the GitHub Actions Node HTTP
adversarial suite with two fake owners and W1 Python PEP/PDP inline.
"""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
ENFORCER=ROOT/"scripts/security/w2-inline-synthetic-enforcer.cjs"
HARNESS=ROOT/"scripts/ci/w2-inline-lab-http.test.cjs"
WORKFLOW=ROOT/".github/workflows/tto-adaptive-ci.yml"
BASE=ROOT/"docs/contracts/shareholder-w2-offline-inline-pep-v0.1.json"
HARDEN=ROOT/"docs/contracts/shareholder-w2-1-inline-policy-hardening-v0.1.json"

class TestW21OfflineNoDockerSecurity(unittest.TestCase):
    def test_01_public_response_exact_allowlist_and_no_raw_forwarding(self):
        policy=ENFORCER.read_text(encoding="utf8")
        harness=HARNESS.read_text(encoding="utf8")
        for marker in (
            'const PUBLIC_KEYS=[', 'sameKeys(raw,PUBLIC_KEYS)',
            'raw.canGrantPermission!==false',
            'raw.hasActualRecord!==false', 'raw.legalOperationalEffect!=="NONE"',
            'raw.data!==null', 'raw.sourceTouches!==1',
            'raw.reasonCode!=="SIMULATION_ONLY"',
            'sanitizeW2SyntheticPublicResponse(raw)',
            'const safe=sanitizeW2SyntheticPublicResponse(raw)',
            'NextResponse.json(safe,{',
            'UPSTREAM_CONTRACT_INVALID',
            'TTO_W2_BFF_REJECTS_CORRUPT_NEST_PAYLOAD=PASS',
            'TTO_W2_STRICT_RESPONSE_ALLOWLIST=PASS'
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker,policy+"\n"+harness)
        self.assertNotIn('NextResponse.json(body,{',harness)
        self.assertIn('sourceTouches:status===503?null:0',harness)
        self.assertIn('PRIVATE_SYNTHETIC_CANARY',harness)

    def test_02_policy_revalidation_around_async_pdp_and_audit(self):
        policy=ENFORCER.read_text(encoding="utf8")
        for marker in (
            'const proofSnapshot=PROOF_KEYS.map(key=>p[key])',
            'return cfg.proof===p&&PROOF_KEYS.every',
            'if(!unchangedProof())return deny("PROOF_CHANGED")',
            'audit.record({requestId:id,operation:"read",',
            'cfg.source.read({'
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker,policy)
        self.assertEqual(policy.count('if(!unchangedProof())return deny("PROOF_CHANGED")'),2)
        self.assertLess(policy.index('const proofSnapshot='),policy.index('raw=await Promise.race(['))
        self.assertLess(policy.index('raw=await Promise.race(['),
                        policy.index('if(!unchangedProof())return deny("PROOF_CHANGED")'))
        self.assertLess(policy.rindex('if(!unchangedProof())return deny("PROOF_CHANGED")'),
                        policy.index('cfg.source.read({'))

    def test_03_adversarial_cases_are_executable_not_just_markers(self):
        s=HARNESS.read_text(encoding="utf8")
        for marker in (
            'revocation DURING async policy rejects before fake source touch',
            'audit callback revocation also blocks source after policy success',
            'invalid synthetic fixture response is denied and touch truth preserved',
            'BFF rejects corrupted actual Nest response without leaking fields',
            'strict public contract strips no data and rejects injected Nest fields',
            'current.policyMode="deferred"',
            'current.resumePolicy()',
            'actor.proof.sourceApproved=false',
            'actor.proof.partyBound=false',
            'assert.equal(response.sourceTouches,1',
            'assert.equal(sanitizeW2SyntheticPublicResponse(response),null',
            'TTO_W2_POLICY_INFLIGHT_REVOCATION_DENY=PASS',
            'TTO_W2_POST_AUDIT_REVOCATION_DENY=PASS',
            'TTO_W2_POST_SOURCE_INVALID_RESPONSE_BLOCKED=PASS'
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        self.assertNotIn("new Pool(",s)
        self.assertNotIn("tto.resolve_session",s)

    def test_04_ci_is_no_docker_only_on_exact_draft_branches(self):
        s=WORKFLOW.read_text(encoding="utf8")
        for branch in ("test/w2-inline-pep-offline-20261101",
                       "test/w2-hardening-no-docker-20261101"):
            self.assertIn("github.head_ref == '"+branch+"'",s)
        self.assertIn("github.event.pull_request.draft",s)
        self.assertIn("github.event_name == 'pull_request'",s)
        self.assertIn("TTO_W2_HARDENING_GITHUB_ACTIONS_NO_DOCKER=PASS",s)
        self.assertIn("node --test scripts/ci/w2-inline-lab-http.test.cjs",s)
        for label in (
            "Start a single disposable local PostgreSQL 17 container",
            "Apply migrations 0001-0010 to disposable PG17 only",
            "Real Next Nest PostgreSQL identity, tenant, source and share quarantine E2E",
            "Complete historical SQL, OTP, login/logout and authority regression",
            "Build and smoke all four OCI images without registry push",
            "Stop isolated PostgreSQL even on failure",
        ):
            prefix=s.split("- name: "+label,1)
            self.assertEqual(len(prefix),2,label)
            stage=prefix[1].split("- name:",1)[0]
            self.assertIn("env.TTO_W2_NO_DOCKER_BRANCH != 'true'",stage,label)
        self.assertIn('permissions:\n  contents: read',s)
        self.assertNotIn('actions/upload-artifact',s)

    def test_05_w2_1_contract_keeps_operational_gates_closed(self):
        base=json.loads(BASE.read_text(encoding="utf8"))
        doc=json.loads(HARDEN.read_text(encoding="utf8"))
        self.assertEqual(doc["schemaVersion"],"0.1-DRAFT")
        self.assertEqual(doc["baselineSha"],"de6cf38cf5b2ec5bd4b4cd67289b2e54cab68fbf")
        self.assertFalse(doc["productionRoutesModified"])
        self.assertFalse(doc["registeredInNestAppModule"])
        self.assertFalse(doc["dockerOrDatabaseUsed"])
        self.assertFalse(doc["operationalPermissionsGranted"])
        self.assertEqual(doc["legalOperationalEffect"],"NONE")
        self.assertEqual(doc["ciScope"],"DRAFT_GITHUB_ACTIONS_NO_DOCKER")
        self.assertFalse(base["runtimePEPEnabled"])
        self.assertFalse(base["productionRouteRegistered"])
        self.assertFalse(base["canGrantPermission"])
        for path in (ROOT/"apps/shareholder/app").rglob("*.ts"):
            self.assertNotIn('w2-inline-synthetic-enforcer',path.read_text(encoding="utf8"),str(path))
        for path in (ROOT/"services/api/src").rglob("*.ts"):
            self.assertNotIn('w2-inline-synthetic-enforcer',path.read_text(encoding="utf8"),str(path))

    def test_06_source_fixture_and_decision_errors_cannot_report_false_zero(self):
        s=ENFORCER.read_text(encoding="utf8")
        self.assertIn('return reply("DENY","FIXTURE_INVALID",id,1)',s)
        self.assertIn('return reply("DENY","FIXTURE_UNAVAILABLE",id,1)',s)
        self.assertIn('result.record!==null||result.persisted!==false',s)
        self.assertIn('!sameKeys(result,SOURCE_KEYS)',s)
        self.assertIn('raw.decision==="DENY"&&raw.sourceTouches!==0',s)
        self.assertIn('raw.decision==="SIMULATED_ALLOW"&&(raw.sourceTouches!==1',s)

if __name__=="__main__":
    unittest.main()
