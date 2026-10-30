"""W1 real-route synthetic e2e safety gates, no runtime wiring or real data.

Only the existing Next/Nest routes execute in the new test. Shadow PDP/PEP is
a separate non-authoritative reference and is NOT a real route authorization.
"""
from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parents[2]
E2E=ROOT/"scripts/e2e-w1-real-next-nest-authorization.cjs"
RUNNER=ROOT/"scripts/ci/run-local-docker.ps1"

class W1RealNextNestSourceSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.code=E2E.read_text(encoding="utf-8")
        cls.runner=RUNNER.read_text(encoding="utf-8")

    def test_01_no_live_source_or_project_database(self):
        for x in (
            'TEST_ADMIN_DATABASE_URL!==DB_URL', 'W1_REAL_ROUTES_DISPOSABLE_PG_ONLY',
            'process.env.VERCEL', 'process.env.APIIR_TOKEN',
            'process.env.DATABASE_URL', 'process.env.TTO_DB_APP_PASSWORD',
            'process.env.TTO_DB_POOLER_HOST', 'postgresql://postgres@127.0.0.1:5432/tto',
            '127.0.0.1:32981', '127.0.0.1:32982', '127.0.0.1:32983',
        ):
            with self.subTest(marker=x):self.assertIn(x,self.code)
        for bad in ('https://supabase', 'https://api.', 'TTO_ENABLE_REAL_SMSOTP_DELIVERY:"true"',
                    'ALTER SYSTEM', 'createExtension', 'process.env.VERCEL = "1"'):
            self.assertNotIn(bad,self.code)

    def test_02_real_next_nest_appmodule_not_mock_http(self):
        for marker in (
            '["dist/main.js"]', 'node_modules/next/dist/bin/next', '"start","-p","32982"',
            'relay=http.createServer', 'requests.push({method:req.method,path:url.pathname})',
            'const response=await fetch(API+url.pathname',
            'env:{...process.env,...env}',
            'new Client({connectionString:DB_URL',
        ):
            with self.subTest(marker=marker):self.assertIn(marker,self.code)
        self.assertNotIn('route.fulfill(',self.code)
        self.assertNotIn('page.route(',self.code)

    def test_03_synthetic_source_canaries_never_authorized(self):
        for marker in (
            'member_source_snapshots', 'shareholding_source_snapshots',
            'source_contract_approvals', 'approvals:0,batches:0',
            'SOURCE_OR_PERMISSION_NOT_APPROVED',
            'TTO_W1_REAL_SOURCE_DISCLOSURE=ZERO',
            'TTO_W1_REAL_SOURCE_APPROVALS=ZERO',
            'no canary/token',
        ):
            with self.subTest(marker=marker):self.assertIn(marker,self.code)
        self.assertNotIn("UPDATE tto.source_contract_approvals",self.code)
        self.assertNotIn("INSERT INTO tto.source_contract_approvals",self.code)
        self.assertNotIn("ALTER TABLE tto.",self.code)

    def test_04_negative_real_http_cases_cover_all_boundaries(self):
        for marker in (
            'anonymous blocked by actual Next before any Nest contact',
            'malformed tenant and forged identity headers rejected at Next',
            'real BFF and Nest authorize only tenant context of active synthetic session',
            'unapproved synthetic source snapshots never disclosed by real read routes',
            'cross-tenant source and ownership reads remain denied',
            'trade and notice routes cannot be unlocked by valid session',
            'mutating trade requests cannot reach real Nest from browser',
            'direct actual Nest API independently verifies session, tenant and source',
            'a revoked actual PG session cannot access real Next or Nest reads',
            'independent PEP/PDP shadow refuses cross-tenant, owner and operations',
            'disposable legal-source and immutable source snapshots remain unchanged',
            'TTO_W1_REAL_NEXT_NEST_PG17_CASES=', 'TTO_W1_REAL_TRADE_MUTATION_DISABLED=PASS',
        ):
            with self.subTest(marker=marker):self.assertIn(marker,self.code)
        self.assertEqual(self.code.count('await one("'),11)

    def test_05_pep_shadow_is_existing_isolated_python_bridge_not_runtime(self):
        self.assertIn('["-m","scripts.security.w1_isolated_http_bridge"]',self.code)
        self.assertIn('syntheticPEP(operation,patch={})',self.code)
        self.assertIn('eq(v.fixtureTouches,0,"shadow denial before synthetic fixture")',self.code)
        self.assertIn('TTO_W1_SHADOW_PEP_PDP_NO_OPERATIONAL_ALLOW=PASS',self.code)
        self.assertIn('shadow decisions DO NOT enforce real HTTP routes',self.code)
        self.assertNotIn('fromApi("@nestjs/common")',self.code)
        self.assertNotIn('TTO_W1_ENABLE',self.code)

    def test_06_ci_runs_new_suite_after_build_and_synthetic_db_migrations(self):
        s=self.runner
        self.assertIn('node --check scripts/e2e-w1-real-next-nest-authorization.cjs',s)
        self.assertIn('TTO_W1_REAL_ROUTE_LAB=1',s)
        self.assertIn('command -v python3 >/dev/null',s)
        self.assertIn('node scripts/e2e-w1-real-next-nest-authorization.cjs',s)
        self.assertLess(s.index('Build all portals and API; typecheck'),
                        s.index('W1 real Next Nest PG17 synthetic authorization'))
        self.assertLess(s.index('for ($version = 1; $version -le 10; $version++)'),
                        s.index('W1 real Next Nest PG17 synthetic authorization'))
        self.assertLess(s.index('W1 real Next Nest PG17 synthetic authorization'),
                        s.index('TTO_LOCAL_CORE_PHASE_PASS_SHA='))
        
    def test_07_accepted_seam_contract_still_has_no_runtime_approval(self):
        nav=json.loads((ROOT/"docs/analysis/NAVIGATION_CONTRACT.json").read_text(encoding="utf-8"))
        gates=json.loads((ROOT/"docs/contracts/shareholder-w1-operational-gates-design-v0.1.json").read_text(encoding="utf-8"))
        seam=json.loads((ROOT/"docs/contracts/shareholder-w1-bff-nest-boundary-seam-v0.1.json").read_text(encoding="utf-8"))
        self.assertEqual(nav["implementation_status"],"NOT_IMPLEMENTED")
        self.assertTrue(all(x["authoritative_routes"] is None and x["permission_policy"] is None for x in nav["roots"]))
        self.assertEqual(gates["approvalStatus"],"NOT_APPROVED")
        self.assertFalse(gates["runtimeActivationRequested"])
        self.assertFalse(seam["runtimeActivation"])
        self.assertFalse(seam["canGrantPermission"])
        self.assertFalse(seam["liveSourcesEnabled"])
        self.assertEqual(seam["legalOperationalEffect"],"NONE")
        api=(ROOT/"services/api/src/module.ts").read_text(encoding="utf-8")
        self.assertNotIn('w1-boundary-seam',api)
        self.assertNotIn('e2e-w1-real-next-nest-authorization',api)

if __name__=="__main__":
    unittest.main()
