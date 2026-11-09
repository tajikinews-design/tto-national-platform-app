"""Shareholder phase-1 source-boundary/UI regression checks; runnable offline."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
UI=ROOT/"packages/ui/src/shareholder-workspace.tsx"
LOGIN=ROOT/"packages/ui/src/otp-login.tsx"
SHELL=ROOT/"packages/ui/src/index.tsx"
HOME=ROOT/"apps/shareholder/app/page.tsx"
MODULE=ROOT/"apps/shareholder/app/modules/[id]/page.tsx"
CSS=ROOT/"packages/ui/src/styles.css"

class ShareholderWorkspaceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui=UI.read_text(encoding="utf-8")
        cls.login=LOGIN.read_text(encoding="utf-8")
        cls.shell=SHELL.read_text(encoding="utf-8")
        cls.home=HOME.read_text(encoding="utf-8")
        cls.module=MODULE.read_text(encoding="utf-8")
        cls.css=CSS.read_text(encoding="utf-8")

    def test_shareholder_requires_password_provenance_and_verified_tenant(self):
        self.assertIn('verified?<div>',self.login)
        self.assertIn('surface==="shareholder"?<ShareholderWorkspace',self.login)
        self.assertIn('initialShareholderView',self.login)
        self.assertIn('surface="shareholder" suppressStaticKpis',self.home)
        self.assertIn('<ApprovedDashboardHome surface={surface} demoOnly={demoOnly}>',self.shell)
        self.assertIn('PortalSessionGate surface="shareholder"',self.home)
        self.assertIn('ShareholderWorkspace',self.module)
        self.assertNotIn('OtpLogin',self.module)

    def test_tenant_and_source_reads_are_scoped_by_current_session(self):
        s=self.ui
        for marker in (
            '/api/me/tenant-options',
            '/api/tenants/"+tenantId+"/context',
            '/api/tenants/"+tenantId+"/me/',
            'root+"member-record"',
            'root+"shareholding"',
            'credentials:"same-origin"',
            'cache:"no-store"',
            'result.tenantId!==tenantId',
            'controller.signal.aborted',
            'pending.current?.abort()',
            'sequence.current===generation',
            'response.status===401',
            'response.status===403||response.status===404',
            'response.status!==200',
            'kind:"not-approved"',
            'kind:"unavailable"',
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker,s)
        for bad in (
            "localStorage", "sessionStorage", "dangerouslySetInnerHTML",
            "document.cookie", "Authorization", 'method:"POST"',
            "walletBalance", "shareValue", "fakeHoldings",
        ):
            with self.subTest(forbidden=bad):
                self.assertNotIn(bad,s)

    def test_display_uses_only_whitelisted_versioned_source_records(self):
        s=self.ui
        for marker in (
            'isMember(raw:unknown)',
            'isHolding(raw:unknown)',
            'membershipStatus==="ACTIVE"',
            'x.sourceVersion>0',
            'x.ledgerVersion>0',
            'shareQuantity',
            'verifiedMember',
            'verifiedHolding',
            'sourceAsOf',
            'ledgerAsOf',
            'return "—"',
            'shareNumber(verifiedHolding.shareQuantity)',
            '0|[1-9][0-9]{0,18}',
            'ناموجود به معنی صفر نیست',
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        self.assertNotIn('shareQuantity:"0"',s)
        self.assertNotIn('setHolding({kind:"verified"',s)

    def test_trade_and_notice_features_never_fabricate_approval(self):
        s=self.ui
        for marker in (
            'id:"overview"', 'id:"membership"', 'id:"requests"', 'id:"notices"',
            'ثبت و پیگیری غیرفعال',
            'مرجع ثبت و پیگیری هنوز متصل نیست',
            'فهرست انتشار مصوب هنوز متصل نیست',
            'هیچ سفارش',
            'کیف پول نقدی',
            'پرداخت مستقیم خریدار به فروشنده',
            'نبود فهرست به معنی نبود اطلاعیه نیست',
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        self.assertNotIn('tradeApi',s)
        self.assertNotIn('transactionId',s)

    def test_real_tsx_parser_runs_before_expensive_next_builds(self):
        script=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text(encoding="utf-8")
        runner=(ROOT/"scripts/ci/run-local-docker.ps1").read_text(encoding="utf-8")
        self.assertTrue(self.ui.rstrip().endswith("}"))
        for expected in (
            'ts.createSourceFile',
            'source.parseDiagnostics',
            'TTO_SHAREHOLDER_TSX_PARSE_PASS',
            'packages/ui/src/shareholder-workspace.tsx',
        ):
            self.assertIn(expected,script)
        # The preflight can grow extra syntax/security checks. Verify that
        # every required gate is present and ordered, not one brittle literal.
        preflight_label='Run-Node "Shareholder TSX AST and UI type preflight"'
        build_label='Run-Node "Build all portals and API; typecheck"'
        self.assertIn(preflight_label,runner)
        self.assertIn(build_label,runner)
        self.assertLess(runner.index(preflight_label),runner.index(build_label))
        preflight_line=runner.split(preflight_label,1)[1].splitlines()[0]
        ordered_checks=(
            'node scripts/ci/verify-shareholder-tsx.cjs',
            'node --check scripts/e2e-phase4c-real-session-browser.cjs',
            'node --check scripts/e2e-shareholder-nav06-review.cjs',
            'node --check scripts/e2e-shareholder-nav07-review.cjs',
            'node --check scripts/e2e-shareholder-nav08-review.cjs',
            'node --check scripts/e2e-shareholder-nav09-review.cjs',
            'pnpm --filter @tto/ui typecheck',
        )
        positions=[]
        for gate in ordered_checks:
            self.assertIn(gate,preflight_line)
            positions.append(preflight_line.index(gate))
        self.assertEqual(positions,sorted(positions))
        self.assertEqual(len(set(positions)),len(ordered_checks))

    def test_runtime_smoke_checks_protected_module_states_instead_of_old_placeholder(self):
        smoke=(ROOT/"scripts/smoke-next-otp.mjs").read_text(encoding="utf-8")
        for marker in (
            'const moduleCases=Array.from({length:10}',
            '"/modules/nav-"+String(i+2).padStart(2,"0")',
            'html.includes("در حال بررسی دسترسی")',
            'html.includes("کارپوشه شخصی سهامدار")',
            'html.includes("عضویت فعال — منبع تأییدشده")',
            'const anonymous=await fetch(endpoint)',
            'const forged=await fetch(endpoint',
            'payload.code!=="SESSION_REQUIRED"',
            '"member-record","shareholding"',
            '"X-Role":"MEMBER"',
            'cache-control',
            'approved 11-slot non-data visual review missing',
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker,smoke)
        self.assertNotIn('protectedShareholder=slug==="shareholder"',smoke)
        self.assertNotIn('module view missing safe placeholder/current navigation',smoke)
        self.assertIn('TTO_NEXT_3PORTAL_PASSWORD_GATED_RUNTIME_SMOKE_PASS=',smoke)

    def test_navigation_and_design_are_responsive_and_accessible(self):
        for key in ('NAV-02','NAV-03','NAV-05'):
            with self.subTest(nav=key):self.assertIn(key,self.module)
        self.assertIn('notices',self.module)
        self.assertIn('membership',self.module)
        self.assertIn('requests',self.module)
        for marker in ('aria-pressed','role="alert"','role="status"','htmlFor="sw-tenant"'):
            with self.subTest(marker=marker):self.assertIn(marker,self.ui)
        for marker in ('@media(max-width:640px)','prefers-reduced-motion','.sw-stats','.sw-scope-controls'):
            with self.subTest(marker=marker):self.assertIn(marker,self.css)

if __name__=="__main__":
    unittest.main()
