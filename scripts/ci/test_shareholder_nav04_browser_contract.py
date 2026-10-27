"""Guard NAV04 pure synthetic assembly/election browser regression contract."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
BR=(ROOT/"scripts/ci/nav04-interactive-browser.cjs").read_text("utf-8")
RUN=(ROOT/"scripts/ci/run-review-phase3b-docker.ps1").read_text("utf-8")
MODEL=(ROOT/"apps/shareholder/app/review/interactive/nav-04/governance-fixtures.ts").read_text("utf-8")

class NAV04ActualBrowserContract(unittest.TestCase):
 def test_01_real_playwright_two_viewports_and_ten_captures(self):
  for item in ('require("playwright")','width:1440,height:900','width:390,height:844',
   'page.screenshot({','captures.length===10','expectedScreenshots:10'):
   self.assertIn(item,BR)
 def test_02_no_access_before_explicit_mock(self):
  for item in ('page.locator(".w1a-empty").isVisible()',
   'page.locator(".w1a-items").count()===0',
   'name:"منبع مسدود",exact:true',
   'name:"نمایش نمونه‌های کاملاً ساختگی",exact:true'):
   self.assertIn(item,BR)
 def test_03_verify_five_records_and_keyboard(self):
  self.assertEqual(BR.count('["ASSEMBLY","DEMO-ASM-'),3)
  self.assertEqual(BR.count('["ELECTION","DEMO-ELEC-'),2)
  self.assertIn('page.keyboard.press("Enter")',BR)
  self.assertIn('aria-pressed',BR)
  self.assertIn('await option.click()',BR)
 def test_04_no_api_or_voting_mutation(self):
  for item in ('u.origin!==BASE','!["GET","HEAD"].includes(request.method())',
   'u.pathname.startsWith("/api/")','await entry.abort()',
   'page.locator(".w1a-doc button:not([disabled])").count()===0',
   'page.locator(".w1a-auth")'):
   self.assertIn(item,BR)
  self.assertIn('ballots:"DISABLED"',MODEL)
 def test_05_optin_docker_still_keeps_old_gate(self):
  self.assertIn('[switch]$Nav04Interactive',RUN)
  self.assertIn('if($Nav04Interactive) {',RUN)
  self.assertIn('[switch]$Nav03Interactive',RUN)
  self.assertIn('TTO_PHASE3B_LOCAL_BROWSER_PASS_SHA',RUN)
  self.assertIn('TTO_NAV03_BROWSER_VISUAL_INTERACTIVE_PASS_SHA',RUN)
  self.assertIn('TTO_NAV04_BROWSER_VISUAL_INTERACTIVE_PASS_SHA',RUN)
 def test_06_refuse_unpinned_or_incomplete_visual_evidence(self):
  self.assertIn('TTO_REVIEW_EXPECTED_SOURCE_SHA',RUN)
  self.assertIn('$Nav04.expectedSha -cne $ExpectedCommit',RUN)
  self.assertIn('$Nav04.screenshots.Count -ne 10',RUN)
  self.assertIn('nav04-browser-report.json',BR)
  self.assertIn('no horizontal overflow',BR)
if __name__=="__main__":unittest.main()
