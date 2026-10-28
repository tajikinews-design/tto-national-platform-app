"""NAV07 shareholder market review-only architecture and release gate assertions."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/"apps/shareholder/app/review/interactive/nav-07"
UI=(BASE/"synthetic-marketplace.tsx").read_text(encoding="utf-8")
FIX=(BASE/"market-fixtures.ts").read_text(encoding="utf-8")
CSS=(BASE/"market.css").read_text(encoding="utf-8")
PAGE=(BASE/"page.tsx").read_text(encoding="utf-8")
PARSER=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text(encoding="utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text(encoding="utf-8")
RUNNER=(ROOT/"scripts/ci/run-local-docker.ps1").read_text(encoding="utf-8")
BROWSER=(ROOT/"scripts/e2e-shareholder-nav07-review.cjs").read_text(encoding="utf-8")

class Nav07MarketplaceReview(unittest.TestCase):
    def test_01_ten_exact_submenus(self):
        approved=("فروشگاه","محصولات شرکت","بازار ملی سهامداران",
            "محصولات سایر تعاونی‌ها","پیشنهادهای ویژه","سفارش‌های من",
            "پرداخت سفارش","وضعیت تحویل","معرفی محصول من","فرصت‌های کسب‌وکار")
        block=FIX.split("export const NAV07_SECTIONS=[",1)[1].split("] as const;",1)[0]
        self.assertEqual(block.count('label:"'),10)
        for label in approved:self.assertIn('label:"'+label+'"',block)
        self.assertEqual(UI.count('title:"'),7) # 4 overview headers, 3 grouping headers
    def test_02_strict_source_default_deny(self):
        self.assertIn('useState<Nav07Mode>("UNVERIFIED")',UI)
        self.assertIn('const demo=mode==="DEMO_CONTENT"',UI)
        self.assertIn('data-source-mode={mode}',UI)
        self.assertIn('demo?<div className="nav06-grid">',UI)
        self.assertIn('SOURCE_UNAVAILABLE',UI)
        self.assertIn('منبع معتبر تأیید نشده',UI)
    def test_03_fifteen_pure_mock_entries(self):
        self.assertEqual(FIX.count('id:"DEMO-'),15)
        for m in ('mockOnly:true','publication:"DEMO_ONLY"','authority:false',
            'tenantVerified:false','eligible:false','offerLive:false',
            'orderLive:false','paymentLive:false','fulfillmentLive:false',
            'proposalApproved:false','opportunityApplication:false'):
            self.assertIn(m,FIX)
    def test_04_legal_domain_separation(self):
        for m in ("CHILD16_MARKETPLACE","CHILD16_ORDER","CHILD16_SUPPLIER_PROPOSAL",
            "CHILD16_MARKETPLACE_ADS","CF05_PAYMENT_CH16","CHILD18_OPPORTUNITIES",
            "CHILD17","کیف پول نقدی","بازار سهام","پیشنهاد محصول سهامدار ≠ Offer"):
            self.assertIn(m,FIX+UI)
    def test_05_all_real_actions_disabled(self):
        for m in ('disabled>ثبت سفارش (غیرفعال)','disabled>پرداخت سفارش (غیرفعال)',
            'disabled>ثبت پیشنهاد فروشندگی (غیرفعال)',
            'disabled>معرفی محصول (غیرفعال)','disabled>درخواست همکاری (غیرفعال)'):
            self.assertIn(m,UI)
        for bad in ('fetch(','XMLHttpRequest','WebSocket(','localStorage',
            'sessionStorage','navigator.sendBeacon','document.cookie','<form','type="submit"'):
            self.assertNotIn(bad,UI)
    def test_06_approved_shared_shell_and_sidebar(self):
        for marker in ('"w1a-shell nav06-shell nav07-shell"','<Sidebar/>',
            '<Header/>','w1a-kpi-row nav06-kpi','w1a-four-panels nav06-overview',
            'w1a-actions-row nav06-shortcuts','index===6?" w1a-active"'):
            self.assertIn(marker,UI)
        self.assertIn('import "../nav-04/assemblies.css"',PAGE)
        self.assertIn('import "../nav-06/services.css"',PAGE)
        self.assertIn("@media(max-width:680px)",CSS)
    def test_07_navigation_ten_sections_and_review_only(self):
        self.assertIn('ids:["STORE","COOP_PRODUCTS","NATIONAL","OTHER_COOPS","SPECIAL"]',UI)
        self.assertIn('ids:["MY_ORDERS","PAY_ORDER","DELIVERY"]',UI)
        self.assertIn('ids:["SUGGEST","OPPORTUNITIES"]',UI)
        self.assertIn('"/review/interactive/nav-07"',UI)
        self.assertIn('export const dynamic="force-static"',PAGE)
    def test_08_integration_registered_in_ci(self):
        for marker in ('nav-07/page.tsx','nav-07/synthetic-marketplace.tsx','nav-07/market-fixtures.ts'):
            self.assertIn(marker,PARSER)
        self.assertIn('NAV07 fail-closed SSR marker missing',SMOKE)
        self.assertIn('node --check scripts/e2e-shareholder-nav07-review.cjs',RUNNER)
        self.assertIn('node scripts/e2e-shareholder-nav07-review.cjs',RUNNER)
    def test_09_five_viewports_and_no_writes(self):
        self.assertIn('TTO_NAV07_CHROMIUM_VIEWPORTS=5/5',BROWSER)
        self.assertIn('TTO_NAV07_CHROMIUM_PASS_SHA=',BROWSER)
        for viewport in ('verify(1440,900,true)','verify(1536,1024,false)',
           'verify(768,1024,false)','verify(390,844,true)','verify(320,740,false)'):
            self.assertIn(viewport,BROWSER)
        self.assertIn('for(let i=0;i<10;i++)',BROWSER)
        for m in ('ZERO_WRITES_','ZERO_EXTERNAL_','SOURCE_LOSS_DENY_','NO_OVERFLOW_'):
            self.assertIn(m,BROWSER)
    def test_10_price_wallet_ads_ai_safety(self):
        for phrase in ('MVP','snapshot','Callback','هدف‌گیری سیاسی','AI',
            'RESTRICTED','تبلیغ','تعاونی'):
            self.assertIn(phrase,FIX)
        self.assertIn('معرفی محصول ≠ عرضه فروش',UI)

if __name__=="__main__":
    unittest.main()
