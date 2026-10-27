"""NAV03 dedicated screenshot/browser test is opt-in and pinned to local review-only docker."""
from pathlib import Path
import re
import unittest
ROOT=Path(__file__).resolve().parents[2]
JS=(ROOT/"scripts/ci/nav03-interactive-browser.cjs").read_text("utf-8")
RUNNER=(ROOT/"scripts/ci/run-review-phase3b-docker.ps1").read_text("utf-8")
SOURCE=(ROOT/"apps/shareholder/app/review/interactive/nav-03/case-demo/synthetic-trade-case.tsx").read_text("utf-8")

class Nav03InteractiveActualBrowserContract(unittest.TestCase):
 def test_01_uses_actual_chromium_and_2_viewports(self):
  self.assertIn('const {chromium}=require("playwright")',JS)
  self.assertIn('width:1440,height:900',JS)
  self.assertIn('width:390,height:844',JS)
  self.assertIn('page.screenshot(',JS)
 def test_02_all_nine_cases(self):
  self.assertEqual(len(re.findall(r'\["DEMO-(?:SELL|BUY)-',JS)),9)
  self.assertIn('caseScreenshotsExpected:cases.length*screens.length',JS)
  self.assertIn('images.length===18',JS)
 def test_03_click_keyboard_a11y_and_filters(self):
  for line in ('await card.click()', 'page.keyboard.press("Enter")',
   'page.locator(".w1t-event details").first()', 'getAttribute("aria-pressed")',
   'page.getByRole("button",{name:"فروش",exact:true})',
   'page.getByRole("button",{name:"خرید",exact:true})',
   'width.scroll<=width.client+2'):
   self.assertIn(line,JS)
 def test_04_payment_dispute_register_and_no_real_transfer(self):
  for line in ('DEMO-BUY-PAID-REPORTED','DEMO-BUY-DISPUTED',
   'DEMO-BUY-REGISTERED','DEMO-BUY-COMPLETED',
   'Finalization باید متوقف بماند',
   'Finalization هنوز کامل نیست','هیچ مالکیت واقعی جابه‌جا نشده'):
   self.assertIn(line,JS)
 def test_05_lock_to_loopback_read_only_and_no_api(self):
  self.assertIn('const BASE="http://127.0.0.1:32155"',JS)
  self.assertIn('u.origin!==BASE',JS)
  self.assertIn('!["GET","HEAD"].includes(r.method())',JS)
  self.assertIn('u.pathname.startsWith("/api/")',JS)
  self.assertIn('await request.abort()',JS)
 def test_06_optin_docker_does_not_change_old_default(self):
  self.assertIn('[switch]$Nav03Interactive',RUNNER)
  self.assertIn('if($Nav03Interactive) {',RUNNER)
  self.assertIn('TTO_PHASE3B_LOCAL_BROWSER_PASS_SHA',RUNNER)
  self.assertIn('TTO_NAV03_BROWSER_VISUAL_INTERACTIVE_PASS_SHA',RUNNER)
  self.assertIn('NODE_PATH=/tmp/tto-browser/node_modules',RUNNER)
 def test_07_requires_exact_sha_and_full_report(self):
  self.assertIn('TTO_REVIEW_EXPECTED_SOURCE_SHA',RUNNER)
  self.assertIn('expectedSha:SHA',JS)
  self.assertIn('$Nav03.expectedSha -cne $ExpectedCommit',RUNNER)
  self.assertIn('$Nav03.screenshots.Count -ne 18',RUNNER)
  self.assertIn('nav03-browser-report.json',JS)
 def test_08_visual_qa_is_not_live_data(self):
  self.assertIn('هیچ پرونده واقعی خوانده یا ذخیره نمی‌شود',SOURCE)
  self.assertIn('همه اقدامات مسدود هستند',SOURCE)
  self.assertNotIn('fetch(',SOURCE)
  self.assertIn('no external/API/mutation requests',JS)
if __name__=="__main__":unittest.main()
