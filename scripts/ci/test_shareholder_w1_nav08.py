"""NAV08 synthetic projects review and legal/data-gate assertions; no source admission."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/"apps/shareholder/app/review/interactive/nav-08"
UI=(BASE/"synthetic-projects.tsx").read_text(encoding="utf-8")
FIX=(BASE/"project-fixtures.ts").read_text(encoding="utf-8")
PAGE=(BASE/"page.tsx").read_text(encoding="utf-8")
CSS=(BASE/"projects.css").read_text(encoding="utf-8")
PARSER=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text(encoding="utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text(encoding="utf-8")
RUNNER=(ROOT/"scripts/ci/run-local-docker.ps1").read_text(encoding="utf-8")
BROWSER=(ROOT/"scripts/e2e-shareholder-nav08-review.cjs").read_text(encoding="utf-8")

class Nav08SyntheticProjectReview(unittest.TestCase):
    def test_01_nine_exact_approved_submenus(self):
        expected=("پروژه‌های شرکت","پیشرفت پروژه‌ها","دارایی‌های قابل افشا",
            "سرمایه‌گذاری‌های شرکت","پروژه‌های جدید","فرصت‌های همکاری",
            "فرصت‌های شغلی","برنامه‌های مسئولیت اجتماعی","اثرگذاری محلی")
        block=FIX.split("export const NAV08_SECTIONS=[",1)[1].split("] as const;",1)[0]
        self.assertEqual(block.count('label:"'),9)
        for label in expected:self.assertIn('label:"'+label+'"',block)
        self.assertIn("۹ زیرمنوی رسمی",UI)
    def test_02_domain_owners_and_no_business_inference(self):
        for marker in ("CHILD12_PROJECT","CHILD12_ASSET","CHILD12_INVESTMENT",
            "CHILD17_COLLABORATION","CHILD18_OPPORTUNITY","CHILD19_IMPACT_PROGRAM",
            "CHILD19_IMPACT_CLAIM","رکورد پروژه ≠ مالکیت","پیشرفت پروژه ≠ اثرگذاری",
            "Child12","Child19"):
            self.assertIn(marker,FIX+UI)
    def test_03_exact_eighteen_mock_records_and_denied_authority(self):
        self.assertEqual(FIX.count('id:"DEMO-PRJ-'),18)
        for marker in ('mockOnly:true','publication:"DEMO_ONLY"','authority:false',
            'tenantVerified:false','disclosureApproved:false','ownershipVerified:false',
            'permitVerified:false','investmentEligible:false','contractAwarded:false',
            'employmentApplication:false','impactClaimVerified:false','downloadApproved:false'):
            self.assertIn(marker,FIX)
    def test_04_default_deny_and_unavailable_not_equivalent_to_zero(self):
        for marker in ('useState<Nav08Mode>("UNVERIFIED")',
            'const demo=mode==="DEMO_CONTENT"','data-source-mode={mode}',
            'mode==="UNVERIFIED"','SOURCE_UNAVAILABLE',
            'نمایش واقعی','وضعیت واقعی نامعلوم'):
            self.assertIn(marker,UI+FIX)
        self.assertIn('demo?<div className="nav06-grid">',UI)
    def test_05_no_real_operations_data_io_or_doc_download(self):
        for marker in ('disabled>درخواست سرمایه‌گذاری (غیرفعال)',
            'disabled>دریافت سند (غیرفعال)','disabled>ثبت درخواست شغلی (غیرفعال)',
            'disabled>درخواست همکاری (غیرفعال)'):
            self.assertIn(marker,UI)
        for forbidden in ('fetch(','XMLHttpRequest','WebSocket(','navigator.sendBeacon',
            'document.cookie','localStorage','sessionStorage','<form','type="submit"',
            'window.open','download='):
            self.assertNotIn(forbidden,UI)
    def test_06_approved_shell_and_nine_grouped_tabs(self):
        for marker in ('w1a-shell nav06-shell nav07-shell nav08-shell','<Sidebar/>',
            '<Header/>','index===7?" w1a-active"',
            'w1a-four-panels nav06-overview','w1a-kpi-row nav06-kpi',
            'w1a-actions-row nav06-shortcuts',
            'ids:["PROJECTS","PROGRESS","ASSETS","INVESTMENTS","NEW_PROJECTS"]',
            'ids:["COLLABORATIONS","JOBS"]',
            'ids:["CSR","IMPACT"]'):
            self.assertIn(marker,UI)
        self.assertIn('import "../nav-04/assemblies.css"',PAGE)
        self.assertIn('import "../nav-06/services.css"',PAGE)
        self.assertIn('import "../nav-07/market.css"',PAGE)
        self.assertIn("@media(max-width:680px)",CSS)
    def test_07_review_only_static_route_and_readonly_detail(self):
        self.assertIn('export const dynamic="force-static"',PAGE)
        self.assertIn('"/review/interactive/nav-08"',UI)
        self.assertIn('id="nav08-details"',UI)
        self.assertIn('aria-pressed={section===id}',UI)
        self.assertIn('aria-expanded={detailId===item.id}',UI)
        self.assertIn('requestAnimationFrame(',UI)
    def test_08_tsx_ast_http_and_real_browser_wired(self):
        for marker in ('nav-08/page.tsx','nav-08/synthetic-projects.tsx',
            'nav-08/project-fixtures.ts'):
            self.assertIn(marker,PARSER)
        self.assertIn('NAV08 fail-closed SSR marker missing',SMOKE)
        self.assertIn('DEMO-PRJ-001',SMOKE)
        self.assertIn('node --check scripts/e2e-shareholder-nav08-review.cjs',RUNNER)
        self.assertIn('node scripts/e2e-shareholder-nav08-review.cjs',RUNNER)
    def test_09_real_browser_five_viewports_nine_tabs(self):
        for marker in ('TTO_NAV08_CHROMIUM_VIEWPORTS=5/5',
            'TTO_NAV08_SCREENSHOT_HASHES=','TTO_NAV08_CHROMIUM_PASS_SHA=',
            'verify(1440,900,true)','verify(1536,1024,false)',
            'verify(768,1024,false)','verify(390,844,true)',
            'verify(320,740,false)','for(let i=0;i<9;i++)',
            'ZERO_WRITES_','ZERO_EXTERNAL_','NO_OVERFLOW_',
            'SOURCE_LOSS_DENY_'):
            self.assertIn(marker,BROWSER)
    def test_10_no_accounting_or_unapproved_impact_authority(self):
        for marker in ('نه سیستم حسابداری','SROI','اطلاعات بهره‌مندان',
            'درآمد','مبنای قانونی','افشای مصوب'):
            self.assertTrue(marker in FIX or marker in UI or marker in CSS,
                            "missing explicit boundary: "+marker)
        self.assertIn('هیچ کیف پول نقدی',FIX)

if __name__=="__main__":
    unittest.main()
