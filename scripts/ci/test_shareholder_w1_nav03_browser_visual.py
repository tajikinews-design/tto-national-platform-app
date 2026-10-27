"""Regression on NAV03 actual browser QA harness, separate from its execution."""
from pathlib import Path
import unittest

R=Path(__file__).resolve().parents[2]
JS=(R/"scripts/e2e-shareholder-nav03-visual-review.cjs").read_text("utf-8")
RUN=(R/"scripts/ci/run-local-docker.ps1").read_text("utf-8")
CSS=(R/"apps/shareholder/app/review/interactive/nav-03/case-demo/case.css").read_text("utf-8")
VIEW=(R/"apps/shareholder/app/review/interactive/nav-03/case-demo/synthetic-trade-case.tsx").read_text("utf-8")

class BrowserVisualPolicy(unittest.TestCase):
 def test_01_strict_private_loopback_and_sha(self):
  for token in ('process.env.CI!=="true"','process.env.TTO_LOOPBACK_E2E!=="1"',
                'TTO_PHASE4C_EXPECTED_SOURCE_SHA','http://127.0.0.1:',
                'process.env.VERCEL','process.env.APIIR_TOKEN'):
   self.assertIn(token,JS)
 def test_02_real_playwright_not_mocked(self):
  for token in ('require("playwright")','chromium.launch','page.goto',
                'page.screenshot','page.on("pageerror"','NO_REACT_BROWSER_ERRORS'):
   self.assertIn(token,JS)
  self.assertNotIn('page.route(',JS)
 def test_03_four_actual_layout_sizes(self):
  for dims in ('width:1440,height:900','width:768,height:1024',
               'width:390,height:844','width:320,height:740'):
   self.assertIn(dims,JS)
  self.assertIn('NO_HORIZONTAL_OVERFLOW',JS)
  self.assertIn('CARD_MIN_WIDTH_',JS)
  self.assertIn('NONEMPTY_RENDER_',JS)
  self.assertIn('shotSha256:',JS)
  self.assertIn('path:join("/workspace/.qa-artifacts"',JS)
 def test_04_keyboard_case_selection_and_filters(self):
  for token in ('KEYBOARD_ENTER_FILTER','KEYBOARD_ENTER_CASE','page.keyboard.press("Enter")',
                'BUY_FILTER_SIX','SELL_FILTER_THREE','DISPUTE_SELECTED',
                'DISPUTE_BLOCKS_FINALIZATION','REGISTER_IS_NOT_TRANSFER',
                'COMPLETE_FIXTURE_21_EVENTS','NO_OPERATIONS_'):
   self.assertIn(token,JS)
 def test_05_defense_and_no_external_requests(self):
  self.assertIn('NO_EXTERNAL_REQUESTS_',JS)
  self.assertIn('NO_REACT_BROWSER_ERRORS_',JS)
  self.assertIn('NO_TRANSFER_DEFAULT_',JS)
  self.assertIn('COMPLETED_MARKED_FICTION',JS)
  self.assertNotIn('DATABASE_URL:',JS)
 def test_06_runner_places_test_after_existing_real_browser(self):
  self.assertIn('node scripts/e2e-shareholder-nav03-visual-review.cjs',RUN)
  self.assertLess(RUN.index('node scripts/e2e-phase4c-real-session-browser.cjs'),
                  RUN.index('node scripts/e2e-shareholder-nav03-visual-review.cjs'))
  self.assertIn('mcr.microsoft.com/playwright:v1.56.1-noble',RUN)
  self.assertIn('TTO_LOCAL_HOST_PORTS=NONE',RUN)
  self.assertIn('TTO_LOCAL_VISUAL_QA_PATH=',RUN)
  self.assertIn('"cp", ($nodeContainer + ":/workspace/.qa-artifacts/" + $commit)',RUN)
 def test_07_fictitious_completion_does_not_signal_approved_ownership(self):
  self.assertIn('never use green approval styling',CSS)
  self.assertIn('w1t-legal-effect:not(.w1t-legal-blocked)',CSS)
  self.assertIn('inset -4px',CSS)
  self.assertIn('هیچ مالکیت واقعی',VIEW)
 def test_08_no_claim_about_review_already_completed(self):
  self.assertIn('TTO_NAV03_CHROMIUM_VISUAL_PASS_SHA=',JS)
  self.assertIn('TTO_NAV03_CHROMIUM_VISUAL_VIEWPORTS=4/4',JS)
  self.assertNotIn('https://',JS)
if __name__=="__main__":unittest.main()
