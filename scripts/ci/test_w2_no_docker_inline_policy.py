"""W2 inline synthetic policy in a real Nest *lab* HTTP controller, no Docker.

These tests are safety guardrails only; dynamic Node HTTP tests must also run.
No production route activation, real owner, source, DB, trade or account flows.
"""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
ENFORCER=ROOT/"scripts/security/w2-inline-synthetic-enforcer.cjs"
HARNESS=ROOT/"scripts/ci/w2-inline-lab-http.test.cjs"
WORKFLOW=ROOT/".github/workflows/tto-adaptive-ci.yml"
BASE=ROOT/"docs/contracts/shareholder-w1-operational-gates-design-v0.1.json"
W1=ROOT/"docs/contracts/shareholder-w1-bff-nest-boundary-seam-v0.1.json"
W2=ROOT/"docs/contracts/shareholder-w2-offline-inline-pep-v0.1.json"

class W2NoDockerSyntheticInline(unittest.TestCase):
    def test_01_offline_inline_gate_and_mutation_restriction(self):
        s=ENFORCER.read_text(encoding="utf8")
        for part in (
            'TTO_W2_OFFLINE_LAB==="1"', 'process.env.NODE_ENV==="test"',
            '!process.env.VERCEL', '!process.env.DATABASE_URL',
            '!process.env.TTO_API_BASE_URL','!process.env.APIIR_TOKEN',
            '!process.env.TEST_ADMIN_DATABASE_URL',
            'cfg.candidate.operation!=="read"',
            'p.tenantKey!==cfg.candidate.tenantKey',
            'p.ownerKey!==cfg.candidate.ownerKey',
            'p.partyBound!==true',
            'p.membershipSourceApproved!==true||p.sourceApproved!==true',
            'return deny("PDP_UNAVAILABLE")',
            'return deny(DENIED_REASON)',
            'return reply("DENY","AUDIT_UNAVAILABLE",id)',
            'cfg.source.read({', 'sourceTouches',
            'legalOperationalEffect:"NONE"', 'canGrantPermission:false',
        ):
            with self.subTest(assertion=part):self.assertIn(part,s)
        self.assertLess(s.index('audit.record({requestId:id,operation:"read",'),
                        s.index('cfg.source.read({'))
        for forbidden in ('pg"', "postgresql://", "http://", "https://",
                          "process.env.DATABASE_URL??", "require('node:net')",
                          "child_process", "docker run", "allow_real", "authorization: true"):
            with self.subTest(forbidden=forbidden):self.assertNotIn(forbidden,s)

    def test_02_actual_next_and_nest_lab_no_authoritative_route_registration(self):
        s=HARNESS.read_text(encoding="utf8")
        self.assertIn('fromNext("next/server")',s)
        self.assertIn('fromApi("@nestjs/core")',s)
        self.assertIn('Controller("w2-offline-only")',s)
        self.assertIn('NestFactory.create(W2LabModule',s)
        self.assertIn('prepareW1SyntheticBffCandidate(request',s)
        self.assertIn('enforceW2SyntheticInline({',s)
        self.assertIn('scripts.security.w1_isolated_http_bridge',s)
        self.assertIn('const tenants',s.replace("const tenant=", "const tenants"))
        self.assertIn('owners=["fixture-owner-A","fixture-owner-B"]',s)
        self.assertIn('audits=[],touches=[]',s)
        self.assertNotIn('dist/main.js',s)
        self.assertNotIn('TEST_ADMIN_DATABASE_URL=postgresql',s)
        self.assertNotIn('docker',s.lower().replace('no docker',''))
        for root in ("apps/shareholder/app","services/api/src"):
            for file in (ROOT/root).rglob("*.ts"):
                self.assertNotIn("w2-inline",file.read_text(encoding="utf8"),str(file))
            for file in (ROOT/root).rglob("*.tsx"):
                self.assertNotIn("w2-inline",file.read_text(encoding="utf8"),str(file))

    def test_03_inline_pdp_before_fake_source_and_owner_separation(self):
        s=HARNESS.read_text(encoding="utf8")
        for marker in (
            "two distinct fake owners in SAME tenant can only read own marker",
            "cross-owner and cross-tenant denied before Nest and fixture",
            "direct Nest forged candidate cannot override trusted handle",
            "policy exception, timeout, malformed response all fail closed",
            "audit sink outage blocks resource even on valid read",
            "download export write trade finalize are never eligible inline",
            "production mode disables inline enforcer and source touches",
            "TTO_W2_INLINE_POLICY_BEFORE_SOURCE=PASS",
            "TTO_W2_INLINE_DENIED_SOURCE_TOUCHES=0",
            "TTO_W2_SYNTHETIC_ONLY_NO_OPERATIONAL_ALLOW=PASS",
            "TTO_W2_PDP_FAILURE_AND_TIMEOUT_DENY=PASS",
            "TTO_W2_SAME_TENANT_TWO_OWNERS_ISOLATED=PASS",
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        self.assertNotIn("REAL_OWNER_EMAIL",s)

    def test_04_adaptive_ci_for_w2_draft_never_runs_docker(self):
        s=WORKFLOW.read_text(encoding="utf8")
        self.assertIn("github.event.pull_request.draft && github.head_ref == 'test/w2-inline-pep-offline-20261101'",s)
        self.assertIn("TTO_W2_NO_DOCKER_BRANCH",s)
        self.assertIn("TTO_W2_GITHUB_ACTIONS_NO_DOCKER=PASS",s)
        self.assertIn("node --test scripts/ci/w2-inline-lab-http.test.cjs",s)
        self.assertIn("python3 -m unittest discover -s scripts/ci -p 'test_*.py' -v",s)
        # Every Docker-touching step is gated off only for this exact draft branch.
        for line in s.splitlines():
            if line.startswith("      - name: ") and any(k in line for k in (
                "Start a single disposable local PostgreSQL",
                "Apply migrations 0001-0010",
                "Real Next Nest PostgreSQL identity",
                "Complete historical SQL",
                "Build and smoke all four OCI images",
                "Stop isolated PostgreSQL even on failure"
            )):
                header=s.split(line,1)[1].split("      - name:",1)[0]
                self.assertIn("env.TTO_W2_NO_DOCKER_BRANCH != 'true'",header,line)
        self.assertIn("if: steps.scope.outputs.suite != 'lite'",s)
        self.assertIn("if: steps.scope.outputs.suite == 'release'",s)

    def test_05_w2_contract_never_grants_operational_authority(self):
        v=json.loads(W2.read_text(encoding="utf8"))
        self.assertEqual(v["schemaVersion"],"0.1-DRAFT")
        self.assertFalse(v["productionRouteRegistered"])
        self.assertFalse(v["databaseOrDockerUsed"])
        self.assertFalse(v["runtimePEPEnabled"])
        self.assertEqual(v["legalOperationalEffect"],"NONE")
        self.assertFalse(v["canGrantPermission"])
        self.assertEqual(v["allowedDecisions"],["DENY","SIMULATED_ALLOW"])
        self.assertEqual(v["futureMergePrerequisites"]["fullReleaseWithDocker"],"DEFERRED_USER_REQUEST")
        b=json.loads(BASE.read_text(encoding="utf8"))
        self.assertFalse(b["runtimeActivationRequested"])
        self.assertEqual(b["approvalStatus"],"NOT_APPROVED")
        w=json.loads(W1.read_text(encoding="utf8"))
        self.assertFalse(w["runtimeActivation"])
        self.assertFalse(w["canGrantPermission"])

if __name__=="__main__":
    unittest.main()
