"""Regressions for national root login landing on the main dashboard.

Disallows automatic registration as a login side effect. Source contract tests
are intentionally offline and do not fabricate an authenticated session.
"""
import re
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
LOGIN = ROOT / "apps/national-admin/app/national-root-login.tsx"
HOME = ROOT / "apps/national-admin/app/page.tsx"
DASHBOARD = ROOT / "packages/ui/src/approved-dashboard.tsx"


class NationalLoginHomeNavigationTest(unittest.TestCase):
    def test_successful_login_uses_verified_session_before_dashboard_redirect(self):
        source = LOGIN.read_text(encoding="utf-8")
        self.assertIn('async function verifySession(redirectOnSuccess=false)', source)
        self.assertRegex(source, re.compile(
            r'x\.authenticated===true&&x\.nationalRoot===true.*?'
            r'x\.mustChangeCredentials===false\)\s*\{\s*'
            r'if\(redirectOnSuccess\)window\.location\.replace\("/"\)',
            re.S
        ))
        self.assertIn('await verifySession(true);', source)
        self.assertIn('if(response.status!==200)', source)

    def test_existing_login_shows_dashboard_link_not_creation_link(self):
        source = LOGIN.read_text(encoding="utf-8")
        self.assertIn('href="/">ورود به صفحه اصلی پلتفرم</a>', source)
        self.assertNotIn('href="/cooperatives/new"', source)
        self.assertNotIn('href="/cooperatives/onboarding"', source)
        self.assertIn('async function logout()', source)

    def test_dashboard_is_protected_and_creation_is_explicit_action(self):
        home = HOME.read_text(encoding="utf-8")
        dashboard = DASHBOARD.read_text(encoding="utf-8")
        self.assertIn('PortalSessionGate surface="national"', home)
        self.assertIn('<PortalShell surface="national"/>', home)
        self.assertIn('primaryAction:{label:"مشاهده فهرست تعاونی‌ها",href:"/cooperatives"}', dashboard)


if __name__ == "__main__":
    unittest.main()
