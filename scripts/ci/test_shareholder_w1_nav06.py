"""Offline NAV06 design-review architecture gates; browser and Docker release are separate."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/"apps/shareholder/app/review/interactive/nav-06"
UI=(BASE/"synthetic-services.tsx").read_text(encoding="utf-8")
FIX=(BASE/"services-fixtures.ts").read_text(encoding="utf-8")
CSS=(BASE/"services.css").read_text(encoding="utf-8")
PAGE=(BASE/"page.tsx").read_text(encoding="utf-8")
AST=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text(encoding="utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text(encoding="utf-8")
RUNNER=(ROOT/"scripts/ci/run-local-docker.ps1").read_text(encoding="utf-8")
BROWSER=(ROOT/"scripts/e2e-shareholder-nav06-review.cjs").read_text(encoding="utf-8")
class Nav06ApprovedServices(unittest.TestCase):
 def test_01_eleven_exact_submenus(self):
  names=("خدمات من","درخواست‌های من","آکادمی","دوره‌های من","رویدادها",
         "رزروهای من","گواهی‌های آموزشی","مزایای من","Voucherها","خدمات شرکت","تقویم من")
  self.assertEqual(FIX.count('label:"'),11)
  for name in names:self.assertIn('label:"'+name+'"',FIX)
 def test_02_owner_boundaries(self):
  for owner in ("CHILD14_ACADEMY","CHILD14_EVENTS","CHILD15_BENEFITS",
                "COOPERATIVE_SERVICE","SERVICE_REQUEST","ACTION_CALENDAR_PROJECTION"):
   self.assertIn(owner,FIX)
  self.assertIn("حضور ≠ تکمیل دوره",UI) if False else self.assertIn("ثبت حضور ≠ تکمیل دوره",UI)
 def test_03_demo_marked_and_default_deny(self):
  self.assertIn('useState<Nav06Mode>("UNVERIFIED")',UI)
  self.assertIn('const demo=mode==="DEMO_CONTENT"',UI)
  self.assertIn('demo?<div className="nav06-grid">',UI)
  self.assertIn('data-source-mode={mode}',UI)
  self.assertEqual(FIX.count('id:"DEMO-'),16)
  for guard in ('authority:false','eligible:false','reservation:false','certification:false',
                'redeem:false','payment:false','download:false','mockOnly:true','DEMO_ONLY'):
   self.assertIn(guard,FIX)
 def test_04_no_live_operations_or_secret_providers(self):
  for s in ("fetch(","XMLHttpRequest","WebSocket(","localStorage","sessionStorage",
            "document.cookie","navigator.sendBeacon","type=\"submit\"","method=\"POST\"","<form"):
   self.assertNotIn(s,UI)
  for s in ("fetch(","XMLHttpRequest","WebSocket(","localStorage","sessionStorage"):
   self.assertNotIn(s,FIX)
  self.assertIn('disabled>درخواست خدمت (غیرفعال)',UI)
  self.assertIn('disabled>ثبت‌نام دوره (غیرفعال)',UI)
  self.assertIn('disabled>رزرو و استفاده از مزایا (غیرفعال)',UI)
 def test_05_approved_visual_shell_reused(self):
  self.assertIn('import "../nav-04/assemblies.css"',PAGE)
  for part in ("w1a-shell","w1a-sidebar","w1a-global-header","w1a-kpi-row",
               "w1a-four-panels","w1a-actions-row","w1a-review-toolbox"):
   self.assertIn(part,UI)
  self.assertIn("@media(max-width:680px)",CSS)
  self.assertIn(":focus-visible",CSS)
 def test_06_all_sidebar_roots_and_services_route(self):
  self.assertEqual(UI.count('"/review/interactive/nav-0'),5)
  self.assertIn('index===5?" w1a-active"',UI)
  self.assertIn('["⚙","خدمات من","/review/interactive/nav-06"]',UI)
 def test_07_academy_event_benefit_legal_limits(self):
  for clause in ("Attendance", "گواهی","کیف پول نقدی","Voucher","فهرست انتظار","تقویم"):
   self.assertIn(clause,FIX+UI)
  self.assertIn("NAV06_RELEASE_GATES",FIX)
 def test_08_existing_tsx_ast_and_http_smoke(self):
  for x in ("nav-06/page.tsx","nav-06/synthetic-services.tsx","nav-06/services-fixtures.ts"):
   self.assertIn(x,AST)
  self.assertIn('/review/interactive/nav-06',SMOKE)
  self.assertIn('NAV06 fail-closed SSR marker missing',SMOKE)
 def test_09_exact_sha_disposable_browser(self):
  for x in ("TTO_NAV06_CHROMIUM_VIEWPORTS=5/5","TTO_NAV06_CHROMIUM_PASS_SHA=",
            "TTO_PHASE4C_EXPECTED_SOURCE_SHA","NO_OVERFLOW_","SOURCE_LOSS_DENY_",
            "ZERO_WRITES_","nav06-"):
   self.assertIn(x,BROWSER)
  self.assertIn("e2e-shareholder-nav06-review.cjs",RUNNER)
 def test_10_mobile_non_cash_restrictions(self):
  self.assertIn("@media(max-width:360px)",CSS)
  self.assertIn("Reward",FIX)
  self.assertIn("cash",FIX.lower())
  self.assertIn("voucher",FIX.lower())
  self.assertIn("payment:false",FIX)
if __name__=="__main__":unittest.main()
