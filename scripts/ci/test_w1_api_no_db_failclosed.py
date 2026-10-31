"""W1 OCI fail-closed startup regression: no release gate weakening.

The source-of-truth runtime test executes the compiled API with no DB before
OCI probes; this static test prevents accidental deletion or bypass of checks.
"""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
MAIN=ROOT/"services/api/src/main.ts"
MODULE=ROOT/"services/api/src/module.ts"
DOCKER=ROOT/"services/api/Dockerfile"
HELPER=ROOT/"scripts/ci/local-release-helper.ps1"
RUNNER=ROOT/"scripts/ci/run-local-docker.ps1"
JS=ROOT/"scripts/ci/w1-api-startup-failclosed.test.cjs"
MARKER="TTO_API_STARTUP_FAILED_CODE_DATABASE_URL_NOT_CONFIGURED"

class W1ApiMissingDatabaseFailClosed(unittest.TestCase):
    def test_01_non_vercel_database_preflight_before_nest_di(self):
        s=MAIN.read_text(encoding="utf8")
        pre='if (!process.env.DATABASE_URL && !process.env.VERCEL) {'
        self.assertIn(pre,s)
        self.assertLess(s.index(pre),s.index('NestFactory.create<NestFastifyApplication>'))
        self.assertIn('code: "DATABASE_URL_NOT_CONFIGURED"',s)
        self.assertIn('process.exitCode = 1',s)
        self.assertIn('TTO_API_STARTUP_FAILED_CODE_',s)
        self.assertNotIn('console.error(error)',s)
        self.assertNotIn('console.error(process.env.DATABASE_URL)',s)
        self.assertNotIn('console.log(process.env.DATABASE_URL)',s)

    def test_02_existing_vercel_source_preflight_and_database_provider_preserved(self):
        s=MODULE.read_text(encoding="utf8")
        self.assertIn('if (!connectionString && process.env.VERCEL)',s)
        self.assertIn('if (!connectionString) throw new Error("DATABASE_URL_NOT_CONFIGURED")',s)
        self.assertIn("RLS_SAFE_DATABASE_ROLE_REQUIRED",s)
        self.assertIn("tto.resolve_session",s)
        self.assertIn("set_config('tto.tenant_id'",s)

    def test_03_compiled_api_negative_test_only_no_db_no_network_credentials(self):
        s=JS.read_text(encoding="utf8")
        for token in ("W1_API_FAILCLOSED_DISPOSABLE_CI_ONLY","TEST_ADMIN_DATABASE_URL",
                      '["dist/main.js"]','DATABASE_URL=""','TTO_W1_API_NO_DATABASE_DETERMINISTIC_FAILCLOSED=PASS',
                      'TTO_W1_API_NO_DATABASE_OPERATIONS=NONE',
                      'r.status,1','TTO_API_STARTUP_FAILED_CODE_DATABASE_URL_NOT_CONFIGURED'):
            # DATABASE_URL is intentionally absent from child env or set empty.
            if token=="TEST_ADMIN_DATABASE_URL":
                self.assertNotIn(token,s)
            else:self.assertIn(token,s)
        self.assertNotIn('DATABASE_URL:process.env.DATABASE_URL',s)
        self.assertNotIn('VERCEL:process.env.VERCEL',s)
        self.assertNotIn('DATABASE_URL:process.env.TEST_ADMIN_DATABASE_URL',s)
        self.assertNotIn("docker",s)

    def test_04_ci_requires_fresh_compiled_failure_probe(self):
        s=RUNNER.read_text(encoding="utf8")
        self.assertIn('node --check scripts/ci/w1-api-startup-failclosed.test.cjs',s)
        self.assertIn('node --test scripts/ci/w1-api-startup-failclosed.test.cjs',s)
        self.assertLess(s.index('Build all portals and API; typecheck'),
                        s.index('W1 compiled API no-DB deterministic fail-closed regression'))
        self.assertLess(s.index('W1 compiled API no-DB deterministic fail-closed regression'),
                        s.index('for ($version = 1; $version -le 10; $version++)'))

    def test_05_original_oci_runtime_gate_is_not_removed_or_weakened(self):
        s=HELPER.read_text(encoding="utf8")
        for marker in (
            'Create API with no DB credentials and NO NETWORK',
            'Start API without DB credentials (must exit closed)',
            'if ($exitCode -eq "0" -or $log -notmatch "TTO_API_STARTUP_FAILED|DATABASE_URL_NOT_CONFIGURED")',
            'throw "TTO_RELEASE_API_FAIL_CLOSED_NOT_PROVEN"',
            'TTO_LOCAL_RELEASE_OCI_API_DENY_PASS',
            'TTO_LOCAL_RELEASE_OCI_FOUR_IMAGE_PASS',
            '"--network","none",$tag'
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)

    def test_06_oci_api_starts_production_without_database_env(self):
        s=DOCKER.read_text(encoding="utf8")
        self.assertIn('ENV NODE_ENV=production',s)
        self.assertIn('CMD ["node","services/api/dist/main.js"]',s)
        self.assertNotIn('ENV DATABASE_URL',s)
        self.assertNotIn('ARG DATABASE_URL',s)

if __name__=="__main__":
    unittest.main()
