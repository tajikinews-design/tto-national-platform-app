"""NAV09 statutory transparency review: domain and release safeguards."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/"apps/shareholder/app/review/interactive/nav-09"
UI=(BASE/"synthetic-disclosures.tsx").read_text(encoding="utf-8")
FIX=(BASE/"disclosure-fixtures.ts").read_text(encoding="utf-8")
PAGE=(BASE/"page.tsx").read_text(encoding="utf-8")
CSS=(BASE/"disclosures.css").read_text(encoding="utf-8")
PARSER=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text(encoding="utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text(encoding="utf-8")
RUNNER=(ROOT/"scripts/ci/run-local-docker.ps1").read_text(encoding="utf-8")
BROWSER=(ROOT/"scripts/e2e-shareholder-nav09-review.cjs").read_text(encoding="utf-8")

class Nav09TransparencyReview(unittest.TestCase):
    def test_01_exact_eight_approved_shareholder_submenus(self):
        approved=("شفافیت شرکت","گزارش‌های مالی","گزارش هیئت‌مدیره",
            "گزارش بازرس","اسناد قانونی","حقوق و مقررات سهامدار",
            "سیاست حریم خصوصی","هشدارهای مهم شرکت")
        block=FIX.split("export const NAV09_SECTIONS=[",1)[1].split("] as const;",1)[0]
        self.assertEqual(block.count('label:"'),8)
        for label in approved:
            self.assertIn('label:"'+label+'"',block)
        self.assertIn("۸ زیرمنوی رسمی",UI)

    def test_02_exactly_sixteen_fabricated_records(self):
        self.assertEqual(FIX.count('id:"DEMO-DISC-'),16)
        for marker in ('mockOnly:true','publication:"DEMO_ONLY"',
            'authority:false','disclosureApproved:false','documentDownload:false',
            'statementOfficial:false','noticeAck:false','accountingEntry:false'):
            self.assertIn(marker,FIX)

    def test_03_statutory_owner_and_notices_privacy_boundary(self):
        for marker in ("CHILD11_TRANSPARENCY","CHILD11_FINANCIAL","CHILD11_BOARD",
            "CHILD11_AUDITOR","CHILD11_LEGAL","CHILD11_MEMBER_RIGHTS",
            "CHILD22_PRIVACY","CHILD09_NOTICE","Child20 GRC"):
            self.assertIn(marker,FIX)

    def test_04_no_general_accounting_or_inferred_authenticity(self):
        for marker in ("journal posting","بسته","نسخه","دوره","معتبر",
            "حسابداری","تصویب‌شده","Legal Hold"):
            self.assertIn(marker,FIX+UI)
        self.assertIn("DELIVERED ≠ READ ≠ ACKNOWLEDGED",FIX)

    def test_05_default_unknown_not_zero(self):
        self.assertIn('useState<Nav09Mode>("UNVERIFIED")',UI)
        self.assertIn('const demo=mode==="DEMO_CONTENT"',UI)
        self.assertIn('data-source-mode={mode}',UI)
        self.assertIn('SOURCE_UNAVAILABLE',UI)
        self.assertIn('demo?<div className="nav06-grid">',UI)
        self.assertIn('وضعیت واقعی نامعلوم',UI)

    def test_06_readonly_no_document_approval_or_ack(self):
        for marker in ('disabled>دریافت PDF (غیرفعال)',
            'disabled>تأیید دریافت ابلاغ (غیرفعال)',
            'disabled>ویرایش سند (غیرفعال)',
            'disabled>ثبت اعتراض (غیرفعال)'):
            self.assertIn(marker,UI)
        for forbidden in ('fetch(','XMLHttpRequest','WebSocket(','navigator.sendBeacon',
            'document.cookie','localStorage','sessionStorage','<form',
            'type="submit"','download=','window.open'):
            self.assertNotIn(forbidden,UI)

    def test_07_inherited_shared_shell_and_eight_tabs(self):
        for marker in ('nav09-shell','<Sidebar/>','<Header/>',
            'index===8?" w1a-active"','w1a-kpi-row nav06-kpi',
            'w1a-four-panels nav06-overview','w1a-actions-row nav06-shortcuts',
            'ids:["TRANSPARENCY","FINANCIAL","BOARD","AUDITOR"]',
            'ids:["LEGAL","RIGHTS"]','ids:["PRIVACY","WARNINGS"]'):
            self.assertIn(marker,UI)
        self.assertIn('import "../nav-08/projects.css"',PAGE)
        self.assertIn('@media(max-width:680px)',CSS)

    def test_08_static_route_and_no_real_source_in_ssr(self):
        self.assertIn('export const dynamic="force-static"',PAGE)
        self.assertIn('"/review/interactive/nav-09"',UI)
        self.assertIn('id="nav09-details"',UI)
        self.assertIn('NAV09 fail-closed SSR marker missing',SMOKE)
        self.assertIn('DEMO-DISC-001',SMOKE)

    def test_09_mandatory_tsx_browser_gates(self):
        for marker in ("nav-09/page.tsx","nav-09/synthetic-disclosures.tsx",
            "nav-09/disclosure-fixtures.ts"):
            self.assertIn(marker,PARSER)
        self.assertIn('node --check scripts/e2e-shareholder-nav09-review.cjs',RUNNER)
        self.assertIn('node scripts/e2e-shareholder-nav09-review.cjs',RUNNER)

    def test_10_five_chromium_viewports_and_evidence(self):
        for marker in ('TTO_NAV09_CHROMIUM_VIEWPORTS=5/5',
            'TTO_NAV09_SCREENSHOT_HASHES=','TTO_NAV09_CHROMIUM_PASS_SHA=',
            'check(1440,900,true)','check(1536,1024,false)',
            'check(768,1024,false)','check(390,844,true)',
            'check(320,740,false)','i<8',
            'errors.length===0','external.length===0','writes.length===0'):
            self.assertIn(marker,BROWSER)

if __name__=="__main__":
    unittest.main()
