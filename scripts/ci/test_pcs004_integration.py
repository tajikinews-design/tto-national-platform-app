"""PCS-004: static compatibility and non-regression controls (not browser/DB E2E)."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def read(path):
    return (ROOT/path).read_text(encoding="utf-8")
class Pcs004(unittest.TestCase):
    def test_nav03_updated_browser_harness_retains_unique_old_safety(self):
        s=read("scripts/e2e-shareholder-nav03-visual-review.cjs")
        for marker in ("DISPUTE_BLOCKS_FINALIZATION","REGISTER_IS_NOT_TRANSFER","COMPLETE_FIXTURE_21_EVENTS","KEYBOARD_ENTER_CASE","NO_EXTERNAL_REQUESTS_"):
            with self.subTest(marker=marker):self.assertIn(marker,s)
    def test_nav04_current_approved_visual_remains_safe(self):
        ui=read("apps/shareholder/app/review/interactive/nav-04/synthetic-assemblies.tsx")
        fix=read("apps/shareholder/app/review/interactive/nav-04/assembly-fixtures.ts")
        for marker in ("DemoSourceState","UNVERIFIED","DEMO_CONTENT","ApprovedVisualOverview"):
            with self.subTest(marker=marker):self.assertIn(marker,ui)
        for marker in ("canVote:false","canCountVotes:false","resultOfficial:false"):
            with self.subTest(marker=marker):self.assertIn(marker,fix)
    def test_current_local_font_uses_no_network(self):
        test=read("scripts/ci/test_vazirmatn_offline_build.py")
        self.assertIn("Vazirmatn[wght].woff2",test)
        for app in ("shareholder","cooperative-management","national-admin"):
            layout=read(f"apps/{app}/app/layout.tsx")
            self.assertIn('next/font/local',layout)
            self.assertNotIn('next/font/google',layout)
    def test_alternative_journal_is_not_live_import(self):
        journal=read("scripts/security/w24-offline-audit-chain.cjs")
        self.assertIn("CI",journal)
        api=read("services/api/src/module.ts")
        self.assertNotIn("w24-durable-synthetic-audit",api)
    def test_review_routes_not_real_trade(self):
        view=read("apps/shareholder/app/review/interactive/nav-03/synthetic-share-market.tsx")
        self.assertIn("disabled",view)
        page=read("apps/shareholder/app/review/interactive/page.tsx")
        self.assertIn("SyntheticDashboard",page)
if __name__=="__main__":unittest.main()
