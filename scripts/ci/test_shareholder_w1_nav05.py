"""NAV05 shareholder design-review architecture, default-deny and owner contracts.
Source checks run offline in existing Python CI. Browser gates run separately.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/"apps/shareholder/app/review/interactive/nav-05"
UI=(BASE/"synthetic-communications.tsx").read_text(encoding="utf-8")
FIX=(BASE/"communications-fixtures.ts").read_text(encoding="utf-8")
CSS=(BASE/"communications.css").read_text(encoding="utf-8")
PAGE=(BASE/"page.tsx").read_text(encoding="utf-8")
AST=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text(encoding="utf-8")
BROWSER=(ROOT/"scripts/e2e-shareholder-nav05-review.cjs").read_text(encoding="utf-8")
RUNNER=(ROOT/"scripts/ci/run-local-docker.ps1").read_text(encoding="utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text(encoding="utf-8")

class NAV05Architecture(unittest.TestCase):
 def test_01_preserves_navigation_taxonomy(self):
  labels=("اخبار شرکت","اطلاعیه‌ها","ابلاغ‌های مهم",
          "پیام‌های نیازمند تأیید","نظرسنجی‌ها","صدای من",
          "پیشنهادهای من","پاسخ مدیریت","تیکت‌های من","اعلان‌ها")
  self.assertEqual(FIX.count('label:"'),10)
  for label in labels:self.assertIn('label:"'+label+'"',FIX)
  self.assertEqual(UI.count('"/review/interactive/nav-0'),5)
  self.assertIn('className="w1a-side-links"',UI)

 def test_02_canonical_owner_boundaries(self):
  for owner in ("CHILD09","CHILD10","CHILD13","CF05"):
   self.assertIn(owner,FIX)
  self.assertIn("تحویل اعلان ≠ مطالعه محتوا ≠ تأیید دریافت",UI)
  self.assertIn("NAV04",UI)
  self.assertIn("NAV09",UI)

 def test_03_default_fail_closed_and_optin(self):
  self.assertIn('useState<Nav05Mode>("UNVERIFIED")',UI)
  self.assertIn('const demo=mode==="DEMO_CONTENT"',UI)
  self.assertIn('demo?NAV05_FIXTURES.filter',UI)
  self.assertIn('demo?<div className="nav05-item-grid">',UI)
  self.assertIn('data-source-mode={mode}',UI)
  self.assertIn('setSelectedId(null);setQuery("")',UI)

 def test_04_no_operational_behavior_or_data_access(self):
  for fragment in ("fetch(","XMLHttpRequest","WebSocket(","localStorage",
                   "sessionStorage","document.cookie","navigator.sendBeacon",
                   "type=\"submit\"","method=\"POST\"","<form"):
   self.assertNotIn(fragment,UI)
  for fragment in ("fetch(","XMLHttpRequest","WebSocket(","localStorage","sessionStorage"):
   self.assertNotIn(fragment,FIX)
  self.assertIn('disabled>ثبت درخواست جدید (غیرفعال)',UI)
  self.assertIn('disabled type="button">تأیید دریافت (غیرفعال)',UI)
  self.assertIn('disabled type="button">دریافت پیوست (غیرفعال)',UI)

 def test_05_all_fixtures_are_explicitly_fake(self):
  self.assertEqual(FIX.count('id:"DEMO-'),13)
  for guard in ("mockOnly:true","official:false","downloadable:false",
                "ackEnabled:false","canSend:false","DEMO_ONLY","DEMO-V1"):
   self.assertIn(guard,FIX)

 def test_06_same_approved_dashboard_structure(self):
  self.assertIn('import "../nav-04/assemblies.css"',PAGE)
  for shell in ("w1a-shell","w1a-sidebar","w1a-global-header",
                "w1a-kpi-row","w1a-four-panels","w1a-actions-row",
                "w1a-review-toolbox"):
   self.assertIn(shell,UI)
  self.assertIn("@media(max-width:680px)",CSS)
  self.assertIn(":focus-visible",CSS)

 def test_07_source_contract_and_release_gates(self):
  self.assertIn("NAV05_RELEASE_GATES",FIX)
  self.assertIn("sourceDomain",FIX)
  self.assertIn("publication",FIX)
  self.assertIn("version",FIX)
  self.assertIn("audience",FIX)
  self.assertIn("Notice Assurance",FIX)
  self.assertIn('type Nav05Mode="UNVERIFIED"|"SOURCE_UNAVAILABLE"|"DEMO_CONTENT"',FIX)

 def test_08_ast_and_http_smoke_included(self):
  for file in ("nav-05/page.tsx","nav-05/synthetic-communications.tsx",
               "nav-05/communications-fixtures.ts"):
   self.assertIn(file,AST)
  self.assertIn('"/review/interactive/nav-05"',SMOKE)
  self.assertIn("NAV05 fail-closed SSR marker missing",SMOKE)

 def test_09_private_browser_release_gate(self):
  self.assertIn("e2e-shareholder-nav05-review.cjs",RUNNER)
  for marker in ("TTO_NAV05_CHROMIUM_VIEWPORTS=5/5",
                 "TTO_NAV05_CHROMIUM_PASS_SHA=",
                 "NO_HORIZONTAL_OVERFLOW_","SOURCE_LOSS_FAIL_CLOSED_",
                 "ZERO_POST_OR_WRITE_","CANONICAL_10_SUBMENUS_"):
   self.assertIn(marker,BROWSER)
  self.assertIn("TTO_LOOPBACK_E2E",BROWSER)
  self.assertIn("TTO_PHASE4C_EXPECTED_SOURCE_SHA",BROWSER)

if __name__=="__main__":unittest.main()
