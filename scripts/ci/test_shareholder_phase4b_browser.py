"""Offline contract for opt-in Chromium browser tests; no browser or backend needed."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
BROWSER=ROOT/"scripts/ci/phase4b-session-browser.cjs"
RUNNER=ROOT/"scripts/ci/run-phase4b-browser-docker.ps1"
SMOKE=ROOT/"scripts/smoke-next-otp.mjs"
class SyntheticSessionBrowserContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.browser=BROWSER.read_text(encoding="utf-8")
        cls.runner=RUNNER.read_text(encoding="utf-8-sig")
        cls.smoke=SMOKE.read_text(encoding="utf-8")

    def test_browser_cases_cover_session_revocation_and_failures(self):
        for marker in ('anonymous-denied','revoke-after-holdings-visible',
                       'session-503-fail-closed-and-retry',
                       'session-malformed-fail-closed',
                       'tenant-discovery-401-unmounts',
                       'tenant-context-401-unmounts',
                       'membership-401-unmounts',
                       'trade','notices',
                       'scope-403-stays-locked-not-logged-out',
                       'source-403-is-not-session-loss'):
            with self.subTest(case=marker):
                self.assertIn(marker,self.browser)
        self.assertIn('casesPassed++',self.browser)
        self.assertIn('casesExecuted++',self.browser)
        self.assertIn('casesExecuted===11&&casesPassed===11',self.browser)

    def test_intercepts_only_in_isolated_browser(self):
        for marker in ('await context.route("**/*"', 'url.origin!==BASE',
                       'url.pathname.startsWith("/api/")',
                       'method!=="GET"','browserOnlySyntheticBff:true',
                       'realAuthenticationVerified:false',
                       'operationalSourceApproval:false',
                       'phase4b-session-report.json'):
            with self.subTest(marker=marker):
                self.assertIn(marker,self.browser)
        for forbidden in ('process.env.APIIR_TOKEN','Authorization:','walletBalance',
                          'INSERT INTO','realTradeExecution'):
            self.assertNotIn(forbidden,self.browser)

    def test_runner_is_exact_sha_and_disposable(self):
        for marker in ('SOURCE_COMMIT_MISMATCH','SOURCE_WORKTREE_NOT_CLEAN',
                       'TRACKED_SENSITIVE_FILES_REFUSE_ARCHIVE',
                       'tto.phase4b.sha',
                       '"--network",("container:"+$container)',
                       '"--security-opt","no-new-privileges"',
                       'TTO_API_BASE_URL=https://invalid.example',
                       'TTO_PHASE4B_EXPECTED_SOURCE_SHA',
                       'phase4b-session-browser.cjs',
                       'phase4b-session-report.json',
                       'casesPassed -ne 11','sourceSha -cne $ExpectedCommit'):
            with self.subTest(marker=marker):
                self.assertIn(marker,self.runner)
        self.assertNotIn('docker compose',self.runner.lower())
        self.assertNotIn('docker system prune',self.runner.lower())

    def test_no_backend_smoke_covers_all_ten_module_routes(self):
        for n in range(2,12):
            with self.subTest(nav=n):
                slug=f'/modules/nav-{n:02}'
                self.assertIn(slug,self.smoke)
        self.assertIn('protectedShareholder=slug==="shareholder"',self.smoke)
        self.assertIn('legacy module lost safe placeholder',self.smoke)
        self.assertIn('protected module leaked private data',self.smoke)

if __name__=="__main__":
    unittest.main()
