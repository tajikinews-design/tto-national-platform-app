"""W2.2 async/cancellable PDP security guards; GitHub Actions, NO Docker.

Static invariants complement executable Node child-process failure tests.
No production route registration, DB, official data or operational authority.
"""
import unittest
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PROVIDER=ROOT/"scripts/security/w2-2-cancellable-pdp-provider.cjs"
CHILD=ROOT/"scripts/ci/w2-2-cancellable-pdp-fixture.cjs"
E2E=ROOT/"scripts/ci/w2-2-cancellable-pdp.test.cjs"
INLINE=ROOT/"scripts/security/w2-inline-synthetic-enforcer.cjs"
HTTP=ROOT/"scripts/ci/w2-inline-lab-http.test.cjs"
WORKFLOW=ROOT/".github/workflows/tto-adaptive-ci.yml"
CONTRACT=ROOT/"docs/contracts/shareholder-w2-2-cancellable-pdp-v0.1.json"

class TestW22CancellablePdp(unittest.TestCase):
    def test_01_real_async_subprocess_and_explicit_cancellation(self):
        s=PROVIDER.read_text(encoding="utf8")
        for marker in (
            'const {spawn}=require("node:child_process")',
            'signal.addEventListener("abort",onAbort,{once:true})',
            'signal.removeEventListener("abort",onAbort)',
            'child.kill("SIGKILL")',
            'child.on("close",code=>',
            'active.delete(child)',
            'signal.aborted',
            'shell:false',
            'stdio:["pipe","pipe","pipe"]',
            'const MAX_INPUT=8192,MAX_OUTPUT=8192',
            'if(stdoutSize>MAX_OUTPUT)',
            'if(code!==0)',
            'JSON.parse(Buffer.concat(stdout)',
            'counters.aborted++',
            'const env={',
            'PYTHONDONTWRITEBYTECODE:"1"',
            'scripts.security.w1_isolated_http_bridge',
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        for forbidden in (
            "spawnSync", "exec(", "execSync", "shell:true",
            "process.env.DATABASE_URL??", "env:process.env", "console.log(input)",
            "console.error(input)", "https://", "http://", "new Pool(",
            "TTO_ENABLE_REAL_SMSOTP_DELIVERY"
        ):
            with self.subTest(forbidden=forbidden):self.assertNotIn(forbidden,s)

    def test_02_enforcer_deadline_and_request_abort_before_resource(self):
        s=INLINE.read_text(encoding="utf8")
        for marker in (
            'new AbortController()', 'external instanceof AbortSignal',
            'external?.aborted', 'performance.now()+timeout',
            'controller.abort()', 'raw=await Promise.race([',
            'cfg.policy("read",derivedContext(p),{',
            'signal:controller.signal',
            'external?.addEventListener("abort",stopRequest,{once:true})',
            'external?.removeEventListener("abort",stopRequest)',
            'return deny("REQUEST_ABORTED")',
            'return deny("PDP_TIMEOUT")',
            'return deny("PDP_UNAVAILABLE")',
            'if(!unchangedProof())return deny("PROOF_CHANGED")',
            'cfg.source.read({'
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        self.assertLess(s.index('const controller=new AbortController()'),s.index('raw=await Promise.race(['))
        self.assertLess(s.index('raw=await Promise.race(['),s.index('cfg.source.read({'))
        self.assertLess(s.index('if(expired||performance.now()>=deadlineAt)'),
                        s.index('cfg.source.read({'))

    def test_03_actual_lab_HTTP_propagates_disconnection_and_no_blocking_python(self):
        s=HTTP.read_text(encoding="utf8")
        self.assertIn('runW22CancellablePDP(operation,ctx,{signal,mode})',s)
        self.assertIn('const aborter=new AbortController()',s)
        self.assertIn('connection?.once("close",onDisconnect)',s)
        self.assertIn('requestSignal:aborter.signal',s)
        self.assertIn('nodeRes.once("close",onClientDisconnect)',s)
        self.assertIn('signal:AbortSignal.any([upstreamAbort.signal,AbortSignal.timeout(3000)])',s)
        self.assertIn('scripts.security.w1_isolated_http_bridge',s)
        self.assertNotIn('spawnSync(',s)
        self.assertNotIn('DATABASE_URL:process.env.DATABASE_URL',s)
        for root in ("apps/shareholder/app","services/api/src"):
            for file in (ROOT/root).rglob("*.ts"):
                self.assertNotIn("w2-2-cancellable-pdp",file.read_text(encoding="utf8"),str(file))
            for file in (ROOT/root).rglob("*.tsx"):
                self.assertNotIn("w2-2-cancellable-pdp",file.read_text(encoding="utf8"),str(file))

    def test_04_adversarial_live_child_and_late_reply_matrix(self):
        s=E2E.read_text(encoding="utf8")
        for marker in (
            'OS child process is genuinely asynchronous and killable',
            'deadline aborts hung child',
            'late positive child reply cannot revive expired authorization',
            'client-request AbortSignal cancels running PDP',
            'already aborted request returns DENY without launching child',
            'PDP crash, malformed JSON and excessive output all fail closed',
            'owner revocation during delayed PDP response blocks resource',
            'a PDP provider that ignores cancellation is still unable to allow late',
            'concurrent owner requests are isolated',
            'only synthetic audit metadata survives and every child is reaped',
            'TTO_W22_ASYNC_PYTHON_PDP_INLINE=PASS',
            'TTO_W22_OS_CHILD_ABORT_AND_REAP=PASS',
            'TTO_W22_HANG_DEADLINE_FAIL_CLOSED=PASS',
            'TTO_W22_LATE_POSITIVE_DISCARDED=PASS',
            'TTO_W22_REQUEST_DISCONNECT_ABORTS_PDP=PASS',
            'TTO_W22_NO_ORPHAN_CHILD_PROCESSES=PASS',
            'TTO_W22_NO_DB_NO_DOCKER_NO_OPERATIONAL_ALLOW=PASS'
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        f=CHILD.read_text(encoding="utf8")
        self.assertIn('TTO_W22_CHILD_FIXTURE',f)
        for mode in ('"hang"','"late"','"crash"','"invalid"','"schema"','"oversize"'):
            self.assertIn(mode,f)
        self.assertNotIn('require("node:http")',f)
        self.assertNotIn('require("node:net")',f)

    def test_05_git_only_draft_and_all_six_docker_actions_skipped(self):
        s=WORKFLOW.read_text(encoding="utf8")
        br="test/w2-2-cancellable-pdp-no-docker-20261101"
        self.assertIn("github.event.pull_request.draft && github.head_ref == '"+br+"'",s)
        self.assertIn("TTO_W22_GITHUB_ACTIONS_NO_DOCKER=PASS",s)
        self.assertIn('node --test scripts/ci/w2-2-cancellable-pdp.test.cjs',s)
        self.assertIn('node --test scripts/ci/w2-inline-lab-http.test.cjs',s)
        self.assertIn('TTO_W22_CANCELLABLE_LAB: "1"',s)
        self.assertIn("if: env.TTO_W2_NO_DOCKER_BRANCH == 'true'",s)
        for name in (
            "Start a single disposable local PostgreSQL 17 container",
            "Apply migrations 0001-0010 to disposable PG17 only",
            "Real Next Nest PostgreSQL identity, tenant, source and share quarantine E2E",
            "Complete historical SQL, OTP, login/logout and authority regression",
            "Build and smoke all four OCI images without registry push",
            "Stop isolated PostgreSQL even on failure"
        ):
            stage=s.split("- name: "+name,1)
            self.assertEqual(len(stage),2,name)
            self.assertIn("env.TTO_W2_NO_DOCKER_BRANCH != 'true'",
                          stage[1].split("- name:",1)[0],name)
        self.assertIn('permissions:\n  contents: read',s)

    def test_06_contract_does_not_authorize_real_operations(self):
        v=json.loads(CONTRACT.read_text(encoding="utf8"))
        self.assertEqual(v["schemaVersion"],"0.1-DRAFT")
        self.assertFalse(v["usesDockerOrDatabase"])
        self.assertFalse(v["realRoutesModified"])
        self.assertFalse(v["productionInlinePEP"])
        self.assertFalse(v["canGrantPermission"])
        self.assertEqual(v["legalOperationalEffect"],"NONE")
        self.assertEqual(v["approvedStatus"],"NOT_APPROVED")
        self.assertIn("W1 Python bridge remains synthetic-only",v["limitations"])
        self.assertIn("Full Docker/OCI release deferred by user request",v["limitations"])

if __name__=="__main__":
    unittest.main()
